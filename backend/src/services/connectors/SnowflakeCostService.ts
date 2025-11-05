import { supabaseAdmin } from '../../config/supabase';
import { decryptAPIKey } from '../../utils/encryption';

const snowflake = require('snowflake-sdk');

export class SnowflakeCostService {
  private async getConnector(connectorId: string) {
    const { data, error } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .select('*')
      .eq('id', connectorId)
      .single();
    if (error || !data) throw new Error('Connector not found');
    return data;
  }

  private async connect(connectorId: string) {
    const connector = await this.getConnector(connectorId);
    const configStr = decryptAPIKey(
      connector.config_encrypted,
      connector.config_iv,
      connector.config_auth_tag
    );
    const cfg = JSON.parse(configStr || '{}');
    const conn = snowflake.createConnection({
      account: cfg.account,
      username: cfg.username,
      password: cfg.password,
      role: cfg.role,
      warehouse: cfg.warehouse,
      database: cfg.database,
      schema: cfg.schema,
    });
    await new Promise<void>((resolve, reject) => conn.connect((err: any) => err ? reject(err) : resolve()));
    return conn;
  }

  private async exec(conn: any, sqlText: string): Promise<any[]> {
    return new Promise<any[]>((resolve, reject) => {
      conn.execute({
        sqlText,
        complete: (err: any, _stmt: any, rows: any[]) => err ? reject(err) : resolve(rows || [])
      });
    });
  }

  private rangeClause(start?: string, end?: string, col: string = 'START_TIME') {
    const s = start ? ` AND ${col} >= '${start}'` : '';
    const e = end ? ` AND ${col} < '${end}'` : '';
    return s + e;
  }

  private eqClause(value: string | undefined | null, col: string) {
    return value ? ` AND ${col} = '${value.replace(/'/g, "''")}'` : '';
  }

  async getOverviewDailyCredits(connectorId: string, start?: string, end?: string, opts?: { warehouse?: string; tagName?: string; tagValue?: string }) {
    const conn = await this.connect(connectorId);
    try {
      const useTag = !!(opts?.tagName || opts?.tagValue);
      const where = `WHERE 1=1${this.rangeClause(start, end, 'mh.START_TIME')}${this.eqClause(opts?.warehouse, 'mh.WAREHOUSE_NAME')}`;
      const tagJoin = useTag ? `
        JOIN SNOWFLAKE.ACCOUNT_USAGE.TAG_REFERENCES tr
          ON UPPER(tr.OBJECT_NAME) = UPPER(mh.WAREHOUSE_NAME) AND tr.OBJECT_DOMAIN = 'WAREHOUSE'
      ` : '';
      const tagFilter = useTag
        ? `${opts?.tagName ? ` AND tr.TAG_NAME = '${opts.tagName.replace(/'/g, "''")}'` : ''}${opts?.tagValue ? ` AND tr.TAG_VALUE = '${opts.tagValue.replace(/'/g, "''")}'` : ''}`
        : '';
      const sql = `
        SELECT DATE_TRUNC('day', mh.START_TIME) AS DAY,
               SUM(mh.CREDITS_USED_COMPUTE + mh.CREDITS_USED_CLOUD_SERVICES) AS CREDITS
        FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY mh
        ${tagJoin}
        ${where}
        ${tagFilter}
        GROUP BY 1
        ORDER BY 1
      `;
      return await this.exec(conn, sql);
    } finally {
      try { conn.destroy(() => {}); } catch {}
    }
  }

  async getWarehouseCosts(connectorId: string, start?: string, end?: string, opts?: { tagName?: string; tagValue?: string }) {
    const conn = await this.connect(connectorId);
    try {
      const useTag = !!(opts?.tagName || opts?.tagValue);
      const where = `WHERE 1=1${this.rangeClause(start, end, 'mh.START_TIME')}`;
      const tagJoin = useTag ? `
        JOIN SNOWFLAKE.ACCOUNT_USAGE.TAG_REFERENCES tr
          ON UPPER(tr.OBJECT_NAME) = UPPER(mh.WAREHOUSE_NAME) AND tr.OBJECT_DOMAIN = 'WAREHOUSE'
      ` : '';
      const tagFilter = useTag
        ? `${opts?.tagName ? ` AND tr.TAG_NAME = '${opts.tagName.replace(/'/g, "''")}'` : ''}${opts?.tagValue ? ` AND tr.TAG_VALUE = '${opts.tagValue.replace(/'/g, "''")}'` : ''}`
        : '';
      const sql = `
        SELECT mh.WAREHOUSE_NAME,
               SUM(mh.CREDITS_USED_COMPUTE + mh.CREDITS_USED_CLOUD_SERVICES) AS CREDITS
        FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY mh
        ${tagJoin}
        ${where}
        ${tagFilter}
        GROUP BY mh.WAREHOUSE_NAME
        ORDER BY CREDITS DESC
        LIMIT 100
      `;
      return await this.exec(conn, sql);
    } finally {
      try { conn.destroy(() => {}); } catch {}
    }
  }

