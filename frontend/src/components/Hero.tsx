import { Link } from 'react-router-dom';
import { ArrowRight, Check, Database, PlayCircle, Send, Sparkles, Zap, GitBranch, LineChart, FileText, Bot, DollarSign } from 'lucide-react';
import { SiSnowflake, SiDbt, SiGithub, SiApacheairflow } from 'react-icons/si';
import { DataFlowDiagram } from './DataFlowDiagram';

const featureRows = [
  {
    id: 'ide',
    tag: 'AI-Powered IDE',
    title: 'Code faster with AI agents that understand your data',
    description: 'DuckCode IDE brings autonomous AI agents directly into VS Code — instantly find business logic, trace dependencies, and ship code 10x faster.',
    bullets: [
      'Data Architect agent for exploration & discovery',
      'Data Developer agent for safe code modifications', 
      'Context-aware AI understands schema & lineage',
      'Offline-first with lightning-fast local search'
    ],
    placeholder: 'IDE with AI agents demo (GIF)'
  },
  {
    id: 'lineage',
    tag: 'Column-Level Lineage',
    title: 'Trace every transformation in seconds, not hours',
    description: 'Visual lineage that shows exactly how data flows — from raw tables through dbt models to BI dashboards. 100-200x faster than PostgreSQL with Tantivy search.',
    bullets: [
      'Column-level lineage with full dependency graph',
      '5-10ms search across millions of objects',
      'Interactive visualization with drill-down', 
      'Export & share with stakeholders'
    ],
    placeholder: 'Lineage visualization demo (GIF)'
  },
  {
    id: 'documentation',
    tag: 'Auto Documentation',
    title: 'Docs that write themselves at merge time',
    description: 'AI generates release-ready documentation automatically when code ships — always in sync with Git, never stale or out of date.',
    bullets: [
      'Auto-generated from dbt models & SQL queries',
      'Business-friendly summaries tied to code',
      'Sync to Confluence/Notion (optional)',
      'Version history tracking with Git'
    ],
    placeholder: 'Auto documentation demo (GIF)'
  },
  {
    id: 'cost',
    tag: 'Cost Intelligence',
    title: 'Find $10K+ monthly waste automatically',
    description: 'Snowflake cost dashboard that detects unused tables, idle warehouses, and optimization opportunities — saving customers $134K/year on average.',
    bullets: [
      'Real-time cost breakdown by warehouse',
      'Auto-detect waste & underutilized resources',
      'Historical spend trends & forecasting',
      'One-click recommendations with ROI'
    ],
    placeholder: 'Cost intelligence dashboard (GIF)'
  }
];

const integrations = [
  {
    name: 'Snowflake',
    description: 'Cost intelligence & query optimization',
    icon: SiSnowflake,
    iconBg: 'from-[#e3f2ff] to-[#cfe6ff]',
    iconColor: 'text-[#29b5e8]'
  },
  {
    name: 'dbt',
    description: 'Model lineage & documentation sync',
    icon: SiDbt,
    iconBg: 'from-[#fff0e7] to-[#ffd9c2]',
    iconColor: 'text-[#ff6a3c]'
  },
  {
    name: 'Airflow',
    description: 'Pipeline orchestration & monitoring',
    icon: SiApacheairflow,
    iconBg: 'from-[#e5f9fb] to-[#cceff5]',
    iconColor: 'text-[#0094ce]'
  },
  {
    name: 'GitHub',
    description: 'Repository analysis & code insights',
    icon: SiGithub,
    iconBg: 'from-[#f2f2f2] to-[#e0e0e0]',
    iconColor: 'text-[#161413]'
  }
];

