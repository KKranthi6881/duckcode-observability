import axios from 'axios';
import { IConnector, ConnectorConfig, ConnectionTestResult, ExtractionResult, ExtractedObjectColumn } from './IConnector';

export class TableauConnector implements IConnector {
  name: string;
  type: 'tableau' = 'tableau';
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
    const serverUrl = String(this.config.server_url || '').trim();
    if (!serverUrl) {
      return { success: false, message: 'server_url is required for Tableau connector' };
    }

    try {
      const url = serverUrl;
      const resp = await axios.get(url, {
        timeout: 8000,
        validateStatus: () => true,
      });

      if (resp.status >= 200 && resp.status < 300) {
        return {
          success: true,
          message: `Tableau server reachable (status ${resp.status})`,
          details: { url },
        };
      }

      return {
        success: false,
        message: `Tableau server responded with status ${resp.status}`,
        details: { url },
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Failed to reach Tableau server',
        details: e,
      };
    }
  }

  async extractMetadata(): Promise<ExtractionResult> {
    const serverUrl = String(this.config.server_url || '').trim() || 'tableau://';
    const tokenName = String(this.config.token_name || '').trim();
    const tokenSecret = String(this.config.token_secret || '').trim();
    const siteName = String(this.config.site_name || '').trim();

    const repository = {
      path: serverUrl,
      name: this.name || 'Tableau',
      type: 'bi' as const,
    };

    // If we don't have PAT credentials, return an empty result but keep repository info
    if (!serverUrl || !tokenName || !tokenSecret) {
      return {
        repository,
        objects: [],
        stats: { objects: 0, columns: 0 },
      };
    }

    try {
      const apiBase = this.getApiBase(serverUrl);
      const { token, siteId } = await this.signIn(apiBase, tokenName, tokenSecret, siteName);

      // Fetch workbooks for this site
      const workbooks = await this.fetchWorkbooks(apiBase, siteId, token);

      const objects: ExtractionResult['objects'] = [];
      let totalColumns = 0;

      // Limit for safety
      const limitedWorkbooks = workbooks.slice(0, 50);

      for (const wb of limitedWorkbooks) {
        const columns: ExtractedObjectColumn[] = [];

        // Try to fetch views for each workbook and expose them as columns
        try {
          const views = await this.fetchWorkbookViews(apiBase, siteId, token, wb.id);
          views.forEach((v, idx) => {
            columns.push({
              name: v.name,
              data_type: 'view',
              is_nullable: true,
              position: idx + 1,
            });
          });
        } catch (e) {
          // Non-fatal; workbook object will still be created without view columns
          // eslint-disable-next-line no-console
          console.warn('[TABLEAU] Failed to fetch views for workbook', wb.id, e instanceof Error ? e.message : e);
        }

        totalColumns += columns.length;

        const definition = {
          workbookId: wb.id,
          projectName: wb.projectName,
          contentUrl: wb.contentUrl,
        };

        objects.push({
          name: wb.name,
          schema_name: (siteName || 'DEFAULT').toUpperCase(),
          database_name: 'TABLEAU',
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
      // Fail gracefully: log and return empty result so the orchestrator can decide how to handle
      // eslint-disable-next-line no-console
      console.error('[TABLEAU] extractMetadata failed:', e?.message || e);
      return {
        repository,
        objects: [],
        stats: { objects: 0, columns: 0 },
      };
    }
  }

  private getApiBase(serverUrl: string): string {
    const trimmed = serverUrl.replace(/\/$/, '');
    // Pin to a recent API version; Tableau is generally backwards compatible
    const version = '3.18';
    return `${trimmed}/api/${version}`;
  }

  private async signIn(apiBase: string, tokenName: string, tokenSecret: string, siteName: string): Promise<{ token: string; siteId: string }> {
    const signInUrl = `${apiBase}/auth/signin`;

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<tsRequest>\n` +
      `  <credentials personalAccessTokenName="${this.escapeXml(tokenName)}" personalAccessTokenSecret="${this.escapeXml(tokenSecret)}">\n` +
      `    <site contentUrl="${this.escapeXml(siteName || '')}" />\n` +
      `  </credentials>\n` +
      `</tsRequest>`;

    const resp = await axios.post(signInUrl, xmlBody, {
      headers: {
        'Content-Type': 'text/xml',
        'Accept': 'application/xml',
      },
      timeout: 10000,
      validateStatus: () => true,
    });

    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(`Tableau sign-in failed with status ${resp.status}`);
    }

    const body = typeof resp.data === 'string' ? resp.data : String(resp.data || '');

    const tokenMatch = body.match(/token="([^"]+)"/);
    const siteIdMatch = body.match(/<site[^>]*id="([^"]+)"/);

    if (!tokenMatch || !siteIdMatch) {
      throw new Error('Failed to parse Tableau sign-in response');
    }

    return { token: tokenMatch[1], siteId: siteIdMatch[1] };
  }

  private async fetchWorkbooks(apiBase: string, siteId: string, token: string): Promise<Array<{ id: string; name: string; projectName?: string; contentUrl?: string }>> {
    const url = `${apiBase}/sites/${siteId}/workbooks`;

    const resp = await axios.get(url, {
      headers: {
        'X-Tableau-Auth': token,
        'Accept': 'application/xml',
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    if (resp.status < 200 || resp.status >= 300) {
      // eslint-disable-next-line no-console
      console.warn('[TABLEAU] Workbooks endpoint returned status', resp.status);
      return [];
    }

    const xml = typeof resp.data === 'string' ? resp.data : String(resp.data || '');
    const workbooks: Array<{ id: string; name: string; projectName?: string; contentUrl?: string }> = [];

    const workbookTagRegex = /<workbook\b[^>]*>/g;
    let match: RegExpExecArray | null;

    while ((match = workbookTagRegex.exec(xml)) !== null) {
      const tag = match[0];
      const id = this.extractXmlAttr(tag, 'id');
      const name = this.extractXmlAttr(tag, 'name');
      const projectName = this.extractXmlAttr(tag, 'projectName');
      const contentUrl = this.extractXmlAttr(tag, 'contentUrl');
      if (id && name) {
        workbooks.push({ id, name, projectName, contentUrl });
      }
    }

    return workbooks;
  }

  private async fetchWorkbookViews(apiBase: string, siteId: string, token: string, workbookId: string): Promise<Array<{ id: string; name: string }>> {
    const url = `${apiBase}/sites/${siteId}/workbooks/${workbookId}/views`;

    const resp = await axios.get(url, {
      headers: {
        'X-Tableau-Auth': token,
        'Accept': 'application/xml',
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    if (resp.status < 200 || resp.status >= 300) {
      // eslint-disable-next-line no-console
      console.warn('[TABLEAU] Views endpoint returned status', resp.status);
      return [];
    }

    const xml = typeof resp.data === 'string' ? resp.data : String(resp.data || '');
    const views: Array<{ id: string; name: string }> = [];

    const viewTagRegex = /<view\b[^>]*>/g;
    let match: RegExpExecArray | null;

    while ((match = viewTagRegex.exec(xml)) !== null) {
      const tag = match[0];
      const id = this.extractXmlAttr(tag, 'id');
      const name = this.extractXmlAttr(tag, 'name');
      if (id && name) {
        views.push({ id, name });
      }
    }

    return views;
  }

  private extractXmlAttr(tag: string, attr: string): string | undefined {
    const regex = new RegExp(`${attr}="([^"]+)"`);
    const match = tag.match(regex);
    return match ? match[1] : undefined;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async disconnect(): Promise<void> {
    // HTTP-only connector; nothing to clean up
    return;
  }
}
