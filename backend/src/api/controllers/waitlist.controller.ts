import { Request, Response } from 'express';
import supabaseAdmin, { supabaseDuckCode } from '../../config/supabaseClient';
import EmailService from '../../services/EmailService';

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

  // Public endpoint: Calendly webhook for demo scheduling
  async calendlyWebhook(req: Request, res: Response) {
    try {
      const eventType = req.body?.event;
      const payload = req.body?.payload || {};

      if (eventType !== 'invitee.created') {
        return res.status(200).json({ success: true, message: 'Event ignored' });
      }

      const emailRaw = payload.email || payload.email_address;
      if (!emailRaw || typeof emailRaw !== 'string') {
        console.warn('[Calendly webhook] Missing email in payload');
        return res.status(200).json({ success: false, message: 'Missing email' });
      }

      const email = emailRaw.trim().toLowerCase();
      const startTime = payload.calendar_event?.start_time || payload.start_time;
      const endTime = payload.calendar_event?.end_time || payload.end_time;
      const timezone = payload.timezone || payload.invitee_timezone || null;
      const eventName = payload.event_type?.name || payload.event_type_name || null;
      const calendlyCreatedAt = payload.created_at || null;

      if (!startTime || !endTime) {
        console.warn('[Calendly webhook] Missing start or end time', { email, startTime, endTime });
      }

      // Find the most recent demo_request waitlist record for this email
      const { data: matches, error: fetchErr } = await supabaseDuckCode
        .from('waitlist')
        .select('*')
        .eq('email', email)
        .contains('metadata', { type: 'demo_request' })
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchErr) {
        console.error('[Calendly webhook] Failed to look up waitlist record:', fetchErr);
        return res.status(500).json({ error: 'Failed to look up waitlist record' });
      }

      const record = matches && matches[0];
      if (!record) {
        console.warn('[Calendly webhook] No matching waitlist record found for email', email);
        return res.status(200).json({ success: true, message: 'No matching waitlist record' });
      }

      const existingMetadata = (record.metadata && typeof record.metadata === 'object')
        ? record.metadata
        : {};

      const newMetadata = {
        ...existingMetadata,
        scheduled_start: startTime,
        scheduled_end: endTime,
        scheduled_timezone: timezone,
        calendly_event_name: eventName,
        calendly_created_at: calendlyCreatedAt,
        schedule_status: 'booked',
      };

      const { data: updated, error: updateErr } = await supabaseDuckCode
        .from('waitlist')
        .update({ metadata: newMetadata })
        .eq('id', record.id)
        .select('*')
        .single();

      if (updateErr) {
        console.error('[Calendly webhook] Failed to update waitlist record:', updateErr);
        return res.status(500).json({ error: 'Failed to update waitlist record' });
      }

      // Build notification email for internal team
      const contactName: string = updated.full_name || payload.name || email;
      const company: string = (updated.metadata && (updated.metadata as any).company) || 'Unknown company';
      const role: string = (updated.metadata && (updated.metadata as any).role) || 'Not specified';
      const teamSize: string = (updated.metadata && (updated.metadata as any).team_size) || 'Not specified';
      const useCase: string = (updated.metadata && (updated.metadata as any).use_case) || 'Not specified';
      const wantsTrialFlag: boolean = !!(updated.metadata && (updated.metadata as any).wants_trial);

      const scheduledTimeText = startTime
        ? `${startTime}${timezone ? ` (${timezone})` : ''}`
        : 'Not captured (check Calendly event)';

      const subject = `New Duckcode demo booked – ${company} (${contactName})`;
      const html = `
        <h2>New demo booked via Calendly</h2>
        <p>A new demo has been scheduled from the marketing site.</p>
        <h3>Contact</h3>
        <ul>
          <li><strong>Name:</strong> ${contactName}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Company:</strong> ${company}</li>
          <li><strong>Role:</strong> ${role}</li>
          <li><strong>Team size:</strong> ${teamSize}</li>
        </ul>
        <h3>Demo details</h3>
        <ul>
          <li><strong>Scheduled time:</strong> ${scheduledTimeText}</li>
          <li><strong>Event type:</strong> ${eventName || 'Duckcode demo session'}</li>
          <li><strong>Use case focus:</strong> ${useCase}</li>
          <li><strong>Wants 30-day trial:</strong> ${wantsTrialFlag ? 'Yes' : 'No'}</li>
        </ul>
        <p>You can also find this contact in the <strong>Admin → Demo Requests</strong> view (waitlist table, type=demo_request).</p>
      `;

      await EmailService.sendEmail({
        to: 'kranthi@duckcode.ai',
        subject,
        html,
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[Calendly webhook] Unexpected error:', err);
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