export function Hero() {
  return (
    <div className="bg-[#f5f1e9] text-[#161413]">
      <section id="home" className="px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Hero Content - Centered */}
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#d6d2c9] bg-gradient-to-r from-white/90 to-white/70 px-5 py-2.5 text-sm font-medium text-[#6f695f] shadow-sm backdrop-blur-sm">
              <Sparkles className="h-4 w-4 animate-pulse text-[#ff6a3c]" />
              AI-Powered IDE + Observability Platform
            </div>
            
            {/* Main Headline */}
            <div className="space-y-6">
              <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-[#0d0c0a] sm:text-6xl lg:text-7xl">
                Build faster.<br />
                <span className="bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] bg-clip-text text-transparent">
                  Ship smarter.
                </span>
                <br />
                Spend wisely.
              </h1>
              <p className="mx-auto max-w-3xl text-xl leading-relaxed text-[#59544c] sm:text-2xl">
                The only platform that combines an <strong className="font-semibold text-[#161413]">AI-powered IDE</strong> with enterprise <strong className="font-semibold text-[#161413]">observability</strong> — built for modern data teams working with Snowflake, dbt, and Airflow.
              </p>
            </div>

            {/* Value Props */}
            <div className="mt-10 flex flex-wrap justify-center gap-6">
              <div className="flex items-center gap-2 text-[#4e493f]">
                <Zap className="h-5 w-5 text-[#ff6a3c]" />
                <span className="font-medium">10x faster development</span>
              </div>
              <div className="flex items-center gap-2 text-[#4e493f]">
                <DollarSign className="h-5 w-5 text-[#ff6a3c]" />
                <span className="font-medium">Auto-detect $10K+ savings</span>
              </div>
              <div className="flex items-center gap-2 text-[#4e493f]">
                <Bot className="h-5 w-5 text-[#ff6a3c]" />
                <span className="font-medium">AI agents that ship code</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row sm:items-center">
              <Link
                to="/register"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] px-8 py-4 text-lg font-semibold text-white shadow-[0_20px_50px_rgba(255,106,60,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_25px_60px_rgba(255,106,60,0.5)]"
              >
                Start free trial
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#demo"
                className="group inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#bfb8ac] bg-white px-8 py-4 text-lg font-semibold text-[#161413] transition-all duration-300 hover:border-[#ff6a3c] hover:bg-[#fff4ee]"
              >
                Watch demo
                <PlayCircle className="h-5 w-5 transition-transform group-hover:scale-110" />
              </a>
            </div>

            {/* Trust Indicators */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 border-t border-[#e1dcd3] pt-8 text-sm text-[#7b7469]">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#d94a1e]" />
                <span>15-minute setup</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#d94a1e]" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#d94a1e]" />
                <span>SOC 2 compliant</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Flow Visualization Section */}
      <section className="px-4 pb-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Section Header */}
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#0d0c0a] sm:text-4xl">
              Your Data, <span className="bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] bg-clip-text text-transparent">Unified & Optimized</span>
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-[#59544c]">
              Connect <strong className="text-[#161413]">Snowflake, dbt, and Airflow</strong> → DuckCode AI processes locally with <strong className="text-[#161413]">10x speed</strong> → Get instant <strong className="text-[#161413]">docs, lineage, cost insights</strong>, and team collaboration
            </p>
            <div className="mx-auto mt-3 flex items-center justify-center gap-2 text-sm text-[#a39c92]">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span>Inputs</span>
              <ArrowRight className="h-4 w-4 text-[#ff6a3c]" />
              <div className="h-2 w-2 rounded-full bg-[#ff6a3c]"></div>
              <span>Processing</span>
              <ArrowRight className="h-4 w-4 text-emerald-500" />
              <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
              <span>Outputs</span>
            </div>
          </div>

          {/* Animated Flow Diagram */}
          <div className="relative overflow-visible rounded-[2rem] border border-gray-200/50 bg-white shadow-2xl">
            <DataFlowDiagram />
          </div>

          {/* Key Metrics Row */}
          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border-2 border-[#e1dcd3] bg-white p-6 text-center shadow-sm">
              <Zap className="mx-auto mb-3 h-8 w-8 text-[#ff6a3c]" />
              <p className="text-3xl font-bold text-[#ff6a3c]">10x</p>
              <p className="mt-1 text-sm font-medium text-[#6f695f]">Faster Development</p>
            </div>
            <div className="rounded-2xl border-2 border-[#e1dcd3] bg-white p-6 text-center shadow-sm">
              <LineChart className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
              <p className="text-3xl font-bold text-emerald-500">5-10ms</p>
              <p className="mt-1 text-sm font-medium text-[#6f695f]">Search Speed</p>
            </div>
            <div className="rounded-2xl border-2 border-[#e1dcd3] bg-white p-6 text-center shadow-sm">
              <DollarSign className="mx-auto mb-3 h-8 w-8 text-green-500" />
              <p className="text-3xl font-bold text-green-500">$134K</p>
              <p className="mt-1 text-sm font-medium text-[#6f695f]">Avg. Annual Savings</p>
            </div>
          </div>

          {/* Tech Stack Badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <span className="text-sm font-semibold uppercase tracking-wider text-[#a39c92]">
              Works with
            </span>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex items-center gap-2 rounded-full border border-[#e1dcd3] bg-white px-4 py-2 shadow-sm transition-all hover:scale-105 hover:border-[#29b5e8] hover:shadow-md">
                <SiSnowflake className="h-4 w-4 text-[#29b5e8]" />
                <span className="text-sm font-semibold text-[#161413]">Snowflake</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#e1dcd3] bg-white px-4 py-2 shadow-sm transition-all hover:scale-105 hover:border-[#ff6a3c] hover:shadow-md">
                <SiDbt className="h-4 w-4 text-[#ff6a3c]" />
                <span className="text-sm font-semibold text-[#161413]">dbt</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#e1dcd3] bg-white px-4 py-2 shadow-sm transition-all hover:scale-105 hover:border-[#0094ce] hover:shadow-md">
                <SiApacheairflow className="h-4 w-4 text-[#0094ce]" />
                <span className="text-sm font-semibold text-[#161413]">Airflow</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#e1dcd3] bg-white px-4 py-2 shadow-sm transition-all hover:scale-105 hover:border-[#161413] hover:shadow-md">
                <SiGithub className="h-4 w-4 text-[#161413]" />
                <span className="text-sm font-semibold text-[#161413]">GitHub</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Stats */}
      <section className="px-4 pb-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="group rounded-3xl border border-[#e1dcd3] bg-gradient-to-br from-white to-[#f8f4ec] p-8 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-full bg-gradient-to-r from-[#ff6a3c]/10 to-[#d94a1e]/10 p-3">
                  <LineChart className="h-6 w-6 text-[#ff6a3c]" />
                </div>
              </div>
              <p className="text-4xl font-bold text-[#161413]">5-10ms</p>
              <p className="mt-2 text-sm leading-relaxed text-[#59544c]">
                Lightning-fast search with Tantivy — find any model, column, or dependency instantly.
              </p>
            </div>
            
            <div className="group rounded-3xl border border-[#e1dcd3] bg-gradient-to-br from-white to-[#f8f4ec] p-8 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-full bg-gradient-to-r from-[#ff6a3c]/10 to-[#d94a1e]/10 p-3">
                  <GitBranch className="h-6 w-6 text-[#ff6a3c]" />
                </div>
              </div>
              <p className="text-4xl font-bold text-[#161413]">Column-level</p>
              <p className="mt-2 text-sm leading-relaxed text-[#59544c]">
                Trace every transformation — from source tables to BI dashboards in seconds.
              </p>
            </div>
            
            <div className="group rounded-3xl border border-[#e1dcd3] bg-gradient-to-br from-white to-[#f8f4ec] p-8 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-full bg-gradient-to-r from-[#ff6a3c]/10 to-[#d94a1e]/10 p-3">
                  <FileText className="h-6 w-6 text-[#ff6a3c]" />
                </div>
              </div>
              <p className="text-4xl font-bold text-[#161413]">Auto-sync</p>
              <p className="mt-2 text-sm leading-relaxed text-[#59544c]">
                Docs written at merge time — always in sync with Git, never stale.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 pb-32 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-32">
          {featureRows.map(({ id, tag, title, description, bullets, placeholder }, index) => (
            <div
              key={id}
              id={id}
              className={`grid gap-12 lg:grid-cols-2 lg:gap-16 ${index % 2 === 1 ? 'lg:grid-cols-[1fr_1.1fr]' : 'lg:grid-cols-[1.1fr_1fr]'}`}
            >
              {/* Content Side */}
              <div className={`flex flex-col justify-center space-y-8 ${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6a3c]/10 to-[#d94a1e]/10 px-4 py-2 text-sm font-bold uppercase tracking-wider text-[#ff6a3c]">
                    {tag}
                  </span>
                  <h2 className="text-4xl font-bold leading-tight tracking-tight text-[#0d0c0a] lg:text-5xl">
                    {title}
                  </h2>
                  <p className="text-lg leading-relaxed text-[#59544c]">
                    {description}
                  </p>
                </div>

                <ul className="space-y-4">
                  {bullets.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e]">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-base text-[#4e493f]">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-4 pt-4">
                  <Link
                    to="/register"
                    className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] px-6 py-3 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
                  >
                    Try for free
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <a
                    href="#demo"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[#d6d2c9] bg-white px-6 py-3 text-base font-semibold text-[#161413] transition-all duration-300 hover:border-[#ff6a3c] hover:bg-[#fff4ee]"
                  >
                    See demo
                    <PlayCircle className="h-4 w-4" />
                  </a>
                </div>
              </div>

              {/* Visual Side */}
              <div className={`${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                <div className="group relative overflow-hidden rounded-[32px] border-2 border-[#1f1d1b] bg-gradient-to-br from-[#0b0a09] to-[#141211] p-8 shadow-[0_40px_80px_rgba(7,7,7,0.4)] transition-all duration-500 hover:scale-[1.02]">
                  {/* Video/GIF Placeholder */}
                  <div className="relative min-h-[450px] overflow-hidden rounded-[24px] border border-[#24211e] bg-[#0d0c0b]">
                    <div className="flex h-full min-h-[450px] items-center justify-center">
                      <div className="text-center text-[#8d857b]">
                        <div className="mb-4 flex justify-center">
                          <div className="rounded-full bg-gradient-to-r from-[#ff6a3c]/20 to-[#d94a1e]/20 p-6">
                            <PlayCircle className="h-12 w-12 text-[#ff6a3c]" />
                          </div>
                        </div>
                        <p className="text-base font-medium">{placeholder}</p>
                      </div>
                    </div>
                  </div>

                  {/* Animated Glow Effect */}
                  <div className="pointer-events-none absolute -inset-px rounded-[32px] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    <div className="absolute inset-0 rounded-[32px] bg-gradient-to-r from-[#ff6a3c]/20 via-[#d94a1e]/20 to-transparent blur-2xl"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations Section */}
      <section className="px-4 pb-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Section Header */}
          <div className="mb-16 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6a3c]/10 to-[#d94a1e]/10 px-4 py-2 text-sm font-bold uppercase tracking-wider text-[#ff6a3c]">
              Integrations
            </span>
            <h2 className="mt-6 text-4xl font-bold tracking-tight text-[#0d0c0a] sm:text-5xl">
              Works with your entire data stack
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-[#59544c]">
              Native integrations with the tools you already use — Snowflake, dbt, Airflow, and GitHub.
            </p>
          </div>

          {/* Integration Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="group relative overflow-hidden rounded-3xl border-2 border-[#e1dcd3] bg-white p-8 shadow-sm transition-all duration-300 hover:scale-105 hover:border-[#ff6a3c] hover:shadow-xl"
              >
                {/* Icon/Logo Placeholder */}
                <div
                  className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${integration.iconBg} transition-all duration-300 group-hover:from-[#fff4ee] group-hover:to-[#ffe8dc]`}
                >
                  <integration.icon
                    className={`h-8 w-8 ${integration.iconColor} transition-all duration-300 group-hover:scale-110`}
                  />
                </div>
                
                {/* Integration Name */}
                <h3 className="text-xl font-bold text-[#161413]">{integration.name}</h3>
                
                {/* Description */}
                <p className="mt-2 text-sm leading-relaxed text-[#6f695f]">
                  {integration.description}
                </p>

                {/* Hover Effect Border */}
                <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-[#ff6a3c]/5 to-[#d94a1e]/5"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-12 text-center">
            <p className="text-sm text-[#7b7469]">
              Need a custom integration?{' '}
              <a href="mailto:hello@duckcode.ai" className="font-semibold text-[#ff6a3c] transition hover:text-[#d94a1e]">
                Let's talk →
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section id="cta" className="px-4 pb-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[48px] border-2 border-[#e1dcd3] bg-gradient-to-br from-[#fff7f2] via-[#fff4ee] to-[#ffe8dc] p-16 shadow-2xl">
            {/* Background Pattern */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #161413 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
            </div>

            {/* Content */}
            <div className="relative z-10 text-center">
              <h2 className="text-4xl font-bold tracking-tight text-[#0d0c0a] sm:text-5xl lg:text-6xl">
                Ready to transform how your{' '}
                <span className="bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] bg-clip-text text-transparent">
                  data team works?
                </span>
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-[#59544c]">
                Join teams using DuckCode to build faster, ship smarter, and spend wisely. Start your free trial today — no credit card required.
              </p>

              {/* Stats Row */}
              <div className="mt-12 flex flex-wrap justify-center gap-12">
                <div>
                  <p className="text-3xl font-bold text-[#ff6a3c]">$134K</p>
                  <p className="mt-1 text-sm text-[#6f695f]">Avg. annual savings</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-[#ff6a3c]">100-200x</p>
                  <p className="mt-1 text-sm text-[#6f695f]">Faster search</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-[#ff6a3c]">15 min</p>
                  <p className="mt-1 text-sm text-[#6f695f]">Setup time</p>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
                <Link
                  to="/register"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] px-10 py-5 text-lg font-bold text-white shadow-[0_20px_50px_rgba(255,106,60,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_25px_60px_rgba(255,106,60,0.5)]"
                >
                  Start free trial
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href="mailto:hello@duckcode.ai"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#161413] bg-white px-10 py-5 text-lg font-bold text-[#161413] transition-all duration-300 hover:bg-[#161413] hover:text-white"
                >
                  Talk to sales
                  <PlayCircle className="h-5 w-5" />
                </a>
              </div>

              {/* Trust Badge */}
              <p className="mt-8 text-sm text-[#7b7469]">
                Used by data teams at Fortune 500 companies • SOC 2 Type II in progress • GDPR compliant
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter + Resources Section */}
      <section id="resources" className="bg-gradient-to-b from-[#f5f1e9] to-[#f0ede5] px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          {/* Newsletter Signup */}
          <div className="rounded-[32px] border-2 border-[#e1dcd3] bg-white p-10 shadow-lg">
            <div className="mb-6">
              <h3 className="text-3xl font-bold text-[#161413]">Stay ahead of the curve</h3>
              <p className="mt-3 text-base leading-relaxed text-[#59544c]">
                Get Snowflake optimization playbooks, product updates, and early access to new features. Join 500+ data leaders.
              </p>
            </div>
            <form className="space-y-4" data-analytics="waitlist-form">
              <div>
                <label htmlFor="waitlist-email" className="sr-only">
                  Work email
                </label>
                <input
                  id="waitlist-email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  className="w-full rounded-2xl border-2 border-[#d6d2c9] bg-white px-5 py-4 text-base text-[#161413] transition focus:border-[#ff6a3c] focus:outline-none focus:ring-4 focus:ring-[#ff6a3c]/20"
                />
              </div>
              <button
                type="submit"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] px-6 py-4 text-base font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl sm:w-auto"
              >
                Subscribe now
                <Send className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </form>
            <p className="mt-4 text-sm text-[#7b7469]">
              No spam, ever. Unsubscribe anytime. Questions?{' '}
              <a href="mailto:hello@duckcode.ai" className="font-semibold text-[#ff6a3c] hover:text-[#d94a1e]">
                hello@duckcode.ai
              </a>
            </p>
          </div>

          {/* Resources */}
          <div className="space-y-6 rounded-[32px] border border-[#e1dcd3] bg-gradient-to-br from-[#f8f4ec] to-[#f0ede5] p-8">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-[#a39c92]">Free Resources</p>
              <ul className="space-y-3 text-sm text-[#4e493f]">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6a3c]" />
                  <span>Snowflake cost optimization guide</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6a3c]" />
                  <span>Data lineage best practices</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6a3c]" />
                  <span>dbt documentation templates</span>
                </li>
              </ul>
            </div>
            <div className="border-t border-[#e1dcd3] pt-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-[#a39c92]">Enterprise</p>
              <p className="text-sm leading-relaxed text-[#4e493f]">
                SOC 2 Type II (in progress) • SSO/SCIM • Private cloud • On-premise deployment
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-[#e1dcd3] bg-[#f0ede5] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {/* Top Section */}
          <div className="grid gap-12 lg:grid-cols-[2fr_1fr_1fr_1fr]">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e]">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#161413]">Duckcode.ai</p>
                  <p className="text-xs text-[#7b7469]">AI-Powered Data Platform</p>
                </div>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-[#59544c]">
                The only platform that combines an AI-powered IDE with enterprise observability for modern data teams.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <p className="mb-4 text-sm font-bold text-[#161413]">Product</p>
              <ul className="space-y-3 text-sm text-[#59544c]">
                <li>
                  <a href="#ide" className="transition hover:text-[#ff6a3c]">
                    AI IDE
                  </a>
                </li>
                <li>
                  <a href="#lineage" className="transition hover:text-[#ff6a3c]">
                    Data Lineage
                  </a>
                </li>
                <li>
                  <a href="#cost" className="transition hover:text-[#ff6a3c]">
                    Cost Intelligence
                  </a>
                </li>
                <li>
                  <a href="#documentation" className="transition hover:text-[#ff6a3c]">
                    Documentation
                  </a>
                </li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <p className="mb-4 text-sm font-bold text-[#161413]">Company</p>
              <ul className="space-y-3 text-sm text-[#59544c]">
                <li>
                  <a href="/about" className="transition hover:text-[#ff6a3c]">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="/blog" className="transition hover:text-[#ff6a3c]">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="/careers" className="transition hover:text-[#ff6a3c]">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="mailto:hello@duckcode.ai" className="transition hover:text-[#ff6a3c]">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <p className="mb-4 text-sm font-bold text-[#161413]">Legal</p>
              <ul className="space-y-3 text-sm text-[#59544c]">
                <li>
                  <a href="/privacy" className="transition hover:text-[#ff6a3c]">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/terms" className="transition hover:text-[#ff6a3c]">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="/security" className="transition hover:text-[#ff6a3c]">
                    Security
                  </a>
                </li>
                <li>
                  <a href="/compliance" className="transition hover:text-[#ff6a3c]">
                    Compliance
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-[#e1dcd3] pt-8 sm:flex-row">
            <p className="text-sm text-[#7b7469]">
              © {new Date().getFullYear()} Duckcode.ai. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#59544c] transition hover:text-[#ff6a3c]"
              >
                <span className="sr-only">LinkedIn</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#59544c] transition hover:text-[#ff6a3c]"
              >
                <span className="sr-only">GitHub</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#59544c] transition hover:text-[#ff6a3c]"
              >
                <span className="sr-only">Twitter</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
