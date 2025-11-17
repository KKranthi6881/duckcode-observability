import axios, { AxiosRequestConfig } from 'axios';
import { IConnector, ConnectorConfig, ConnectionTestResult, ExtractionResult, ExtractedObjectColumn } from './IConnector';

export class AirflowConnector implements IConnector {
  name: string;
  type: 'airflow' = 'airflow';
  version = '1.0.0';
  private config: ConnectorConfig = {};

  constructor(name: string, config: ConnectorConfig) {
    this.name = name;
    this.config = config || {};
  }

  async configure(config: ConnectorConfig): Promise<void> {
    this.config = config || {};
  }

  private buildHealthUrl(): string {
    const base = String(this.config.base_url || '').trim();
    if (!base) {
      throw new Error('base_url is required for Airflow connector');
    }
    try {
      const url = new URL(base);
      // Prefer the Airflow 2.x health endpoint if available
      return new URL('/api/v1/health', url).toString();
    } catch {
      // Fallback: assume given string is a valid URL and append path
      const trimmed = base.replace(/\/$/, '');
      return `${trimmed}/api/v1/health`;
    }
  }

  private buildApiUrl(path: string): string {
    const base = String(this.config.base_url || '').trim();
    if (!base) {
      throw new Error('base_url is required for Airflow connector');
    }
    try {
      const url = new URL(base);
      return new URL(path, url).toString();
    } catch {
      const trimmed = base.replace(/\/$/, '');
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      return `${trimmed}${normalizedPath}`;
    }
  }

  private buildAxiosConfig(): AxiosRequestConfig {
    const cfg: AxiosRequestConfig = {
      timeout: 10000,
      validateStatus: () => true,
    };

    const headers: Record<string, string> = {};
    const apiToken = this.config.api_token as string | undefined;
    if (apiToken && apiToken.trim()) {
      headers['Authorization'] = `Bearer ${apiToken.trim()}`;
    }
    if (Object.keys(headers).length > 0) {
      cfg.headers = headers;
    }

    const username = this.config.username as string | undefined;
    const password = this.config.password as string | undefined;
    if (!apiToken && username && password) {
      cfg.auth = { username, password };
    }

    return cfg;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const url = this.buildHealthUrl();
      const cfg = this.buildAxiosConfig();
      const resp = await axios.get(url, cfg);
      if (resp.status >= 200 && resp.status < 300) {
        const detail = typeof resp.data === 'object' ? JSON.stringify(resp.data) : String(resp.data || '');
        return {
          success: true,
          message: `Connected to Airflow (status ${resp.status})`,
          details: { url, sample: detail.slice(0, 200) },
        };
      }

      return {
        success: false,
        message: `Airflow health endpoint returned status ${resp.status}`,
        details: { url, body: resp.data },
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Failed to reach Airflow health endpoint',
        details: e,
      };
    }
  }

  async extractMetadata(): Promise<ExtractionResult> {
    const base = String(this.config.base_url || '').trim() || 'airflow://';
    const repoName = this.name || 'Apache Airflow';

    const cfg = this.buildAxiosConfig();
    const dagUrl = this.buildApiUrl('/api/v1/dags?limit=1000');

    let dags: any[] = [];
    try {
      const resp = await axios.get(dagUrl, cfg);
      if (resp.status >= 200 && resp.status < 300) {
        const data = resp.data || {};
        // Airflow 2 API typically returns { dags: [...], total_entries: N }
        dags = Array.isArray(data.dags) ? data.dags : (Array.isArray(data) ? data : []);
      } else {
        console.warn(`[AIRFLOW] DAG list endpoint returned status ${resp.status}`);
      }
    } catch (e) {
      console.error('[AIRFLOW] Failed to list DAGs:', e instanceof Error ? e.message : e);
    }

    const objects: ExtractionResult['objects'] = [];
    let totalColumns = 0;

    for (const dag of dags) {
      const dagId = dag.dag_id || dag.dagId || dag.id;
      if (!dagId) continue;

      const columns: ExtractedObjectColumn[] = [];

      // Try to fetch tasks for this DAG so we can expose them as columns
      try {
        const tasksUrl = this.buildApiUrl(`/api/v1/dags/${encodeURIComponent(dagId)}/tasks?limit=200`);
        const tasksResp = await axios.get(tasksUrl, cfg);
        if (tasksResp.status >= 200 && tasksResp.status < 300) {
          const tData = tasksResp.data || {};
          const tasks = Array.isArray(tData.tasks) ? tData.tasks : (Array.isArray(tData) ? tData : []);

          tasks.forEach((t: any, idx: number) => {
            const taskId = t.task_id || t.taskId || t.id;
            if (!taskId) return;
            const operator = t.operator || t.task_type || 'UnknownOperator';
            columns.push({
              name: String(taskId),
              data_type: String(operator),
              is_nullable: true,
              position: idx + 1,
            });
          });
        } else {
          console.warn(`[AIRFLOW] Tasks endpoint for DAG ${dagId} returned status ${tasksResp.status}`);
        }
      } catch (e) {
        console.warn(`[AIRFLOW] Failed to fetch tasks for DAG ${dagId}:`, e instanceof Error ? e.message : e);
      }

      totalColumns += columns.length;

      const definition = {
        description: dag.description || dag.doc_md || null,
        tags: dag.tags || [],
        is_paused: dag.is_paused,
        owners: dag.owners || dag.owners_names || [],
      };

      objects.push({
        name: String(dagId),
        // Logical "schema" and "database" for orchestrator objects
        schema_name: 'AIRFLOW',
        database_name: 'ORCHESTRATOR',
        object_type: 'view',
        definition: JSON.stringify(definition),
        columns,
      });
    }

    return {
      repository: {
        path: base,
        name: repoName,
        type: 'orchestrator',
      },
      objects,
      stats: {
        objects: objects.length,
        columns: totalColumns,
      },
    };
  }

  async disconnect(): Promise<void> {
    // No persistent connection to manage for HTTP-based connector
    return;
  }
}
