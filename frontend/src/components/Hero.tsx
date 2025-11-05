import { Link } from 'react-router-dom';
import { ArrowRight, Check, Database, PlayCircle, Send, Sparkles } from 'lucide-react';

const featureRows = [
  {
    id: 'lineage',
    tag: 'Lineage',
    title: 'Lineage that understands every hop',
    description: 'Column-level lineage renders instantly so every metric change is traceable in seconds.',
    bullets: ['Trace upstream + downstream instantly', 'Shareable snapshots for stakeholders', 'Column + BI exposure coverage'],
    placeholder: 'Lineage feature clip placeholder'
  },
  {
    id: 'documentation',
    tag: 'Auto documentation',
    title: 'Docs written at merge time',
    description: 'AI produces release-ready docs the moment code ships — always versioned with Git.',
    bullets: ['Plain-language summaries tied to code', 'Owner & SLA tagging on autopilot', 'Docs synced to Notion / Confluence (optional)'],
    placeholder: 'Documentation feature clip placeholder'
  },
  {
    id: 'architecture',
    tag: 'Auto architecture',
    title: 'Architecture maps without the diagram tool',
    description: 'Metadata fuels auto-generated architecture views so leadership and devs stay aligned.',
    bullets: ['Environment-aware topology layouts', 'Pipeline health overlays', 'Embed in decks or share securely'],
    placeholder: 'Architecture feature clip placeholder'
  },
  {
    id: 'snowflake',
    tag: 'Snowflake + dbt',
    title: 'Snowflake guardrails inside the IDE',
    description: 'Snowflake spend, tests, and telemetry appear where you build — before issues escalate.',
    bullets: ['Spend insights + anomaly alerts', 'dbt job + exposure sync', 'AI copilots tuned to your warehouse'],
    placeholder: 'Snowflake & dbt feature clip placeholder'
  }
];

const integrations = ['Snowflake', 'dbt', 'GitHub', 'GitLab', 'Azure DevOps'];

const quickReasons = [
  { title: '15 min setup', description: 'Connect Git + Snowflake and preview automated lineage instantly.' },
  { title: 'Secure by design', description: 'Deploy in your VPC or use Duckcode managed cloud with SSO and RBAC.' },
  { title: 'Full data stack coverage', description: 'Support for Snowflake, dbt, lakehouses, and BI refresh pipelines.' }
];