  async getCostByTags(connectorId: string, start?: string, end?: string) {
    const conn = await this.connect(connectorId);
    try {
      const where = `WHERE 1=1${this.rangeClause(start, end, 'mh.START_TIME')}`;
      const sql = `
        SELECT tr.TAG_NAME, tr.TAG_VALUE,
               SUM(mh.CREDITS_USED_COMPUTE + mh.CREDITS_USED_CLOUD_SERVICES) AS CREDITS
        FROM SNOWFLAKE.ACCOUNT_USAGE.TAG_REFERENCES tr
        JOIN SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY mh
          ON UPPER(tr.OBJECT_NAME) = UPPER(mh.WAREHOUSE_NAME)
        WHERE tr.OBJECT_DOMAIN = 'WAREHOUSE'
          ${this.rangeClause(start, end, 'mh.START_TIME')}
        GROUP BY tr.TAG_NAME, tr.TAG_VALUE
        ORDER BY CREDITS DESC
        LIMIT 200
      `;
      return await this.exec(conn, sql);
    } catch (error: any) {
      // TAG_REFERENCES may not be available or accessible
      console.warn('[SnowflakeCostService] TAG_REFERENCES not available:', error?.message);
      return [];
    } finally {
      try { conn.destroy(() => {}); } catch {}
    }
  }

  async getTopQueriesByBytes(connectorId: string, start?: string, end?: string, opts?: { warehouse?: string; user?: string }) {
    const conn = await this.connect(connectorId);
    try {
      const where = `WHERE 1=1${this.rangeClause(start, end, 'START_TIME')}${this.eqClause(opts?.warehouse, 'WAREHOUSE_NAME')}${this.eqClause(opts?.user, 'USER_NAME')}`;
      const sql = `
        SELECT QUERY_ID, USER_NAME, WAREHOUSE_NAME, DATABASE_NAME, SCHEMA_NAME,
               BYTES_SCANNED, TOTAL_ELAPSED_TIME, EXECUTION_TIME, START_TIME,
               QUERY_TEXT
        FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
        ${where}
        ORDER BY BYTES_SCANNED DESC NULLS LAST
        LIMIT 50
      `;
      return await this.exec(conn, sql);
    } finally {
      try { conn.destroy(() => {}); } catch {}
    }
  }

