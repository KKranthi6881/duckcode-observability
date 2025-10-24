# Webhook Architecture for SaaS Product

## Problem Statement
In a SaaS product, users don't have access to `.env` files. Webhook secrets must be managed through the UI and stored per-organization in the database.

---

## Solution: Per-Organization Webhook Management

### Architecture Overview
```
┌─────────────────────────────────────────┐
│  User's Admin Panel                     │
│  ┌────────────────────────────────┐    │
│  │ Webhook Configuration          │    │
│  │                                │    │
│  │ GitHub Webhook Secret:         │    │
│  │ [abc123...xyz] 📋 Copy        │    │
│  │ [Regenerate]                   │    │
│  │                                │    │
│  │ GitLab Webhook Token:          │    │
│  │ [def456...uvw] 📋 Copy        │    │
│  │ [Regenerate]                   │    │
│  │                                │    │
│  │ Webhook URL:                   │    │
│  │ https://api.duck.ai/webhooks/  │    │
│  │ github/{org_id}                │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Database (Encrypted Storage)           │
│  enterprise.webhook_configurations      │
│  - organization_id                      │
│  - github_secret (encrypted)            │
│  - gitlab_token (encrypted)             │
│  - created_at, updated_at               │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Webhook Validation                     │
│  1. Receive webhook                     │
│  2. Extract organization_id from URL    │
│  3. Fetch secret from database          │
│  4. Validate signature                  │
│  5. Process if valid                    │
└─────────────────────────────────────────┘
```

---

## Database Schema Update

### New Table: webhook_configurations
```sql
CREATE TABLE enterprise.webhook_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) UNIQUE,
  
  -- Webhook secrets (encrypted at rest)
  github_secret TEXT, -- Encrypted
  github_secret_iv TEXT, -- Initialization vector for encryption
  gitlab_token TEXT, -- Encrypted
  gitlab_token_iv TEXT,
  
  -- Webhook URLs (for user reference)
  github_webhook_url TEXT GENERATED ALWAYS AS (
    'https://' || current_setting('app.domain', true) || '/api/webhooks/github/' || organization_id
  ) STORED,
  gitlab_webhook_url TEXT GENERATED ALWAYS AS (
    'https://' || current_setting('app.domain', true) || '/api/webhooks/gitlab/' || organization_id
  ) STORED,
  
  -- Metadata
  github_secret_created_at TIMESTAMPTZ,
  gitlab_token_created_at TIMESTAMPTZ,
  last_github_webhook_at TIMESTAMPTZ,
  last_gitlab_webhook_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_org_webhook UNIQUE(organization_id)
);

-- Indexes
CREATE INDEX idx_webhook_configs_org ON enterprise.webhook_configurations(organization_id);

-- RLS Policies (users can only see their org's config)
ALTER TABLE enterprise.webhook_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_config_org_policy ON enterprise.webhook_configurations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM enterprise.user_organization_roles 
      WHERE user_id = auth.uid()
    )
  );
```

---

## Backend Implementation

