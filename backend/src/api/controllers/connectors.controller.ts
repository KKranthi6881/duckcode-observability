import { Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase';
import { encryptAPIKey, decryptAPIKey } from '../../utils/encryption';
import { ConnectorFactory } from '../../services/connectors/ConnectorFactory';
import { MetadataStorageService } from '../../services/metadata/storage/MetadataStorageService';
import { ConnectorExtractionOrchestrator } from '../../services/connectors/ConnectorExtractionOrchestrator';

function ensureAdmin(userId: string, organizationId: string) {
  return supabaseAdmin
    .schema('enterprise')
    .from('user_organization_roles')
    .select('role_id, organization_roles!inner(name)')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single();
}

export async function updateConnectorSchedule(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;
    const { frequency } = req.body as { frequency: 'none' | 'daily' | 'weekly' };
    if (!['none', 'daily', 'weekly'].includes(String(frequency))) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }

    const { data: connector, error } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .select('id, organization_id')
      .eq('id', id)
      .single();

    if (error || !connector) return res.status(404).json({ error: 'Not found' });

    const { data: roleRow, error: roleErr } = await ensureAdmin(userId, connector.organization_id);
    if (roleErr || parseRoleName(roleRow) !== 'Admin') return res.status(403).json({ error: 'Forbidden' });

    // Compute next run time
    let nextRun: string | null = null;
    if (frequency !== 'none') {
      const now = new Date();
      const millis = frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      nextRun = new Date(now.getTime() + millis).toISOString();
    }

    const { data: updated, error: upErr } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .update({ sync_frequency: frequency, sync_next_run_at: nextRun, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (upErr) return res.status(500).json({ error: 'Failed to update schedule' });

    return res.json({ connector: updated });
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error', details: e?.message || String(e) });
  }
}

export async function getConnectorHistory(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;

    const { data: connector, error } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .select('id, organization_id')
      .eq('id', id)
      .single();

    if (error || !connector) return res.status(404).json({ error: 'Not found' });

    const { data: roleRow, error: roleErr } = await ensureAdmin(userId, connector.organization_id);
    if (roleErr || !roleRow) return res.status(403).json({ error: 'Forbidden' });

    const { data, error: histErr } = await supabaseAdmin
      .schema('enterprise')
      .from('connector_sync_history')
      .select('*')
      .eq('connector_id', id)
      .order('started_at', { ascending: false })
      .limit(100);

    if (histErr) return res.status(500).json({ error: 'Failed to load history' });

    return res.json({ success: true, history: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error', details: e?.message || String(e) });
  }
}

function parseRoleName(roleRow: any): string | null {
  const role = (roleRow?.organization_roles as any) || null;
  if (!role) return null;
  if (Array.isArray(role)) return role[0]?.name || null;
  return role.name || null;
}

export async function createConnector(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { organizationId, name, type, config } = req.body as { organizationId: string; name: string; type: string; config: any };
    if (!organizationId || !name || !type || !config) {
      return res.status(400).json({ error: 'organizationId, name, type, and config are required' });
    }

    const { data: roleRow, error: roleErr } = await ensureAdmin(userId, organizationId);
    if (roleErr || parseRoleName(roleRow) !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can create connectors' });
    }

    const { encryptedKey, iv, authTag } = encryptAPIKey(JSON.stringify(config));

    const { data, error } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .insert({
        organization_id: organizationId,
        name,
        type,
        status: 'active',
        config_encrypted: encryptedKey,
        config_iv: iv,
        config_auth_tag: authTag,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to create connector' });

    return res.json({ connector: data });
  } catch (e) {
    return res.status(500).json({ error: 'Internal error' });
  }
}

export async function listConnectors(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { organizationId } = req.query as { organizationId?: string };
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });

    const { data: roleRow, error: roleErr } = await ensureAdmin(userId, organizationId);
    if (roleErr || !roleRow) return res.status(403).json({ error: 'Forbidden' });

    const { data, error } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Failed to list connectors' });

    return res.json({ connectors: data });
  } catch (e) {
    return res.status(500).json({ error: 'Internal error' });
  }
}

export async function getConnector(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Not found' });

    const organizationId = data.organization_id;
    const { data: roleRow, error: roleErr } = await ensureAdmin(userId, organizationId);
    if (roleErr || !roleRow) return res.status(403).json({ error: 'Forbidden' });

    return res.json({ connector: data });
  } catch (e) {
    return res.status(500).json({ error: 'Internal error' });
  }
}

