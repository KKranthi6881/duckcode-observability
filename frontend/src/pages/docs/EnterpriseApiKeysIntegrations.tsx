import { Key, Shield, Github } from 'lucide-react';

export default function EnterpriseApiKeysIntegrations() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-10 lg:py-16">
        {/* Header */}
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <Key className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">API Keys & Integrations</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            API Keys & Integrations Guide
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            Learn how to issue, secure and manage organization-level API keys and external integration tokens in DuckCode.
          </p>
        </header>

        <div className="space-y-10 text-sm md:text-base">
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">1. Organization API Keys</h2>
            <p className="text-muted-foreground mb-3">
              Organization API keys provide programmatic access to DuckCode APIs and are scoped to a single tenant. They are ideal for CI/CD
              pipelines, scheduled jobs or internal tools.
            </p>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm text-muted-foreground">
              <ul className="list-disc list-inside space-y-1">
                <li>API keys are created and managed from the admin portal under the API Keys section.</li>
                <li>Each key is tied to a provider and carries a masked representation for display.</li>
                <li>Key status can be updated (active, inactive, revoked, expired) to control usage over time.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">2. Encryption & Storage</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm text-muted-foreground">
              <ul className="list-disc list-inside space-y-1">
                <li>Raw API keys are never stored in plain text.</li>
                <li>Keys are encrypted with AES-256-GCM using secrets derived from environment variables.</li>
                <li>The database stores only ciphertext, initialization vector (IV) and authentication tag.</li>
                <li>Only backend services with access to the encryption key material can decrypt keys at runtime.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">3. Using API Keys Safely</h2>
            <p className="text-muted-foreground mb-3">
              Treat organization API keys as highly sensitive credentials and follow these operational patterns:
            </p>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm text-muted-foreground">
              <ul className="list-disc list-inside space-y-1">
                <li>Store keys in a secure secrets manager (HashiCorp Vault, AWS Secrets Manager, etc.).</li>
                <li>Scope each key to a single use case (e.g. CI pipeline, data sync job) and rotate regularly.</li>
                <li>Never embed keys directly in source code or share them in logs, screenshots or chat.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">4. GitHub & Repository Integrations</h2>
            <p className="text-muted-foreground mb-3">
              For repository-based features (such as code intelligence or documentation), DuckCode uses GitHub tokens or similar repository
              access credentials.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm text-muted-foreground">
              <div className="rounded-lg border border-border bg-card/80 p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Github className="h-4 w-4 text-[#2AB7A9]" />
                  Token handling
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>GitHub personal access tokens are validated for expected formats before acceptance.</li>
                  <li>Tokens are then encrypted using the same AES-256-GCM service as other secrets.</li>
                  <li>Decryption happens only when the backend calls GitHub APIs on your behalf.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card/80 p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#2AB7A9]" />
                  Recommended practices
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Use fine-grained tokens when available and limit scopes to only what DuckCode needs.</li>
                  <li>Rotate repository tokens on a regular schedule and on every incident or suspected leak.</li>
                  <li>Monitor GitHub for unusual token usage patterns alongside DuckCode audit logs.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">5. Webhooks & Outbound Integrations</h2>
            <p className="text-muted-foreground mb-3">
              When DuckCode sends events to your systems (for example, for incident alerts), webhook endpoints are authenticated with
              shared secrets.
            </p>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm text-muted-foreground">
              <ul className="list-disc list-inside space-y-1">
                <li>Webhook secrets are generated from secure random bytes.</li>
                <li>Secrets are encrypted before being stored and decrypted only to sign outgoing requests.</li>
                <li>We recommend validating signatures on your side and rotating webhook secrets periodically.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">6. Auditing & Governance</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm text-muted-foreground">
              <ul className="list-disc list-inside space-y-1">
                <li>Creation, rotation and revocation of keys are logged to the security audit log.</li>
                <li>Access to API key management is governed by RBAC permissions.</li>
                <li>Periodic reviews of keys and their usage are recommended for strong governance.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
