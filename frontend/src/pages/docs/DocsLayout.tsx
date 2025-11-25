import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, LayoutDashboard, Rocket, Plug, Activity, Globe2, LifeBuoy, Shield, Search } from 'lucide-react';

interface NavItem {
  label: string;
  to: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface TocItem {
  id: string;
  text: string;
}

interface DocsPage {
  path: string;
  label: string;
}

const primarySections: NavSection[] = [
  {
    title: 'Getting started',
    items: [
      { label: 'Product overview', to: '/docs', icon: LayoutDashboard },
      { label: 'Getting started', to: '/docs/getting-started', icon: Rocket },
      { label: 'Workspaces & organizations', to: '/docs/workspaces-organizations' },
    ],
  },
  {
    title: 'Data & analytics',
    items: [
      { label: 'Connectors', to: '/docs/connectors', icon: Plug },
      { label: 'Code intelligence & AI docs', to: '/docs/code-intel-ai-docs', icon: Activity },
      { label: 'Observability & analytics', to: '/docs/observability-analytics' },
    ],
  },
  {
    title: 'Integrations & operations',
    items: [
      { label: 'API & integrations', to: '/docs/api-overview', icon: Globe2 },
      { label: 'Troubleshooting & operations', to: '/docs/troubleshooting', icon: LifeBuoy },
      { label: 'Release notes', to: '/docs/release-notes' },
    ],
  },
];

const enterpriseSection: NavSection = {
  title: 'Enterprise & security',
  items: [
    { label: 'Enterprise overview', to: '/docs/enterprise/overview', icon: Shield },
    { label: 'Identity & access management', to: '/docs/enterprise/iam' },
    { label: 'SSO management', to: '/docs/enterprise/sso-management' },
    { label: 'API keys & integrations', to: '/docs/enterprise/api-keys' },
    { label: 'Snowflake security', to: '/docs/enterprise/snowflake-security' },
    { label: 'Security & compliance FAQ', to: '/docs/enterprise/security-faq' },
  ],
};

const docsPages: DocsPage[] = [
  { path: '', label: 'Product overview' },
  { path: 'getting-started', label: 'Getting started' },
  { path: 'workspaces-organizations', label: 'Workspaces & organizations' },
  { path: 'connectors', label: 'Connectors' },
  { path: 'code-intel-ai-docs', label: 'Code intelligence & AI docs' },
  { path: 'observability-analytics', label: 'Observability & analytics' },
  { path: 'api-overview', label: 'API & integrations' },
  { path: 'troubleshooting', label: 'Troubleshooting & operations' },
  { path: 'release-notes', label: 'Release notes' },
  { path: 'enterprise/overview', label: 'Enterprise overview' },
  { path: 'enterprise/iam', label: 'Identity & access management' },
  { path: 'enterprise/sso-management', label: 'SSO management' },
  { path: 'enterprise/api-keys', label: 'API keys & integrations' },
  { path: 'enterprise/snowflake-security', label: 'Snowflake security' },
  { path: 'enterprise/security-faq', label: 'Security & compliance FAQ' },
];

function DocsNavLink({ item }: { item: NavItem }) {
  const location = useLocation();
  const isActive = location.pathname === item.to;

  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/docs'}
      className={
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ' +
        (isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground')
      }
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function DocsNavSection({ section }: { section: NavSection }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
        <span>{section.title}</span>
        {section.title === 'Enterprise & security' && (
          <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200 bg-amber-50/80 dark:bg-amber-950/40">
            Enterprise
          </span>
        )}
      </p>
      <div className="space-y-1">
        {section.items.map((item) => (
          <DocsNavLink key={item.to} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function DocsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const headings = Array.from(document.querySelectorAll('main h2')) as HTMLHeadingElement[];
    const items: TocItem[] = headings
      .map((heading) => {
        const text = heading.textContent?.trim() || '';
        if (!text) {
          return null;
        }
        let id = heading.id;
        if (!id) {
          id = text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          heading.id = id;
        }
        return { id, text };
      })
      .filter((item): item is TocItem => Boolean(item));
    setTocItems(items);
  }, [location.pathname]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filterSectionItems = (section: NavSection): NavSection => ({
    ...section,
    items: section.items.filter((item) =>
      item.label.toLowerCase().includes(normalizedQuery)
    ),
  });

  const filteredPrimarySections = normalizedQuery
    ? primarySections
        .map(filterSectionItems)
        .filter((section) => section.items.length > 0)
    : primarySections;

  const filteredEnterpriseSection = normalizedQuery
    ? filterSectionItems(enterpriseSection)
    : enterpriseSection;

  const hasEnterpriseItems = filteredEnterpriseSection.items.length > 0;

  const currentPath = location.pathname.startsWith('/docs')
    ? location.pathname.replace(/^\/docs/, '') || '/'
    : '/';
  const normalizedCurrentPath = currentPath === '/' ? '' : currentPath.replace(/^\//, '');
  const currentIndex = docsPages.findIndex((page) => page.path === normalizedCurrentPath);
  const previousPage = currentIndex > 0 ? docsPages[currentIndex - 1] : null;
  const nextPage =
    currentIndex >= 0 && currentIndex < docsPages.length - 1
      ? docsPages[currentIndex + 1]
      : null;
  const isEnterprisePath = normalizedCurrentPath.startsWith('enterprise/');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }

      if (event.key === '[' && previousPage) {
        event.preventDefault();
        navigate(previousPage.path ? `/docs/${previousPage.path}` : '/docs');
      } else if (event.key === ']' && nextPage) {
        event.preventDefault();
        navigate(nextPage.path ? `/docs/${nextPage.path}` : '/docs');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, previousPage, nextPage]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">DuckCode Documentation</span>
          </div>
          <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl">
            Explore product, connectors, AI documentation, observability and enterprise security guides in one place.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <aside className="lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-24 self-start">
            <div className="rounded-xl border border-border bg-card/80 p-4 space-y-4">
              <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search docs"
                  className="h-7 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/70"
                />
              </div>
              <div className="space-y-5">
                {filteredPrimarySections.map((section) => (
                  <DocsNavSection key={section.title} section={section} />
                ))}
                {hasEnterpriseItems && (
                  <div className="border-t border-border/60 pt-4 mt-2">
                    <DocsNavSection section={filteredEnterpriseSection} />
                  </div>
                )}
                {normalizedQuery &&
                  !filteredPrimarySections.length &&
                  !hasEnterpriseItems && (
                    <p className="text-[11px] text-muted-foreground/80">
                      No docs match your search.
                    </p>
                  )}
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            {isEnterprisePath && (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-[#2AB7A9]" />
                <span className="font-medium uppercase tracking-wide">Enterprise docs</span>
              </div>
            )}
            {tocItems.length > 0 && (
              <div className="mb-6 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs md:text-sm">
                <p className="mb-2 font-medium text-muted-foreground">On this page</p>
                <div className="flex flex-wrap gap-2">
                  {tocItems.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/60 transition-colors"
                    >
                      {item.text}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <Outlet />
            {(previousPage || nextPage) && (
              <>
                <div className="mt-10 flex flex-col gap-3 border-t border-border/60 pt-4 md:flex-row md:items-center md:justify-between text-xs md:text-sm">
                  {previousPage ? (
                    <NavLink
                      to={previousPage.path ? `/docs/${previousPage.path}` : '/docs'}
                      className="group inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                        Previous
                      </span>
                      <span className="truncate">{previousPage.label}</span>
                    </NavLink>
                  ) : (
                    <span />
                  )}
                  {nextPage && (
                    <NavLink
                      to={nextPage.path ? `/docs/${nextPage.path}` : '/docs'}
                      className="group inline-flex items-center gap-2 text-muted-foreground hover:text-foreground md:ml-auto"
                    >
                      <span className="truncate text-right">{nextPage.label}</span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                        Next
                      </span>
                    </NavLink>
                  )}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground/80 md:text-right">
                  Tip: you can also use <span className="font-mono text-foreground">[</span> and <span className="font-mono text-foreground">
                    ]
                  </span>{' '}
                  to move between pages.
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
