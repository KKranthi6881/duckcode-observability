import React, { useState } from 'react';
import { AlertCircle, CalendarClock, Mail, PlusCircle, Users, CheckCircle } from 'lucide-react';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { organizationService, roleService, invitationService } from '@/services/enterpriseService';
import type { OrganizationInvitationWithDetails } from '@/types/enterprise';

interface TrialSummary {
  organizationId: string;
  name: string;
  displayName: string;
  adminEmail: string;
  trialEndDate: string | null;
  subscriptionStatus: string | null;
  invitations: OrganizationInvitationWithDetails[];
}

const FOUNDER_EMAIL = 'kranthi@duckcode.ai';

const FounderTrials: React.FC = () => {
  const { user } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastTrial, setLastTrial] = useState<TrialSummary | null>(null);

  if (!user || !user.email || user.email.toLowerCase() !== FOUNDER_EMAIL) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-foreground mb-1">Restricted area</h1>
          <p className="text-sm text-muted-foreground">
            This page is only available to the DuckCode founder account.
          </p>
        </div>
      </div>
    );
  }

  const createSlugFromName = (name: string): string => {
    const base = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (base.length === 0) {
      return `org-${Date.now()}`;
    }
    return base;
  };

  const handleCreateTrial = async () => {
    setError(null);
    setSuccess(null);

    const trimmedOrgName = orgName.trim();
    const trimmedDisplayName = displayName.trim() || trimmedOrgName;
    const trimmedEmail = adminEmail.trim().toLowerCase();

    if (!trimmedOrgName || !trimmedEmail) {
      setError('Organization name and admin email are required.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Please enter a valid admin email address.');
      return;
    }

    setCreating(true);
    try {
      const slug = createSlugFromName(trimmedOrgName);
      const emailDomain = trimmedEmail.split('@')[1] || null;

      // 1) Create organization (this will auto-create a 30-day trial subscription via trigger)
      const org = await organizationService.createOrganization({
        name: slug,
        display_name: trimmedDisplayName,
        domain: emailDomain || undefined,
      });

      // 2) Fetch roles for the new org and pick Admin role
      const roles = await roleService.getOrganizationRoles(org.id);
      const adminRole = roles.find((r) => r.name === 'Admin') || roles[0];
      if (!adminRole) {
        throw new Error('No roles found for new organization');
      }

      // 3) Send invitation to admin email
      await invitationService.inviteUser({
        organization_id: org.id,
        emails: [trimmedEmail],
        role_id: adminRole.id,
        message: 'Welcome to your 30-day DuckCode trial. Click the link in this email to activate your account.',
      });

      // 4) Load subscription + invitations for summary
      const { data: subRow } = await supabase
        .schema('enterprise')
        .from('organization_subscriptions')
        .select('subscription_status, trial_end_date')
        .eq('organization_id', org.id)
        .single();

      const invitations = await invitationService.getInvitations(org.id);

      setLastTrial({
        organizationId: org.id,
        name: org.name,
        displayName: org.display_name,
        adminEmail: trimmedEmail,
        trialEndDate: subRow?.trial_end_date ?? null,
        subscriptionStatus: subRow?.subscription_status ?? null,
        invitations,
      });

      setSuccess('Trial organization created and invite email sent.');
      setOrgName('');
      setDisplayName('');
      setAdminEmail('');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to create trial organization.';
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Founder Trial Control
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create 30-day trial organizations and send admin invites.
            </p>
          </div>
        </div>

        {/* Create Trial Card */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <PlusCircle className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Create new 30-day trial</h2>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              <CheckCircle className="w-4 h-4 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Organization name (slug)</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Data Team"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used to generate the unique organization slug.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Display name (optional)</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Acme Corp – Data Platform"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">Admin email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@customer.com"
                  className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                We’ll send a single invite email to this address with a link to activate the trial.
              </p>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={handleCreateTrial}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Creating trial…' : 'Create 30-day trial'}
            </button>
          </div>
        </div>

        {/* Last Trial Summary */}
        {lastTrial && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarClock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Last created trial</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Organization</p>
                <p className="font-semibold text-foreground">{lastTrial.displayName}</p>
                <p className="text-xs text-muted-foreground">Slug: {lastTrial.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Admin email</p>
                <p className="font-semibold text-foreground">{lastTrial.adminEmail}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Trial & subscription</p>
                <p className="font-semibold text-foreground">
                  {lastTrial.trialEndDate
                    ? `Trial until ${new Date(lastTrial.trialEndDate).toLocaleDateString()}`
                    : 'Trial end not available'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: {lastTrial.subscriptionStatus || 'unknown'}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-foreground mb-2">Invitations</p>
              {lastTrial.invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invitations found for this organization yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="min-w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Email</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Status</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Role</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Invited</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Accepted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lastTrial.invitations.map((inv) => (
                        <tr key={inv.id}>
                          <td className="px-3 py-2 text-foreground">{inv.email}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-foreground">{inv.role_name || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {new Date(inv.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {inv.accepted_at ? new Date(inv.accepted_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FounderTrials;
