# Phase 6: Security & RBAC

## 🎯 Objective
Implement enterprise-grade security with role-based access control, audit logging, and data isolation for multi-tenant environment.

## 🔐 Security Layers

### 1. Authentication
**Current**: OAuth with JWT tokens ✅

**Enhancements**:
- Multi-factor authentication (MFA)
- SSO integration (SAML, OIDC)
- Session timeout policies
- Device management
- IP whitelisting

### 2. Authorization (RBAC)

#### Role Hierarchy
```
Organization Admin
  └─ Can manage everything in organization
  
Team Admin
  └─ Can manage assigned teams and members
  
Connector Admin
  └─ Can manage connectors and API keys
  
Data Steward
  └─ Can edit metadata, add descriptions
  
Analyst
  └─ Can view metadata, run queries
  
Viewer
  └─ Read-only access
```

#### Permission Model
```typescript
interface Permission {
  resource: string; // 'organizations', 'teams', 'connectors', 'metadata'
  action: string;   // 'create', 'read', 'update', 'delete'
  scope: string;    // 'organization', 'team', 'own'
}

// Example permissions for Analyst role
const analystPermissions: Permission[] = [
  { resource: 'metadata', action: 'read', scope: 'organization' },
  { resource: 'connectors', action: 'read', scope: 'organization' },
  { resource: 'teams', action: 'read', scope: 'team' },
];
```

### 3. Row-Level Security (RLS)

#### Supabase RLS Policies
```sql
-- Users only see their organization's data
CREATE POLICY "org_isolation" ON metadata.objects
  FOR ALL
  USING (organization_id IN (
    SELECT organization_id 
    FROM enterprise.user_organization_roles 
    WHERE user_id = auth.uid()
  ));

-- Team-based access
CREATE POLICY "team_access" ON metadata.objects
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM enterprise.team_members tm
      JOIN enterprise.teams t ON tm.team_id = t.id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Admins can see everything in their org
CREATE POLICY "admin_full_access" ON metadata.objects
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM enterprise.user_organization_roles uor
      JOIN enterprise.organization_roles r ON uor.role_id = r.id
      WHERE uor.user_id = auth.uid()
        AND uor.organization_id = objects.organization_id
        AND r.name = 'Admin'
    )
  );
```

### 4. API Key Security

#### Encryption at Rest
```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte key
const ALGORITHM = 'aes-256-gcm';

export function encryptApiKey(apiKey: string): EncryptedData {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export function decryptApiKey(encryptedData: EncryptedData): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

#### Key Rotation
```typescript
async function rotateApiKey(
  organizationId: string,
  oldKeyId: string,
  newApiKey: string
): Promise<void> {
  // Mark old key as inactive
  await supabase
    .from('organization_api_keys')
    .update({ status: 'inactive' })
    .eq('id', oldKeyId);
  
  // Create new key
  await supabase
    .from('organization_api_keys')
    .insert({
      organization_id: organizationId,
      encrypted_key: encryptApiKey(newApiKey),
      status: 'active',
      created_at: new Date(),
    });
  
  // Log rotation event
  await auditLog({
    organization_id: organizationId,
    action: 'api_key_rotated',
    metadata: { old_key_id: oldKeyId },
  });
}
```

### 5. Audit Logging

#### Audit Events Table
```sql
CREATE TABLE enterprise.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES enterprise.organizations(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org ON enterprise.audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON enterprise.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON enterprise.audit_logs(action);
```

#### Audit Service
```typescript
class AuditLogService {
  async logEvent(event: AuditEvent): Promise<void> {
    await supabase.from('audit_logs').insert({
      organization_id: event.organizationId,
      user_id: event.userId,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
      metadata: event.metadata,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
    });
  }
  
  async getOrganizationLogs(
    organizationId: string,
    filters?: AuditLogFilters
  ): Promise<AuditLog[]> {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    
    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  }
}
```

#### Events to Log
- User authentication (login, logout, failed attempts)
- User management (invite, add, remove, role change)
- Team management (create, update, delete)
- Connector operations (add, update, delete, sync)
- API key operations (create, rotate, delete)
- Metadata access (view, search, export)
- Settings changes
- Permission changes

### 6. Data Isolation

#### Multi-Tenancy Strategy
```typescript
// Middleware to enforce organization context
export async function requireOrganization(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.user?.id;
  const organizationId = req.params.organizationId || req.query.organizationId;
  
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' });
  }
  
  // Verify user has access to this organization
  const hasAccess = await checkUserOrganizationAccess(userId, organizationId);
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to this organization' });
  }
  
  // Add organization to request context
  req.organizationId = organizationId;
  next();
}
```

### 7. Rate Limiting

#### API Rate Limits
```typescript
import rateLimit from 'express-rate-limit';

