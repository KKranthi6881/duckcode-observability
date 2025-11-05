import { createClient } from '@supabase/supabase-js';

interface ROIBaseline {
  connector_id: string;
  baseline_period_start: string;
  baseline_period_end: string;
  baseline_monthly_cost_usd: number;
  baseline_compute_credits: number;
  baseline_storage_gb: number;
}

interface ROISavings {
  actual_monthly_cost_usd: number;
  projected_savings_usd: number;
  actual_savings_usd: number;
  variance_percent: number;
}

export class ROITrackingService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Establish baseline metrics before recommendations are applied
   */
  async establishBaseline(connectorId: string): Promise<void> {
    console.log('[ROITracking] Establishing baseline for connector:', connectorId);

    try {
      // Get cost metrics for last 30 days as baseline
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 30);

      // Get compute credits
      const { data: costData } = await this.supabase
        .schema('enterprise')
        .from('snowflake_cost_metrics')
        .select('compute_credits, storage_credits')
        .eq('connector_id', connectorId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get storage usage
      const { data: storageData } = await this.supabase
        .schema('enterprise')
        .from('snowflake_storage_usage')
        .select('storage_bytes')
        .eq('connector_id', connectorId);

      const totalStorageGB = storageData
        ? storageData.reduce((sum, row) => sum + (row.storage_bytes || 0), 0) / (1024 ** 3)
        : 0;

      const computeCredits = costData?.compute_credits || 0;
      const storageCredits = costData?.storage_credits || 0;
      const monthlyCostUSD = (computeCredits + storageCredits) * 3; // $3 per credit estimate

      const baseline: ROIBaseline = {
        connector_id: connectorId,
        baseline_period_start: periodStart.toISOString(),
        baseline_period_end: periodEnd.toISOString(),
        baseline_monthly_cost_usd: monthlyCostUSD,
        baseline_compute_credits: computeCredits,
        baseline_storage_gb: totalStorageGB,
      };

      // Store baseline (will be linked to recommendations when they're applied)
      console.log('[ROITracking] Baseline established:', baseline);
      
      // Note: We'll create ROI tracking records when recommendations are applied
    } catch (error) {
      console.error('[ROITracking] Error establishing baseline:', error);
      throw error;
    }
  }

  /**
   * Calculate actual savings after a recommendation has been applied
   */
  async calculateActualSavings(recommendationId: string): Promise<ROISavings> {
    console.log('[ROITracking] Calculating actual savings for recommendation:', recommendationId);

    try {
      // Get the recommendation
      const { data: recommendation, error: recError } = await this.supabase
        .schema('enterprise')
        .from('snowflake_recommendations')
        .select('*')
        .eq('id', recommendationId)
        .single();

      if (recError || !recommendation) {
        throw new Error('Recommendation not found');
      }

      if (recommendation.status !== 'applied') {
        throw new Error('Recommendation has not been applied');
      }

      const appliedDate = new Date(recommendation.applied_at);
      const daysSinceApplied = Math.floor((Date.now() - appliedDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceApplied < 7) {
        throw new Error('Not enough time has passed to measure savings (minimum 7 days)');
      }

      // Get current costs (after implementation)
      const measurementStart = new Date(appliedDate);
      measurementStart.setDate(measurementStart.getDate() + 7); // Start measuring 7 days after
      const measurementEnd = new Date();

      // Get current cost data
      const { data: currentCostData } = await this.supabase
        .schema('enterprise')
        .from('snowflake_cost_metrics')
        .select('compute_credits, storage_credits')
        .eq('connector_id', recommendation.connector_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const currentMonthlyCredits = (currentCostData?.compute_credits || 0) + (currentCostData?.storage_credits || 0);
      const currentMonthlyCostUSD = currentMonthlyCredits * 3;

      // Get baseline from ROI tracking table (if exists)
      const { data: roiData } = await this.supabase
        .schema('enterprise')
        .from('snowflake_roi_tracking')
        .select('*')
        .eq('recommendation_id', recommendationId)
        .single();

      let baselineCost = 0;
      if (roiData) {
        baselineCost = roiData.baseline_monthly_cost_usd;
      } else {
        // Estimate baseline from recommendation data
        baselineCost = currentMonthlyCostUSD + (recommendation.estimated_monthly_savings_usd || 0);
      }

      const projectedSavings = recommendation.estimated_monthly_savings_usd || 0;
      const actualSavings = baselineCost - currentMonthlyCostUSD;
      const variancePercent = projectedSavings > 0 
        ? ((actualSavings - projectedSavings) / projectedSavings) * 100
        : 0;

      const savings: ROISavings = {
        actual_monthly_cost_usd: currentMonthlyCostUSD,
        projected_savings_usd: projectedSavings,
        actual_savings_usd: actualSavings,
        variance_percent: variancePercent,
      };

      // Update or create ROI tracking record
      if (roiData) {
        await this.supabase
          .schema('enterprise')
          .from('snowflake_roi_tracking')
          .update({
            measurement_period_start: measurementStart.toISOString(),
            measurement_period_end: measurementEnd.toISOString(),
            actual_monthly_cost_usd: currentMonthlyCostUSD,
            actual_savings_usd: actualSavings,
            variance_percent: variancePercent,
            updated_at: new Date().toISOString(),
          })
          .eq('recommendation_id', recommendationId);
      } else {
        // Create new ROI tracking record
        await this.supabase
          .schema('enterprise')
          .from('snowflake_roi_tracking')
          .insert({
            connector_id: recommendation.connector_id,
            recommendation_id: recommendationId,
            baseline_period_start: new Date(appliedDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            baseline_period_end: appliedDate.toISOString(),
            baseline_monthly_cost_usd: baselineCost,
            measurement_period_start: measurementStart.toISOString(),
            measurement_period_end: measurementEnd.toISOString(),
            actual_monthly_cost_usd: currentMonthlyCostUSD,
            projected_savings_usd: projectedSavings,
            actual_savings_usd: actualSavings,
            variance_percent: variancePercent,
          });
      }

      console.log('[ROITracking] Actual savings calculated:', savings);
      return savings;
    } catch (error) {
      console.error('[ROITracking] Error calculating actual savings:', error);
      throw error;
    }
  }

  /**
   * Get ROI summary for a connector
   */
  async getROISummary(connectorId: string): Promise<any> {
    console.log('[ROITracking] Getting ROI summary for connector:', connectorId);

    try {
      // Get all applied recommendations
      const { data: recommendations } = await this.supabase
        .schema('enterprise')
        .from('snowflake_recommendations')
        .select('*')
        .eq('connector_id', connectorId)
        .eq('status', 'applied');

      if (!recommendations || recommendations.length === 0) {
        return {
          total_recommendations_applied: 0,
          total_projected_savings: 0,
          total_actual_savings: 0,
          average_variance_percent: 0,
          roi_percentage: 0,
        };
      }

      // Get ROI tracking data
      const { data: roiData } = await this.supabase
        .schema('enterprise')
        .from('snowflake_roi_tracking')
        .select('*')
        .eq('connector_id', connectorId);

      const totalProjectedSavings = recommendations.reduce(
        (sum, rec) => sum + (rec.estimated_monthly_savings_usd || 0),
        0
      );

      const totalActualSavings = roiData
        ? roiData.reduce((sum, roi) => sum + (roi.actual_savings_usd || 0), 0)
        : 0;

      const avgVariance = roiData && roiData.length > 0
        ? roiData.reduce((sum, roi) => sum + (roi.variance_percent || 0), 0) / roiData.length
        : 0;

      // Calculate ROI (annual savings vs product cost)
      const productCostAnnual = 999 * 12; // $999/month Pro plan
      const annualSavings = totalActualSavings > 0 ? totalActualSavings * 12 : totalProjectedSavings * 12;
      const roiPercentage = (annualSavings / productCostAnnual) * 100;

      return {
        total_recommendations_applied: recommendations.length,
        total_projected_savings: Math.round(totalProjectedSavings),
        total_actual_savings: Math.round(totalActualSavings),
        average_variance_percent: Math.round(avgVariance * 10) / 10,
        roi_percentage: Math.round(roiPercentage),
        annual_savings: Math.round(annualSavings),
        product_cost_annual: productCostAnnual,
        payback_period_months: annualSavings > 0 ? Math.round((productCostAnnual / annualSavings) * 12) : 0,
        recommendations_with_tracking: roiData?.length || 0,
      };
    } catch (error) {
      console.error('[ROITracking] Error getting ROI summary:', error);
      throw error;
    }
  }

  /**
   * Get detailed ROI breakdown by recommendation
   */
  async getROIBreakdown(connectorId: string): Promise<any[]> {
    console.log('[ROITracking] Getting ROI breakdown for connector:', connectorId);

    try {
      const { data, error } = await this.supabase
        .schema('enterprise')
        .from('snowflake_recommendations')
        .select(`
          id,
          type,
          title,
          estimated_monthly_savings_usd,
          applied_at,
          snowflake_roi_tracking (
            actual_savings_usd,
            variance_percent,
            measurement_period_end
          )
        `)
        .eq('connector_id', connectorId)
        .eq('status', 'applied')
        .order('applied_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[ROITracking] Error getting ROI breakdown:', error);
      throw error;
    }
  }
}

export default new ROITrackingService();