export function Hero() {
  return (
    <div className="bg-[#f5f1e9] text-[#161413]">
      <section id="home" className="px-4 pb-24 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d6d2c9] bg-white/70 px-4 py-2 text-sm text-[#6f695f]">
              <Sparkles className="h-4 w-4 text-[#ff6a3c]" />
              Duckcode.ai — AI IDE for data teams
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-[#0d0c0a] sm:text-5xl">
              Build, document, and trust Snowflake projects in one place.
            </h1>
            <p className="text-lg text-[#59544c]">
              Duckcode turns lineage, documentation, and observability into an AI-native workflow. One IDE for analysts, engineers, and architects.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] px-7 py-4 text-base font-semibold text-white shadow-[0_18px_40px_rgba(255,106,60,0.35)] transition hover:translate-y-[-2px]"
              >
                Try Duckcode free
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#snowflake"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#bfb8ac] px-7 py-4 text-base font-semibold text-[#161413] transition hover:border-[#ff6a3c]"
              >
                Book a demo
                <PlayCircle className="h-5 w-5" />
              </a>
            </div>
            <div className="grid gap-4 text-sm text-[#59544c] sm:grid-cols-3">
              <div className="rounded-3xl border border-[#d6d2c9] bg-white/80 p-4 shadow-sm">
                <p className="text-3xl font-semibold text-[#161413]">80%</p>
                <p>Less time stitching docs and lineage together.</p>
              </div>
              <div className="rounded-3xl border border-[#d6d2c9] bg-white/80 p-4 shadow-sm">
                <p className="text-3xl font-semibold text-[#161413]">95%</p>
                <p>Coverage across Snowflake, dbt, and downstream BI.</p>
              </div>
              <div className="rounded-3xl border border-[#d6d2c9] bg-white/80 p-4 shadow-sm">
                <p className="text-3xl font-semibold text-[#161413]">24 hrs</p>
                <p>Average time to value with guided onboarding.</p>
              </div>
            </div>
          </div>

          <div className="relative rounded-[36px] border border-[#d6d2c9] bg-white/80 p-6 shadow-[0_35px_60px_rgba(26,20,15,0.1)]">
            <div className="flex items-center justify-between text-xs text-[#6f695f]">
              <span className="rounded-full bg-[#fff4ee] px-3 py-1 font-semibold text-[#d94a1e]">Product preview</span>
              <span>Replace with hero GIF</span>
            </div>
            <div className="mt-6 h-72 rounded-3xl border border-dashed border-[#d6d2c9] bg-[#f8f4ec] p-6 text-sm text-[#a7a198]">
              Showcase Duckcode IDE + lineage explorer here.
            </div>
            <div className="mt-6 rounded-2xl bg-[#f5efe3] p-4 text-xs text-[#6f695f]">
              Optional dark mode toggle can sit inside the app preview.
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-4">
          {quickReasons.map(({ title, description }) => (
            <div key={title} className="flex-1 min-w-[220px] rounded-3xl border border-[#e1dcd3] bg-white/80 px-6 py-5 text-sm text-[#4e493f]">
              <div className="flex items-center gap-2 text-[#161413]">
                <Check className="h-4 w-4 text-[#d94a1e]" />
                <span className="font-semibold">{title}</span>
              </div>
              <p className="mt-2 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-20">
          {featureRows.map(({ id, tag, title, description, bullets, placeholder }, index) => (
            <div
              key={id}
              id={id}
              className={`flex flex-col gap-10 lg:flex-row ${index % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}
            >
              <div className="lg:w-[28%] min-w-[260px] space-y-5 text-center text-[#161413]">
                <span className="inline-flex items-center justify-center gap-2 text-xs uppercase tracking-[0.3em] text-[#a39c92]">{tag}</span>
                <h2 className="text-3xl font-semibold leading-tight">{title}</h2>
                <p className="text-sm text-[#4e493f]">{description}</p>
                <ul className="space-y-2 text-sm text-[#4e493f]">
                  {bullets.map((item) => (
                    <li key={item} className="flex items-center justify-center gap-2">
                      <Check className="h-4 w-4 text-[#ff6a3c]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-3 rounded-[28px] border border-[#d6d2c9] px-6 py-3 text-sm font-semibold text-[#161413] transition hover:border-[#ff6a3c]"
                >
                  Explore Duckcode
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="flex-1 rounded-[36px] border border-[#1f1d1b] bg-[#0b0a09] p-6 text-sm text-[#8d857b] shadow-[0_30px_60px_rgba(7,7,7,0.35)]">
                <div className="flex h-full min-h-[440px] items-center justify-center rounded-[28px] border border-[#24211e] bg-[#141211]">
                  {placeholder}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-28 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 rounded-[32px] border border-[#e1dcd3] bg-[#f8f4ec] p-10 shadow-sm">
          <div className="flex flex-col justify-between gap-4 text-[#4e493f] md:flex-row md:items-end">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-[#a39c92]">Integrations</p>
              <h3 className="mt-2 text-2xl font-semibold text-[#161413]">Learn from the systems you already trust.</h3>
              <p className="mt-2 max-w-xl text-sm">
                Duckcode plugs into your repositories, warehouses, and observability pipelines to stay ahead of change.
              </p>
            </div>
            <a
              href="#snowflake"
              className="inline-flex items-center gap-2 rounded-full border border-[#bfb8ac] px-5 py-2 text-sm font-medium text-[#161413] transition hover:border-[#ff6a3c]"
            >
              View all connections
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="grid gap-4 rounded-[24px] border border-[#e8e2d8] bg-white p-6 sm:grid-cols-5">
            {integrations.map((item) => (
              <div
                key={item}
                className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-transparent text-[#161413] transition hover:border-[#d6d2c9] hover:bg-[#f5f1e9]"
              >
                <Database className="h-8 w-8 text-[#161413]" />
                <span className="text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="cta" className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[32px] border border-[#e1dcd3] bg-[#fff7f2] p-12 text-center shadow-[0_25px_45px_rgba(217,74,30,0.2)]">
          <h2 className="text-3xl font-semibold text-[#161413] sm:text-4xl">Bring clarity to your Snowflake estate.</h2>
          <p className="mt-4 text-sm text-[#4e493f]">
            Duckcode gives data teams a calm, shared workspace — lineage, docs, and AI copilots bundled into one IDE.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] px-8 py-4 text-base font-semibold text-white shadow-[0_18px_40px_rgba(255,106,60,0.35)] transition hover:translate-y-[-2px]"
            >
              Start free workspace
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="mailto:hello@duckcode.ai"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#bfb8ac] px-8 py-4 text-base font-semibold text-[#161413] transition hover:border-[#ff6a3c]"
            >
              Talk to sales
              <PlayCircle className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      <section id="resources" className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[32px] border border-[#e1dcd3] bg-white p-10 shadow-sm">
            <h3 className="text-2xl font-semibold text-[#161413]">Join the Duckcode waitlist</h3>
            <p className="mt-2 text-sm text-[#4e493f]">
              Get product drops, Snowflake playbooks, and early-access invites. No spam — ever.
            </p>
            <form className="mt-6 flex flex-col gap-3 sm:flex-row" data-analytics="waitlist-form">
              <label htmlFor="waitlist-email" className="sr-only">
                Email
              </label>
              <input
                id="waitlist-email"
                type="email"
                required
                placeholder="you@company.com"
                className="w-full rounded-full border border-[#d6d2c9] bg-white px-4 py-3 text-sm text-[#161413] shadow-sm focus:border-[#ff6a3c] focus:outline-none focus:ring-2 focus:ring-[#ff6a3c]/40"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#161413] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0d0c0a]"
              >
                Join waitlist
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-3 text-xs text-[#7b7469]">Prefer a call? hello@duckcode.ai — response within one business day.</p>
          </div>
          <div className="space-y-4 rounded-[32px] border border-[#e1dcd3] bg-[#f8f4ec] p-8 text-sm text-[#4e493f]">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#a39c92]">Resources</p>
              <ul className="mt-3 space-y-2">
                <li>Snowflake optimisation kit</li>
                <li>Lineage rollout playbook</li>
                <li>Enterprise security checklist</li>
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#a39c92]">Security & deployment</p>
              <p className="mt-2">SOC 2 in progress • SSO / SCIM • Private cloud & on-prem options.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e1dcd3] bg-[#f0ede5] py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 text-sm text-[#4e493f] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/icon-duck-obs.png" alt="Duckcode Logo" className="h-8 w-8" />
            <div>
              <p className="text-sm font-semibold text-[#161413]">Duckcode.ai</p>
              <p className="text-xs text-[#7b7469]">AI IDE + Observability platform for Snowflake &amp; dbt teams.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <a href="https://www.linkedin.com" className="transition hover:text-[#161413]">
              LinkedIn
            </a>
            <a href="https://github.com" className="transition hover:text-[#161413]">
              GitHub
            </a>
            <a href="mailto:hello@duckcode.ai" className="transition hover:text-[#161413]">
              Contact
            </a>
            <a href="/privacy" className="transition hover:text-[#161413]">
              Privacy Policy
            </a>
          </div>
          <p className="text-xs text-[#7b7469]">© {new Date().getFullYear()} Duckcode.ai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
