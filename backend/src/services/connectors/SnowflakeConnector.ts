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
    
    console.log('[SNOWFLAKE] Creating new connection with config:', {
      account: this.config.account,
      username: this.config.username,
      role: this.config.role,
      warehouse: this.config.warehouse,
      database: this.config.database,
      schema: this.config.schema,
      hasPassword: !!this.config.password,
      hasMfaToken: !!this.config.passcode
    });
    
    const connectionConfig: any = {
      account: this.config.account,
      username: this.config.username,
      password: this.config.password,
      role: this.config.role,
      warehouse: this.config.warehouse,
      database: this.config.database,
      schema: this.config.schema,
    };

    // Add MFA token if provided
    if (this.config.passcode) {
      connectionConfig.passcode = this.config.passcode;
    }

    const conn = snowflake.createConnection(connectionConfig);

    await new Promise<void>((resolve, reject) => {
      conn.connect((err: any) => {
        if (err) {
          console.error('[SNOWFLAKE] Connection failed:', err?.message || err);
          return reject(err);
        }
        console.log('[SNOWFLAKE] Connection established successfully');
        resolve();
      });
    });

    this.connection = conn;
    return conn;
  }

  private async exec(sqlText: string): Promise<any[]> {
    const conn = await this.getConnection();
    const preview = sqlText.replace(/\s+/g, ' ').slice(0, 140);
    console.log(`[SNOWFLAKE] Executing: ${preview}...`);
    const p = new Promise<any[]>((resolve, reject) => {
      try {
        conn.execute({
          sqlText,
          complete: (err: any, _stmt: any, rows: any[]) => {
            if (err) {
              console.error(`[SNOWFLAKE] Query failed:`, {
                message: err?.message,
                code: err?.code,
                sqlState: err?.sqlState,
                query: preview
              });
              return reject(err);
            }
            resolve(rows || []);
          }
        });
      } catch (e) {
        console.error(`[SNOWFLAKE] Execute threw exception:`, e);
        reject(e);
      }
    });
    const timeoutMs = parseInt(process.env.SNOWFLAKE_QUERY_TIMEOUT_MS || '60000', 10);
    const rows = await this.withTimeout(p, timeoutMs, 'snowflake.exec');
    console.log(`[SNOWFLAKE] Done: rows=${rows.length}`);
    return rows;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Force fresh connection for testing
      await this.disconnect();
      
      console.log('[SNOWFLAKE] Testing connection...');
      const rows = await this.exec('SELECT CURRENT_VERSION() AS VERSION');
      const ver = rows && rows[0] && (rows[0].VERSION || rows[0].version);
      console.log('[SNOWFLAKE] Test successful, version:', ver);
      return { success: true, message: `Connected. Snowflake ${ver}` };
    } catch (e: any) {
      console.error('[SNOWFLAKE] Test failed:', e?.message || e);
      return { success: false, message: e?.message || 'Connection failed', details: e };
    } finally {
      await this.disconnect();
    }
  }

  async extractMetadata(): Promise<ExtractionResult> {
    try {
      // Ensure fresh connection for extraction
      await this.disconnect();
      await this.getConnection();

      const targetDb = this.config.database || null;
      const targetSchema = this.config.schema || null;

      // Session context similar to OpenMetadata: ensure role/warehouse/db/schema and case behavior
      if (this.config.warehouse) {
        await this.exec(`USE WAREHOUSE ${this.quoteIdent(this.config.warehouse as string)}`);
      }
      if (targetDb) {
        await this.exec(`USE DATABASE ${this.quoteIdent(targetDb)}`);
      }
      if (targetSchema) {
        await this.exec(`USE SCHEMA ${this.quoteIdent(targetSchema)}`);
      }
      await this.exec('ALTER SESSION SET QUOTED_IDENTIFIERS_IGNORE_CASE = TRUE');

      // Use SHOW for tables/views and GET_DDL for view SQL (OpenMetadata pattern)
      console.log('[SNOWFLAKE] Fetching tables and views via SHOW');
      const showScope = targetDb && targetSchema ? `IN SCHEMA ${this.safePath(targetDb, targetSchema)}`
                      : (targetDb ? `IN DATABASE ${this.quoteIdent(targetDb)}` : '');
      const tables = await this.exec(`SHOW TABLES ${showScope}`).catch((e) => { console.error('[SNOWFLAKE] SHOW TABLES failed:', e?.message || e); return []; });
      const viewsShow = await this.exec(`SHOW VIEWS ${showScope}`).catch((e) => { console.error('[SNOWFLAKE] SHOW VIEWS failed:', e?.message || e); return []; });
      console.log(`[SNOWFLAKE] Retrieved: tables=${tables.length}, views=${viewsShow.length}`);

      // Fetch columns from information_schema first; fallback to SHOW COLUMNS per table
      const columnsQuery = `
        SELECT table_catalog, table_schema, table_name, column_name, data_type, ordinal_position, is_nullable
        FROM information_schema.columns
        ${targetSchema ? `WHERE table_schema = '${targetSchema}'` : ''}
      `;
      const columns = await this.exec(columnsQuery).catch((e) => { console.error('[SNOWFLAKE] columnsQuery failed:', e?.message || e); return []; });
      console.log(`[SNOWFLAKE] Retrieved columns from information_schema: ${columns.length}`);
      if (columns.length > 0) {
        console.log(`[SNOWFLAKE] Sample column row:`, JSON.stringify(columns[0]));
      }

      // Fetch constraints using Snowflake-specific SHOW commands
      console.log('[SNOWFLAKE] Fetching table constraints via SHOW commands...');
      const constraints: any[] = [];
      
      // Fetch Primary Keys for each table
      for (const t of tables) {
        const dbName = t.database_name || t.DATABASE_NAME || targetDb || '';
        const schemaName = t.schema_name || t.SCHEMA_NAME || targetSchema || '';
        const tableName = t.name || t.NAME;
        
        try {
          const pkRows = await this.exec(`SHOW PRIMARY KEYS IN TABLE ${this.fqName(dbName, schemaName, tableName)}`);
          for (const pk of pkRows) {
            constraints.push({
              TABLE_CATALOG: dbName,
              TABLE_SCHEMA: schemaName,
              TABLE_NAME: tableName,
              CONSTRAINT_NAME: pk.constraint_name || pk.CONSTRAINT_NAME || 'PRIMARY',
              CONSTRAINT_TYPE: 'PRIMARY KEY',
              COLUMN_NAME: pk.column_name || pk.COLUMN_NAME,
              KEY_ORDINAL: pk.key_sequence || pk.KEY_SEQUENCE || 1
            });
          }
        } catch (e: any) {
          // Table might not have PK, that's ok
          console.log(`[SNOWFLAKE] No primary keys for ${tableName}`);
        }

        try {
          const fkRows = await this.exec(`SHOW IMPORTED KEYS IN TABLE ${this.fqName(dbName, schemaName, tableName)}`);
          for (const fk of fkRows) {
            constraints.push({
              TABLE_CATALOG: dbName,
              TABLE_SCHEMA: schemaName,
              TABLE_NAME: tableName,
              CONSTRAINT_NAME: fk.fk_name || fk.FK_NAME,
              CONSTRAINT_TYPE: 'FOREIGN KEY',
              COLUMN_NAME: fk.fk_column_name || fk.FK_COLUMN_NAME,
              REFERENCED_TABLE_SCHEMA: fk.pk_schema_name || fk.PK_SCHEMA_NAME,
              REFERENCED_TABLE_NAME: fk.pk_table_name || fk.PK_TABLE_NAME,
              REFERENCED_COLUMN_NAME: fk.pk_column_name || fk.PK_COLUMN_NAME,
              UPDATE_RULE: fk.update_rule || fk.UPDATE_RULE,
              DELETE_RULE: fk.delete_rule || fk.DELETE_RULE,
              KEY_ORDINAL: fk.key_sequence || fk.KEY_SEQUENCE || 1
            });
          }
        } catch (e: any) {
          // Table might not have FKs, that's ok
          console.log(`[SNOWFLAKE] No foreign keys for ${tableName}`);
        }
      }
      
      console.log(`[SNOWFLAKE] Retrieved constraints: ${constraints.length}`);

      // Build view definitions using GET_DDL for accuracy
      const viewDefMap = new Map<string, string>();
      for (const v of viewsShow) {
        const dbName = this.safeUpper(v.database_name || v.DATABASE_NAME || targetDb || '');
        const schemaName = this.safeUpper(v.schema_name || v.SCHEMA_NAME || targetSchema || '');
        const name = this.safeUpper(v.name || v.NAME);
        const key = `${dbName}.${schemaName}.${name}`;
        try {
          const ddlRows = await this.exec(`SELECT GET_DDL('VIEW', ${this.fqName(dbName, schemaName, name)}) AS DDL`);
          const ddl = ddlRows?.[0]?.DDL || ddlRows?.[0]?.ddl || '';
          viewDefMap.set(key, ddl);
        } catch (e: any) {
          console.warn('[SNOWFLAKE] GET_DDL failed for view', key, e?.message || e);
          viewDefMap.set(key, '');
        }
      }

      const colMap = new Map<string, any[]>();
      for (const c of columns) {
        const key = `${(c.TABLE_CATALOG||c.table_catalog||'').toUpperCase()}.${(c.TABLE_SCHEMA||c.table_schema||'').toUpperCase()}.${(c.TABLE_NAME||c.table_name||'').toUpperCase()}`;
        if (!colMap.has(key)) colMap.set(key, []);
        colMap.get(key)!.push({
          name: c.COLUMN_NAME || c.column_name,
          data_type: c.DATA_TYPE || c.data_type,
          is_nullable: (c.IS_NULLABLE || c.is_nullable) === 'YES' || (c.IS_NULLABLE || c.is_nullable) === 'NO' ? (c.IS_NULLABLE || c.is_nullable) === 'YES' : false,
          position: c.ORDINAL_POSITION || c.ordinal_position,
        });
      }
      
      console.log(`[SNOWFLAKE] Column map keys:`, Array.from(colMap.keys()).slice(0, 3));
      console.log(`[SNOWFLAKE] Column map size: ${colMap.size}`);

      // Fallback: if information_schema returned no columns, use SHOW COLUMNS per table
      if (colMap.size === 0 && tables.length > 0) {
        console.log('[SNOWFLAKE] Falling back to SHOW COLUMNS per table');
        for (const t of tables) {
          const dbName = this.safeUpper(t.database_name || t.DATABASE_NAME || targetDb || '');
          const schemaName = this.safeUpper(t.schema_name || t.SCHEMA_NAME || targetSchema || '');
          const name = this.safeUpper(t.name || t.NAME || t.table_name || t.TABLE_NAME);
          const key = `${dbName}.${schemaName}.${name}`;
          try {
            const cols = await this.exec(`SHOW COLUMNS IN TABLE ${this.fqName(dbName, schemaName, name)}`);
            for (const rc of cols) {
              const colName = rc.column_name || rc.COLUMN_NAME || rc.name || rc.NAME;
              const dataType = rc.data_type || rc.DATA_TYPE || rc.type || rc.TYPE;
              const nullableRaw = rc.is_nullable || rc.IS_NULLABLE || rc.nullable || rc.NULLABLE;
              const isNullable = String(nullableRaw).toUpperCase().includes('YES') || String(nullableRaw).toUpperCase().includes('TRUE');
              const position = rc.ordinal_position || rc.ORDINAL_POSITION || rc.position || rc.POSITION || null;
              if (!colMap.has(key)) colMap.set(key, []);
              colMap.get(key)!.push({ name: colName, data_type: dataType, is_nullable: isNullable, position });
            }
          } catch (e: any) {
            console.warn('[SNOWFLAKE] SHOW COLUMNS failed for table', key, e?.message || e);
          }
        }
      }

      // Process constraints into a map by table
      const constraintsMap = new Map<string, any[]>();
      for (const c of constraints) {
        const tableKey = `${(c.TABLE_CATALOG||c.table_catalog||'').toUpperCase()}.${(c.TABLE_SCHEMA||c.table_schema||'').toUpperCase()}.${(c.TABLE_NAME||c.table_name||'').toUpperCase()}`;
        if (!constraintsMap.has(tableKey)) {
          constraintsMap.set(tableKey, []);
        }
        constraintsMap.get(tableKey)!.push(c);
      }
      console.log(`[SNOWFLAKE] Constraints map size: ${constraintsMap.size}`);

      const objects: ExtractedObject[] = [];
      
      // Process tables
      for (const t of tables) {
        const database_name = t.database_name || t.DATABASE_NAME || t.table_catalog || t.TABLE_CATALOG || null;
        const schema_name = t.schema_name || t.SCHEMA_NAME || t.table_schema || t.TABLE_SCHEMA || null;
        const name = t.name || t.NAME || t.table_name || t.TABLE_NAME;
        const type = ((t.kind || t.KIND) || (t.table_type || t.TABLE_TYPE) || '').toUpperCase();
        const key = `${(database_name||'').toUpperCase()}.${(schema_name||'').toUpperCase()}.${(name||'').toUpperCase()}`;

        if (targetDb && database_name && database_name.toUpperCase() !== String(targetDb).toUpperCase()) {
          continue;
        }

        const object_type = type === 'VIEW' ? 'view' : 'table';
        const definition = object_type === 'view' ? (viewDefMap.get(key) || undefined) : undefined;
        const columnsForObj = colMap.get(key) || [];
        const tableConstraints = constraintsMap.get(key) || [];

        // Group constraints by constraint_name
        const constraintsByName = new Map<string, any[]>();
        for (const c of tableConstraints) {
          const cName = c.CONSTRAINT_NAME || c.constraint_name;
          if (!constraintsByName.has(cName)) {
            constraintsByName.set(cName, []);
          }
          constraintsByName.get(cName)!.push(c);
        }

        // Build constraint objects
        const processedConstraints = Array.from(constraintsByName.entries()).map(([cName, rows]) => {
          const first = rows[0];
          return {
            constraint_name: cName,
            constraint_type: (first.CONSTRAINT_TYPE || first.constraint_type) as any,
            columns: rows.map(r => r.COLUMN_NAME || r.column_name).filter(Boolean),
            referenced_table: first.REFERENCED_TABLE_NAME || first.referenced_table_name,
            referenced_schema: first.REFERENCED_TABLE_SCHEMA || first.referenced_table_schema,
            referenced_columns: rows.map(r => r.REFERENCED_COLUMN_NAME || r.referenced_column_name).filter(Boolean),
            update_rule: first.UPDATE_RULE || first.update_rule,
            delete_rule: first.DELETE_RULE || first.delete_rule,
          };
        });

        console.log(`[SNOWFLAKE] Object ${name}: type=${object_type}, key=${key}, columns=${columnsForObj.length}, constraints=${processedConstraints.length}`);

        objects.push({
          name,
          schema_name: schema_name || undefined,
          database_name: database_name || undefined,
          object_type,
          definition,
          columns: columnsForObj,
          constraints: processedConstraints.length > 0 ? processedConstraints : undefined,
        });
      }

      // Process views (in case they weren't in tables)
      for (const v of viewsShow) {
        const database_name = v.database_name || v.DATABASE_NAME || targetDb || null;
        const schema_name = v.schema_name || v.SCHEMA_NAME || targetSchema || null;
        const name = v.name || v.NAME;
        const key = `${(database_name||'').toUpperCase()}.${(schema_name||'').toUpperCase()}.${(name||'').toUpperCase()}`;

        // Skip if already added from tables
        if (objects.some(o => o.name === name && o.schema_name === schema_name && o.database_name === database_name)) {
          continue;
        }

        const columnsForObj = colMap.get(key) || [];
        const definition = viewDefMap.get(key) || undefined;

        console.log(`[SNOWFLAKE] View ${name}: columns=${columnsForObj.length}`);

        objects.push({
          name,
          schema_name: schema_name || undefined,
          database_name: database_name || undefined,
          object_type: 'view',
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
    const destroyPromise = new Promise<void>((resolve) => {
      try {
        conn.destroy(() => resolve());
      } catch (_) {
        resolve();
      }
    });
    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 2000));
    await Promise.race([destroyPromise, timeoutPromise]);
  }

  private withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      p.then((v) => { clearTimeout(t); resolve(v); })
       .catch((e) => { clearTimeout(t); reject(e); });
    });
  }

  private quoteIdent(name: string): string {
    const n = String(name).replace(/"/g, '""');
    return `"${n}"`;
  }

  private safePath(db: string, schema: string): string {
    // SHOW commands accept unquoted identifiers if simple. Use upper-case plain path.
    return `${db}.${schema}`;
  }

  private fqName(db: string, schema: string, name: string): string {
    // Fully quoted identifier for GET_DDL/SHOW COLUMNS
    return `${this.quoteIdent(db)}.${this.quoteIdent(schema)}.${this.quoteIdent(name)}`;
  }

  private safeUpper(v: any): string { return String(v || '').toUpperCase(); }
}
