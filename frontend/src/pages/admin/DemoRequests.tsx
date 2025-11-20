import { useState, useEffect, useMemo } from 'react';
import { Users, Mail, Building2, Filter, RefreshCw, Search, CalendarClock } from 'lucide-react';

interface WaitlistRecord {
  id: string;
  email: string;
  full_name?: string | null;
  plan_choice?: string | null;
  agent_interests?: string[] | null;
  source?: string | null;
  status: string;
  metadata?: {
    type?: string;
    company?: string;
    role?: string;
    team_size?: string;
    use_case?: string;
    wants_trial?: boolean;
    preferred_date?: string;
    preferred_time_window?: string;
    availability_notes?: string;
    [key: string]: unknown;
  } | null;
  created_at?: string;
}

export const DemoRequests: React.FC = () => {
  const [requests, setRequests] = useState<WaitlistRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [search, setSearch] = useState('');

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/waitlist?status=${statusFilter}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to load demo requests');
      }

      const data = await res.json();
      const items = (data?.items || []) as WaitlistRecord[];

      const demoItems = items.filter((item) => item.metadata && item.metadata.type === 'demo_request');

      setRequests(demoItems);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load demo requests';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;

    return requests.filter((r) => {
      const name = (r.full_name || '').toLowerCase();
      const email = (r.email || '').toLowerCase();
      const company = (r.metadata?.company || '').toLowerCase();
      const useCase = (r.metadata?.use_case || '').toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        company.includes(q) ||
        useCase.includes(q)
      );
    });
  }, [requests, search]);

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasRequests = filteredRequests.length > 0;

  if (loading && !hasRequests && !error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Loading demo requests...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Users className="w-6 h-6 text-primary" />
              Demo Requests
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Centralized list of inbound demo requests for Duckcode team members to review and schedule demos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadRequests}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card border border-border rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Filter className="h-3 w-3" />
              Status
            </span>
            <div className="flex rounded-lg border border-border bg-muted text-xs">
              {(['pending', 'approved', 'rejected'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, email, or company"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Table */}
        {hasRequests ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/60 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Requested</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Contact</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Company / Role</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Demo Focus</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Availability</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Trial Intent</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/80">
                  {filteredRequests.map((req) => {
                    const wantsTrial = !!req.metadata?.wants_trial;
                    const interests = Array.isArray(req.agent_interests) ? req.agent_interests : [];

                    return (
                      <tr key={req.id} className="hover:bg-accent/40">
                        <td className="px-4 py-3 align-top text-foreground whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span>{formatDate(req.created_at)}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" />
                              {req.source || 'web'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-foreground">
                              <Users className="h-4 w-4 text-primary" />
                              <span className="font-semibold">
                                {req.full_name || 'Unknown contact'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[220px]">{req.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-foreground">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium truncate max-w-[220px]">
                                {req.metadata?.company || '—'}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                              {req.metadata?.role || 'Role not specified'}
                            </span>
                            {interests.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {interests.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                                  >
                                    {tag.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="max-w-xs text-[11px] leading-snug text-muted-foreground">
                            {req.metadata?.use_case || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                            {req.metadata?.preferred_date || req.metadata?.preferred_time_window ? (
                              <div className="flex items-center gap-1 text-foreground">
                                <CalendarClock className="h-3 w-3" />
                                <span>
                                  {req.metadata?.preferred_date || 'Flexible date'}
                                  {req.metadata?.preferred_time_window
                                    ? ` · ${req.metadata.preferred_time_window}`
                                    : ''}
                                </span>
                              </div>
                            ) : (
                              <span>Not specified</span>
                            )}
                            {req.metadata?.availability_notes && (
                              <span className="truncate max-w-[260px]">
                                {req.metadata.availability_notes}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              wantsTrial
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                                : 'bg-muted text-muted-foreground border border-border'
                            }`}
                          >
                            {wantsTrial ? 'Wants 30-day trial' : 'Demo only for now'}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                              req.status === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                                : req.status === 'rejected'
                                ? 'bg-red-500/15 text-red-300 border border-red-500/40'
                                : 'bg-yellow-500/10 text-yellow-200 border border-yellow-500/40'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card px-8 py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">No demo requests yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              When customers submit the Request demo form on the marketing site, they will appear here for your team to review.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DemoRequests;
