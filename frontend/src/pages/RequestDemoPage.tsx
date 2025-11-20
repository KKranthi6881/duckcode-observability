import React, { useState } from 'react';
import { ArrowRight, Building2, Mail, User, Users } from 'lucide-react';
import { joinWaitlist } from '../features/auth/services/waitlistService';

const RequestDemoPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [useCase, setUseCase] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTimeWindow, setPreferredTimeWindow] = useState('');
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [wantsTrial, setWantsTrial] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus('idle');
    setError(null);

    try {
      await joinWaitlist({
        email: email.trim(),
        full_name: fullName.trim(),
        plan_choice: 'free_50_pro',
        agent_interests: ['all'],
        source: 'web',
        metadata: {
          type: 'demo_request',
          company: company.trim(),
          role: role.trim(),
          team_size: teamSize,
          use_case: useCase.trim(),
          wants_trial: wantsTrial,
          preferred_date: preferredDate || undefined,
          preferred_time_window: preferredTimeWindow || undefined,
          availability_notes: availabilityNotes.trim() || undefined,
          from_page: 'request_demo',
        },
      });

      setStatus('success');
      setFullName('');
      setEmail('');
      setCompany('');
      setRole('');
      setTeamSize('');
      setUseCase('');
      setPreferredDate('');
      setPreferredTimeWindow('');
      setAvailabilityNotes('');
      setWantsTrial(true);
    } catch (err: unknown) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Failed to submit demo request. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f1e9] text-[#161413] flex items-center justify-center px-4 py-16">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[#e1dcd3] bg-white/95 shadow-2xl">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#ff6a3c]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#2AB7A9]/15 blur-3xl" />

        <div className="relative px-6 py-8 sm:px-10 sm:py-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d6d2c9] bg-[#f5f1e9] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#7b7469]">
            <span className="h-2 w-2 rounded-full bg-[#ff6a3c]" />
            Request enterprise demo
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[#0d0c0a] sm:text-3xl">
            See Duckcode.ai in action for your team
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#59544c]">
            Share a few details and we&apos;ll reach out to schedule a live walkthrough, tailored to your
            data stack and workflows. You can optionally start a 30-day trial right after the session.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {status === 'success' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div className="font-semibold">Thanks for your interest!</div>
                <p className="mt-1">
                  Your demo request has been received. We&apos;ll email you shortly with scheduling options.
                </p>
              </div>
            )}

            {status === 'error' && error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <div className="font-semibold">Something went wrong</div>
                <p className="mt-1">{error}</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col text-sm font-medium text-[#4e493f]">
                Full name
                <span className="mt-1 flex items-center gap-2 rounded-xl border border-[#e1dcd3] bg-white px-3 py-2.5 text-sm text-[#161413] focus-within:border-[#ff6a3c] focus-within:ring-1 focus-within:ring-[#ff6a3c]">
                  <User className="h-4 w-4 text-[#b3aa9d]" />
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="flex-1 border-0 bg-transparent text-sm text-[#161413] placeholder:text-[#b3aa9d] focus:outline-none focus:ring-0"
                  />
                </span>
              </label>

              <label className="flex flex-col text-sm font-medium text-[#4e493f]">
                Work email
                <span className="mt-1 flex items-center gap-2 rounded-xl border border-[#e1dcd3] bg-white px-3 py-2.5 text-sm text-[#161413] focus-within:border-[#ff6a3c] focus-within:ring-1 focus-within:ring-[#ff6a3c]">
                  <Mail className="h-4 w-4 text-[#b3aa9d]" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="flex-1 border-0 bg-transparent text-sm text-[#161413] placeholder:text-[#b3aa9d] focus:outline-none focus:ring-0"
                  />
                </span>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col text-sm font-medium text-[#4e493f]">
                Company
                <span className="mt-1 flex items-center gap-2 rounded-xl border border-[#e1dcd3] bg-white px-3 py-2.5 text-sm text-[#161413] focus-within:border-[#ff6a3c] focus-within:ring-1 focus-within:ring-[#ff6a3c]">
                  <Building2 className="h-4 w-4 text-[#b3aa9d]" />
                  <input
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Corp"
                    className="flex-1 border-0 bg-transparent text-sm text-[#161413] placeholder:text-[#b3aa9d] focus:outline-none focus:ring-0"
                  />
                </span>
              </label>

              <label className="flex flex-col text-sm font-medium text-[#4e493f]">
                Role
                <span className="mt-1 flex items-center gap-2 rounded-xl border border-[#e1dcd3] bg-white px-3 py-2.5 text-sm text-[#161413] focus-within:border-[#ff6a3c] focus-within:ring-1 focus-within:ring-[#ff6a3c]">
                  <Users className="h-4 w-4 text-[#b3aa9d]" />
                  <input
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Head of Data, Analytics Engineer, ..."
                    className="flex-1 border-0 bg-transparent text-sm text-[#161413] placeholder:text-[#b3aa9d] focus:outline-none focus:ring-0"
                  />
                </span>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col text-sm font-medium text-[#4e493f]">
                Team size
                <select
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                  className="mt-1 rounded-xl border border-[#e1dcd3] bg-white px-3 py-2.5 text-sm text-[#161413] focus:border-[#ff6a3c] focus:outline-none focus:ring-1 focus:ring-[#ff6a3c]"
                >
                  <option value="">Select an option</option>
                  <option value="1-5">1-5</option>
                  <option value="6-20">6-20</option>
                  <option value="21-50">21-50</option>
                  <option value="51-200">51-200</option>
                  <option value="200+">200+</option>
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-[#e1dcd3] bg-white px-4 py-3 text-sm text-[#4e493f]">
                <input
                  type="checkbox"
                  checked={wantsTrial}
                  onChange={(e) => setWantsTrial(e.target.checked)}
                  className="h-4 w-4 rounded border-[#d6d2c9] text-[#ff6a3c] focus:ring-[#ff6a3c]"
                />
                <span>We&apos;re interested in a 30-day trial after the demo</span>
              </label>
            </div>

            <div className="space-y-3 rounded-2xl border border-[#e1dcd3] bg-[#f9f6f0] px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#4e493f]">
                  When are you generally available for a demo?
                </p>
                <span className="text-[11px] text-[#7b7469]">Optional, but helps us schedule faster</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col text-sm font-medium text-[#4e493f]">
                  Preferred date
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="mt-1 rounded-xl border border-[#e1dcd3] bg-white px-3 py-2.5 text-sm text-[#161413] focus:border-[#ff6a3c] focus:outline-none focus:ring-1 focus:ring-[#ff6a3c]"
                  />
                </label>

                <label className="flex flex-col text-sm font-medium text-[#4e493f]">
                  Preferred time of day (US time zones)
                  <select
                    value={preferredTimeWindow}
                    onChange={(e) => setPreferredTimeWindow(e.target.value)}
                    className="mt-1 rounded-xl border border-[#e1dcd3] bg-white px-3 py-2.5 text-sm text-[#161413] focus:border-[#ff6a3c] focus:outline-none focus:ring-1 focus:ring-[#ff6a3c]"
                  >
                    <option value="">Select an option</option>
                    <option value="Morning (9–12 ET / 8–11 CT / 6–9 PT)">
                      Morning (9–12 ET / 8–11 CT / 6–9 PT)
                    </option>
                    <option value="Afternoon (12–4 ET / 11–3 CT / 9–1 PT)">
                      Afternoon (12–4 ET / 11–3 CT / 9–1 PT)
                    </option>
                    <option value="Late afternoon (4–7 ET / 3–6 CT / 1–4 PT)">
                      Late afternoon (4–7 ET / 3–6 CT / 1–4 PT)
                    </option>
                  </select>
                  <p className="mt-1 text-[11px] text-[#7b7469]">
                    We&apos;ll confirm the exact slot by email. If you&apos;re outside the US, you can mention your
                    timezone below.
                  </p>
                </label>
              </div>

              <label className="flex flex-col text-sm font-medium text-[#4e493f]">
                Additional availability details (optional)
                <textarea
                  value={availabilityNotes}
                  onChange={(e) => setAvailabilityNotes(e.target.value)}
                  rows={2}
                  className="mt-1 rounded-2xl border border-[#e1dcd3] bg-white px-3 py-2.5 text-sm text-[#161413] placeholder:text-[#b3aa9d] focus:border-[#ff6a3c] focus:outline-none focus:ring-1 focus:ring-[#ff6a3c]"
                  placeholder="Share a couple of options for next week and your timezone (e.g. PST, EST, CET)."
                />
              </label>
            </div>

            <label className="flex flex-col text-sm font-medium text-[#4e493f]">
              What would you like to focus on in the demo?
              <textarea
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                rows={4}
                className="mt-1 rounded-2xl border border-[#e1dcd3] bg-white px-3 py-2.5 text-sm text-[#161413] placeholder:text-[#b3aa9d] focus:border-[#ff6a3c] focus:outline-none focus:ring-1 focus:ring-[#ff6a3c]"
                placeholder="e.g., speeding up dbt development, column-level lineage for Snowflake, cutting warehouse spend, etc."
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(255,106,60,0.45)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_22px_55px_rgba(255,106,60,0.55)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Submitting...' : 'Submit request'}
              <ArrowRight className="h-4 w-4" />
            </button>

            <p className="mt-3 text-center text-xs text-[#7b7469]">
              We&apos;ll only use your details to coordinate the demo and trial. No spam.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RequestDemoPage;
