import axios from 'axios';
import { IConnector, ConnectorConfig, ConnectionTestResult, ExtractionResult, ExtractedObjectColumn } from './IConnector';

export class PowerBIConnector implements IConnector {
  name: string;
  type: 'power_bi' = 'power_bi';
  version = '1.0.0';
  private config: ConnectorConfig = {};

  constructor(name: string, config: ConnectorConfig) {
    this.name = name;
    this.config = config || {};
  }

  async configure(config: ConnectorConfig): Promise<void> {
    this.config = config || {};
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const tenantId = String(this.config.tenant_id || '').trim();
    const clientId = String(this.config.client_id || '').trim();
    const clientSecret = String(this.config.client_secret || '').trim();

    if (!tenantId || !clientId || !clientSecret) {
      return {
        success: false,
        message: 'tenant_id, client_id, and client_secret are required for Power BI connector',
      };
    }

    try {
      // Lightweight token acquisition to validate credentials
      const token = await this.getAccessToken(tenantId, clientId, clientSecret);
      return {
        success: true,
        message: 'Successfully acquired Power BI access token.',
        details: {
          tenant_id_present: !!tenantId,
          client_id_present: !!clientId,
          token_preview: token ? token.substring(0, 12) + '...' : null,
        },
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Failed to acquire Power BI access token',
        details: e,
      };
    }
  }

  async extractMetadata(): Promise<ExtractionResult> {
    const tenantId = String(this.config.tenant_id || '').trim();
    const workspaceId = String(this.config.workspace_id || '').trim();
    const clientId = String(this.config.client_id || '').trim();
    const clientSecret = String(this.config.client_secret || '').trim();

    const path = workspaceId ? `powerbi://${tenantId}/${workspaceId}` : `powerbi://${tenantId || 'tenant'}`;

    const repository = {
      path,
      name: this.name || 'Power BI',
      type: 'bi' as const,
    };

    if (!tenantId || !clientId || !clientSecret) {
      return {
        repository,
        objects: [],
        stats: { objects: 0, columns: 0 },
      };
    }

    try {
      const token = await this.getAccessToken(tenantId, clientId, clientSecret);
      const apiBase = 'https://api.powerbi.com/v1.0/myorg';

      const datasets = await this.fetchDatasets(apiBase, token, workspaceId);

      const objects: ExtractionResult['objects'] = [];
      let totalColumns = 0;

      const limitedDatasets = datasets.slice(0, 50);

      for (const ds of limitedDatasets) {
        const columns: ExtractedObjectColumn[] = [];

        try {
          const tables = await this.fetchDatasetTables(apiBase, token, ds.id, workspaceId);
          tables.forEach((t, idx) => {
            columns.push({
              name: t.name,
              data_type: 'table',
              is_nullable: true,
              position: idx + 1,
            });
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[POWER_BI] Failed to fetch tables for dataset', ds.id, e instanceof Error ? e.message : e);
        }

        totalColumns += columns.length;

        const definition = {
          datasetId: ds.id,
          workspaceId: workspaceId || null,
        };

        objects.push({
          name: ds.name,
          schema_name: (workspaceId || 'TENANT').toUpperCase(),
          database_name: 'POWER_BI',
          object_type: 'view',
          definition: JSON.stringify(definition),
          columns,
        });
      }

      return {
        repository,
        objects,
        stats: {
          objects: objects.length,
          columns: totalColumns,
        },
      };
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[POWER_BI] extractMetadata failed:', e?.message || e);
      return {
        repository,
        objects: [],
        stats: { objects: 0, columns: 0 },
      };
    }
  }

  async disconnect(): Promise<void> {
    // No persistent connection to manage
    return;
  }

  private async getAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'https://analysis.windows.net/powerbi/api/.default');
    params.append('grant_type', 'client_credentials');

    const resp = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
      validateStatus: () => true,
    });

    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(`Azure AD token request failed with status ${resp.status}`);
    }

    const token = resp.data?.access_token;
    if (!token) {
      throw new Error('Azure AD token response missing access_token');
    }
    return token;
  }

  private async fetchDatasets(apiBase: string, token: string, workspaceId?: string): Promise<Array<{ id: string; name: string }>> {
    const url = workspaceId
      ? `${apiBase}/groups/${workspaceId}/datasets`
      : `${apiBase}/datasets`;

    const resp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    if (resp.status < 200 || resp.status >= 300) {
      // eslint-disable-next-line no-console
      console.warn('[POWER_BI] Datasets endpoint returned status', resp.status);
      return [];
    }

    const value = resp.data?.value;
    if (!Array.isArray(value)) return [];

    return value
      .filter((v: any) => v && v.id && v.name)
      .map((v: any) => ({ id: String(v.id), name: String(v.name) }));
  }

  private async fetchDatasetTables(apiBase: string, token: string, datasetId: string, workspaceId?: string): Promise<Array<{ name: string }>> {
    const url = workspaceId
      ? `${apiBase}/groups/${workspaceId}/datasets/${datasetId}/tables`
      : `${apiBase}/datasets/${datasetId}/tables`;

    const resp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    if (resp.status < 200 || resp.status >= 300) {
      // eslint-disable-next-line no-console
      console.warn('[POWER_BI] Tables endpoint returned status', resp.status, 'for dataset', datasetId);
      return [];
    }

    const value = resp.data?.value;
    if (!Array.isArray(value)) return [];

    return value
      .filter((v: any) => v && v.name)
      .map((v: any) => ({ name: String(v.name) }));
  }
}
