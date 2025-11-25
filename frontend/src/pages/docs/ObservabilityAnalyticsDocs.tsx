import { Activity, BarChart3, Network } from 'lucide-react';

export default function ObservabilityAnalyticsDocs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-10 lg:py-16">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <Activity className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">Observability</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Observability & Analytics</h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            Dashboards that help you understand lineage, Snowflake cost and platform usage across your data stack.
          </p>
        </header>

        <div className="space-y-8 text-sm md:text-base text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">1. Lineage</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 mb-2 text-foreground">
                <Network className="h-4 w-4 text-[#2AB7A9]" />
                <span className="font-semibold">Understanding dependencies</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>Visualize upstream and downstream dependencies between tables, views and models.</li>
                <li>Trace impact from raw data to business-facing dashboards or metrics.</li>
                <li>Use lineage views before making changes to critical objects to avoid surprises.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">2. Snowflake Cost & Recommendations</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 mb-2 text-foreground">
                <BarChart3 className="h-4 w-4 text-[#2AB7A9]" />
                <span className="font-semibold">Cost visibility</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>Track Snowflake spend by warehouse, database or workload pattern.</li>
                <li>Surface optimization suggestions based on usage and historical behavior.</li>
                <li>Help platform and FinOps teams prioritize cost reduction efforts.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">3. Usage Analytics</h2>
            <p className="mb-3">
              Some deployments expose additional analytics pages showing user and IDE usage patterns. These can help you understand adoption and
              where to focus enablement.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