// Per organization limits
const organizationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each org to 1000 requests per window
  keyGenerator: (req) => req.organizationId,
  message: 'Too many requests from this organization',
});

// Per user limits (stricter)
const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.user?.id,
  message: 'Too many requests from this user',
});
```

### 8. Input Validation

#### Schema Validation
```typescript
import { z } from 'zod';

const createConnectorSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['github', 'snowflake', 'bigquery', /* ... */]),
  config: z.object({
    // Type-specific validation
  }),
});

// Use in API endpoints
app.post('/api/connectors', async (req, res) => {
  try {
    const validatedData = createConnectorSchema.parse(req.body);
    // Proceed with validated data
  } catch (error) {
    return res.status(400).json({ error: error.errors });
  }
});
```

### 9. SQL Injection Prevention

#### Parameterized Queries
```typescript
// ✅ Good - use parameterized queries
const { data } = await supabase
  .from('objects')
  .select('*')
  .eq('name', userInput); // Safe

// ❌ Bad - string concatenation
const query = `SELECT * FROM objects WHERE name = '${userInput}'`; // Unsafe
```

## 🛡️ Security Checklist

### Authentication
- [ ] MFA enabled for admin accounts
- [ ] SSO integration configured
- [ ] Session timeout enforced (configurable)
- [ ] Failed login attempt tracking
- [ ] Account lockout after N failed attempts
- [ ] IP whitelisting support

### Authorization
- [ ] RBAC implemented with granular permissions
- [ ] RLS policies active on all tables
- [ ] Admin actions require elevated permissions
- [ ] API endpoints validate user permissions

### Data Security
- [ ] API keys encrypted at rest
- [ ] Sensitive data never logged
- [ ] HTTPS enforced on all endpoints
- [ ] Database connections use SSL/TLS
- [ ] Secrets stored in vault (not code)

### Audit & Compliance
- [ ] All admin actions logged
- [ ] Audit logs tamper-proof
- [ ] Audit log retention policy defined
- [ ] Audit log export functionality
- [ ] GDPR compliance measures

### Network Security
- [ ] Rate limiting on all APIs
- [ ] DDoS protection enabled
- [ ] CORS properly configured
- [ ] CSP headers set
- [ ] SQL injection protection

## ✅ Acceptance Criteria

- [ ] RBAC enforces permissions correctly
- [ ] RLS prevents cross-organization data access
- [ ] API keys encrypted and rotatable
- [ ] All security events logged to audit table
- [ ] Rate limiting prevents abuse
- [ ] Input validation prevents injection attacks
- [ ] Security tests pass (penetration testing)
- [ ] SOC 2 compliance requirements met

## 🔍 Security Testing

### Penetration Testing
- Test for SQL injection
- Test for XSS vulnerabilities
- Test authorization bypass attempts
- Test data exfiltration scenarios
- Test API abuse/DoS

### Automated Security Scans
- OWASP ZAP
- Snyk for dependency vulnerabilities
- SonarQube for code quality

## 📚 Compliance

### SOC 2 Type II
- Access controls documented
- Audit logging comprehensive
- Incident response plan
- Data encryption at rest and in transit
- Regular security reviews

### GDPR
- Data subject access requests
- Right to be forgotten
- Data export functionality
- Consent management
- Data retention policies
