import { NotebookPen } from 'lucide-react';

export default function ReleaseNotesDocs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-10 lg:py-16">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <NotebookPen className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">Release Notes</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Release Notes</h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            High-level log of new features, improvements and breaking changes in DuckCode. This page is a stub you can extend as you ship.
          </p>
        </header>

        <div className="space-y-6 text-sm md:text-base text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">Current Version</h2>
            <p>
              Add your current version number and a short description of the most recent release here. When you cut a new release, move this
              section down into the history and create a new current entry.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">Release History</h2>
            <p>
              As you adopt a formal release process, use this section to record notable changes (features, fixes, migrations) so customers and
              internal teams can track what changed and when.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
