/**
 * API Keys Controller
 * Handles organization-level API key management
 */

import { Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase.js';
import { encryptAPIKey, decryptAPIKey, maskAPIKey, validateAPIKeyFormat } from '../../utils/encryption.js';

/**
 * Get all API keys for an organization
 * Returns masked keys for security
 */
export async function getOrganizationAPIKeys(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify user is admin of this organization
    const { data: userRole, error: roleError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('role_id, organization_roles!inner(name)')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (roleError || !userRole) {
      return res.status(403).json({ error: 'Only admins can view API keys' });
    }

    const roleName = (userRole.organization_roles as any)?.[0]?.name || (userRole.organization_roles as any)?.name;
    if (roleName !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can view API keys' });
    }

    // Fetch API keys
    const { data: apiKeys, error } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_api_keys')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching API keys:', error);
      return res.status(500).json({ error: 'Failed to fetch API keys' });
    }

    // Mask API keys for display
    const maskedKeys = apiKeys.map(key => ({
      id: key.id,
      provider: key.provider,
      key_name: key.key_name,
      masked_key: maskAPIKey(decryptAPIKey(key.encrypted_key, key.encryption_iv, key.encryption_auth_tag)),
      is_default: key.is_default,
      status: key.status,
      created_at: key.created_at,
      last_used_at: key.last_used_at,
    }));

    return res.json({ api_keys: maskedKeys });
  } catch (error) {
    console.error('Get API keys error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Create or update an API key for an organization
 */
export async function upsertOrganizationAPIKey(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const { provider, api_key, key_name, is_default } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Validate required fields
    if (!provider || !api_key || !key_name) {
      return res.status(400).json({ error: 'Provider, API key, and key name are required' });
    }

    // Validate API key format
    if (!validateAPIKeyFormat(api_key, provider)) {
      return res.status(400).json({ error: `Invalid API key format for provider: ${provider}` });
    }

    // Verify user is admin of this organization
    const { data: userRole, error: roleError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('role_id, organization_roles!inner(name)')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (roleError || !userRole) {
      return res.status(403).json({ error: 'Only admins can manage API keys' });
    }

    const roleName = (userRole.organization_roles as any)?.[0]?.name || (userRole.organization_roles as any)?.name;
    if (roleName !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can manage API keys' });
    }

    // Encrypt the API key
    const { encryptedKey, iv, authTag } = encryptAPIKey(api_key);

    // If this is set as default, unset other defaults for this provider
    if (is_default) {
      await supabaseAdmin
        .schema('enterprise')
        .from('organization_api_keys')
        .update({ is_default: false })
        .eq('organization_id', organizationId)
        .eq('provider', provider);
    }

    // Check if key with same name exists
    const { data: existingKey } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_api_keys')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('key_name', key_name)
      .single();

    let result;
    if (existingKey) {
      // Update existing key
      const { data, error } = await supabaseAdmin
        .schema('enterprise')
        .from('organization_api_keys')
        .update({
          encrypted_key: encryptedKey,
          encryption_iv: iv,
          encryption_auth_tag: authTag,
          is_default: is_default || false,
          status: 'active',
        })
        .eq('id', existingKey.id)
        .select()
        .single();

      if (error) throw error;
      result = data;

      // Audit log
      await supabaseAdmin
        .schema('enterprise')
        .from('organization_api_keys_audit')
        .insert({
          organization_id: organizationId,
          provider: provider,
          action: 'updated',
          changed_by: userId,
          metadata: { key_name },
        });
    } else {
      // Create new key
      const { data, error } = await supabaseAdmin
        .schema('enterprise')
        .from('organization_api_keys')
        .insert({
          organization_id: organizationId,
          provider: provider,
          encrypted_key: encryptedKey,
          encryption_iv: iv,
          encryption_auth_tag: authTag,
          key_name: key_name,
          is_default: is_default || false,
          status: 'active',
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;

      // Audit log
      await supabaseAdmin
        .schema('enterprise')
        .from('organization_api_keys_audit')
        .insert({
          organization_id: organizationId,
          provider: provider,
          action: 'created',
          changed_by: userId,
          metadata: { key_name },
        });
    }

    return res.json({
      success: true,
      api_key: {
        id: result.id,
        provider: result.provider,
        key_name: result.key_name,
        masked_key: maskAPIKey(api_key),
        is_default: result.is_default,
        status: result.status,
      },
    });
  } catch (error) {
    console.error('Upsert API key error:', error);
    return res.status(500).json({ error: 'Failed to save API key' });
  }
}

/**
 * Delete an API key
 */
export async function deleteOrganizationAPIKey(req: Request, res: Response) {
  try {
    const { organizationId, keyId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify user is admin
    const { data: userRole, error: roleError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('role_id, organization_roles!inner(name)')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (roleError || !userRole) {
      return res.status(403).json({ error: 'Only admins can delete API keys' });
    }

    const roleName = (userRole.organization_roles as any)?.[0]?.name || (userRole.organization_roles as any)?.name;
    if (roleName !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can delete API keys' });
    }

    // Get key info for audit log
    const { data: keyInfo } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_api_keys')
      .select('provider, key_name')
      .eq('id', keyId)
      .eq('organization_id', organizationId)
      .single();

    // Delete the key
    const { error } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_api_keys')
      .delete()
      .eq('id', keyId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting API key:', error);
      return res.status(500).json({ error: 'Failed to delete API key' });
    }

    // Audit log
    if (keyInfo) {
      await supabaseAdmin
        .schema('enterprise')
        .from('organization_api_keys_audit')
        .insert({
          organization_id: organizationId,
          provider: keyInfo.provider,
          action: 'deleted',
          changed_by: userId,
          metadata: { key_name: keyInfo.key_name },
        });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete API key error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get active API keys for VS Code extension (members only)
 * Returns decrypted keys for the extension to use
 */
export async function getActiveAPIKeysForExtension(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify user belongs to this organization
    const { data: userRole, error: roleError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('role_id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (roleError || !userRole) {
      return res.status(403).json({ error: 'You do not belong to this organization' });
    }

    // Fetch active default API keys
    const { data: apiKeys, error } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_api_keys')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .eq('is_default', true);

    if (error) {
      console.error('Error fetching API keys:', error);
      return res.status(500).json({ error: 'Failed to fetch API keys' });
    }

    // Decrypt keys for extension use
    const decryptedKeys: Record<string, string> = {};
    
    for (const key of apiKeys) {
      try {
        const decrypted = decryptAPIKey(
          key.encrypted_key,
          key.encryption_iv,
          key.encryption_auth_tag
        );
        decryptedKeys[key.provider] = decrypted;

        // Update last_used_at
        await supabaseAdmin
          .schema('enterprise')
          .from('organization_api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', key.id);
      } catch (error) {
        console.error(`Failed to decrypt key for provider ${key.provider}:`, error);
      }
    }

    return res.json({ api_keys: decryptedKeys });
  } catch (error) {
    console.error('Get extension API keys error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
