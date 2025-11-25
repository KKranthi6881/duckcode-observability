import { Globe2, Key } from 'lucide-react';

export default function APIOverviewDocs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-10 lg:py-16">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <Globe2 className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">API</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">API & Integrations Overview</h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            How DuckCode APIs are authenticated and how they fit into your broader automation and integration workflows.
          </p>
        </header>

        <div className="space-y-8 text-sm md:text-base text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">1. Authentication</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Most APIs are authenticated using organization-level API keys or IDE tokens.</li>
              <li>Organization admin pages let you create, rotate and revoke API keys.</li>
              <li>Keys are encrypted at rest and masked in the UI.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">2. Typical Use Cases</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Pulling observability metrics into your own internal dashboards.</li>
              <li>Automating connector setup or sync triggers as part of deployment pipelines.</li>
              <li>Querying AI documentation or lineage information from external tools.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">3. Governance</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 mb-2 text-foreground">
                <Key className="h-4 w-4 text-[#2AB7A9]" />
                <span className="font-semibold">Best practices</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>Use different API keys for different applications or teams.</li>
                <li>Store keys in a dedicated secrets manager and rotate regularly.</li>
                <li>Review API key usage and audit logs on a regular cadence.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
