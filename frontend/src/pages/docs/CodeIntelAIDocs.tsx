import { FileText, Brain, Code } from 'lucide-react';

export default function CodeIntelAIDocs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-10 lg:py-16">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <Brain className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">AI Documentation</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Code Intelligence & AI Documentation</h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            Learn how DuckCode analyzes your repositories and generates rich, business-friendly documentation for complex pipelines.
          </p>
        </header>

        <div className="space-y-8 text-sm md:text-base text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">1. What AI Documentation Produces</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>High-level summaries of what a table, view or model does.</li>
              <li>Step-by-step breakdowns of transformation logic.</li>
              <li>Business rules, stakeholders and downstream impact where available.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">2. Running Documentation Jobs</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 mb-2 text-foreground">
                <Code className="h-4 w-4 text-[#2AB7A9]" />
                <span className="font-semibold">Selecting objects</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>From the AI documentation admin view, select one or more objects to document.</li>
                <li>Configure job options such as skipping existing docs or regenerating all.</li>
                <li>Monitor job progress, token usage and cost in the job status panel.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">3. Editing and Trusting AI Output</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 mb-2 text-foreground">
                <FileText className="h-4 w-4 text-[#2AB7A9]" />
                <span className="font-semibold">Human-in-the-loop</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>Engineers and analysts can review and edit AI-generated sections directly in the UI.</li>
                <li>Edits are stored and surfaced with metadata so teammates see who last updated what.</li>
                <li>We recommend treating AI docs as a strong first draft, with experts confirming final wording for critical assets.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
