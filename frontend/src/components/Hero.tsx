import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Database, PlayCircle, Sparkles, Zap, GitBranch, LineChart, FileText, Bot, DollarSign, ShieldCheck } from 'lucide-react';
import { SiSnowflake, SiDbt, SiGithub, SiApacheairflow, SiOkta } from 'react-icons/si';
import { DataFlowDiagram } from './DataFlowDiagram';
import architectureVideo from '../assets/duckcode-architecture.mov';
import autoCodeVideo from '../assets/AutoCode-Generation.mov';
import lineageVideo from '../assets/Lineage-Visualization.mp4';
import costVideo from '../assets/snowflake-cost-analysis.mp4';
import documentationVideo from '../assets/duckcode-document.mov';

const features = [
  'AI-Powered IDE',
  'Offline Lineage',
  'Auto Docs',
  'Smart Data Catalog',
  'Multi-Repo Intelligence',
  'Snowflake Cost Optimizer'
];

const featureRows = [
  {
    id: 'architecture',
    tag: 'Architecture & Logic',
    title: 'Instant architecture diagrams with business logic explained',
    description:
      'Out-of-the-box architecture diagrams that explain business logic, dependencies, and data flows — even for large, complex, multi-repo setups.',
    bullets: [
      'Auto-generate architecture diagrams from your existing dbt and SQL code',
      'Understand complex business logic at the root level of your repo',
      'See dependencies and data contracts across domains and teams',
      'Share a clear, high-level view of how data powers the business'
    ],
    placeholder: 'Architecture diagrams and explanations demo (GIF)'
  },
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
    description: 'Visual lineage that shows exactly how data flows — for all your code base objects and columns. 100-200x faster search within your local code base.',
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
    title: 'Cut Snowflake spend by double-digit % automatically',
    description: 'Snowflake cost dashboard that detects unused tables, idle warehouses, and inefficient workloads — giving you clear, percentage-based savings and ROI instead of static dollar guesses.',
    bullets: [
      'Real-time cost breakdown by warehouse, database, and workload',
      'Auto-detect waste & underutilized resources across compute and storage',
      'Historical spend trends, forecasting, and usage patterns',
      'One-click optimization recommendations with projected % savings and ROI'
    ],
    placeholder: 'Cost intelligence dashboard (GIF)'
  }
];
export function Hero() {
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const architectureVideoRef = useRef<HTMLVideoElement | null>(null);
  const architectureVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const ideVideoRef = useRef<HTMLVideoElement | null>(null);
  const ideVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const lineageVideoRef = useRef<HTMLVideoElement | null>(null);
  const lineageVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const costVideoRef = useRef<HTMLVideoElement | null>(null);
  const costVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const documentationVideoRef = useRef<HTMLVideoElement | null>(null);
  const documentationVideoContainerRef = useRef<HTMLDivElement | null>(null);

  // Typing animation effect
  useEffect(() => {
    const currentFeature = features[currentFeatureIndex];
    const typingSpeed = 35; // ms per character (faster typing)
    const deletingSpeed = 10; // ms per character when deleting (faster)
    const pauseBeforeDelete = 1200; // pause at end before deleting (shorter)
    const pauseBeforeNext = 200; // pause before typing next feature (shorter)

    const timeout = setTimeout(() => {
      if (!isDeleting && displayedText === currentFeature) {
        // Finished typing, pause then start deleting
        setIsDeleting(true);
      } else if (isDeleting && displayedText === '') {
        // Finished deleting, move to next feature
        setIsDeleting(false);
        setCurrentFeatureIndex((prev) => (prev + 1) % features.length);
      } else if (!isDeleting) {
        // Typing
        setDisplayedText(currentFeature.slice(0, displayedText.length + 1));
      } else {
        // Deleting
        setDisplayedText(currentFeature.slice(0, displayedText.length - 1));
      }
    }, !isDeleting && displayedText === currentFeature ? pauseBeforeDelete : isDeleting && displayedText === '' ? pauseBeforeNext : !isDeleting ? typingSpeed : deletingSpeed);

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, currentFeatureIndex]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const videoEl = architectureVideoRef.current;
    const containerEl = architectureVideoContainerRef.current;
    if (!videoEl || !containerEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          videoEl
            .play()
            .catch(() => {
              // Autoplay might be blocked; ignore errors.
            });
        } else {
          videoEl.pause();
        }
      },
      {
        threshold: 0.4,
      }
    );

    observer.observe(containerEl);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const videoEl = ideVideoRef.current;
    const containerEl = ideVideoContainerRef.current;
    if (!videoEl || !containerEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          videoEl
            .play()
            .catch(() => {
              // Autoplay might be blocked; ignore errors.
            });
        } else {
          videoEl.pause();
        }
      },
      {
        threshold: 0.4,
      }
    );

    observer.observe(containerEl);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const videoEl = costVideoRef.current;
    const containerEl = costVideoContainerRef.current;
    if (!videoEl || !containerEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          videoEl
            .play()
            .catch(() => {
              // Autoplay might be blocked; ignore errors.
            });
        } else {
          videoEl.pause();
        }
      },
      {
        threshold: 0.4,
      }
    );

    observer.observe(containerEl);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const videoEl = lineageVideoRef.current;
    const containerEl = lineageVideoContainerRef.current;
    if (!videoEl || !containerEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          videoEl
            .play()
            .catch(() => {
              // Autoplay might be blocked; ignore errors.
            });
        } else {
          videoEl.pause();
        }
      },
      {
        threshold: 0.4,
      }
    );

    observer.observe(containerEl);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const videoEl = documentationVideoRef.current;
    const containerEl = documentationVideoContainerRef.current;
    if (!videoEl || !containerEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          videoEl
            .play()
            .catch(() => {
              // Autoplay might be blocked; ignore errors.
            });
        } else {
          videoEl.pause();
        }
      },
      {
        threshold: 0.4,
      }
    );

    observer.observe(containerEl);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="bg-[#f5f1e9] text-[#161413]">
      <section id="home" className="px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-7xl">
          {/* Hero Content - Centered */}
          <div className="mx-auto max-w-4xl text-center">
            {/* Animated Badge with Typing Effect */}
            <div className="mb-8 inline-flex min-h-[50px] items-center justify-center gap-2.5 rounded-xl border-2 border-[#ff6a3c]/30 bg-gradient-to-r from-white/95 to-white/90 px-6 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-[#ff6a3c]/50 hover:shadow-xl">
              <Sparkles className="h-5 w-5 flex-shrink-0 animate-pulse text-[#ff6a3c]" />
              <div className="flex items-center">
                <span className="text-lg font-bold tracking-tight text-[#0d0c0a] sm:text-xl lg:text-2xl">
                  {displayedText || '\u00A0'}
                </span>
                <span className="ml-1 inline-block h-5 w-0.5 animate-pulse bg-[#ff6a3c] sm:h-6 lg:h-7"></span>
              </div>
            </div>
            
            {/* Main Headline */}
            <div className="space-y-6">
              <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-[#0d0c0a] sm:text-6xl lg:text-7xl">
                Build faster.{' '}
                <span className="bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] bg-clip-text text-transparent">
                  Ship smarter.
                </span>{' '}
                Spend wisely.
              </h1>
              <p className="mx-auto max-w-3xl text-xl leading-relaxed text-[#59544c] sm:text-2xl">
                Unified AI Workspace for Enterprise Data Teams.
              </p>
            </div>

            {/* Works with */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
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

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#a39c92]">
                Enterprise SSO
              </span>
              <div className="flex items-center gap-2 rounded-full border border-[#e1dcd3] bg-white px-4 py-2 shadow-sm">
                <SiOkta className="h-4 w-4 text-[#007dc1]" />
                <span className="text-sm font-semibold text-[#161413]">Okta</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#e1dcd3] bg-white px-4 py-2 shadow-sm">
                <ShieldCheck className="h-4 w-4 text-[#0072c6]" />
                <span className="text-sm font-semibold text-[#161413]">Azure AD</span>
              </div>
            </div>

            {/* Value Props */}
            <div className="mt-10 flex flex-wrap justify-center gap-6">
              <div className="flex items-center gap-2 text-[#4e493f]">
                <Zap className="h-5 w-5 text-[#ff6a3c]" />
                <span className="font-medium">10x faster development</span>
              </div>
              <div className="flex items-center gap-2 text-[#4e493f]">
                <DollarSign className="h-5 w-5 text-[#ff6a3c]" />
                <span className="font-medium">Auto-detect 20–30% cost savings</span>
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
              <Link
                to="/request-demo"
                className="group inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#bfb8ac] bg-white px-8 py-4 text-lg font-semibold text-[#161413] transition-all duration-300 hover:border-[#ff6a3c] hover:bg-[#fff4ee]"
              >
                Request demo
                <PlayCircle className="h-5 w-5 transition-transform group-hover:scale-110" />
              </Link>
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
          {/* Animated Flow Diagram */}
          <div className="relative overflow-visible rounded-[2rem] border border-gray-200/50 bg-white shadow-2xl">
            <DataFlowDiagram />
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
                Lightning-fast search with Our Unique metadata engine  — find any model, column, or dependency instantly.
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
                Trace every transformation — from source tables to BI dashboards in seconds with Local Offline.
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
          {featureRows.map(({ id, tag, title, description, bullets, placeholder }) => (
            <div
              key={id}
              id={id}
              className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16"
            >
              {/* Content Side */}
              <div className="flex flex-col justify-center space-y-8">
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

         
              </div>
              {/* Visual Side */}
              <div>
                {id === 'architecture' ? (
                  <div
                    className="relative h-[480px] sm:h-[540px] lg:h-[620px] overflow-hidden rounded-[32px] bg-black shadow-[0_40px_80px_rgba(7,7,7,0.4)]"
                    ref={architectureVideoContainerRef}
                  >
                    <video
                      ref={architectureVideoRef}
                      src={architectureVideo}
                      className="block h-full w-full object-contain bg-black"
                      muted
                      loop
                      playsInline
                    />
                  </div>
                ) : id === 'ide' ? (
                  // Simplified, larger video layout for the IDE feature (no zoom)
                  <div
                    className="relative h-[480px] sm:h-[540px] lg:h-[620px] overflow-hidden rounded-[32px] shadow-[0_40px_80px_rgba(7,7,7,0.4)]"
                    ref={ideVideoContainerRef}
                  >
                    <video
                      ref={ideVideoRef}
                      src={autoCodeVideo}
                      className="block h-full w-full object-contain bg-black"
                      muted
                      loop
                      playsInline
                    />
                  </div>
                ) : id === 'lineage' ? (
                  <div
                    className="relative h-[480px] sm:h-[540px] lg:h-[620px] overflow-hidden rounded-[32px] shadow-[0_40px_80px_rgba(7,7,7,0.4)]"
                    ref={lineageVideoContainerRef}
                  >
                    <video
                      ref={lineageVideoRef}
                      src={lineageVideo}
                      className="block h-full w-full object-contain bg-black"
                      muted
                      loop
                      playsInline
                    />
                  </div>
                ) : id === 'documentation' ? (
                  <div
                    className="relative h-[480px] sm:h-[540px] lg:h-[620px] overflow-hidden rounded-[32px] shadow-[0_40px_80px_rgba(7,7,7,0.4)]"
                    ref={documentationVideoContainerRef}
                  >
                    <video
                      ref={documentationVideoRef}
                      src={documentationVideo}
                      className="block h-full w-full object-contain bg-black"
                      muted
                      loop
                      playsInline
                    />
                  </div>
                ) : id === 'cost' ? (
                  <div
                    className="relative h-[480px] sm:h-[540px] lg:h-[620px] overflow-hidden rounded-[32px] shadow-[0_40px_80px_rgba(7,7,7,0.4)]"
                    ref={costVideoContainerRef}
                  >
                    <video
                      ref={costVideoRef}
                      src={costVideo}
                      className="block h-full w-full object-contain bg-black"
                      muted
                      loop
                      playsInline
                    />
                  </div>
                ) : (
                  <div className="group relative overflow-hidden rounded-[32px] border-2 border-[#1f1d1b] bg-gradient-to-br from-[#0b0a09] to-[#141211] p-8 shadow-[0_40px_80px_rgba(7,7,7,0.4)] transition-all duration-500 hover:scale-[1.02]">
                    {/* Video/GIF Placeholder or Autoplay Video */}
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
                )}
              </div>
            </div>
          ))}
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
                href="https://www.linkedin.com/company/duckcode"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#59544c] transition hover:text-[#ff6a3c]"
              >
                <span className="sr-only">LinkedIn</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
