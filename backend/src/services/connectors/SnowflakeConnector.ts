import { IConnector, ConnectorConfig, ConnectionTestResult, ExtractionResult, ExtractedObject } from './IConnector';
import { promisify } from 'util';

const snowflake = require('snowflake-sdk');

export class SnowflakeConnector implements IConnector {
  name: string;
  type: 'snowflake' = 'snowflake';
  version = '1.0.0';
  private config: ConnectorConfig = {};
  private connection: any;

  constructor(name: string, config: ConnectorConfig) {
    this.name = name;
    this.config = config || {};
  }

  async configure(config: ConnectorConfig): Promise<void> {
    this.config = config || {};
  }

  private async getConnection(): Promise<any> {
    if (this.connection) return this.connection;
    const conn = snowflake.createConnection({
      account: this.config.account,
      username: this.config.username,
      password: this.config.password,
      role: this.config.role,
      warehouse: this.config.warehouse,
      database: this.config.database,
      schema: this.config.schema,
    });

    await new Promise<void>((resolve, reject) => {
      conn.connect((err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    this.connection = conn;
    return conn;
  }

  private async exec(sqlText: string): Promise<any[]> {
    const conn = await this.getConnection();
    return new Promise<any[]>((resolve, reject) => {
      conn.execute({
        sqlText,
        complete: (err: any, stmt: any, rows: any[]) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      });
    });
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const rows = await this.exec('SELECT CURRENT_VERSION() AS VERSION');
      const ver = rows && rows[0] && (rows[0].VERSION || rows[0].version);
      return { success: true, message: `Connected. Snowflake ${ver}` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Connection failed', details: e };
    } finally {
      await this.disconnect();
    }
  }

  async extractMetadata(): Promise<ExtractionResult> {
    try {
      await this.getConnection();

      const targetDb = this.config.database || null;
      const targetSchema = this.config.schema || null;

      const tablesQuery = `
        SELECT table_catalog, table_schema, table_name, table_type
        FROM information_schema.tables
        ${targetSchema ? `WHERE table_schema = '${targetSchema}'` : ''}
      `;

      const columnsQuery = `
        SELECT table_catalog, table_schema, table_name, column_name, data_type, ordinal_position, is_nullable
        FROM information_schema.columns
        ${targetSchema ? `WHERE table_schema = '${targetSchema}'` : ''}
      `;

      const viewsQuery = `
        SELECT table_catalog, table_schema, table_name, view_definition
        FROM information_schema.views
        ${targetSchema ? `WHERE table_schema = '${targetSchema}'` : ''}
      `;

      const [tables, columns, views] = await Promise.all([
        this.exec(tablesQuery),
        this.exec(columnsQuery),
        this.exec(viewsQuery),
      ]);

      const viewDefMap = new Map<string, string>();
      for (const v of views) {
        const key = `${(v.table_catalog||'').toUpperCase()}.${(v.table_schema||'').toUpperCase()}.${(v.table_name||'').toUpperCase()}`;
        viewDefMap.set(key, v.view_definition || v.VIEW_DEFINITION || '');
      }

      const colMap = new Map<string, any[]>();
      for (const c of columns) {
        const key = `${(c.table_catalog||'').toUpperCase()}.${(c.table_schema||'').toUpperCase()}.${(c.table_name||'').toUpperCase()}`;
        if (!colMap.has(key)) colMap.set(key, []);
        colMap.get(key)!.push({
          name: c.column_name || c.COLUMN_NAME,
          data_type: c.data_type || c.DATA_TYPE,
          is_nullable: (c.is_nullable || c.IS_NULLABLE) === 'YES',
          position: c.ordinal_position || c.ORDINAL_POSITION,
        });
      }

      const objects: ExtractedObject[] = [];
      for (const t of tables) {
        const database_name = t.table_catalog || t.TABLE_CATALOG || null;
        const schema_name = t.table_schema || t.TABLE_SCHEMA || null;
        const name = t.table_name || t.TABLE_NAME;
        const type = (t.table_type || t.TABLE_TYPE || '').toUpperCase();
        const key = `${(database_name||'').toUpperCase()}.${(schema_name||'').toUpperCase()}.${(name||'').toUpperCase()}`;

        if (targetDb && database_name && database_name.toUpperCase() !== String(targetDb).toUpperCase()) {
          continue;
        }

        const object_type = type === 'VIEW' ? 'view' : 'table';
        const definition = object_type === 'view' ? (viewDefMap.get(key) || undefined) : undefined;
        const columnsForObj = colMap.get(key) || [];

        objects.push({
          name,
          schema_name: schema_name || undefined,
          database_name: database_name || undefined,
          object_type,
          definition,
          columns: columnsForObj,
        });
      }

      const repoPath = `snowflake://${this.config.account || 'account'}/${this.config.database || ''}`;
      const result: ExtractionResult = {
        repository: {
          path: repoPath,
          name: this.config.database || this.name || 'Snowflake',
          type: 'warehouse',
        },
        objects,
        stats: {
          objects: objects.length,
          columns: columns.length,
        }
      };

      return result;
    } finally {
      await this.disconnect();
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connection) return;
    const conn = this.connection;
    this.connection = null;
    await new Promise<void>((resolve) => {
      try {
        conn.destroy(() => resolve());
      } catch (_) {
        resolve();
      }
    });
  }
}