  async getCreditsSummary(connectorId: string, start?: string, end?: string, scope?: { level: 'overall' | 'warehouse' | 'tag' | 'user'; warehouse?: string; tagName?: string; tagValue?: string; user?: string }) {
    const conn = await this.connect(connectorId);
    try {
      if (!scope || scope.level === 'overall') {
        const sql = `
          SELECT COALESCE(SUM(mh.CREDITS_USED_COMPUTE + mh.CREDITS_USED_CLOUD_SERVICES), 0) AS CREDITS
          FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY mh
          WHERE 1=1 ${this.rangeClause(start, end, 'mh.START_TIME')}
        `;
        const rows = await this.exec(conn, sql);
        return Number(rows?.[0]?.CREDITS || 0);
      }
      if (scope.level === 'warehouse') {
        const sql = `
          SELECT COALESCE(SUM(mh.CREDITS_USED_COMPUTE + mh.CREDITS_USED_CLOUD_SERVICES), 0) AS CREDITS
          FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY mh
          WHERE 1=1 ${this.rangeClause(start, end, 'mh.START_TIME')}${this.eqClause(scope.warehouse, 'mh.WAREHOUSE_NAME')}
        `;
        const rows = await this.exec(conn, sql);
        return Number(rows?.[0]?.CREDITS || 0);
      }
      if (scope.level === 'tag') {
        try {
          const sql = `
            SELECT COALESCE(SUM(mh.CREDITS_USED_COMPUTE + mh.CREDITS_USED_CLOUD_SERVICES), 0) AS CREDITS
            FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY mh
            JOIN SNOWFLAKE.ACCOUNT_USAGE.TAG_REFERENCES tr
              ON UPPER(tr.OBJECT_NAME) = UPPER(mh.WAREHOUSE_NAME) AND tr.OBJECT_DOMAIN = 'WAREHOUSE'
            WHERE 1=1 ${this.rangeClause(start, end, 'mh.START_TIME')}
              ${scope.tagName ? ` AND tr.TAG_NAME = '${scope.tagName.replace(/'/g, "''")}'` : ''}
              ${scope.tagValue ? ` AND tr.TAG_VALUE = '${scope.tagValue.replace(/'/g, "''")}'` : ''}
          `;
          const rows = await this.exec(conn, sql);
          return Number(rows?.[0]?.CREDITS || 0);
        } catch (error: any) {
          console.warn('[SnowflakeCostService] TAG_REFERENCES not available for credits summary:', error?.message);
          return 0;
        }
      }
      if (scope.level === 'user') {
        const sql = `
          SELECT COALESCE(SUM(mh.CREDITS_USED_COMPUTE + mh.CREDITS_USED_CLOUD_SERVICES), 0) AS CREDITS
          FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY mh
          JOIN SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY q
            ON DATE_TRUNC('hour', q.START_TIME) = DATE_TRUNC('hour', mh.START_TIME)
            AND q.WAREHOUSE_NAME = mh.WAREHOUSE_NAME
          WHERE 1=1 ${this.rangeClause(start, end, 'mh.START_TIME')}${this.eqClause(scope.user, 'q.USER_NAME')}
        `;
        const rows = await this.exec(conn, sql);
        return Number(rows?.[0]?.CREDITS || 0);
      }
      return 0;
    } finally {
      try { conn.destroy(() => {}); } catch {}
    }
  }

  async listWarehouses(connectorId: string, start?: string, end?: string): Promise<{ WAREHOUSE_NAME: string }[]> {
    const conn = await this.connect(connectorId);
    try {
      const where = `WHERE 1=1${this.rangeClause(start, end, 'START_TIME')}`;
      const sql = `
        SELECT DISTINCT WAREHOUSE_NAME
        FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
        ${where}
        ORDER BY 1
      `;
      return await this.exec(conn, sql);
    } finally { try { conn.destroy(() => {}); } catch {} }
  }

  async listTags(connectorId: string, start?: string, end?: string): Promise<{ TAG_NAME: string; TAG_VALUE: string }[]> {
    const conn = await this.connect(connectorId);
    try {
      const where = `WHERE 1=1${this.rangeClause(start, end, 'mh.START_TIME')}`;
      const sql = `
        SELECT DISTINCT tr.TAG_NAME, tr.TAG_VALUE
        FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY mh
        JOIN SNOWFLAKE.ACCOUNT_USAGE.TAG_REFERENCES tr
          ON UPPER(tr.OBJECT_NAME) = UPPER(mh.WAREHOUSE_NAME) AND tr.OBJECT_DOMAIN = 'WAREHOUSE'
        ${where}
        ORDER BY 1, 2
      `;
      return await this.exec(conn, sql);
    } catch (error: any) {
      // TAG_REFERENCES may not be available or accessible
      console.warn('[SnowflakeCostService] TAG_REFERENCES not available for tags:', error?.message);
      return [];
    } finally { try { conn.destroy(() => {}); } catch {} }
  }

  async listUsers(connectorId: string, start?: string, end?: string): Promise<{ USER_NAME: string }[]> {
    const conn = await this.connect(connectorId);
    try {
      const where = `WHERE 1=1${this.rangeClause(start, end, 'START_TIME')}`;
      const sql = `
        SELECT DISTINCT USER_NAME
        FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
        ${where}
        ORDER BY 1
        LIMIT 1000
      `;
      return await this.exec(conn, sql);
    } finally { try { conn.destroy(() => {}); } catch {} }
  }

  // ============================================
  // PHASE 1: Storage & Cost Intelligence
  // ============================================

  /**
   * Get storage usage breakdown by database, schema, and table
   */
  async getStorageUsage(connectorId: string): Promise<any[]> {
    const conn = await this.connect(connectorId);
    try {
      const sql = `
        SELECT 
          TABLE_CATALOG AS DATABASE_NAME,
          TABLE_SCHEMA AS SCHEMA_NAME,
          TABLE_NAME,
          'TABLE' AS TABLE_TYPE,
          ACTIVE_BYTES AS STORAGE_BYTES,
          NULL AS ROW_COUNT,
          IS_TRANSIENT,
          CASE WHEN IS_TRANSIENT = 'YES' THEN 0 ELSE 1 END AS RETENTION_DAYS,
          COALESCE(TABLE_DROPPED, TABLE_CREATED) AS LAST_ALTERED,
          TABLE_CREATED AS CREATED
        FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS
        WHERE DELETED = FALSE
          AND TABLE_CATALOG IS NOT NULL
        ORDER BY ACTIVE_BYTES DESC NULLS LAST
        LIMIT 1000
      `;
      return await this.exec(conn, sql);
    } finally { try { conn.destroy(() => {}); } catch {} }
  }

  /**
   * Get storage costs from STORAGE_USAGE view
   */
  async getStorageCosts(connectorId: string, start?: string, end?: string): Promise<any[]> {
    const conn = await this.connect(connectorId);
    try {
      const where = `WHERE 1=1${this.rangeClause(start, end, 'USAGE_DATE')}`;
      const sql = `
        SELECT 
          USAGE_DATE,
          STORAGE_BYTES,
          STAGE_BYTES,
          FAILSAFE_BYTES
        FROM SNOWFLAKE.ACCOUNT_USAGE.STORAGE_USAGE
        ${where}
        ORDER BY USAGE_DATE DESC
        LIMIT 90
      `;
      return await this.exec(conn, sql);
    } finally { try { conn.destroy(() => {}); } catch {} }
  }

  /**
   * Detect unused tables (no access in 90+ days)
   */
  async detectUnusedTables(connectorId: string, daysSinceAccess: number = 90): Promise<any[]> {
    const conn = await this.connect(connectorId);
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysSinceAccess);
      const cutoff = cutoffDate.toISOString().slice(0, 10);

      const sql = `
        WITH table_storage AS (
          SELECT 
            TABLE_CATALOG,
            TABLE_SCHEMA,
            TABLE_NAME,
            ACTIVE_BYTES,
            COALESCE(TABLE_DROPPED, TABLE_CREATED) AS LAST_MODIFIED
          FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS
          WHERE DELETED = FALSE
            AND TABLE_CATALOG IS NOT NULL
        ),
        table_access AS (
          SELECT 
            obj.value:objectName::STRING AS TABLE_NAME,
            obj.value:objectDomain::STRING AS OBJECT_DOMAIN,
            MAX(QUERY_START_TIME) AS LAST_ACCESS
          FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY,
          LATERAL FLATTEN(input => DIRECT_OBJECTS_ACCESSED) obj
          WHERE QUERY_START_TIME >= '${cutoff}'
            AND obj.value:objectDomain::STRING = 'Table'
          GROUP BY obj.value:objectName::STRING, obj.value:objectDomain::STRING
        )
        SELECT 
          ts.TABLE_CATALOG AS DATABASE_NAME,
          ts.TABLE_SCHEMA AS SCHEMA_NAME,
          ts.TABLE_NAME,
          ts.ACTIVE_BYTES AS STORAGE_BYTES,
          ts.LAST_MODIFIED AS LAST_ALTERED,
          ta.LAST_ACCESS,
          DATEDIFF(day, COALESCE(ta.LAST_ACCESS, ts.LAST_MODIFIED), CURRENT_TIMESTAMP()) AS DAYS_SINCE_ACCESS
        FROM table_storage ts
        LEFT JOIN table_access ta ON ts.TABLE_NAME = ta.TABLE_NAME
        WHERE COALESCE(ta.LAST_ACCESS, ts.LAST_MODIFIED) < '${cutoff}'
          AND ts.ACTIVE_BYTES > 1073741824 -- At least 1 GB
        ORDER BY ts.ACTIVE_BYTES DESC
        LIMIT 100
      `;
      return await this.exec(conn, sql);
    } finally { try { conn.destroy(() => {}); } catch {} }
  }

  /**
   * Detect idle warehouses (no queries in X days)
   */
  async detectIdleWarehouses(connectorId: string, daysIdle: number = 30): Promise<any[]> {
    const conn = await this.connect(connectorId);
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysIdle);
      const cutoff = cutoffDate.toISOString().slice(0, 19);

      const sql = `
        WITH all_warehouses AS (
          SELECT DISTINCT WAREHOUSE_NAME
          FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
          WHERE START_TIME >= DATEADD(day, -90, CURRENT_TIMESTAMP())
        ),
        recent_activity AS (
          SELECT 
            WAREHOUSE_NAME,
            MAX(START_TIME) AS LAST_QUERY_TIME,
            COUNT(*) AS QUERY_COUNT
          FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
          WHERE START_TIME >= '${cutoff}'
          GROUP BY WAREHOUSE_NAME
        ),
        warehouse_costs AS (
          SELECT 
            WAREHOUSE_NAME,
            SUM(CREDITS_USED_COMPUTE + CREDITS_USED_CLOUD_SERVICES) AS TOTAL_CREDITS
          FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
          WHERE START_TIME >= DATEADD(day, -30, CURRENT_TIMESTAMP())
          GROUP BY WAREHOUSE_NAME
        )
        SELECT 
          aw.WAREHOUSE_NAME,
          ra.LAST_QUERY_TIME,
          COALESCE(ra.QUERY_COUNT, 0) AS QUERY_COUNT,
          DATEDIFF(day, COALESCE(ra.LAST_QUERY_TIME, DATEADD(day, -365, CURRENT_TIMESTAMP())), CURRENT_TIMESTAMP()) AS DAYS_IDLE,
          COALESCE(wc.TOTAL_CREDITS, 0) AS MONTHLY_CREDITS
        FROM all_warehouses aw
        LEFT JOIN recent_activity ra ON aw.WAREHOUSE_NAME = ra.WAREHOUSE_NAME
        LEFT JOIN warehouse_costs wc ON aw.WAREHOUSE_NAME = wc.WAREHOUSE_NAME
        WHERE COALESCE(ra.QUERY_COUNT, 0) = 0
        ORDER BY wc.TOTAL_CREDITS DESC NULLS LAST
      `;
      return await this.exec(conn, sql);
    } finally { try { conn.destroy(() => {}); } catch {} }
  }

  /**
   * Analyze warehouse utilization and detect undersized/oversized warehouses
   */
  async analyzeWarehouseUtilization(connectorId: string, days: number = 7): Promise<any[]> {
    const conn = await this.connect(connectorId);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const start = startDate.toISOString().slice(0, 19);

      const sql = `
        WITH warehouse_load AS (
          SELECT 
            WAREHOUSE_NAME,
            AVG_RUNNING,
            AVG_QUEUED_LOAD,
            AVG_QUEUED_PROVISIONING,
            START_TIME
          FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_LOAD_HISTORY
          WHERE START_TIME >= '${start}'
        ),
        warehouse_metering AS (
          SELECT 
            WAREHOUSE_NAME,
            SUM(CREDITS_USED_COMPUTE + CREDITS_USED_CLOUD_SERVICES) AS TOTAL_CREDITS,
            COUNT(DISTINCT DATE_TRUNC('hour', START_TIME)) AS ACTIVE_HOURS
          FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
          WHERE START_TIME >= '${start}'
          GROUP BY WAREHOUSE_NAME
        ),
        warehouse_info AS (
          SELECT DISTINCT
            WAREHOUSE_NAME,
            FIRST_VALUE(WAREHOUSE_SIZE) OVER (PARTITION BY WAREHOUSE_NAME ORDER BY START_TIME DESC) AS WAREHOUSE_SIZE
          FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
          WHERE START_TIME >= '${start}'
            AND WAREHOUSE_NAME IS NOT NULL
            AND WAREHOUSE_SIZE IS NOT NULL
        )
        SELECT 
          COALESCE(wi.WAREHOUSE_NAME, wm.WAREHOUSE_NAME) AS WAREHOUSE_NAME,
          wi.WAREHOUSE_SIZE,
          wm.TOTAL_CREDITS,
          wm.ACTIVE_HOURS,
          AVG(wl.AVG_RUNNING) AS AVG_UTILIZATION,
          AVG(wl.AVG_QUEUED_LOAD) AS AVG_QUEUE_LOAD,
          CASE 
            WHEN AVG(wl.AVG_RUNNING) < 0.3 THEN 'UNDERUTILIZED'
            WHEN AVG(wl.AVG_QUEUED_LOAD) > 0.1 THEN 'OVERSIZED'
            ELSE 'OPTIMAL'
          END AS STATUS
        FROM warehouse_metering wm
        LEFT JOIN warehouse_info wi ON wm.WAREHOUSE_NAME = wi.WAREHOUSE_NAME
        LEFT JOIN warehouse_load wl ON wm.WAREHOUSE_NAME = wl.WAREHOUSE_NAME
        GROUP BY COALESCE(wi.WAREHOUSE_NAME, wm.WAREHOUSE_NAME), wi.WAREHOUSE_SIZE, wm.TOTAL_CREDITS, wm.ACTIVE_HOURS
        ORDER BY wm.TOTAL_CREDITS DESC NULLS LAST
      `;
      return await this.exec(conn, sql);
    } finally { try { conn.destroy(() => {}); } catch {} }
  }

  /**
   * Get cost overview summary for dashboard cards
   */
  async getCostOverview(connectorId: string, days: number = 30): Promise<any> {
    const conn = await this.connect(connectorId);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const start = startDate.toISOString().slice(0, 19);

      // Get compute costs
      const computeSql = `
        SELECT SUM(CREDITS_USED_COMPUTE + CREDITS_USED_CLOUD_SERVICES) AS TOTAL_CREDITS
        FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
        WHERE START_TIME >= '${start}'
      `;
      const computeRows = await this.exec(conn, computeSql);
      const computeCredits = Number(computeRows?.[0]?.TOTAL_CREDITS || 0);

      // Get storage costs (approximate)
      const storageSql = `
        SELECT 
          AVG(STORAGE_BYTES + STAGE_BYTES + FAILSAFE_BYTES) AS AVG_BYTES
        FROM SNOWFLAKE.ACCOUNT_USAGE.STORAGE_USAGE
        WHERE USAGE_DATE >= DATEADD(day, -${days}, CURRENT_DATE())
      `;
      const storageRows = await this.exec(conn, storageSql);
      const avgBytes = Number(storageRows?.[0]?.AVG_BYTES || 0);
      // Snowflake charges $23 per TB per month for storage (compressed)
      const storageCredits = (avgBytes / 1099511627776) * 23 / 3; // Convert to credits ($3/credit)

      // Get total queries
      const querySql = `
        SELECT COUNT(*) AS TOTAL_QUERIES
        FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
        WHERE START_TIME >= '${start}'
      `;
      const queryRows = await this.exec(conn, querySql);
      const totalQueries = Number(queryRows?.[0]?.TOTAL_QUERIES || 0);

      // Get failed queries
      const failedSql = `
        SELECT COUNT(*) AS FAILED_QUERIES
        FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
        WHERE START_TIME >= '${start}'
          AND EXECUTION_STATUS = 'FAIL'
      `;
      const failedRows = await this.exec(conn, failedSql);
      const failedQueries = Number(failedRows?.[0]?.FAILED_QUERIES || 0);

      return {
        period_days: days,
        compute_credits: computeCredits,
        storage_credits: storageCredits,
        total_credits: computeCredits + storageCredits,
        total_cost: (computeCredits + storageCredits) * 3, // $3 per credit
        total_queries: totalQueries,
        failed_queries: failedQueries,
        failure_rate: totalQueries > 0 ? (failedQueries / totalQueries * 100).toFixed(2) : 0
      };
    } finally { try { conn.destroy(() => {}); } catch {} }
  }

  /**
   * Get data transfer costs (egress)
   */
  async getDataTransferCosts(connectorId: string, days: number = 30): Promise<any[]> {
    const conn = await this.connect(connectorId);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const start = startDate.toISOString().slice(0, 19);

      const sql = `
        SELECT 
          USAGE_DATE,
          SOURCE_CLOUD,
          SOURCE_REGION,
          TARGET_CLOUD,
          TARGET_REGION,
          BYTES_TRANSFERRED,
          TRANSFER_TYPE
        FROM SNOWFLAKE.ACCOUNT_USAGE.DATA_TRANSFER_HISTORY
        WHERE START_TIME >= '${start}'
        ORDER BY BYTES_TRANSFERRED DESC
        LIMIT 100
      `;
      return await this.exec(conn, sql);
    } finally { try { conn.destroy(() => {}); } catch {} }
  }
}
