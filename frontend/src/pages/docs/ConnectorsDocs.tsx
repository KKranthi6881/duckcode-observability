import { Plug, Database, Github } from 'lucide-react';

export default function ConnectorsDocs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-10 lg:py-16">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <Plug className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">Connectors</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Connectors</h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            Configure secure connections to Snowflake, code repositories and other systems that DuckCode analyzes.
          </p>
        </header>

        <div className="space-y-8 text-sm md:text-base text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">1. Snowflake</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 mb-2 text-foreground">
                <Database className="h-4 w-4 text-[#2AB7A9]" />
                <span className="font-semibold">Permissions</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>Use a dedicated Snowflake user or role for DuckCode.</li>
                <li>Grant read access to ACCOUNT_USAGE and relevant metadata views.</li>
                <li>Restrict broad table access where possible; focus on metadata and observability views.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">2. Repositories (GitHub)</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 mb-2 text-foreground">
                <Github className="h-4 w-4 text-[#2AB7A9]" />
                <span className="font-semibold">Repository access</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>Provide tokens with minimal scopes necessary to read the relevant repositories.</li>
                <li>Tokens are encrypted at rest and decrypted only when calling GitHub APIs.</li>
                <li>Once connected, DuckCode can extract SQL and metadata from your analytics projects.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">3. Operational Tips</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Prefer environment-specific connectors (e.g. staging vs production Snowflake accounts).</li>
              <li>Rotate connector credentials regularly and on any security incident.</li>
              <li>Use the admin connectors view to monitor connection health and last sync times.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
