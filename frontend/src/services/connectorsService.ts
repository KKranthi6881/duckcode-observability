import { supabase } from '../config/supabaseClient';

export interface ConnectorItem {
  id: string;
  name: string;
  type: string;
  organization_id: string;
  config?: Record<string, unknown>;
  status?: string;
  created_at?: string;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  sync_frequency?: 'none' | 'daily' | 'weekly';
  sync_next_run_at?: string | null;
}

export interface ConnectorHistoryRow {
  id: string;
  connector_id?: string;
  started_at?: string;
  completed_at?: string | null;
  status?: 'running' | 'completed' | 'failed';
  objects_extracted?: number;
  columns_extracted?: number;
  error_message?: string | null;
}

export interface CreateSnowflakeRequest {
  organizationId: string;
  name: string;
  config: {
    account: string;
    username: string;
    password: string;
    role?: string;
    warehouse?: string;
    database?: string;
    schema?: string;
    passcode?: string;
  };
}

export interface CreateConnectorRequest {
  organizationId: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
}

class ConnectorsService {
  private baseUrl: string;
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  }

  async updateSchedule(id: string, frequency: 'none'|'daily'|'weekly'): Promise<void> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${id}/schedule`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ frequency })
    });
    if (!res.ok) throw new Error('Failed to update schedule');
  }
  private async token(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    return session.access_token;
  }

  async list(organizationId: string): Promise<ConnectorItem[]> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors?organizationId=${organizationId}`, {
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Failed to list connectors');
    const json = await res.json();
    return json.connectors || [];
  }

  async createConnector(req: CreateConnectorRequest): Promise<ConnectorItem> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        organizationId: req.organizationId, 
        name: req.name, 
        type: req.type, 
        config: req.config 
      }),
    });
    if (!res.ok) throw new Error('Failed to create connector');
    const json = await res.json();
    return json.connector as ConnectorItem;
  }

  async createSnowflake(req: CreateSnowflakeRequest): Promise<ConnectorItem> {
    return this.createConnector({
      organizationId: req.organizationId,
      name: req.name,
      type: 'snowflake',
      config: req.config,
    });
  }

  async test(id: string): Promise<void> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${id}/test`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || error.error || 'Test failed');
    }
  }

  async extract(id: string): Promise<{ success: boolean }> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${id}/extract`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Extraction failed');
    return { success: true };
  }

  async history(id: string): Promise<ConnectorHistoryRow[]> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${id}/history`, {
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Failed to load history');
    const json = await res.json();
    return (json.history || []) as ConnectorHistoryRow[];
  }

  async delete(id: string): Promise<void> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Failed to delete connector');
  }

  async update(id: string, data: { name?: string; config?: any }): Promise<ConnectorItem> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update connector');
    const json = await res.json();
    return json.connector as ConnectorItem;
  }

  async getStatus(id: string): Promise<{ status: string; job: ConnectorHistoryRow | null }> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${id}/status`, {
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Failed to get status');
    return await res.json();
  }
}

export const connectorsService = new ConnectorsService();
