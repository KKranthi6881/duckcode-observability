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
}