export async function testConnector(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;

    const { data: connector, error } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !connector) return res.status(404).json({ error: 'Not found' });

    const { data: roleRow, error: roleErr } = await ensureAdmin(userId, connector.organization_id);
    if (roleErr || !roleRow) return res.status(403).json({ error: 'Forbidden' });

    const configStr = decryptAPIKey(connector.config_encrypted, connector.config_iv, connector.config_auth_tag);
    const config = JSON.parse(configStr || '{}');

    const instance = ConnectorFactory.create(connector.type, connector.name, config);
    await instance.configure(config);
    const result = await instance.testConnection();

    // Return appropriate HTTP status based on test result
    if (result.success) {
      return res.json({ result });
    } else {
      return res.status(400).json({ 
        error: 'Connection test failed', 
        message: result.message,
        details: result.details 
      });
    }
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error', details: e?.message });
  }
}

export async function extractConnector(req: Request, res: Response) {
  const orchestrator = new ConnectorExtractionOrchestrator();
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;

    const { data: connector, error } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !connector) return res.status(404).json({ error: 'Not found' });

    const { data: roleRow, error: roleErr } = await ensureAdmin(userId, connector.organization_id);
    if (roleErr || !roleRow) return res.status(403).json({ error: 'Forbidden' });
    
    // Run extraction asynchronously
    orchestrator.extract(connector.id, userId).catch(err => {
      console.error('[Extract] Background extraction failed:', err);
    });
    
    return res.json({ success: true, message: 'Extraction started' });
  } catch (e: any) {
    return res.status(500).json({ error: 'Extraction failed', details: e?.message || String(e) });
  }
}

export async function deleteConnector(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;

    const { data: connector, error } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .select('id, organization_id')
      .eq('id', id)
      .single();

    if (error || !connector) return res.status(404).json({ error: 'Not found' });

    const { data: roleRow, error: roleErr } = await ensureAdmin(userId, connector.organization_id);
    if (roleErr || parseRoleName(roleRow) !== 'Admin') return res.status(403).json({ error: 'Forbidden' });

    // Delete connector (cascades to history and metadata)
    const { error: deleteErr } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .delete()
      .eq('id', id);

    if (deleteErr) return res.status(500).json({ error: 'Failed to delete connector' });

    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error', details: e?.message || String(e) });
  }
}

export async function updateConnector(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;
    const { name, config } = req.body as { name?: string; config?: any };

    const { data: connector, error } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .select('id, organization_id')
      .eq('id', id)
      .single();

    if (error || !connector) return res.status(404).json({ error: 'Not found' });

    const { data: roleRow, error: roleErr } = await ensureAdmin(userId, connector.organization_id);
    if (roleErr || parseRoleName(roleRow) !== 'Admin') return res.status(403).json({ error: 'Forbidden' });

    const updates: any = { updated_at: new Date().toISOString() };
    if (name) updates.name = name;
    if (config) {
      const { encryptedKey, iv, authTag } = encryptAPIKey(JSON.stringify(config));
      updates.config_encrypted = encryptedKey;
      updates.config_iv = iv;
      updates.config_auth_tag = authTag;
    }

    const { data: updated, error: upErr } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (upErr) return res.status(500).json({ error: 'Failed to update connector' });

    return res.json({ connector: updated });
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error', details: e?.message || String(e) });
  }
}

export async function getExtractionStatus(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;

    const { data: connector, error } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .select('id, organization_id')
      .eq('id', id)
      .single();

    if (error || !connector) return res.status(404).json({ error: 'Not found' });

    const { data: roleRow, error: roleErr } = await ensureAdmin(userId, connector.organization_id);
    if (roleErr || !roleRow) return res.status(403).json({ error: 'Forbidden' });

    // Get latest running or most recent job
    const { data: latestJob, error: jobErr } = await supabaseAdmin
      .schema('enterprise')
      .from('connector_sync_history')
      .select('*')
      .eq('connector_id', id)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (jobErr && jobErr.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Failed to get status' });
    }

    return res.json({ 
      status: latestJob?.status || 'idle',
      job: latestJob || null
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error', details: e?.message || String(e) });
  }
}
