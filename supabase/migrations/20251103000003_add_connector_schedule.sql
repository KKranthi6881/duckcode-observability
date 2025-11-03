BEGIN;

ALTER TABLE enterprise.connectors
  ADD COLUMN IF NOT EXISTS sync_frequency TEXT NOT NULL DEFAULT 'none' CHECK (sync_frequency IN ('none','daily','weekly')),
  ADD COLUMN IF NOT EXISTS sync_next_run_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_connectors_sync_next_run ON enterprise.connectors(sync_next_run_at);
CREATE INDEX IF NOT EXISTS idx_connectors_sync_frequency ON enterprise.connectors(sync_frequency);

COMMIT;