### 1. Webhook Secret Service
```typescript
// backend/src/services/webhook/WebhookSecretService.ts
import crypto from 'crypto';
import { supabaseAdmin } from '../../config/supabase';

export class WebhookSecretService {
  private encryptionKey: Buffer;

  constructor() {
    // Use a master encryption key from environment
    const key = process.env.WEBHOOK_ENCRYPTION_KEY;
    if (!key) throw new Error('WEBHOOK_ENCRYPTION_KEY not configured');
    this.encryptionKey = Buffer.from(key, 'hex');
  }

  /**
   * Generate a new webhook secret
   */
  generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Encrypt a secret for database storage
   */
  private encrypt(text: string): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return {
      encrypted,
      iv: iv.toString('hex')
    };
  }

  /**
   * Decrypt a secret from database
   */
  private decrypt(encrypted: string, ivHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Get or create webhook configuration for organization
   */
  async getOrCreateConfig(organizationId: string): Promise<{
    githubSecret: string;
    gitlabToken: string;
    githubWebhookUrl: string;
    gitlabWebhookUrl: string;
  }> {
    // Try to get existing config
    const { data: existing } = await supabaseAdmin
      .schema('enterprise')
      .from('webhook_configurations')
      .select('*')
      .eq('organization_id', organizationId)
      .single();

    if (existing) {
      // Decrypt existing secrets
      return {
        githubSecret: existing.github_secret 
          ? this.decrypt(existing.github_secret, existing.github_secret_iv)
          : '',
        gitlabToken: existing.gitlab_token
          ? this.decrypt(existing.gitlab_token, existing.gitlab_token_iv)
          : '',
        githubWebhookUrl: existing.github_webhook_url,
        gitlabWebhookUrl: existing.gitlab_webhook_url
      };
    }

    // Create new secrets
    const githubSecret = this.generateSecret();
    const gitlabToken = this.generateSecret();

    const githubEncrypted = this.encrypt(githubSecret);
    const gitlabEncrypted = this.encrypt(gitlabToken);

    // Store in database
    await supabaseAdmin
      .schema('enterprise')
      .from('webhook_configurations')
      .insert({
        organization_id: organizationId,
        github_secret: githubEncrypted.encrypted,
        github_secret_iv: githubEncrypted.iv,
        gitlab_token: gitlabEncrypted.encrypted,
        gitlab_token_iv: gitlabEncrypted.iv,
        github_secret_created_at: new Date().toISOString(),
        gitlab_token_created_at: new Date().toISOString()
      });

    const domain = process.env.BACKEND_URL || 'https://api.duck.ai';
    
    return {
      githubSecret,
      gitlabToken,
      githubWebhookUrl: `${domain}/api/webhooks/github/${organizationId}`,
      gitlabWebhookUrl: `${domain}/api/webhooks/gitlab/${organizationId}`
    };
  }

  /**
   * Regenerate a secret
   */
  async regenerateSecret(
    organizationId: string,
    provider: 'github' | 'gitlab'
  ): Promise<string> {
    const newSecret = this.generateSecret();
    const encrypted = this.encrypt(newSecret);

    if (provider === 'github') {
      await supabaseAdmin
        .schema('enterprise')
        .from('webhook_configurations')
        .update({
          github_secret: encrypted.encrypted,
          github_secret_iv: encrypted.iv,
          github_secret_created_at: new Date().toISOString()
        })
        .eq('organization_id', organizationId);
    } else {
      await supabaseAdmin
        .schema('enterprise')
        .from('webhook_configurations')
        .update({
          gitlab_token: encrypted.encrypted,
          gitlab_token_iv: encrypted.iv,
          gitlab_token_created_at: new Date().toISOString()
        })
        .eq('organization_id', organizationId);
    }

    return newSecret;
  }

  /**
   * Get secret for webhook validation (used by webhook controller)
   */
  async getSecretForValidation(
    organizationId: string,
    provider: 'github' | 'gitlab'
  ): Promise<string | null> {
    const { data } = await supabaseAdmin
      .schema('enterprise')
      .from('webhook_configurations')
      .select('*')
      .eq('organization_id', organizationId)
      .single();

    if (!data) return null;

    if (provider === 'github' && data.github_secret) {
      return this.decrypt(data.github_secret, data.github_secret_iv);
    }
    
    if (provider === 'gitlab' && data.gitlab_token) {
      return this.decrypt(data.gitlab_token, data.gitlab_token_iv);
    }

    return null;
  }
}
```

### 2. Updated Webhook Controller
```typescript
// backend/src/api/controllers/webhook.controller.ts

export class WebhookController {
  private orchestrator: ExtractionOrchestrator;
  private secretService: WebhookSecretService;

  constructor(orchestrator: ExtractionOrchestrator) {
    this.orchestrator = orchestrator;
    this.secretService = new WebhookSecretService();
  }

  /**
   * Updated GitHub webhook handler - uses org-specific secret
   * POST /api/webhooks/github/:organizationId
   */
  async handleGitHubWebhook(req: Request, res: Response) {
    try {
      const organizationId = req.params.organizationId;
      const signature = req.headers['x-hub-signature-256'] as string;
      const event = req.headers['x-github-event'] as string;
      const payload = req.body;

      console.log(`📨 Received GitHub webhook for org: ${organizationId}`);

      // Get organization-specific secret from database
      const secret = await this.secretService.getSecretForValidation(
        organizationId,
        'github'
      );

      if (!secret) {
        console.warn('⚠️  No webhook secret configured for organization');
        return res.status(400).json({ 
          error: 'Webhook not configured. Please set up webhooks in Admin Panel.' 
        });
      }

      // Verify signature using org-specific secret
      if (!this.verifyGitHubSignature(payload, signature, secret)) {
        console.warn('⚠️  Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // ... rest of the handling logic
    } catch (error: any) {
      console.error('❌ Webhook processing failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  private verifyGitHubSignature(
    payload: any,
    signature: string,
    secret: string
  ): boolean {
    if (!signature) return false;

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  }
}
```

