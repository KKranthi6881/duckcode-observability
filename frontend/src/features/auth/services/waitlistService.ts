export type PlanChoice = 'own_api_key' | 'free_50_pro';
export type AgentInterest = 'data_architect' | 'data_developer' | 'data_troubleshooter' | 'platform_dba' | 'all';

export interface WaitlistPayload {
  email: string;
  full_name?: string;
  plan_choice: PlanChoice;
  agent_interests: AgentInterest[];
  source?: 'web' | 'ide';
  metadata?: Record<string, unknown>;
}

export async function joinWaitlist(payload: WaitlistPayload): Promise<{ success: boolean }>{
  const res = await fetch('/api/waitlist/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Failed to join waitlist');
  }
  return res.json();
}
