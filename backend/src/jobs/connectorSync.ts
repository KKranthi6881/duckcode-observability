import { supabaseAdmin } from '../config/supabase';
import { ConnectorExtractionOrchestrator } from '../services/connectors/ConnectorExtractionOrchestrator';

export function startConnectorSyncJob(): void {
  const enabled = process.env.CONNECTOR_SYNC_ENABLED !== 'false';
  if (!enabled) {
    console.log('[ConnectorSync] Disabled via CONNECTOR_SYNC_ENABLED=false');
    return;
  }

  const intervalMs = parseInt(process.env.CONNECTOR_SYNC_INTERVAL_MS || `${15 * 60 * 1000}`, 10); // default 15 min
  console.log(`[ConnectorSync] Scheduling connector sync watcher every ${Math.round(intervalMs/60000)} min`);

  const tick = async () => {
    try {
      const nowIso = new Date().toISOString();
      // Find due connectors
      const { data: connectors, error } = await supabaseAdmin
        .schema('enterprise')
        .from('connectors')
        .select('id, organization_id, created_by, type, name, sync_frequency, sync_next_run_at, status')
        .neq('sync_frequency', 'none')
        .lte('sync_next_run_at', nowIso)
        .eq('status', 'active')
        .limit(20);

      if (error) {
        console.error('[ConnectorSync] Fetch failed:', error);
        return;
      }

      if (!connectors || connectors.length === 0) {
        return;
      }

      console.log(`[ConnectorSync] Found ${connectors.length} due connector(s)`);
      const orchestrator = new ConnectorExtractionOrchestrator();

      for (const c of connectors) {
        try {
          console.log(`[ConnectorSync] Triggering extraction for ${c.id} (${c.name})`);
          await orchestrator.extract(c.id, c.created_by || 'system');

          // Compute next run
          const millis = c.sync_frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
          const next = new Date(Date.now() + millis).toISOString();
          await supabaseAdmin
            .schema('enterprise')
            .from('connectors')
            .update({ sync_next_run_at: next })
            .eq('id', c.id);
        } catch (e: any) {
          console.error('[ConnectorSync] Extraction error:', e?.message || e);
          await supabaseAdmin
            .schema('enterprise')
            .from('connectors')
            .update({ last_sync_status: 'error' })
            .eq('id', c.id);
        }
      }
    } catch (e) {
      console.error('[ConnectorSync] Tick error:', e);
    }
  };

  // Initial tick delayed slightly
  setTimeout(tick, 5000);
  // Schedule future ticks
  setInterval(tick, intervalMs);
}
