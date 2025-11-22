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
  const [wantsTrial, setWantsTrial] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showCalendly, setShowCalendly] = useState(false);

  const baseCalendlyUrl = 'https://calendly.com/kranthi-duckcode/duckcode-demo-session';
  const calendlyParams = new URLSearchParams();
  if (fullName) calendlyParams.append('name', fullName);
  if (email) calendlyParams.append('email', email);
  const calendlyUrl = calendlyParams.toString()
    ? `${baseCalendlyUrl}?${calendlyParams.toString()}`
    : baseCalendlyUrl;

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
          from_page: 'request_demo',
        },
      });

      setStatus('success');
      setShowCalendly(true);
      // Keep the form data to pre-fill Calendly - don't clear it
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
            {!showCalendly 
              ? "Share a few details below, then pick a time for your personalized demo. You can optionally start a 30-day trial right after the session."
              : "Your details have been saved. Now choose a convenient time for your live demo."}
          </p>

          {!showCalendly ? (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">

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
          ) : (
            <div className="mt-8">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800 mb-6">
                <div className="font-semibold">✓ Thanks, {fullName}!</div>
                <p className="mt-1">
                  Your information has been saved. Now pick a time that works best for your demo session.
                </p>
                <button
                  onClick={() => setShowCalendly(false)}
                  className="mt-3 text-xs text-emerald-700 hover:text-emerald-900 underline"
                >
                  ← Edit my information
                </button>
              </div>

              <div className="border-t border-[#e1dcd3] pt-6">
                <h2 className="text-lg font-semibold text-[#0d0c0a] mb-2">
                  Schedule your live demo
                </h2>
                <p className="text-sm text-[#59544c] mb-4">
                  Pick a time slot below. You&apos;ll receive a calendar invite with the Zoom link automatically.
                </p>
                <div className="rounded-2xl border border-[#e1dcd3] bg-white/70 overflow-hidden">
                  <iframe
                    title="Schedule a Duckcode demo"
                    src={calendlyUrl}
                    className="w-full h-[640px]"
                    frameBorder="0"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestDemoPage;
