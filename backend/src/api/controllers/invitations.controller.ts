import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import EmailService from '../../services/EmailService';

// Create admin client for all schemas
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * Send invitations to multiple users
 */
export const sendInvitations = async (req: Request, res: Response) => {
  try {
    const { organization_id, emails, role_id, team_id, message } = req.body;
    const user = (req as any).user;

    if (!organization_id || !emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ 
        error: 'organization_id and emails array are required' 
      });
    }

    if (!role_id) {
      return res.status(400).json({ error: 'role_id is required' });
    }

    // Get organization details
    const { data: organization, error: orgError } = await supabaseAdmin
      .schema('enterprise')
      .from('organizations')
      .select('display_name')
      .eq('id', organization_id)
      .single();

    if (orgError || !organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get role details
    const { data: role, error: roleError } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_roles')
      .select('name, display_name')
      .eq('id', role_id)
      .single();

    if (roleError || !role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Get inviter details
    const { data: inviter, error: inviterError } = await supabaseAdmin
      .schema('duckcode')
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    if (inviterError || !inviter) {
      return res.status(404).json({ error: 'Inviter not found' });
    }

    // Create invitations
    const invitations = emails.map((email: string) => ({
      organization_id,
      email: email.trim().toLowerCase(),
      role_id,
      team_id: team_id || null,
      invited_by: user.id,
      invitation_token: crypto.randomUUID(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      email_status: 'pending',
      email_attempts: 0,
    }));

    const { data: createdInvitations, error: insertError } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_invitations')
      .insert(invitations)
      .select();

    if (insertError) {
      console.error('Failed to create invitations:', insertError);
      return res.status(500).json({ error: 'Failed to create invitations', details: insertError.message });
    }

    // Send emails for each invitation
    const emailResults = await Promise.allSettled(
      createdInvitations.map(async (invitation: any) => {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
        const acceptUrl = `${frontendUrl}/invite/${invitation.invitation_token}`;

        const emailResult = await EmailService.sendInvitationEmail(invitation.email, {
          inviterName: inviter.full_name || inviter.email,
          organizationName: organization.display_name,
          roleName: role.display_name || role.name,
          acceptUrl,
          expiresAt: invitation.expires_at,
        });

        // Update invitation with email status
        const updateData: any = {
          email_attempts: invitation.email_attempts + 1,
        };

        if (emailResult.success) {
          updateData.email_status = 'sent';
          updateData.email_sent_at = new Date().toISOString();
          updateData.email_message_id = emailResult.messageId;
        } else {
          updateData.email_status = 'failed';
          updateData.email_error = emailResult.error;
        }

        await supabaseAdmin
          .schema('enterprise')
          .from('organization_invitations')
          .update(updateData)
          .eq('id', invitation.id);

        return { email: invitation.email, success: emailResult.success, error: emailResult.error };
      })
    );

    // Count successes and failures
    const successful = emailResults.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = emailResults.length - successful;

    res.json({
      success: true,
      message: `Sent ${successful} invitation(s) successfully${failed > 0 ? `, ${failed} failed` : ''}`,
      invitations: createdInvitations,
      emailResults: emailResults.map((r, i) => ({
        email: createdInvitations[i].email,
        success: r.status === 'fulfilled' && (r.value as any).success,
        error: r.status === 'fulfilled' ? (r.value as any).error : 'Unknown error',
      })),
    });
  } catch (error) {
    console.error('Send invitations error:', error);
    res.status(500).json({
      error: 'Failed to send invitations',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get invitation details by token (public endpoint)
 */
export const getInvitationByToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    console.log('Looking for invitation token:', token);

    const { data: invitation, error } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_invitations')
      .select(`
        id,
        email,
        expires_at,
        status,
        invited_by,
        organization_id,
        role_id
      `)
      .eq('invitation_token', token)
      .single();

    console.log('Query result:', { data: invitation, error });

    if (error || !invitation) {
      console.error('Invitation not found. Error:', error);
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // Check if already accepted
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation has already been accepted' });
    }

    // Get organization details
    const { data: organization } = await supabaseAdmin
      .schema('enterprise')
      .from('organizations')
      .select('id, display_name, name')
      .eq('id', invitation.organization_id)
      .single();

    // Get role details
    const { data: role } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_roles')
      .select('id, name, display_name')
      .eq('id', invitation.role_id)
      .single();

    // Get inviter name
    const { data: inviterProfile } = await supabaseAdmin
      .schema('duckcode')
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', invitation.invited_by)
      .single();

    res.json({
      email: invitation.email,
      organizationName: organization?.display_name || 'Unknown Organization',
      organizationSlug: organization?.name || 'unknown',
      roleName: role?.display_name || role?.name || 'Unknown Role',
      inviterName: inviterProfile?.full_name || inviterProfile?.email || 'Someone',
      expiresAt: invitation.expires_at,
    });
  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({
      error: 'Failed to get invitation details',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Accept invitation and create account
 */
export const acceptInvitation = async (req: Request, res: Response) => {
  try {
    const { token, fullName, password } = req.body;

    if (!token || !fullName || !password) {
      return res.status(400).json({ error: 'Token, fullName, and password are required' });
    }

    // Get invitation details
    const { data: invitation, error: invError } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_invitations')
      .select(`
        id,
        email,
        organization_id,
        role_id,
        expires_at,
        status,
        organization:organization_id(display_name),
        role:role_id(name, display_name)
      `)
      .eq('invitation_token', token)
      .single();

    if (invError || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Validate invitation
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation has already been accepted' });
    }

    // Create user account in Supabase Auth
    let userId: string;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password: password,
      email_confirm: true, // Auto-confirm email since they clicked the invitation link
      user_metadata: {
        full_name: fullName,
        organization_id: invitation.organization_id,
      },
    });

    if (authError) {
      // Check if user already exists
      if (authError.message?.includes('already registered')) {
        // Get existing user
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const user = existingUser?.users.find((u) => u.email === invitation.email);
        if (!user) {
          console.error('User exists but could not find:', authError);
          return res.status(500).json({ 
            error: 'User already exists but could not be found',
            details: authError.message,
          });
        }
        userId = user.id;
      } else {
        console.error('Failed to create user:', authError);
        return res.status(500).json({ 
          error: 'Failed to create account',
          details: authError?.message || 'Unknown error',
        });
      }
    } else if (authData?.user) {
      userId = authData.user.id;
    } else {
      return res.status(500).json({ 
        error: 'Failed to create account',
        details: 'No user data returned',
      });
    }

    // Create user profile in duckcode schema (use upsert in case it already exists)
    const { error: profileError } = await supabaseAdmin
      .schema('duckcode')
      .from('user_profiles')
      .upsert({
        id: userId,
        email: invitation.email,
        full_name: fullName,
        organization_id: invitation.organization_id,
      }, {
        onConflict: 'id',
        ignoreDuplicates: false, // Update if exists
      });

    if (profileError) {
      console.error('Failed to create/update profile:', profileError);
      // Don't fail - profile might be auto-created by trigger
    }

    // Assign role to user (use upsert to handle re-invitations)
    // Note: ONE user = ONE role per organization (enterprise standard)
    const { error: roleError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .upsert({
        organization_id: invitation.organization_id,
        user_id: userId,
        role_id: invitation.role_id,
      }, {
        onConflict: 'user_id,organization_id', // Updated constraint: one role per user
        ignoreDuplicates: false, // Update role if user already exists in org
      });

    if (roleError) {
      console.error('Failed to assign role:', roleError);
      return res.status(500).json({ 
        error: 'Account created but failed to assign role',
        details: roleError.message,
      });
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Failed to update invitation status:', updateError);
      // Don't fail - account is already created
    }

    // Send welcome email
    try {
      await EmailService.sendWelcomeEmail(
        invitation.email,
        (invitation.organization as any).display_name,
        (invitation.role as any).display_name || (invitation.role as any).name
      );
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail - account is created
    }

    res.json({
      success: true,
      message: 'Account created successfully! You can now login.',
      email: invitation.email,
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({
      error: 'Failed to accept invitation',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Resend invitation email
 */
export const resendInvitation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Get invitation with all details
    const { data: invitation, error: invError } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_invitations')
      .select(`
        *,
        organization:organization_id(display_name),
        role:role_id(name, display_name)
      `)
      .eq('id', id)
      .single();

    if (invError || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if invitation is still valid
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation has already been accepted' });
    }

    // Get inviter details
    const { data: inviter } = await supabaseAdmin
      .schema('duckcode')
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', invitation.invited_by)
      .single();

    // Resend email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
    const acceptUrl = `${frontendUrl}/invite/${invitation.invitation_token}`;

    const emailResult = await EmailService.sendInvitationEmail(invitation.email, {
      inviterName: inviter?.full_name || inviter?.email || 'Someone',
      organizationName: (invitation.organization as any).display_name,
      roleName: (invitation.role as any).display_name || (invitation.role as any).name,
      acceptUrl,
      expiresAt: invitation.expires_at,
    });

    // Update invitation
    const updateData: any = {
      email_attempts: (invitation.email_attempts || 0) + 1,
    };

    if (emailResult.success) {
      updateData.email_status = 'sent';
      updateData.email_sent_at = new Date().toISOString();
      updateData.email_message_id = emailResult.messageId;
    } else {
      updateData.email_status = 'failed';
      updateData.email_error = emailResult.error;
    }

    await supabaseAdmin
      .schema('enterprise')
      .from('organization_invitations')
      .update(updateData)
      .eq('id', id);

    if (emailResult.success) {
      res.json({ success: true, message: 'Invitation email resent successfully' });
    } else {
      res.status(500).json({ success: false, error: emailResult.error });
    }
  } catch (error) {
    console.error('Resend invitation error:', error);
    res.status(500).json({
      error: 'Failed to resend invitation',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
