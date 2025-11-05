import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const snowflake = require('snowflake-sdk');

interface SnowflakeConnection {
  execute: (options: any) => Promise<any>;
  destroy: (callback: (err: any) => void) => void;
}

export class SnowflakePhase2Extractor {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Extract warehouse utilization data for right-sizing recommendations
   */
  async extractWarehouseUtilization(connectorId: string, connection: SnowflakeConnection): Promise<void> {
    console.log('[Phase2] Extracting warehouse utilization data...');
    
    const sql = `
      WITH warehouse_info AS (
        SELECT DISTINCT 
          WAREHOUSE_NAME,
          WAREHOUSE_SIZE
        FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
        WHERE START_TIME >= DATEADD(day, -30, CURRENT_TIMESTAMP())
          AND WAREHOUSE_NAME IS NOT NULL
      )
      SELECT 
        wi.WAREHOUSE_NAME,
        wi.WAREHOUSE_SIZE,
        wlh.START_TIME AS MEASUREMENT_TIME,
        wlh.AVG_RUNNING,
        wlh.AVG_QUEUED_LOAD,
        wlh.AVG_QUEUED_PROVISIONING,
        wlh.AVG_BLOCKED
      FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_LOAD_HISTORY wlh
      JOIN warehouse_info wi ON wlh.WAREHOUSE_NAME = wi.WAREHOUSE_NAME
      WHERE wlh.START_TIME >= DATEADD(day, -30, CURRENT_TIMESTAMP())
      ORDER BY wlh.START_TIME DESC
      LIMIT 10000
    `;

    const rows = await this.executeQuery(connection, sql);
    
    if (rows.length === 0) {
      console.log('[Phase2] No warehouse utilization data found');
      return;
    }

    // Transform and insert into database
    const records = rows.map((row: any) => ({
      connector_id: connectorId,
      warehouse_name: row.WAREHOUSE_NAME,
      warehouse_size: row.WAREHOUSE_SIZE,
      measurement_time: row.MEASUREMENT_TIME,
      avg_running: row.AVG_RUNNING,
      avg_queued_load: row.AVG_QUEUED_LOAD,
      avg_queued_provisioning: row.AVG_QUEUED_PROVISIONING,
      avg_blocked: row.AVG_BLOCKED,
    }));

    // Delete old data for this connector
    await this.supabase
      .schema('enterprise')
      .from('snowflake_warehouse_utilization')
      .delete()
      .eq('connector_id', connectorId);

    // Insert new data in batches
    const batchSize = 1000;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await this.supabase
        .schema('enterprise')
        .from('snowflake_warehouse_utilization')
        .insert(batch);
      
      if (error) {
        console.error('[Phase2] Error inserting warehouse utilization:', error);
        throw error;
      }
    }

