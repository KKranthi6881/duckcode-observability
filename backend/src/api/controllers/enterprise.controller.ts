import { Request, Response } from 'express';
import { supabaseEnterprise } from '../../config/supabase';
import { encryptApiKey, decryptApiKey as decryptKey, maskApiKey, validateApiKeyFormat } from '../../services/encryptionService';
import crypto from 'crypto';

const sanitizeSsoConnection = (connection: Record<string, any>) => {
  if (!connection) return connection;
  const { client_secret, ...safeConnection } = connection;
  return {
    ...safeConnection,
    has_client_secret: Boolean(client_secret)
  };
};

// ==================== API KEYS ====================

/**
 * Create and encrypt a new API key
 */
export const createApiKey = async (req: Request, res: Response) => {
  try {
    const { organization_id, provider, api_key, key_name, is_default } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate required fields
    if (!organization_id || !provider || !api_key) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate API key format
    if (!validateApiKeyFormat(provider, api_key)) {
      return res.status(400).json({ error: `Invalid API key format for provider: ${provider}` });
    }

    // Check if user has permission to create API keys
    const { data: hasPermission } = await supabaseEnterprise
      .rpc('check_user_permission', {
        p_user_id: userId,
        p_organization_id: organization_id,
        p_permission: 'api_keys:create',
      });

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Encrypt the API key
    const encryptedKey = encryptApiKey(api_key);

    // Create the API key record
    const { data, error } = await supabaseEnterprise
      .from('organization_api_keys')
      .insert({
        organization_id,
        provider,
        encrypted_key: encryptedKey,
        key_name: key_name || null,
        is_default: is_default || false,
        status: 'active',
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create API key:', error);
      return res.status(500).json({ error: 'Failed to create API key' });
    }

    // Return with masked key
    res.status(201).json({
      ...data,
      encrypted_key: maskApiKey(api_key),
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSsoConnection = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { connectionId } = req.params;

    const { data: connection, error: connError } = await supabaseEnterprise
      .from('sso_connections')
      .select('id, organization_id')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const { data: isAdmin } = await supabaseEnterprise
      .rpc('is_organization_admin', {
        p_user_id: userId,
        p_organization_id: connection.organization_id,
      });

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { error: nullifyError } = await supabaseEnterprise
      .from('sso_domains')
      .update({ connection_id: null })
      .eq('connection_id', connectionId);

    if (nullifyError) {
      console.error('Failed to detach domains from connection:', nullifyError);
      return res.status(500).json({ error: 'Failed to update related domains' });
    }

    const { error: deleteError } = await supabaseEnterprise
      .from('sso_connections')
      .delete()
      .eq('id', connectionId);

    if (deleteError) {
      console.error('Failed to delete SSO connection:', deleteError);
      return res.status(500).json({ error: 'Failed to delete SSO connection' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete SSO connection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all API keys for an organization
 */
export const getApiKeys = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check permission
    const { data: hasPermission } = await supabaseEnterprise
      .rpc('check_user_permission', {
        p_user_id: userId,
        p_organization_id: organizationId,
        p_permission: 'api_keys:read',
      });

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { data, error } = await supabaseEnterprise
      .from('organization_api_keys')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to get API keys:', error);
      return res.status(500).json({ error: 'Failed to get API keys' });
    }

    res.json(data);
  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update API key status
 */
export const updateApiKeyStatus = async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const { status } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!['active', 'inactive', 'revoked'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data, error } = await supabaseEnterprise
      .from('organization_api_keys')
      .update({ status })
      .eq('id', keyId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update API key status:', error);
      return res.status(500).json({ error: 'Failed to update API key status' });
    }

    res.json(data);
  } catch (error) {
    console.error('Update API key status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete an API key
 */
export const deleteApiKey = async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { error } = await supabaseEnterprise
      .from('organization_api_keys')
      .delete()
      .eq('id', keyId);

    if (error) {
      console.error('Failed to delete API key:', error);
      return res.status(500).json({ error: 'Failed to delete API key' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Decrypt an API key for display (admin only)
 */
export const decryptApiKey = async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the encrypted key
    const { data: apiKey, error } = await supabaseEnterprise
      .from('organization_api_keys')
      .select('encrypted_key, organization_id')
      .eq('id', keyId)
      .single();

    if (error || !apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Check if user is org admin
    const { data: isAdmin } = await supabaseEnterprise
      .rpc('is_organization_admin', {
        p_user_id: userId,
        p_organization_id: apiKey.organization_id,
      });

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Decrypt the key
    const decrypted = decryptKey(apiKey.encrypted_key);

    res.json({ decrypted_key: decrypted });
  } catch (error) {
    console.error('Decrypt API key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== SSO CONFIGURATION ====================

export const getSsoConnections = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: isAdmin } = await supabaseEnterprise
      .rpc('is_organization_admin', {
        p_user_id: userId,
        p_organization_id: organizationId,
      });

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { data: connections, error: connectionsError } = await supabaseEnterprise
      .from('sso_connections')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (connectionsError) {
      console.error('Failed to fetch SSO connections:', connectionsError);
      return res.status(500).json({ error: 'Failed to fetch SSO connections' });
    }

    const { data: domains, error: domainsError } = await supabaseEnterprise
      .from('sso_domains')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (domainsError) {
      console.error('Failed to fetch SSO domains:', domainsError);
      return res.status(500).json({ error: 'Failed to fetch SSO domains' });
    }

    res.json({
      connections: (connections || []).map(sanitizeSsoConnection),
      domains: domains || []
    });
  } catch (error) {
    console.error('Get SSO configuration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const upsertSsoConnection = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      organization_id,
      provider_type,
      provider_label,
      issuer_url,
      authorization_url,
      token_url,
      jwks_url,
      client_id,
      client_secret,
      default_role_id,
      enforce_sso,
      allow_password_fallback,
      metadata,
    } = req.body;

    if (!organization_id || !provider_type || !provider_label || !issuer_url || !client_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: isAdmin } = await supabaseEnterprise
      .rpc('is_organization_admin', {
        p_user_id: userId,
        p_organization_id: organization_id,
      });

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const payload: Record<string, any> = {
      organization_id,
      provider_type,
      provider_label,
      issuer_url,
      authorization_url: authorization_url || null,
      token_url: token_url || null,
      jwks_url: jwks_url || null,
      client_id,
      default_role_id: default_role_id || null,
      enforce_sso: enforce_sso ?? false,
      allow_password_fallback: allow_password_fallback ?? true,
      metadata: metadata || {},
    };

    if (client_secret) {
      payload.client_secret = encryptApiKey(client_secret);
    }

    const { data, error } = await supabaseEnterprise
      .from('sso_connections')
      .upsert(payload, { onConflict: 'organization_id,provider_type' })
      .select('*')
      .single();

    if (error) {
      console.error('Failed to upsert SSO connection:', error);
      return res.status(500).json({ error: 'Failed to save SSO connection' });
    }

    res.status(201).json(sanitizeSsoConnection(data));
  } catch (error) {
    console.error('Upsert SSO connection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createSsoDomain = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organization_id, domain_name, connection_id } = req.body;

    if (!organization_id || !domain_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedDomain = domain_name.trim().toLowerCase();
    const { data: isAdmin } = await supabaseEnterprise
      .rpc('is_organization_admin', {
        p_user_id: userId,
        p_organization_id: organization_id,
      });

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { data, error } = await supabaseEnterprise
      .from('sso_domains')
      .insert({
        organization_id,
        connection_id: connection_id || null,
        domain_name: normalizedDomain,
        verification_token: crypto.randomBytes(24).toString('hex'),
      })
      .select('*')
      .single();

    if (error) {
      console.error('Failed to create SSO domain:', error);
      return res.status(500).json({ error: 'Failed to create domain' });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Create SSO domain error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifySsoDomain = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { domainId } = req.params;
    const { verification_token } = req.body;

    if (!verification_token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const { data: domainRecord, error: domainError } = await supabaseEnterprise
      .from('sso_domains')
      .select('*')
      .eq('id', domainId)
      .single();

    if (domainError || !domainRecord) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const { data: isAdmin } = await supabaseEnterprise
      .rpc('is_organization_admin', {
        p_user_id: userId,
        p_organization_id: domainRecord.organization_id,
      });

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (domainRecord.verification_token !== verification_token) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    const { data, error } = await supabaseEnterprise
      .from('sso_domains')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', domainId)
      .select('*')
      .single();

    if (error) {
      console.error('Failed to verify SSO domain:', error);
      return res.status(500).json({ error: 'Failed to verify domain' });
    }

    res.json(data);
  } catch (error) {
    console.error('Verify SSO domain error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSsoDomain = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { domainId } = req.params;

    const { data: domainRecord, error: domainError } = await supabaseEnterprise
      .from('sso_domains')
      .select('id, organization_id')
      .eq('id', domainId)
      .single();

    if (domainError || !domainRecord) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const { data: isAdmin } = await supabaseEnterprise
      .rpc('is_organization_admin', {
        p_user_id: userId,
        p_organization_id: domainRecord.organization_id,
      });

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { error } = await supabaseEnterprise
      .from('sso_domains')
      .delete()
      .eq('id', domainId);

    if (error) {
      console.error('Failed to delete SSO domain:', error);
      return res.status(500).json({ error: 'Failed to delete domain' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete SSO domain error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== INVITATIONS ====================

/**
 * Get invitation details by token (PUBLIC - no auth required)
 */
export const getInvitationByToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find the invitation with organization and role details
    const { data: invitation, error } = await supabaseEnterprise
      .from('organization_invitations')
      .select(`
        *,
        organization:organizations!organization_invitations_organization_id_fkey (
          id,
          name,
          display_name
        ),
        role:organization_roles!organization_invitations_role_id_fkey (
          id,
          name
        ),
        inviter:invited_by (
          email
        )
      `)
      .eq('invitation_token', token)
      .single();

    if (error || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if already accepted
    if (invitation.status === 'accepted') {
      return res.status(410).json({ error: 'This invitation has already been accepted' });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Update status if not already marked as expired
      if (invitation.status === 'pending') {
        await supabaseEnterprise
          .from('organization_invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id);
      }
      return res.status(404).json({ error: 'This invitation has expired' });
    }

    // Return invitation details
    res.json({
      id: invitation.id,
      organization_id: invitation.organization.id,
      organization_name: invitation.organization.display_name || invitation.organization.name,
      email: invitation.email,
      role_name: invitation.role.name,
      team_name: invitation.team_id ? 'Team' : null, // TODO: Fetch team name
      invited_by_email: invitation.inviter?.email || 'Unknown',
      expires_at: invitation.expires_at,
      status: invitation.status,
    });
  } catch (error) {
    console.error('Get invitation by token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Send invitation emails
 */
export const sendInvitations = async (req: Request, res: Response) => {
  try {
    const { organization_id, emails, role_id, message } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate inputs
    if (!organization_id || !emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Invalid invitation data' });
    }

    // Check permission
    const { data: hasPermission } = await supabaseEnterprise
      .rpc('check_user_permission', {
        p_user_id: userId,
        p_organization_id: organization_id,
        p_permission: 'users:invite',
      });

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Create invitations
    const invitations = emails.map((email: string) => ({
      organization_id,
      email: email.trim().toLowerCase(),
      role_id,
      invited_by: userId,
      invitation_token: crypto.randomBytes(32).toString('hex'),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      status: 'pending',
    }));

    const { data, error } = await supabaseEnterprise
      .from('organization_invitations')
      .insert(invitations)
      .select();

    if (error) {
      console.error('Failed to create invitations:', error);
      return res.status(500).json({ error: 'Failed to create invitations' });
    }

    // TODO: Send actual emails using email service
    console.log('Invitations created (email sending not yet implemented):', data);

    res.status(201).json({
      invitations: data,
      message: 'Invitations created successfully. Email sending will be implemented.',
    });
  } catch (error) {
    console.error('Send invitations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Accept an invitation (PUBLIC - supports both new and existing users)
 */
export const acceptInvitation = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { password, full_name } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find the invitation
    const { data: invitation, error: findError } = await supabaseEnterprise
      .from('organization_invitations')
      .select('*')
      .eq('invitation_token', token)
      .eq('status', 'pending')
      .single();

    if (findError || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      await supabaseEnterprise
        .from('organization_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return res.status(404).json({ error: 'Invitation has expired' });
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseEnterprise
      .rpc('get_user_by_email', { p_email: invitation.email });

    let userId: string;
    let userExists = false;

    if (existingUsers && existingUsers.length > 0) {
      // User exists - just add them to organization
      userId = existingUsers[0].id;
      userExists = true;
    } else {
      // New user - create account
      if (!password || !full_name) {
        return res.status(400).json({ error: 'Password and full name are required for new users' });
      }

      // Create user using Supabase Auth (admin API)
      const { data: authData, error: authError } = await supabaseEnterprise.auth.admin.createUser({
        email: invitation.email,
        password: password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: full_name,
        },
      });

      if (authError || !authData.user) {
        console.error('Failed to create user:', authError);
        return res.status(500).json({ error: 'Failed to create user account' });
      }

      userId = authData.user.id;

      // Profile should be auto-created by trigger, but verify
      console.log(`New user created: ${userId} (${invitation.email})`);
    }

    // Add user to organization with the invited role
    // Use upsert to handle re-invitations (one role per user per org)
    const { error: roleError } = await supabaseEnterprise
      .from('user_organization_roles')
      .upsert({
        user_id: userId,
        organization_id: invitation.organization_id,
        role_id: invitation.role_id,
      }, {
        onConflict: 'user_id,organization_id',
        ignoreDuplicates: false, // Update role if user already exists
      });

    if (roleError) {
      console.error('Failed to assign role:', roleError);
      return res.status(500).json({ error: 'Failed to add user to organization' });
    }

    // If team was specified, add user to team
    if (invitation.team_id) {
      await supabaseEnterprise
        .from('team_members')
        .insert({
          team_id: invitation.team_id,
          user_id: userId,
          role: 'member', // Default team role
        });
    }

    // Update invitation status
    await supabaseEnterprise
      .from('organization_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: userId,
      })
      .eq('id', invitation.id);

    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      user_exists: userExists,
      redirect_url: '/login',
      organization_id: invitation.organization_id,
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Cancel an invitation
 */
export const cancelInvitation = async (req: Request, res: Response) => {
  try {
    const { invitationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { error } = await supabaseEnterprise
      .from('organization_invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId);

    if (error) {
      console.error('Failed to cancel invitation:', error);
      return res.status(500).json({ error: 'Failed to cancel invitation' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== ORGANIZATIONS ====================

/**
 * Delete an organization
 */
export const deleteOrganization = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is org admin
    const { data: isAdmin } = await supabaseEnterprise
      .rpc('is_organization_admin', {
        p_user_id: userId,
        p_organization_id: organizationId,
      });

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Delete organization (cascade will handle related records)
    const { error } = await supabaseEnterprise
      .from('organizations')
      .delete()
      .eq('id', organizationId);

    if (error) {
      console.error('Failed to delete organization:', error);
      return res.status(500).json({ error: 'Failed to delete organization' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update organization
 */
export const updateOrganization = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const updates = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check permission
    const { data: hasPermission } = await supabaseEnterprise
      .rpc('check_user_permission', {
        p_user_id: userId,
        p_organization_id: organizationId,
        p_permission: 'organization:update',
      });

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { data, error } = await supabaseEnterprise
      .from('organizations')
      .update(updates)
      .eq('id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update organization:', error);
      return res.status(500).json({ error: 'Failed to update organization' });
    }

    res.json(data);
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== PERMISSIONS ====================

/**
 * Check if user has a specific permission
 */
export const checkPermission = async (req: Request, res: Response) => {
  try {
    const { organization_id, permission } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: hasPermission, error } = await supabaseEnterprise
      .rpc('check_user_permission', {
        p_user_id: userId,
        p_organization_id: organization_id,
        p_permission: permission,
      });

    if (error) {
      console.error('Failed to check permission:', error);
      return res.status(500).json({ error: 'Failed to check permission' });
    }

    res.json({ has_permission: hasPermission });
  } catch (error) {
    console.error('Check permission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
