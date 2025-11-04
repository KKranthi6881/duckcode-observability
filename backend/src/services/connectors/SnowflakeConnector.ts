import { IConnector, ConnectorConfig, ConnectionTestResult, ExtractionResult, ExtractedObject } from './IConnector';
import { promisify } from 'util';
import snowflakeCostExtractor from './SnowflakeCostExtractor';

const snowflake = require('snowflake-sdk');

export class SnowflakeConnector implements IConnector {
  name: string;
  type: 'snowflake' = 'snowflake';
  version = '1.0.0';
  private config: ConnectorConfig = {};
  private connection: any;
  private connectorId?: string;
  private organizationId?: string;

  constructor(name: string, config: ConnectorConfig, connectorId?: string, organizationId?: string) {
    this.name = name;
    this.config = config || {};
    this.connectorId = connectorId;
    this.organizationId = organizationId;
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

      // Build view definitions - SHOW VIEWS includes the 'text' column with view SQL
      const viewDefMap = new Map<string, string>();
      for (const v of viewsShow) {
        const dbName = this.safeUpper(v.database_name || v.DATABASE_NAME || targetDb || '');
        const schemaName = this.safeUpper(v.schema_name || v.SCHEMA_NAME || targetSchema || '');
        const name = this.safeUpper(v.name || v.NAME);
        const key = `${dbName}.${schemaName}.${name}`;
        
        // SHOW VIEWS returns 'text' column with the view definition
        const viewText = v.text || v.TEXT || '';
        if (viewText) {
          viewDefMap.set(key, viewText);
          console.log(`[SNOWFLAKE] View ${name} definition extracted from SHOW VIEWS (${viewText.length} chars)`);
          console.log(`[SNOWFLAKE] View ${name} SQL preview:`, viewText.substring(0, 150));
        } else {
          // Fallback to GET_DDL if text is not available
          try {
            const ddlRows = await this.exec(`SELECT GET_DDL('VIEW', '${dbName}.${schemaName}.${name}') AS DDL`);
            const ddl = ddlRows?.[0]?.DDL || ddlRows?.[0]?.ddl || '';
            viewDefMap.set(key, ddl);
            console.log(`[SNOWFLAKE] View ${name} definition extracted from GET_DDL (${ddl.length} chars)`);
          } catch (e: any) {
            console.warn('[SNOWFLAKE] GET_DDL failed for view', key, e?.message || e);
            viewDefMap.set(key, '');
          }
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

      // Extract and store cost data (Phase 1)
      console.log(`[SNOWFLAKE] Cost extraction check: connectorId=${this.connectorId}, organizationId=${this.organizationId}`);
      if (this.connectorId && this.organizationId) {
        console.log('[SNOWFLAKE] ✅ Starting cost and storage data extraction...');
        try {
          await this.extractAndStoreCostData(this.connectorId, this.organizationId);
          console.log('[SNOWFLAKE] ✅ Cost extraction complete!');
        } catch (e: any) {
          console.error('[SNOWFLAKE] ❌ Cost extraction failed (non-fatal):', e?.message || e);
          console.error('[SNOWFLAKE] Error stack:', e?.stack);
          // Don't fail the whole extraction if cost data fails
        }
      } else {
        console.log('[SNOWFLAKE] ⚠️  Skipping cost extraction - connectorId or organizationId not provided');
      }

      return result;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Extract cost, storage, and waste data and store in database
   */
  private async extractAndStoreCostData(connectorId: string, organizationId: string): Promise<void> {
    try {
      console.log('[SNOWFLAKE] Getting connection for cost extraction...');
      await this.getConnection();

      // 1. Extract cost metrics (last 30 days)
      console.log('[SNOWFLAKE] 📊 Step 1/4: Extracting cost metrics...');
      const costData = await this.extractCostMetrics();
      console.log(`[SNOWFLAKE] Found cost data: ${costData.total_credits} credits`);
      await snowflakeCostExtractor.storeCostMetrics({
        connectorId,
        organizationId,
        ...costData
      });
      console.log('[SNOWFLAKE] ✅ Cost metrics stored');

      // 2. Extract storage usage
      console.log('[SNOWFLAKE] 💾 Step 2/4: Extracting storage usage...');
      const storageData = await this.extractStorageData();
      console.log(`[SNOWFLAKE] Found ${storageData.length} tables with storage data`);
      
      // Debug: Log first row to see what we're getting
      if (storageData.length > 0) {
        console.log('[SNOWFLAKE] First storage row sample:', JSON.stringify(storageData[0], null, 2));
        
        await snowflakeCostExtractor.storeStorageUsage(
          storageData.map(s => ({ connectorId, organizationId, ...s }))
        );
        console.log('[SNOWFLAKE] ✅ Storage usage stored');
      } else {
        console.log('[SNOWFLAKE] ⚠️  No storage data found');
      }

      // 3. Extract warehouse metrics
      console.log('[SNOWFLAKE] 🏭 Step 3/4: Extracting warehouse metrics...');
      const warehouseMetrics = await this.extractWarehouseMetrics();
      console.log(`[SNOWFLAKE] Found ${warehouseMetrics.length} warehouses`);
      if (warehouseMetrics.length > 0) {
        await snowflakeCostExtractor.storeWarehouseMetrics(
          warehouseMetrics.map(w => ({ connectorId, organizationId, ...w }))
        );
        console.log('[SNOWFLAKE] ✅ Warehouse metrics stored');
      } else {
        console.log('[SNOWFLAKE] ⚠️  No warehouse metrics found');
      }

      // 4. Detect waste opportunities
      console.log('[SNOWFLAKE] 🔍 Step 4/4: Detecting waste opportunities...');
      const wasteOpportunities = await this.detectWasteOpportunities();
      console.log(`[SNOWFLAKE] Found ${wasteOpportunities.length} waste opportunities`);
      if (wasteOpportunities.length > 0) {
        await snowflakeCostExtractor.storeWasteOpportunities(
          wasteOpportunities.map(w => ({ connectorId, organizationId, ...w }))
        );
        console.log('[SNOWFLAKE] ✅ Waste opportunities stored');
      } else {
        console.log('[SNOWFLAKE] ⚠️  No waste opportunities found');
      }

      console.log('[SNOWFLAKE] 🎉 Cost extraction complete!');
    } catch (e: any) {
      console.error('[SNOWFLAKE] Cost extraction error:', e?.message || e);
      throw e;
    }
  }

  /**
   * Extract cost metrics for last 30 days
   */
  private async extractCostMetrics(): Promise<{ compute_credits: number; storage_credits: number; total_credits: number }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const start = startDate.toISOString().slice(0, 19);

    // Get compute costs
    const computeSql = `
      SELECT COALESCE(SUM(CREDITS_USED_COMPUTE + CREDITS_USED_CLOUD_SERVICES), 0) AS TOTAL_CREDITS
      FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
      WHERE START_TIME >= '${start}'
    `;
    const computeRows = await this.exec(computeSql);
    const computeCredits = Number(computeRows?.[0]?.TOTAL_CREDITS || 0);

    // Get storage costs (approximate)
    const storageSql = `
      SELECT AVG(STORAGE_BYTES + STAGE_BYTES + FAILSAFE_BYTES) AS AVG_BYTES
      FROM SNOWFLAKE.ACCOUNT_USAGE.STORAGE_USAGE
      WHERE USAGE_DATE >= DATEADD(day, -30, CURRENT_DATE())
    `;
    const storageRows = await this.exec(storageSql);
    const avgBytes = Number(storageRows?.[0]?.AVG_BYTES || 0);
    const storageCredits = (avgBytes / 1099511627776) * 23 / 3; // TB to credits

    return {
      compute_credits: computeCredits,
      storage_credits: storageCredits,
      total_credits: computeCredits + storageCredits
    };
  }

  /**
   * Extract storage usage for all tables
   * Using actual TABLE_STORAGE_METRICS schema from Snowflake ACCOUNT_USAGE
   */
  private async extractStorageData(): Promise<any[]> {
    const sql = `
      SELECT 
        TABLE_CATALOG,
        TABLE_SCHEMA,
        TABLE_NAME,
        ACTIVE_BYTES,
        TIME_TRAVEL_BYTES,
        FAILSAFE_BYTES,
        RETAINED_FOR_CLONE_BYTES,
        IS_TRANSIENT,
        TABLE_CREATED,
        TABLE_DROPPED
      FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS
      WHERE DELETED = FALSE
        AND ACTIVE_BYTES > 0
        AND TABLE_CATALOG IS NOT NULL
        AND TABLE_SCHEMA IS NOT NULL
        AND TABLE_NAME IS NOT NULL
      ORDER BY ACTIVE_BYTES DESC NULLS LAST
      LIMIT 1000
    `;
    
    const rows = await this.exec(sql);
    
    // Map Snowflake column names (uppercase) to our schema (lowercase)
    return rows.map((row: any) => ({
      database_name: row.TABLE_CATALOG,
      schema_name: row.TABLE_SCHEMA,
      table_name: row.TABLE_NAME,
      table_type: 'TABLE',
      storage_bytes: row.ACTIVE_BYTES || 0,
      row_count: null,
      is_transient: row.IS_TRANSIENT === 'YES',
      retention_days: row.IS_TRANSIENT === 'YES' ? 0 : 1,
      last_altered: row.TABLE_DROPPED || row.TABLE_CREATED,
      last_accessed: null,
      days_since_access: null,
      time_travel_bytes: row.TIME_TRAVEL_BYTES || 0,
      failsafe_bytes: row.FAILSAFE_BYTES || 0,
      retained_for_clone_bytes: row.RETAINED_FOR_CLONE_BYTES || 0
    }));
  }

  /**
   * Extract warehouse performance metrics (last 7 days)
   * Combines query stats from QUERY_HISTORY and credits from WAREHOUSE_METERING_HISTORY
   */
  private async extractWarehouseMetrics(): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const start = startDate.toISOString().slice(0, 19);

    const sql = `
      WITH query_aggregates AS (
        SELECT 
          WAREHOUSE_NAME,
          COUNT(*) AS TOTAL_QUERIES,
          SUM(TOTAL_ELAPSED_TIME) AS TOTAL_EXECUTION_TIME_MS
        FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
        WHERE START_TIME >= '${start}'
          AND WAREHOUSE_NAME IS NOT NULL
        GROUP BY WAREHOUSE_NAME
      ),
      warehouse_sizes AS (
        SELECT DISTINCT
          WAREHOUSE_NAME,
          FIRST_VALUE(WAREHOUSE_SIZE) OVER (PARTITION BY WAREHOUSE_NAME ORDER BY START_TIME DESC) AS WAREHOUSE_SIZE
        FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
        WHERE START_TIME >= '${start}'
          AND WAREHOUSE_NAME IS NOT NULL
      ),
      credit_usage AS (
        SELECT 
          WAREHOUSE_NAME,
          SUM(CREDITS_USED_COMPUTE + CREDITS_USED_CLOUD_SERVICES) AS CREDITS_USED
        FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
        WHERE START_TIME >= '${start}'
        GROUP BY WAREHOUSE_NAME
      )
      SELECT 
        COALESCE(qa.WAREHOUSE_NAME, cu.WAREHOUSE_NAME) AS WAREHOUSE_NAME,
        COALESCE(qa.TOTAL_QUERIES, 0) AS TOTAL_QUERIES,
        COALESCE(qa.TOTAL_EXECUTION_TIME_MS, 0) AS TOTAL_EXECUTION_TIME_MS,
        COALESCE(cu.CREDITS_USED, 0) AS CREDITS_USED,
        NULL AS UTILIZATION_PERCENT,
        ws.WAREHOUSE_SIZE
      FROM query_aggregates qa
      FULL OUTER JOIN credit_usage cu ON qa.WAREHOUSE_NAME = cu.WAREHOUSE_NAME
      LEFT JOIN warehouse_sizes ws ON COALESCE(qa.WAREHOUSE_NAME, cu.WAREHOUSE_NAME) = ws.WAREHOUSE_NAME
    `;
    
    const rows = await this.exec(sql);
    
    // Map Snowflake column names (uppercase) to our schema (lowercase)
    return rows.map((row: any) => ({
      warehouse_name: row.WAREHOUSE_NAME,
      total_queries: row.TOTAL_QUERIES || 0,
      total_execution_time_ms: row.TOTAL_EXECUTION_TIME_MS || 0,
      credits_used: row.CREDITS_USED || 0,
      utilization_percent: row.UTILIZATION_PERCENT,
      warehouse_size: row.WAREHOUSE_SIZE
    }));
  }

  /**
   * Detect waste opportunities
   */
  private async detectWasteOpportunities(): Promise<any[]> {
    const opportunities: any[] = [];

    // Detect unused tables (>90 days no access, >1GB)
    const unusedTablesSql = `
      WITH table_storage AS (
        SELECT 
          TABLE_CATALOG,
          TABLE_SCHEMA,
          TABLE_NAME,
          ACTIVE_BYTES,
          COALESCE(TABLE_DROPPED, TABLE_CREATED) AS LAST_MODIFIED
        FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS
        WHERE DELETED = FALSE 
          AND ACTIVE_BYTES > 1073741824
          AND TABLE_CATALOG IS NOT NULL
      ),
      table_access AS (
        SELECT 
          obj.value:objectName::STRING AS TABLE_NAME,
          obj.value:objectDomain::STRING AS OBJECT_DOMAIN,
          MAX(QUERY_START_TIME) AS LAST_ACCESS
        FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY,
        LATERAL FLATTEN(input => DIRECT_OBJECTS_ACCESSED) obj
        WHERE QUERY_START_TIME >= DATEADD(day, -90, CURRENT_TIMESTAMP())
          AND obj.value:objectDomain::STRING = 'Table'
        GROUP BY obj.value:objectName::STRING, obj.value:objectDomain::STRING
      )
      SELECT 
        ts.TABLE_CATALOG AS DATABASE_NAME,
        ts.TABLE_SCHEMA AS SCHEMA_NAME,
        ts.TABLE_NAME,
        ts.ACTIVE_BYTES AS STORAGE_BYTES,
        ts.LAST_MODIFIED,
        ta.LAST_ACCESS,
        DATEDIFF(day, COALESCE(ta.LAST_ACCESS, ts.LAST_MODIFIED), CURRENT_TIMESTAMP()) AS DAYS_SINCE_ACCESS
      FROM table_storage ts
      LEFT JOIN table_access ta ON ts.TABLE_NAME = ta.TABLE_NAME
      WHERE COALESCE(ta.LAST_ACCESS, ts.LAST_MODIFIED) < DATEADD(day, -90, CURRENT_TIMESTAMP())
      ORDER BY ts.ACTIVE_BYTES DESC
      LIMIT 50
    `;

    try {
      const unusedTables = await this.exec(unusedTablesSql);
      for (const table of unusedTables) {
        const bytes = Number(table.STORAGE_BYTES || 0);
        const monthlyCost = (bytes / 1099511627776) * 23;
        opportunities.push({
          opportunity_type: 'unused_table',
          severity: monthlyCost > 100 ? 'high' : 'medium',
          resource_type: 'TABLE',
          resource_name: table.TABLE_NAME,
          database_name: table.DATABASE_NAME,
          schema_name: table.SCHEMA_NAME,
          current_monthly_cost: monthlyCost,
          potential_monthly_savings: monthlyCost,
          savings_confidence: 90,
          title: `Unused table: ${table.TABLE_NAME}`,
          description: `Table has not been accessed in ${table.DAYS_SINCE_ACCESS} days`,
          recommendation: `Archive or delete this table to save $${monthlyCost.toFixed(2)}/month`,
          evidence: { bytes, days_since_access: table.DAYS_SINCE_ACCESS }
        });
      }
    } catch (e) {
      console.warn('[SNOWFLAKE] Failed to detect unused tables:', e);
    }

    return opportunities;
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