    console.log(`[Phase2] Inserted ${records.length} warehouse utilization records`);
  }

  /**
   * Extract repeated query patterns for caching recommendations
   */
  async extractQueryPatterns(connectorId: string, connection: SnowflakeConnection): Promise<void> {
    console.log('[Phase2] Extracting query patterns...');
    
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30);
    const periodEnd = new Date();

    const sql = `
      SELECT 
        QUERY_TEXT,
        DATABASE_NAME,
        SCHEMA_NAME,
        WAREHOUSE_NAME,
        USER_NAME,
        COUNT(*) AS EXECUTION_COUNT,
        SUM(TOTAL_ELAPSED_TIME) AS TOTAL_EXECUTION_TIME_MS,
        AVG(TOTAL_ELAPSED_TIME) AS AVG_EXECUTION_TIME_MS,
        SUM(BYTES_SCANNED) AS TOTAL_BYTES_SCANNED,
        MIN(START_TIME) AS FIRST_EXECUTION,
        MAX(START_TIME) AS LAST_EXECUTION
      FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
      WHERE START_TIME >= DATEADD(day, -30, CURRENT_TIMESTAMP())
        AND QUERY_TEXT IS NOT NULL
        AND QUERY_TYPE IN ('SELECT', 'SHOW', 'DESCRIBE')
        AND EXECUTION_STATUS = 'SUCCESS'
        AND LENGTH(QUERY_TEXT) > 50
      GROUP BY QUERY_TEXT, DATABASE_NAME, SCHEMA_NAME, WAREHOUSE_NAME, USER_NAME
      HAVING COUNT(*) >= 5
      ORDER BY EXECUTION_COUNT DESC, TOTAL_EXECUTION_TIME_MS DESC
      LIMIT 1000
    `;

    const rows = await this.executeQuery(connection, sql);
    
    if (rows.length === 0) {
      console.log('[Phase2] No query patterns found');
      return;
    }

    // Transform and insert into database
    const records = rows.map((row: any) => ({
      connector_id: connectorId,
      query_hash: crypto.createHash('md5').update(row.QUERY_TEXT).digest('hex'),
      query_text: row.QUERY_TEXT.substring(0, 10000), // Limit query text length
      database_name: row.DATABASE_NAME,
      schema_name: row.SCHEMA_NAME,
      warehouse_name: row.WAREHOUSE_NAME,
      user_name: row.USER_NAME,
      execution_count: row.EXECUTION_COUNT,
      total_execution_time_ms: row.TOTAL_EXECUTION_TIME_MS,
      avg_execution_time_ms: row.AVG_EXECUTION_TIME_MS,
      total_bytes_scanned: row.TOTAL_BYTES_SCANNED,
      first_execution: row.FIRST_EXECUTION,
      last_execution: row.LAST_EXECUTION,
      analysis_period_start: periodStart.toISOString(),
      analysis_period_end: periodEnd.toISOString(),
    }));

    // Delete old data for this connector and period
    await this.supabase
      .schema('enterprise')
      .from('snowflake_query_patterns')
      .delete()
      .eq('connector_id', connectorId);

    // Insert new data in batches
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await this.supabase
        .schema('enterprise')
        .from('snowflake_query_patterns')
        .insert(batch);
      
      if (error) {
        console.error('[Phase2] Error inserting query patterns:', error);
        throw error;
      }
    }

    console.log(`[Phase2] Inserted ${records.length} query pattern records`);
  }

  /**
   * Extract clustering history for waste detection
   */
  async extractClusteringHistory(connectorId: string, connection: SnowflakeConnection): Promise<void> {
    console.log('[Phase2] Extracting clustering history...');
    
    const sql = `
      SELECT 
        DATABASE_NAME,
        SCHEMA_NAME,
        TABLE_NAME,
        START_TIME,
        END_TIME,
        CREDITS_USED,
        NUM_BYTES_RECLUSTERED,
        NUM_ROWS_RECLUSTERED
      FROM SNOWFLAKE.ACCOUNT_USAGE.AUTOMATIC_CLUSTERING_HISTORY
      WHERE START_TIME >= DATEADD(day, -30, CURRENT_TIMESTAMP())
      ORDER BY START_TIME DESC
      LIMIT 5000
    `;

    const rows = await this.executeQuery(connection, sql);
    
    if (rows.length === 0) {
      console.log('[Phase2] No clustering history found');
      return;
    }

    // Transform and insert into database
    const records = rows.map((row: any) => ({
      connector_id: connectorId,
      database_name: row.DATABASE_NAME,
      schema_name: row.SCHEMA_NAME,
      table_name: row.TABLE_NAME,
      start_time: row.START_TIME,
      end_time: row.END_TIME,
      credits_used: row.CREDITS_USED,
      bytes_reclustered: row.NUM_BYTES_RECLUSTERED,
      rows_reclustered: row.NUM_ROWS_RECLUSTERED,
    }));

    // Delete old data for this connector
    await this.supabase
      .schema('enterprise')
      .from('snowflake_clustering_history')
      .delete()
      .eq('connector_id', connectorId);

    // Insert new data in batches
    const batchSize = 1000;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await this.supabase
        .schema('enterprise')
        .from('snowflake_clustering_history')
        .insert(batch);
      
      if (error) {
        console.error('[Phase2] Error inserting clustering history:', error);
        throw error;
      }
    }

    console.log(`[Phase2] Inserted ${records.length} clustering history records`);
  }

  /**
   * Extract materialized view refresh history
   */
  async extractMaterializedViewRefresh(connectorId: string, connection: SnowflakeConnection): Promise<void> {
    console.log('[Phase2] Extracting materialized view refresh history...');
    
    const sql = `
      SELECT 
        DATABASE_NAME,
        SCHEMA_NAME,
        START_TIME,
        END_TIME,
        CREDITS_USED
      FROM SNOWFLAKE.ACCOUNT_USAGE.MATERIALIZED_VIEW_REFRESH_HISTORY
      WHERE START_TIME >= DATEADD(day, -30, CURRENT_TIMESTAMP())
      ORDER BY START_TIME DESC
      LIMIT 5000
    `;

    const rows = await this.executeQuery(connection, sql);
    
    if (rows.length === 0) {
      console.log('[Phase2] No materialized view refresh history found');
      return;
    }

    // Transform and insert into database
    const records = rows.map((row: any) => ({
      connector_id: connectorId,
      database_name: row.DATABASE_NAME,
      schema_name: row.SCHEMA_NAME,
      view_name: null, // Snowflake MATERIALIZED_VIEW_REFRESH_HISTORY doesn't provide view name
      start_time: row.START_TIME,
      end_time: row.END_TIME,
      credits_used: row.CREDITS_USED,
    }));

    // Delete old data for this connector
    await this.supabase
      .schema('enterprise')
      .from('snowflake_mv_refresh_history')
      .delete()
      .eq('connector_id', connectorId);

    // Insert new data in batches
    const batchSize = 1000;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await this.supabase
        .schema('enterprise')
        .from('snowflake_mv_refresh_history')
        .insert(batch);
      
      if (error) {
        console.error('[Phase2] Error inserting MV refresh history:', error);
        throw error;
      }
    }

    console.log(`[Phase2] Inserted ${records.length} MV refresh history records`);
  }

  /**
   * Extract task execution history
   */
  async extractTaskHistory(connectorId: string, connection: SnowflakeConnection): Promise<void> {
    console.log('[Phase2] Extracting task history...');
    
    const sql = `
      WITH task_queries AS (
        SELECT 
          th.DATABASE_NAME,
          th.SCHEMA_NAME,
          th.NAME AS TASK_NAME,
          th.STATE,
          th.SCHEDULED_TIME,
          th.COMPLETED_TIME,
          th.QUERY_ID,
          qh.WAREHOUSE_NAME,
          qh.TOTAL_ELAPSED_TIME AS EXECUTION_TIME_MS,
          th.ERROR_CODE,
          th.ERROR_MESSAGE
        FROM SNOWFLAKE.ACCOUNT_USAGE.TASK_HISTORY th
        LEFT JOIN SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY qh 
          ON th.QUERY_ID = qh.QUERY_ID
        WHERE th.SCHEDULED_TIME >= DATEADD(day, -30, CURRENT_TIMESTAMP())
      )
      SELECT *
      FROM task_queries
      ORDER BY SCHEDULED_TIME DESC
      LIMIT 5000
    `;

    const rows = await this.executeQuery(connection, sql);
    
    if (rows.length === 0) {
      console.log('[Phase2] No task history found');
      return;
    }

    // Transform and insert into database
    const records = rows.map((row: any) => ({
      connector_id: connectorId,
      database_name: row.DATABASE_NAME,
      schema_name: row.SCHEMA_NAME,
      task_name: row.TASK_NAME,
      state: row.STATE,
      scheduled_time: row.SCHEDULED_TIME,
      completed_time: row.COMPLETED_TIME,
      query_id: row.QUERY_ID,
      warehouse_name: row.WAREHOUSE_NAME,
      execution_time_ms: row.EXECUTION_TIME_MS,
      error_code: row.ERROR_CODE,
      error_message: row.ERROR_MESSAGE,
    }));

    // Delete old data for this connector
    await this.supabase
      .schema('enterprise')
      .from('snowflake_task_history')
      .delete()
      .eq('connector_id', connectorId);

    // Insert new data in batches
    const batchSize = 1000;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await this.supabase
        .schema('enterprise')
        .from('snowflake_task_history')
        .insert(batch);
      
      if (error) {
        console.error('[Phase2] Error inserting task history:', error);
        throw error;
      }
    }

    console.log(`[Phase2] Inserted ${records.length} task history records`);
  }

  /**
   * Run all Phase 2 extractions
   */
  async extractAll(connectorId: string, connection: SnowflakeConnection): Promise<void> {
    console.log('[Phase2] Starting all Phase 2 extractions for connector:', connectorId);
    
    try {
      await this.extractWarehouseUtilization(connectorId, connection);
      await this.extractQueryPatterns(connectorId, connection);
      await this.extractClusteringHistory(connectorId, connection);
      await this.extractMaterializedViewRefresh(connectorId, connection);
      await this.extractTaskHistory(connectorId, connection);
      
      console.log('[Phase2] All Phase 2 extractions completed successfully');
    } catch (error) {
      console.error('[Phase2] Error during Phase 2 extraction:', error);
      throw error;
    }
  }

  /**
   * Helper method to execute Snowflake queries
   */
  private async executeQuery(connection: SnowflakeConnection, sqlText: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      connection.execute({
        sqlText,
        complete: (err: any, stmt: any, rows: any[]) => {
          if (err) {
            console.error('[Phase2] Query execution error:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      });
    });
  }
}

export default new SnowflakePhase2Extractor();
