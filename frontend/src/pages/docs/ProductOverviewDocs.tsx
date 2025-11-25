import { Sparkles, LayoutDashboard, Activity, Shield, BookOpen } from 'lucide-react';

export default function ProductOverviewDocs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-10 lg:py-16">
        {/* Header */}
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <Sparkles className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">Docs</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            DuckCode Observability – Product Overview
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            A high-level tour of what DuckCode does, who it is for, and how the main areas of the product fit together.
          </p>
        </header>

        {/* Summary grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <SummaryCard
            icon={<LayoutDashboard className="h-5 w-5 text-emerald-500" />}
            title="Dashboards"
            body="Lineage, Snowflake cost and security views help you understand the health of your data stack."
          />
          <SummaryCard
            icon={<Activity className="h-5 w-5 text-sky-500" />}
            title="Code & AI docs"
            body="AI-generated documentation and code intelligence make complex pipelines easier to reason about."
          />
          <SummaryCard
            icon={<Shield className="h-5 w-5 text-amber-500" />}
            title="Enterprise ready"
            body="SSO, RBAC, encrypted secrets and audit logging built in from day one."
          />
        </section>

        <div className="space-y-10 text-sm md:text-base">
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">1. Core Value</h2>
            <p className="text-muted-foreground mb-3">
              DuckCode connects to your Snowflake and code/metadata repositories to answer three core questions:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Where does a metric or report come from and which upstream objects does it depend on?</li>
              <li>How much does it cost to run specific workloads or teams on Snowflake?</li>
              <li>How secure are our data warehouses and who really has access to what?</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">2. Main Areas of the Product</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm text-muted-foreground">
              <div className="rounded-lg border border-border bg-card/80 p-4">
                <h3 className="font-semibold mb-2">Data & Code</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <span className="font-medium text-foreground">Codebase</span> – connect GitHub repositories and analyze code/SQL assets.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Lineage</span> – visualize how objects depend on each other across Snowflake and
                    code.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">AI Documentation</span> – generate business-friendly docs for critical tables,
                    views and models.
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card/80 p-4">
                <h3 className="font-semibold mb-2">Observability & Enterprise</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Snowflake cost dashboards, recommendations and ROI tracking.</li>
                  <li>Snowflake security insights from ACCOUNT_USAGE and related views.</li>
                  <li>Admin portal for subscription, users, SSO and API keys.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">3. Who It Is For</h2>
            <p className="text-muted-foreground mb-3">
              DuckCode is designed primarily for:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Data engineers and analytics engineers operating Snowflake and dbt at scale.</li>
              <li>Platform teams responsible for data platform reliability, cost and security.</li>
              <li>FinOps and business stakeholders who need visibility into data spend and usage.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">4. Where to Start</h2>
            <p className="text-muted-foreground mb-3">
              Use the following docs to go deeper into each part of the product:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[#2AB7A9] text-xs md:text-sm">
              <li>
                <a href="/docs/getting-started" className="hover:underline">
                  Getting Started – connect your first Snowflake account and repository
                </a>
              </li>
              <li>
                <a href="/docs/connectors" className="hover:underline">
                  Connectors – Snowflake, dbt/metadata and GitHub
                </a>
              </li>
              <li>
                <a href="/docs/code-intel-ai-docs" className="hover:underline">
                  Code Intelligence & AI Documentation
                </a>
              </li>
              <li>
                <a href="/docs/observability-analytics" className="hover:underline">
                  Observability & Analytics
                </a>
              </li>
              <li>
                <a href="/docs/enterprise/overview" className="hover:underline">
                  Enterprise & Security Overview
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">5. Keeping Up With Changes</h2>
            <p className="text-muted-foreground flex items-center gap-2 text-xs md:text-sm">
              <BookOpen className="h-4 w-4 text-[#2AB7A9]" />
              Check the <a href="/docs/release-notes" className="underline ml-1">Release Notes</a> for new features and breaking changes.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

interface SummaryCardProps {
  icon: JSX.Element;
  title: string;
  body: string;
}

function SummaryCard({ icon, title, body }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card/80 p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-md bg-muted">
          {icon}
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <p className="text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
