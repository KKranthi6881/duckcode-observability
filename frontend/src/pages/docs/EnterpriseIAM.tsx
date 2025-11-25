import { Users, Shield, Key, Mail } from 'lucide-react';

export default function EnterpriseIAM() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-10 lg:py-16">
        {/* Header */}
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <Users className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">Identity & Access</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Identity & Access Management Guide
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            Learn how organizations, teams, roles and invitations work together to give the right people the right level of access.
          </p>
        </header>

        <div className="space-y-10 text-sm md:text-base">
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">1. Organizations</h2>
            <p className="text-muted-foreground mb-3">
              An <span className="font-medium text-foreground">organization</span> represents an enterprise tenant or environment. All assets
              (users, teams, connectors, API keys, jobs) are isolated per organization.
            </p>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm text-muted-foreground">
              <p className="font-semibold mb-1">Key properties</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Name and display name used across the admin portal.</li>
                <li>Plan type and status (trial, active, suspended, cancelled).</li>
                <li>Settings JSON for org-specific toggles and features.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">2. Users & Invitations</h2>
            <p className="text-muted-foreground mb-3">
              Users join an organization via invitation. Each invitation links an email address to an organization (and optionally a team and
              role) and can be accepted once.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm text-muted-foreground">
              <div className="rounded-lg border border-border bg-card/80 p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#2AB7A9]" />
                  Sending invitations
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Admins create invitations from the members/admin interface.</li>
                  <li>Each invite encodes organization, target email, optional team and role.</li>
                  <li>Invites can be cancelled or expire automatically after a configured period.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card/80 p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#2AB7A9]" />
                  Accepting invitations
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Users follow a unique invite link to accept the invitation.</li>
                  <li>New users complete registration; existing users are joined to the org.</li>
                  <li>On success, the user is added to <code>user_organization_roles</code> for that organization.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">3. Teams & Hierarchy</h2>
            <p className="text-muted-foreground mb-3">
              Teams let you mirror your internal structure (divisions, departments, squads) inside each organization and delegate limited
              administration to team leads.
            </p>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm text-muted-foreground">
              <ul className="list-disc list-inside space-y-1">
                <li>Teams belong to an organization and can form simple hierarchies via parent team IDs.</li>
                <li>Each team has its own members with roles such as admin, member or viewer.</li>
                <li>APIs exist to query a user's teams and to walk the full team hierarchy when needed.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">4. Roles & Permissions</h2>
            <p className="text-muted-foreground mb-3">
              Role-based access control (RBAC) is enforced at the organization level. Roles are defined once per organization and carry a
              structured list of permissions.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm text-muted-foreground">
              <div className="rounded-lg border border-border bg-card/80 p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#2AB7A9]" />
                  Organization roles
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Each role has a name, display name and array of permission strings.</li>
                  <li>Admins can create roles tailored to their security/compliance needs.</li>
                  <li>
                    Example permissions include categories such as <code>api_keys:read</code>, <code>api_keys:write</code>, members management and
                    admin settings.
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card/80 p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Key className="h-4 w-4 text-[#2AB7A9]" />
                  Permission checks
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Permissions are evaluated on the backend using dedicated helper functions and database procedures.</li>
                  <li>APIs never trust client-side claims about roles or permissions.</li>
                  <li>
                    Sensitive routes (API keys, SSO, organization mutations) always verify that the caller has an appropriate permission before
                    proceeding.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">5. Recommended Setup for New Enterprises</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm text-muted-foreground">
              <ol className="list-decimal list-inside space-y-1">
                <li>Create or verify your primary organization record.</li>
                <li>Define core organization roles (e.g. Org Admin, Security Admin, Data Engineer, Viewer).</li>
                <li>Set up teams that mirror your structure and assign team admins.</li>
                <li>Configure SSO and map default roles for just-in-time users.</li>
                <li>Invite users by email, assigning them to appropriate roles and teams.</li>
              </ol>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
