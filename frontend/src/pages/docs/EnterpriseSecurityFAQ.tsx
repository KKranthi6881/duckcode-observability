import { Shield, Lock, Key, Users, Server, AlertCircle, BookOpen } from 'lucide-react';

export default function EnterpriseSecurityFAQ() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-10 lg:py-16">
        {/* Header */}
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <Shield className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">Enterprise</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Enterprise Security & Compliance FAQ
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            This page answers the most common security, identity and product questions from enterprise teams evaluating DuckCode Observability.
          </p>
        </header>

        {/* Quick overview cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="rounded-xl border border-border bg-card/60 p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-md bg-emerald-500/10">
                <Lock className="h-5 w-5 text-emerald-500" />
              </div>
              <h2 className="text-sm font-semibold">Identity & SSO</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              SSO enforcement by domain, password policies, rate limiting and account lockout for high-risk auth flows.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-md bg-sky-500/10">
                <Key className="h-5 w-5 text-sky-500" />
              </div>
              <h2 className="text-sm font-semibold">Keys & Secrets</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              AES-256-GCM encryption for organization API keys, GitHub tokens and webhook secrets.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-md bg-amber-500/10">
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
              <h2 className="text-sm font-semibold">Audit & Monitoring</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Full security audit log for auth, sessions, permissions and suspicious activity, with retention controls.
            </p>
          </div>
        </section>

        {/* FAQ sections */}
        <div className="space-y-10">
          {/* Identity & SSO */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-4 w-4 text-[#2AB7A9]" />
              <h2 className="text-lg font-semibold tracking-tight">1. Identity, Authentication & SSO</h2>
            </div>
            <div className="space-y-4 text-sm md:text-base">
              <FAQItem
                question="What authentication methods are supported?"
                answer={
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Email + password with enterprise password policy.</li>
                    <li>OIDC-based SSO (for providers like Okta or Azure AD).</li>
                    <li>IDE-specific tokens via an OAuth-style flow.</li>
                  </ul>
                }
              />
              <FAQItem
                question="Can we enforce SSO for our corporate domain (e.g. @company.com)?"
                answer={
                  <p className="text-muted-foreground">
                    Yes. We map your corporate domains to an organization and SSO connection. For verified domains, you can enforce that users 
                    must sign in via your IdP, and optionally block password-based login entirely for that domain.
                  </p>
                }
              />
              <FAQItem
                question="How does the SSO flow work technically?"
                answer={
                  <p className="text-muted-foreground">
                    We use OIDC with state, nonce and PKCE to protect against replay and CSRF. Client secrets are stored encrypted and decrypted 
                    only on the backend when talking to your IdP. On callback, we validate tokens and map or just-in-time provision the user into 
                    the correct organization and role.
                  </p>
                }
              />
              <FAQItem
                question="Do you enforce password policy and account lockout?"
                answer={
                  <p className="text-muted-foreground">
                    Yes. Registration and password changes are validated through an enterprise password policy, and login endpoints are rate 
                    limited. Repeated failed attempts trigger account lockout and are captured in the security audit log.
                  </p>
                }
              />
            </div>
          </section>

          {/* Authorization & Roles */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-[#2AB7A9]" />
              <h2 className="text-lg font-semibold tracking-tight">2. Authorization, Organizations & Roles</h2>
            </div>
            <div className="space-y-4 text-sm md:text-base">
              <FAQItem
                question="How is multi-tenant isolation implemented?"
                answer={
                  <p className="text-muted-foreground">
                    Each customer is modeled as an organization with its own users, teams, roles, API keys and connectors. All enterprise tables 
                    are scoped by organization ID, and backend controllers always filter and authorize requests at the organization boundary.
                  </p>
                }
              />
              <FAQItem
                question="What is your authorization model?"
                answer={
                  <p className="text-muted-foreground">
                    We use role-based access control (RBAC). Organization roles define sets of permissions, and backend services call permission 
                    checks before sensitive operations such as API key management or SSO configuration.
                  </p>
                }
              />
              <FAQItem
                question="Can we define custom roles and permissions?"
                answer={
                  <p className="text-muted-foreground">
                    Yes. Organization admins can define custom roles with granular permission strings. New features can expose additional 
                    permissions over time without changing the underlying model.
                  </p>
                }
              />
            </div>
          </section>

          {/* Keys & Secrets */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Key className="h-4 w-4 text-[#2AB7A9]" />
              <h2 className="text-lg font-semibold tracking-tight">3. API Keys, Secrets & Integrations</h2>
            </div>
            <div className="space-y-4 text-sm md:text-base">
              <FAQItem
                question="How are organization API keys stored?"
                answer={
                  <p className="text-muted-foreground">
                    API keys are encrypted at rest using AES-256-GCM with keys derived from secure environment secrets. The database stores only 
                    ciphertext plus IV and authentication tag; only backend services can decrypt them at runtime.
                  </p>
                }
              />
              <FAQItem
                question="Can admins view the full API key?"
                answer={
                  <p className="text-muted-foreground">
                    In the UI we show masked keys by default. Admin-only operations can temporarily decrypt a key for one-time display, gated by 
                    role-based permissions.
                  </p>
                }
              />
              <FAQItem
                question="How are GitHub tokens and webhook secrets handled?"
                answer={
                  <p className="text-muted-foreground">
                    GitHub tokens are validated and stored encrypted using the same AES-256-GCM service. Webhook secrets are generated from 
                    cryptographically secure random bytes, stored encrypted, and used only server-side to verify incoming requests.
                  </p>
                }
              />
            </div>
          </section>

          {/* Sessions & IDE */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Server className="h-4 w-4 text-[#2AB7A9]" />
              <h2 className="text-lg font-semibold tracking-tight">4. Sessions, IDE Access & Device Security</h2>
            </div>
            <div className="space-y-4 text-sm md:text-base">
              <FAQItem
                question="How are web sessions managed?"
                answer={
                  <p className="text-muted-foreground">
                    After login we issue a JWT and set an httpOnly cookie with secure and same-site flags in production. This protects tokens 
                    from direct JavaScript access and mitigates common XSS/XSRF vectors.
                  </p>
                }
              />
              <FAQItem
                question="How do IDE tokens differ from web sessions?"
                answer={
                  <p className="text-muted-foreground">
                    IDE flows use a short-lived authorization code, exchanged for a dedicated IDE session token and refresh token stored in an 
                    IDE sessions table. Sessions include expiry and device/IP metadata and can be individually or globally revoked.
                  </p>
                }
              />
              <FAQItem
                question="Do you detect suspicious session activity?"
                answer={
                  <p className="text-muted-foreground">
                    Yes. We monitor for patterns such as many concurrent sessions from different IPs or rapid session creation. When detected, 
                    we log a critical suspicious activity event with full context in the security audit log.
                  </p>
                }
              />
            </div>
          </section>

          {/* Audit & Snowflake */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-4 w-4 text-[#2AB7A9]" />
              <h2 className="text-lg font-semibold tracking-tight">5. Audit Logging & Snowflake Security</h2>
            </div>
            <div className="space-y-4 text-sm md:text-base">
              <FAQItem
                question="What security events do you log?"
                answer={
                  <p className="text-muted-foreground">
                    We log authentication, session lifecycle, authorization failures, rate limit violations, CSRF/state mismatches, API key 
                    lifecycle events and higher-risk security signals such as suspicious activity. Logs are written to a dedicated security 
                    audit log table.
                  </p>
                }
              />
              <FAQItem
                question="How long are security logs retained?"
                answer={
                  <p className="text-muted-foreground">
                    By default, we retain security events for 90 days before a scheduled job purges older entries. This window can be adjusted in 
                    deployment-specific configuration if your compliance needs require longer retention.
                  </p>
                }
              />
              <FAQItem
                question="What do you analyze from Snowflake for security?"
                answer={
                  <p className="text-muted-foreground">
                    Our Snowflake security services focus on metadata and ACCOUNT_USAGE views such as login history, grants to users and roles, 
                    network policies and access history. We derive alerts around MFA gaps, failed logins, over-privileged roles and stale users 
                    without copying full business datasets.
                  </p>
                }
              />
            </div>
          </section>

          {/* Data handling & next steps */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="h-4 w-4 text-[#2AB7A9]" />
              <h2 className="text-lg font-semibold tracking-tight">6. Data Handling, Residency & Next Steps</h2>
            </div>
            <div className="space-y-4 text-sm md:text-base">
              <FAQItem
                question="Where is data stored and what do you keep?"
                answer={
                  <p className="text-muted-foreground">
                    DuckCode uses a Postgres database (via Supabase) and Node.js backend. We primarily store user and organization metadata, 
                    encrypted secrets, observability metadata (lineage, cost and security metrics), AI-generated documentation summaries and 
                    security audit events. Exact regions and retention can be tailored to your deployment.
                  </p>
                }
              />
              <FAQItem
                question="How can we run a deeper security review?"
                answer={
                  <p className="text-muted-foreground">
                    We can provide architecture diagrams, data flow descriptions and more detailed configuration notes (regions, backup policies, 
                    SLAs) as part of your security or vendor assessment. Use this FAQ as a first pass, then contact us for a tailored package.
                  </p>
                }
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

interface FAQItemProps {
  question: string;
  answer: JSX.Element;
}

function FAQItem({ question, answer }: FAQItemProps) {
  return (
    <div className="rounded-lg border border-border bg-card/80 p-4">
      <h3 className="text-sm md:text-base font-semibold mb-2">{question}</h3>
      {answer}
    </div>
  );
}
