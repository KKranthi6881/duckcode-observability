import { Lock, Shield, Globe2, Mail, Settings } from 'lucide-react';

export default function EnterpriseSSOManagement() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-10 lg:py-16">
        {/* Header */}
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <Lock className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">SSO</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            SSO Management Guide
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            Configure and operate enterprise SSO for DuckCode using providers such as Okta or Azure AD, with domain-level enforcement.
          </p>
        </header>

        <div className="space-y-10 text-sm md:text-base">
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">1. Prerequisites</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm text-muted-foreground">
              <ul className="list-disc list-inside space-y-1">
                <li>An enterprise identity provider (IdP) such as Okta or Azure AD.</li>
                <li>Permissions in your IdP to register a new OIDC/OAuth application.</li>
                <li>The DuckCode backend callback URL that your instance is configured with.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">2. Creating an SSO Connection</h2>
            <p className="text-muted-foreground mb-3">
              SSO connections represent a binding between your organization and an OIDC identity provider. Each connection stores metadata
              such as issuer URL, client ID and whether SSO is enforced.
            </p>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm text-muted-foreground">
              <ol className="list-decimal list-inside space-y-1">
                <li>Open the admin portal and navigate to the SSO section.</li>
                <li>Create a new SSO connection and choose your provider type (Okta, Azure, etc.).</li>
                <li>Fill issuer URL, authorization URL, token URL and JWKS URL as instructed by your IdP.</li>
                <li>Enter the client ID and client secret from your IdP application.</li>
                <li>Optionally choose a default role to assign to just-in-time provisioned users.</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">3. Verifying Email Domains</h2>
            <p className="text-muted-foreground mb-3">
              To enforce SSO for specific domains (for example <code>@company.com</code>), DuckCode maps domains to organizations and
              connections through domain records.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm text-muted-foreground">
              <div className="rounded-lg border border-border bg-card/80 p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-[#2AB7A9]" />
                  Domain configuration
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Add verified email domains (e.g. <code>company.com</code>) to your organization.</li>
                  <li>Associate each domain with the appropriate SSO connection.</li>
                  <li>Only verified domains are considered for SSO enforcement and routing.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card/80 p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#2AB7A9]" />
                  Runtime behavior
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>On login or sign-up, the backend derives the email domain and looks up a matching verified domain record.</li>
                  <li>If a matching domain and connection exist, SSO rules (enforced or fallback) are applied.</li>
                  <li>If no SSO configuration is found, normal email/password flows are used.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">4. Enforcing SSO vs Password Fallback</h2>
            <p className="text-muted-foreground mb-3">
              Each SSO connection allows you to decide how strict enforcement should be for users on mapped domains:
            </p>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm text-muted-foreground">
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <span className="font-medium text-foreground">Enforce SSO</span> – when enabled, the system prefers SSO flows for matching domains.
                </li>
                <li>
                  <span className="font-medium text-foreground">Allow password fallback</span> – when disabled, password-based login and registration are blocked
                  for those domains and an <code>sso_required</code> error is returned.
                </li>
                <li>
                  This behavior is implemented entirely on the backend and logged via the security audit log for traceability.
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">5. Security Characteristics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm text-muted-foreground">
              <div className="rounded-lg border border-border bg-card/80 p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#2AB7A9]" />
                  OIDC best practices
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Uses state and nonce parameters to protect against CSRF and replay attacks.</li>
                  <li>Uses PKCE (code verifier/challenge) when exchanging authorization codes.</li>
                  <li>Validates tokens and issuer configuration on the backend only.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card/80 p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-[#2AB7A9]" />
                  Operational guidance
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Restrict SSO configuration access to a small set of trusted org admins.</li>
                  <li>Use domain-based enforcement for all corporate domains; allow fallback only for special cases.</li>
                  <li>Review audit logs periodically to confirm SSO rules are operating as expected.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