### 3. API Endpoints for Webhook Management
```typescript
// backend/src/api/controllers/webhook-config.controller.ts

export class WebhookConfigController {
  private secretService: WebhookSecretService;

  constructor() {
    this.secretService = new WebhookSecretService();
  }

  /**
   * Get webhook configuration for organization
   * GET /api/webhook-config/:organizationId
   */
  async getConfig(req: Request, res: Response) {
    try {
      const organizationId = req.params.organizationId;
      const userId = req.user.id;

      // Verify user is admin of this organization
      const isAdmin = await this.verifyOrgAdmin(userId, organizationId);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const config = await this.secretService.getOrCreateConfig(organizationId);

      return res.json({
        success: true,
        config: {
          github: {
            secret: config.githubSecret,
            webhookUrl: config.githubWebhookUrl
          },
          gitlab: {
            token: config.gitlabToken,
            webhookUrl: config.gitlabWebhookUrl
          }
        }
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Regenerate webhook secret
   * POST /api/webhook-config/:organizationId/regenerate
   */
  async regenerateSecret(req: Request, res: Response) {
    try {
      const organizationId = req.params.organizationId;
      const { provider } = req.body; // 'github' or 'gitlab'
      const userId = req.user.id;

      const isAdmin = await this.verifyOrgAdmin(userId, organizationId);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const newSecret = await this.secretService.regenerateSecret(
        organizationId,
        provider
      );

      return res.json({
        success: true,
        message: 'Secret regenerated successfully',
        newSecret,
        warning: 'Update your webhook configuration in GitHub/GitLab with the new secret'
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
```

---

## Frontend Implementation

### Admin Panel: Webhook Configuration Page
```tsx
// frontend/src/pages/admin/WebhookConfiguration.tsx

export function WebhookConfiguration() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const orgId = await getOrganizationId(session.user.id);

    const response = await fetch(`/api/webhook-config/${orgId}`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    });

    const result = await response.json();
    setConfig(result.config);
    setLoading(false);
  };

  const handleRegenerate = async (provider: 'github' | 'gitlab') => {
    if (!confirm(`Regenerate ${provider} secret? This will break existing webhooks.`)) {
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const orgId = await getOrganizationId(session.user.id);

    await fetch(`/api/webhook-config/${orgId}/regenerate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider })
    });

    fetchConfig();
    alert('Secret regenerated! Update your webhook configuration.');
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Webhook Configuration</h1>
      
      {/* GitHub Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Github className="w-6 h-6" />
          <h2 className="text-xl font-semibold">GitHub Webhooks</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Webhook URL</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={config.github.webhookUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(config.github.webhookUrl, 'github-url')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                {copiedField === 'github-url' ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Secret</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={config.github.secret}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(config.github.secret, 'github-secret')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                {copiedField === 'github-secret' ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          </div>

          <button
            onClick={() => handleRegenerate('github')}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            🔄 Regenerate Secret
          </button>

          <div className="mt-4 p-4 bg-blue-50 rounded-md">
            <h3 className="font-medium text-blue-900 mb-2">Setup Instructions:</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Go to your GitHub repository → Settings → Webhooks</li>
              <li>Click "Add webhook"</li>
              <li>Paste the Webhook URL above</li>
              <li>Paste the Secret above</li>
              <li>Select "Just the push event"</li>
              <li>Click "Add webhook"</li>
            </ol>
          </div>
        </div>
      </div>

      {/* GitLab Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <GitlabIcon className="w-6 h-6" />
          <h2 className="text-xl font-semibold">GitLab Webhooks</h2>
        </div>
        
        {/* Similar structure as GitHub */}
      </div>
    </div>
  );
}
```

---

## Key Differences from Original Design

### ❌ Original (Not SaaS-Ready):
```
- Single GITHUB_WEBHOOK_SECRET in .env
- Users can't configure webhooks
- Not multi-tenant
- Manual setup required
```

### ✅ Updated (SaaS-Ready):
```
- Per-organization secrets in database
- UI for users to view/manage secrets
- Encrypted storage
- Auto-generation on first use
- Self-service webhook setup
- Multi-tenant ready
```

---

## Environment Variables (Only One Needed!)

```bash
# Master encryption key (32 bytes hex)
WEBHOOK_ENCRYPTION_KEY=your-master-encryption-key
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Your API domain (for webhook URL generation)
BACKEND_URL=https://api.duck.ai
```

---

## Summary

### SaaS Architecture:
1. ✅ **Per-organization secrets** stored in database
2. ✅ **UI for users** to view/copy/regenerate secrets
3. ✅ **Encrypted storage** (AES-256)
4. ✅ **Auto-generation** on first access
5. ✅ **Self-service** setup (no manual intervention)
6. ✅ **Multi-tenant** ready
7. ✅ **Secure** (only master key in .env)

### User Experience:
```
User → Admin Panel → Webhook Configuration →
  See secrets →
  Copy to clipboard →
  Paste into GitHub/GitLab →
  Done! ✅
```

**This is the production-ready SaaS approach!** 🎯
