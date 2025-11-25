import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function TroubleshootingDocs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-10 lg:py-16">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-3">
            <AlertTriangle className="h-3.5 w-3.5 text-[#2AB7A9]" />
            <span className="font-medium tracking-wide">Troubleshooting</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Troubleshooting & Operations</h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            Common issues and operational tips for keeping DuckCode healthy in your environment.
          </p>
        </header>

        <div className="space-y-8 text-sm md:text-base text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">1. Connectors & Syncs</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Check connector configuration (credentials, account names, roles) in the admin portal.</li>
              <li>Verify network access from DuckCode to Snowflake and GitHub.</li>
              <li>Look for recent sync or extraction jobs and their status.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">2. AI Documentation Jobs</h2>
            <div className="rounded-lg border border-border bg-card/80 p-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 mb-2 text-foreground">
                <RefreshCw className="h-4 w-4 text-[#2AB7A9]" />
                <span className="font-semibold">Job health</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>Use the job status view to confirm progress and error logs for documentation runs.</li>
                <li>Retry failed jobs after addressing underlying connection or token issues.</li>
                <li>Monitor token usage and cost estimates for very large batches.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">3. When to Contact Support</h2>
            <p>
              If you see persistent failures, unexpected security events or performance issues, capture timestamps and context (org, user,
              connector) and reach out to support so we can correlate with server-side logs.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
