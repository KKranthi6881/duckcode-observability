import { Rocket, Database, Github, Plug } from 'lucide-react';

export default function GettingStartedDocs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-10 lg:py-16">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <Rocket className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">Getting Started</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Getting Started with DuckCode</h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            Follow these steps to connect your first Snowflake account and repository, and see value from DuckCode in minutes.
          </p>
        </header>

        <div className="space-y-8 text-sm md:text-base text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">1. Sign Up or Log In</h2>
            <ol className="list-decimal list-inside space-y-1">
              <li>Create an account or log in using your email and password or enterprise SSO.</li>
              <li>After login, you will land on the main dashboard under <code>/dashboard</code>.</li>
              <li>If you have been invited to an organization, accepting the invite will attach you to the correct tenant.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">2. Connect Snowflake</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 mb-2 text-foreground">
                <Database className="h-4 w-4 text-[#2AB7A9]" />
                <span className="font-semibold">Snowflake connection basics</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>Use a dedicated Snowflake user with read access to ACCOUNT_USAGE and relevant metadata views.</li>
                <li>Configure credentials and connection details in the Connectors or admin area.</li>
                <li>Once connected, initial metadata and cost syncs will populate the dashboards.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">3. Connect Your Repository (Optional but Recommended)</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 mb-2 text-foreground">
                <Github className="h-4 w-4 text-[#2AB7A9]" />
                <span className="font-semibold">GitHub / code connections</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>Connect your analytics or dbt repository so DuckCode can analyze SQL and lineage.</li>
                <li>Provide a token with the minimum required scopes and store it securely.</li>
                <li>After analysis jobs complete, you will see code-aware lineage and AI documentation options.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">4. Explore the Dashboards</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 mb-2 text-foreground">
                <Plug className="h-4 w-4 text-[#2AB7A9]" />
                <span className="font-semibold">First places to look</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>The Lineage or Data views to understand upstream/downstream dependencies.</li>
                <li>Snowflake cost dashboards to see spend by warehouse, database or workload.</li>
                <li>AI documentation (where available) to quickly understand critical objects.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">5. Next Steps</h2>
            <ul className="list-disc list-inside space-y-1 text-[#2AB7A9] text-xs md:text-sm">
              <li>
                <a href="/docs/connectors" className="hover:underline">
                  Configure additional connectors and environments
                </a>
              </li>
              <li>
                <a href="/docs/code-intel-ai-docs" className="hover:underline">
                  Learn how AI documentation explains your models and pipelines
                </a>
              </li>
              <li>
                <a href="/docs/enterprise/overview" className="hover:underline">
                  Review Enterprise & security capabilities
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
