import { Shield, Database, AlertTriangle } from 'lucide-react';

export default function EnterpriseSnowflakeSecurityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-10 lg:py-16">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <Shield className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">Enterprise · Snowflake Security</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Snowflake Security Overview</h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            How DuckCode connects to your Snowflake account, which security signals it reads, and how those insights are used to
            surface security posture, misconfigurations and risk.
          </p>
        </header>

        <div className="space-y-8 text-sm md:text-base text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">1. Scope of Access</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 mb-2 text-foreground">
                <Database className="h-4 w-4 text-[#2AB7A9]" />
                <span className="font-semibold">Principle of least privilege</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  DuckCode is typically granted read access to <code>ACCOUNT_USAGE</code> and selected metadata views required for
                  lineage, cost and security analytics.
                </li>
                <li>
                  Object-level data access is only required where you explicitly want column-level lineage or documentation; you can
                  restrict access to sensitive schemas.
                </li>
                <li>
                  We recommend using a dedicated Snowflake role for DuckCode so you can fully audit and rotate its permissions.
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">2. Security Signals Collected</h2>
            <p className="mb-3">
              Depending on configuration, DuckCode can read the following classes of security-relevant data from Snowflake:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-medium text-foreground">Login & session history</span> – failed logins, IPs, MFA status
                and client types.
              </li>
              <li>
                <span className="font-medium text-foreground">Users, roles & grants</span> – who exists, who is active and which
                privileges and roles they hold.
              </li>
              <li>
                <span className="font-medium text-foreground">Network & policies</span> – network policies, allowed IP ranges and
                session parameters relevant to security.
              </li>
              <li>
                <span className="font-medium text-foreground">Access patterns</span> – which objects are being queried, by whom,
                and from where, to detect anomalies and over-privileged access.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">3. Derived Insights & Alerts</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 mb-2 text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="font-semibold">Examples of surfaced issues</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>Users without MFA or with stale passwords (where available from Snowflake metadata).</li>
                <li>Roles with powerful privileges (e.g. account admin) granted to inactive or low-activity users.</li>
                <li>Unusual login sources, repeated failed logins or access from unexpected regions.</li>
                <li>Over-privileged service accounts or roles with broad grants across databases and schemas.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">4. How to Use These Insights</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Pair DuckCode&apos;s findings with your internal security runbooks (e.g. onboarding/offboarding, quarterly access
                reviews).
              </li>
              <li>
                Use Snowflake role and grant recommendations as an input to your RBAC design, simplifying role hierarchies where
                possible.
              </li>
              <li>
                Feed high-severity alerts into your SIEM or incident management tools for triage and tracking.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">5. Network & Deployment Considerations</h2>
            <p>
              DuckCode connects to Snowflake over TLS using standard Snowflake drivers. For private deployments or tighter network
              controls, you can place DuckCode behind your own egress controls and restrict Snowflake connectivity by IP or private
              link, consistent with your security policies.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
