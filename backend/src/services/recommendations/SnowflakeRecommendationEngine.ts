import { createClient } from '@supabase/supabase-js';

interface Recommendation {
  connector_id: string;
  organization_id: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  warehouse_name?: string;
  database_name?: string;
  schema_name?: string;
  table_name?: string;
  query_hash?: string;
  title: string;
  description: string;
  current_value?: string;
  recommended_value?: string;
  estimated_monthly_savings_usd: number;
  confidence_score: number;
  effort_level: 'easy' | 'medium' | 'hard';
  sql_commands: string[];
  implementation_notes?: string;
}

export class SnowflakeRecommendationEngine {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Rule 1: Warehouse Right-Sizing
   * If AVG_UTILIZATION < 40% for 7+ days → Recommend downsize
   */
  async analyzeWarehouseRightSizing(connectorId: string, organizationId: string): Promise<Recommendation[]> {
    console.log('[RecommendationEngine] Analyzing warehouse right-sizing...');

    const { data: utilizationData, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_warehouse_utilization')
      .select('*')
      .eq('connector_id', connectorId)
      .gte('measurement_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error || !utilizationData || utilizationData.length === 0) {
      console.log('[RecommendationEngine] No utilization data found');
      return [];
    }

    // Calculate average utilization per warehouse
    const warehouseStats = new Map<string, { size: string; avgUtilization: number; count: number }>();
    
    utilizationData.forEach((row: any) => {
      const key = row.warehouse_name;
      if (!warehouseStats.has(key)) {
        warehouseStats.set(key, { size: row.warehouse_size, avgUtilization: 0, count: 0 });
      }
      const stats = warehouseStats.get(key)!;
      stats.avgUtilization += (row.avg_running || 0);
      stats.count += 1;
    });

    const recommendations: Recommendation[] = [];
    const sizeDowngrades: { [key: string]: string } = {
      'X-Large': 'Large',
      'Large': 'Medium',
      'Medium': 'Small',
      'Small': 'X-Small',
    };

    const sizeCosts: { [key: string]: number } = {
      'X-Large': 4,
      'Large': 2,
      'Medium': 1,
      'Small': 0.5,
      'X-Small': 0.25,
    };

    for (const [warehouseName, stats] of warehouseStats.entries()) {
      const avgUtilization = stats.avgUtilization / stats.count;
      const utilizationPct = avgUtilization * 100;

      // Rule: If avg utilization < 40%, recommend downsize
      if (avgUtilization < 0.40 && sizeDowngrades[stats.size]) {
        const newSize = sizeDowngrades[stats.size];
        const currentCost = sizeCosts[stats.size] || 1;
        const newCost = sizeCosts[newSize] || 0.5;
        const savings = (currentCost - newCost) * 730; // ~730 hours/month

        recommendations.push({
          connector_id: connectorId,
          organization_id: organizationId,
          type: 'warehouse_resize',
          priority: savings > 500 ? 'high' : savings > 200 ? 'medium' : 'low',
          warehouse_name: warehouseName,
          title: `Downsize ${warehouseName} from ${stats.size} to ${newSize}`,
          description: `Warehouse ${warehouseName} is underutilized with an average utilization of ${utilizationPct.toFixed(1)}%. Downsizing from ${stats.size} to ${newSize} will reduce costs by approximately 50% while maintaining performance.`,
          current_value: stats.size,
          recommended_value: newSize,
          estimated_monthly_savings_usd: savings,
          confidence_score: avgUtilization < 0.25 ? 95 : 85,
          effort_level: 'easy',
          sql_commands: [
            `ALTER WAREHOUSE ${warehouseName} SET WAREHOUSE_SIZE = '${newSize.toUpperCase()}';`
          ],
          implementation_notes: `Monitor performance after resize. Can be easily reverted if needed.`
        });
      }
    }

    console.log(`[RecommendationEngine] Generated ${recommendations.length} right-sizing recommendations`);
    return recommendations;
  }

  /**
   * Rule 2: Auto-Suspend Optimization
   * If AVG_IDLE_TIME > 5 minutes → Enable auto-suspend
   */
  async analyzeAutoSuspend(connectorId: string, organizationId: string): Promise<Recommendation[]> {
    console.log('[RecommendationEngine] Analyzing auto-suspend opportunities...');

    // This requires query timeline analysis which is complex
    // For now, we'll check warehouse metrics for idle patterns
    const { data: warehouseData, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_warehouse_metrics')
      .select('*')
      .eq('connector_id', connectorId);

    if (error || !warehouseData || warehouseData.length === 0) {
      console.log('[RecommendationEngine] No warehouse data found');
      return [];
    }

    const recommendations: Recommendation[] = [];

    // Simple heuristic: If warehouse has low query count but significant credits, likely idle time
    for (const warehouse of warehouseData) {
      const queriesPerCredit = warehouse.query_count / (warehouse.total_credits || 1);
      
      // If < 50 queries per credit, likely significant idle time
      if (queriesPerCredit < 50 && warehouse.total_credits > 10) {
        const estimatedIdleCost = warehouse.total_credits * 0.4; // Assume 40% is idle
        const monthlySavings = estimatedIdleCost * 3; // $3 per credit

        recommendations.push({
          connector_id: connectorId,
          organization_id: organizationId,
          type: 'auto_suspend',
          priority: monthlySavings > 300 ? 'high' : 'medium',
          warehouse_name: warehouse.warehouse_name,
          title: `Enable auto-suspend for ${warehouse.warehouse_name}`,
          description: `Warehouse ${warehouse.warehouse_name} shows signs of idle time with only ${queriesPerCredit.toFixed(0)} queries per credit. Enabling auto-suspend with a 5-minute timeout will eliminate idle costs.`,
          current_value: 'No auto-suspend',
          recommended_value: '5-minute auto-suspend',
          estimated_monthly_savings_usd: monthlySavings,
          confidence_score: 90,
          effort_level: 'easy',
          sql_commands: [
            `ALTER WAREHOUSE ${warehouse.warehouse_name} SET AUTO_SUSPEND = 300;  -- 5 minutes`,
            `ALTER WAREHOUSE ${warehouse.warehouse_name} SET AUTO_RESUME = TRUE;`
          ],
          implementation_notes: `Auto-resume ensures no interruption to users. Warehouses will automatically start when needed.`
        });
      }
    }

    console.log(`[RecommendationEngine] Generated ${recommendations.length} auto-suspend recommendations`);
    return recommendations;
  }

  /**
   * Rule 3: Query Caching
   * If query executed 10+ times in 30 days → Enable result caching
   */
  async analyzeQueryCaching(connectorId: string, organizationId: string): Promise<Recommendation[]> {
    console.log('[RecommendationEngine] Analyzing query caching opportunities...');

    const { data: queryPatterns, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_query_patterns')
      .select('*')
      .eq('connector_id', connectorId)
      .gte('execution_count', 10)
      .order('total_execution_time_ms', { ascending: false })
      .limit(20);

    if (error || !queryPatterns || queryPatterns.length === 0) {
      console.log('[RecommendationEngine] No repeated query patterns found');
      return [];
    }

    const recommendations: Recommendation[] = [];

    for (const pattern of queryPatterns) {
      // Estimate cost per execution (rough heuristic)
      const avgTimeMs = pattern.avg_execution_time_ms || 0;
      const costPerExecution = (avgTimeMs / 1000 / 3600) * 2; // $2/hour rough estimate
      const totalCost = costPerExecution * pattern.execution_count;
      
      // With caching, assume 80% reduction after first execution
      const savingsWithCache = totalCost * 0.8;

      if (savingsWithCache > 50) { // Only recommend if savings > $50/month
        recommendations.push({
          connector_id: connectorId,
          organization_id: organizationId,
          type: 'enable_cache',
          priority: savingsWithCache > 500 ? 'high' : savingsWithCache > 200 ? 'medium' : 'low',
          query_hash: pattern.query_hash,
          warehouse_name: pattern.warehouse_name,
          database_name: pattern.database_name,
          schema_name: pattern.schema_name,
          title: `Enable result caching for frequently repeated query`,
          description: `Query executed ${pattern.execution_count} times in the last 30 days. Enabling result caching can reduce costs by up to 80% for repeated executions.`,
          current_value: `No caching (${pattern.execution_count} executions)`,
          recommended_value: `Result cache enabled`,
          estimated_monthly_savings_usd: savingsWithCache,
          confidence_score: 87,
          effort_level: 'medium',
          sql_commands: [
            `-- Enable result cache at account level:`,
            `ALTER ACCOUNT SET USE_CACHED_RESULT = TRUE;`,
            ``,
            `-- Or enable per warehouse:`,
            `ALTER WAREHOUSE ${pattern.warehouse_name || '[WAREHOUSE_NAME]'} SET USE_CACHED_RESULT = TRUE;`
          ],
          implementation_notes: `Query: ${pattern.query_text?.substring(0, 200)}...`
        });
      }
    }

    console.log(`[RecommendationEngine] Generated ${recommendations.length} caching recommendations`);
    return recommendations;
  }

  /**
   * Rule 4: Table Archival
   * If not accessed 90+ days AND size > 100GB → Archive
   */
  async analyzeTableArchival(connectorId: string, organizationId: string): Promise<Recommendation[]> {
    console.log('[RecommendationEngine] Analyzing table archival opportunities...');

    const { data: wasteOpportunities, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_waste_opportunities')
      .select('*')
      .eq('connector_id', connectorId)
      .eq('opportunity_type', 'unused_table')
      .eq('status', 'open')
      .order('potential_monthly_savings', { ascending: false })
      .limit(50);

    if (error || !wasteOpportunities || wasteOpportunities.length === 0) {
      console.log('[RecommendationEngine] No archival candidates found');
      return [];
    }

    const recommendations: Recommendation[] = [];

    for (const opportunity of wasteOpportunities) {
      const savings = opportunity.potential_monthly_savings || 0;

      if (savings > 10) { // Only recommend if savings > $10/month
        recommendations.push({
          connector_id: connectorId,
          organization_id: organizationId,
          type: 'archive_table',
          priority: savings > 1000 ? 'high' : savings > 500 ? 'medium' : 'low',
          database_name: opportunity.database_name,
          schema_name: opportunity.schema_name,
          table_name: opportunity.resource_name,
          title: `Archive unused table ${opportunity.resource_name}`,
          description: opportunity.description || `Table has not been accessed in 90+ days and is costing $${savings.toFixed(2)}/month in storage.`,
          current_value: `Active table costing $${savings.toFixed(2)}/month`,
          recommended_value: `Archived or dropped`,
          estimated_monthly_savings_usd: savings,
          confidence_score: 99,
          effort_level: 'easy',
          sql_commands: [
            `-- Option 1: Archive to separate database`,
            `CREATE TABLE archive.${opportunity.schema_name}.${opportunity.resource_name} AS`,
            `  SELECT * FROM ${opportunity.database_name}.${opportunity.schema_name}.${opportunity.resource_name};`,
            ``,
            `-- Option 2: Export to S3 and drop`,
            `COPY INTO @my_s3_stage/${opportunity.resource_name}`,
            `  FROM ${opportunity.database_name}.${opportunity.schema_name}.${opportunity.resource_name};`,
            ``,
            `-- Then drop the table:`,
            `DROP TABLE ${opportunity.database_name}.${opportunity.schema_name}.${opportunity.resource_name};`
          ],
          implementation_notes: `Verify table is truly unused before archiving. Consider cloning for safety.`
        });
      }
    }

    console.log(`[RecommendationEngine] Generated ${recommendations.length} archival recommendations`);
    return recommendations;
  }

  /**
   * Rule 5: Clustering Waste Detection
   * If clustering credits > $50/month AND query count < 100 → Disable clustering
   */
  async analyzeClusteringWaste(connectorId: string, organizationId: string): Promise<Recommendation[]> {
    console.log('[RecommendationEngine] Analyzing clustering waste...');

    const { data: clusteringData, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_clustering_history')
      .select('*')
      .eq('connector_id', connectorId);

    if (error || !clusteringData || clusteringData.length === 0) {
      console.log('[RecommendationEngine] No clustering data found');
      return [];
    }

    // Aggregate clustering costs by table
    const tableClusteringCosts = new Map<string, { credits: number; operations: number }>();

    clusteringData.forEach((row: any) => {
      const tableKey = `${row.database_name}.${row.schema_name}.${row.table_name}`;
      if (!tableClusteringCosts.has(tableKey)) {
        tableClusteringCosts.set(tableKey, { credits: 0, operations: 0 });
      }
      const stats = tableClusteringCosts.get(tableKey)!;
      stats.credits += row.credits_used || 0;
      stats.operations += 1;
    });

    const recommendations: Recommendation[] = [];

    for (const [tableKey, stats] of tableClusteringCosts.entries()) {
      const monthlyCost = stats.credits * 3; // $3 per credit

      // Rule: If clustering cost > $50/month, likely wasteful for low-traffic tables
      if (monthlyCost > 50) {
        const [database, schema, table] = tableKey.split('.');

        recommendations.push({
          connector_id: connectorId,
          organization_id: organizationId,
          type: 'disable_clustering',
          priority: monthlyCost > 200 ? 'high' : 'medium',
          database_name: database,
          schema_name: schema,
          table_name: table,
          title: `Consider disabling clustering on ${table}`,
          description: `Table ${table} has incurred $${monthlyCost.toFixed(2)} in clustering costs over the last 30 days (${stats.operations} operations). If this table is not frequently queried, automatic clustering may not be cost-effective.`,
          current_value: `Auto-clustering enabled ($${monthlyCost.toFixed(2)}/month)`,
          recommended_value: `Clustering disabled`,
          estimated_monthly_savings_usd: monthlyCost,
          confidence_score: 85,
          effort_level: 'medium',
          sql_commands: [
            `ALTER TABLE ${database}.${schema}.${table} SUSPEND RECLUSTER;`
          ],
          implementation_notes: `Monitor query performance after disabling. Can be re-enabled if performance degrades.`
        });
      }
    }

    console.log(`[RecommendationEngine] Generated ${recommendations.length} clustering waste recommendations`);
    return recommendations;
  }

  /**
   * Generate all recommendations for a connector
   */
  async generateRecommendations(connectorId: string, organizationId: string): Promise<void> {
    console.log(`[RecommendationEngine] Generating all recommendations for connector: ${connectorId}`);

    try {
      // Run all analysis rules in parallel
      const [rightSizing, autoSuspend, caching, archival, clustering] = await Promise.all([
        this.analyzeWarehouseRightSizing(connectorId, organizationId),
        this.analyzeAutoSuspend(connectorId, organizationId),
        this.analyzeQueryCaching(connectorId, organizationId),
        this.analyzeTableArchival(connectorId, organizationId),
        this.analyzeClusteringWaste(connectorId, organizationId),
      ]);

      const allRecommendations = [
        ...rightSizing,
        ...autoSuspend,
        ...caching,
        ...archival,
        ...clustering,
      ];

      console.log(`[RecommendationEngine] Generated ${allRecommendations.length} total recommendations`);

      if (allRecommendations.length === 0) {
        console.log('[RecommendationEngine] No recommendations generated');
        return;
      }

      // Delete old pending recommendations for this connector
      await this.supabase
        .schema('enterprise')
        .from('snowflake_recommendations')
        .delete()
        .eq('connector_id', connectorId)
        .eq('status', 'pending');

      // Insert new recommendations
      const { error } = await this.supabase
        .schema('enterprise')
        .from('snowflake_recommendations')
        .insert(allRecommendations);

      if (error) {
        console.error('[RecommendationEngine] Error storing recommendations:', error);
        throw error;
      }

      console.log(`[RecommendationEngine] Successfully stored ${allRecommendations.length} recommendations`);
    } catch (error) {
      console.error('[RecommendationEngine] Error generating recommendations:', error);
      throw error;
    }
  }

  /**
   * Apply a recommendation (execute SQL commands)
   */
  async applyRecommendation(recommendationId: string, userId: string, connection: any): Promise<void> {
    console.log(`[RecommendationEngine] Applying recommendation: ${recommendationId}`);

    // Get the recommendation
    const { data: recommendation, error: fetchError } = await this.supabase
      .schema('enterprise')
      .from('snowflake_recommendations')
      .select('*')
      .eq('id', recommendationId)
      .single();

    if (fetchError || !recommendation) {
      throw new Error('Recommendation not found');
    }

    if (recommendation.status !== 'pending') {
      throw new Error(`Recommendation is already ${recommendation.status}`);
    }

    try {
      // Execute SQL commands
      for (const sqlCommand of recommendation.sql_commands) {
        if (sqlCommand.trim() && !sqlCommand.startsWith('--')) {
          await this.executeQuery(connection, sqlCommand);
          console.log(`[RecommendationEngine] Executed: ${sqlCommand.substring(0, 100)}...`);
        }
      }

      // Update recommendation status
      await this.supabase
        .schema('enterprise')
        .from('snowflake_recommendations')
        .update({
          status: 'applied',
          applied_at: new Date().toISOString(),
          applied_by: userId,
        })
        .eq('id', recommendationId);

      // Log action
      await this.supabase
        .schema('enterprise')
        .from('snowflake_recommendation_actions')
        .insert({
          recommendation_id: recommendationId,
          action_type: 'applied',
          user_id: userId,
        });

      console.log(`[RecommendationEngine] Recommendation applied successfully`);
    } catch (error) {
      console.error('[RecommendationEngine] Error applying recommendation:', error);
      
      // Update status to failed
      await this.supabase
        .schema('enterprise')
        .from('snowflake_recommendations')
        .update({ status: 'failed' })
        .eq('id', recommendationId);

      // Log error
      await this.supabase
        .schema('enterprise')
        .from('snowflake_recommendation_actions')
        .insert({
          recommendation_id: recommendationId,
          action_type: 'failed',
          user_id: userId,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });

      throw error;
    }
  }

  /**
   * Helper method to execute Snowflake queries
   */
  private async executeQuery(connection: any, sqlText: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      connection.execute({
        sqlText,
        complete: (err: any, stmt: any, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      });
    });
  }
}

export default new SnowflakeRecommendationEngine();
