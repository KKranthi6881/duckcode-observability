import { Building2, Users } from 'lucide-react';

export default function WorkspacesOrganizationsDocs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-10 lg:py-16">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <Building2 className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">Organizations</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Workspaces & Organizations</h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            Understand how tenants, organizations and teams are modeled in DuckCode so you can mirror your company structure.
          </p>
        </header>

        <div className="space-y-8 text-sm md:text-base text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">1. Organizations as Tenants</h2>
            <p className="mb-3">
              Each organization in DuckCode represents an isolated enterprise tenant. Users, roles, connectors, jobs and audit logs are all
              scoped to a specific organization.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Most customers will use one organization per company or environment (e.g. production vs staging).</li>
              <li>Some advanced setups may use multiple organizations to separate business units or regulatory regions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">2. Users & Membership</h2>
            <p className="mb-3">
              A user can belong to multiple organizations, often with different roles in each. Within an organization, membership is controlled
              via invitations and managed by admins.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Organization admins can invite new users by email and assign initial roles.</li>
              <li>Users can switch between organizations they belong to from the admin portal.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">3. Teams & Structure</h2>
            <p className="mb-3">
              Teams let you map departments, squads or functional groups inside each organization. They are optional but recommended for
              larger deployments.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Teams are created under an organization and can reference parent teams to form hierarchies.</li>
              <li>Team membership can be used to drive ownership and permissions in future features.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">4. Where to Configure</h2>
            <p className="mb-3">
              Most organization and member management happens in the admin portal under members, SSO, API keys and connectors sections.
            </p>
            <ul className="list-disc list-inside space-y-1 text-[#2AB7A9] text-xs md:text-sm">
              <li>
                <a href="/docs/enterprise/iam" className="hover:underline">
                  Identity & Access Management Guide
                </a>
              </li>
              <li>
                <a href="/docs/enterprise/overview" className="hover:underline">
                  Enterprise Overview
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
