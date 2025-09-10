import { Request, Response } from 'express';
import supabaseAdmin, { supabaseDuckCode } from '../../config/supabaseClient';

function normalizeAgentInterests(input: any): string[] {
  if (!input) return ['all'];
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [input];
  }
  if (Array.isArray(input)) return input;
  return ['all'];
}

export const WaitlistController = {
  // Public endpoint: join waitlist
  async join(req: Request, res: Response) {
    try {
      const { email, full_name, plan_choice, agent_interests, source, metadata } = req.body || {};

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }

      const plan = plan_choice === 'free_50_pro' ? 'free_50_pro' : 'own_api_key';
      const interests = normalizeAgentInterests(agent_interests);

      const payload = {
        email: email.trim().toLowerCase(),
        full_name: full_name || null,
        plan_choice: plan,
        agent_interests: interests,
        source: source || 'web',
        metadata: (metadata && typeof metadata === 'object') ? metadata : {},
        status: 'pending',
      };

      const { data, error } = await supabaseDuckCode
        .from('waitlist')
        .upsert(payload, { onConflict: 'email' })
        .select('*')
        .single();

      if (error) {
        console.error('[Waitlist join] Insert error:', error);
        return res.status(500).json({ error: 'Failed to add to waitlist', details: error.message });
      }

      return res.json({ success: true, waitlist: data });
    } catch (err) {
      console.error('[Waitlist join] Unexpected error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Admin endpoint: list waitlist
  async list(req: Request, res: Response) {
    try {
      const { status = 'pending', q } = req.query as { status?: string; q?: string };

      let query = supabaseDuckCode.from('waitlist').select('*').order('created_at', { ascending: false });
      if (status) {
        query = query.eq('status', status);
      }
      if (q) {
        // Simple email filter
        query = query.ilike('email', `%${q}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[Waitlist list] Error:', error);
        return res.status(500).json({ error: 'Failed to fetch waitlist', details: error.message });
      }

      return res.json({ items: data });
    } catch (err) {
      console.error('[Waitlist list] Unexpected error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Admin endpoint: approve and send invite
  async approve(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      if (!id) return res.status(400).json({ error: 'Missing id' });

      // Fetch record
      const { data: record, error: fetchErr } = await supabaseDuckCode
        .from('waitlist')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !record) {
        return res.status(404).json({ error: 'Waitlist record not found' });
      }

      // Update status first
      const { data: updated, error: updateErr } = await supabaseDuckCode
        .from('waitlist')
        .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: req.user?.id || null })
        .eq('id', id)
        .select('*')
        .single();

      if (updateErr) {
        console.error('[Waitlist approve] Update error:', updateErr);
        return res.status(500).json({ error: 'Failed to update status', details: updateErr.message });
      }

      // Send invitation email via Supabase Admin API
      try {
        const { data: invite, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(updated.email, {
          data: {
            plan_choice: updated.plan_choice,
            agent_interests: updated.agent_interests,
            source: updated.source,
          },
        });

        if (inviteError) {
          console.error('[Waitlist approve] Invite error:', inviteError);
          // If user already exists, we can generate a login link instead
          try {
            const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
              type: 'magiclink',
              email: updated.email,
            });
            if (linkErr) {
              console.error('[Waitlist approve] Magic Link error:', linkErr);
              return res.status(500).json({ error: 'Failed to send activation email', details: inviteError.message });
            }
          } catch (e) {
            console.error('[Waitlist approve] Fallback link generation error:', e);
            return res.status(500).json({ error: 'Failed to send activation email' });
          }
        }
      } catch (adminErr) {
        console.error('[Waitlist approve] Admin invite exception:', adminErr);
        return res.status(500).json({ error: 'Admin invite failed' });
      }

      return res.json({ success: true, waitlist: updated });
    } catch (err) {
      console.error('[Waitlist approve] Unexpected error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  },

  // Admin endpoint: reject
  async reject(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { notes } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const { data, error } = await supabaseDuckCode
        .from('waitlist')
        .update({ status: 'rejected', notes: notes || null })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('[Waitlist reject] Update error:', error);
        return res.status(500).json({ error: 'Failed to update status', details: error.message });
      }

      return res.json({ success: true, waitlist: data });
    } catch (err) {
      console.error('[Waitlist reject] Unexpected error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  },
};
