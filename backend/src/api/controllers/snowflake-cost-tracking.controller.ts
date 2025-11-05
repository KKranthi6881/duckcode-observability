import { Request, Response } from 'express';
import SnowflakeCostTrackingService from '../../services/SnowflakeCostTrackingService';

export class SnowflakeCostTrackingController {
  /**
   * POST /api/connectors/:id/costs
   * Add or update daily cost data
   */
  async upsertDailyCost(req: Request, res: Response) {
    try {
      const connectorId = req.params.id;
      const { usage_date, total_cost, total_queries, compute_cost, storage_cost } = req.body;

      if (!usage_date || total_cost === undefined) {
        return res.status(400).json({
          error: 'usage_date and total_cost are required',
        });
      }

      const costId = await SnowflakeCostTrackingService.upsertDailyCost({
        connector_id: connectorId,
        usage_date,
        total_cost,
        total_queries,
        compute_cost,
        storage_cost,
      });

      return res.status(200).json({
        success: true,
        cost_id: costId,
        message: 'Cost data saved successfully',
      });
    } catch (error: any) {
      console.error('[CostTrackingController] Error upserting cost:', error);
      return res.status(500).json({
        error: error.message || 'Failed to save cost data',
      });
    }
  }

  /**
   * GET /api/connectors/:id/costs
   * Get daily costs for a connector
   */
  async getDailyCosts(req: Request, res: Response) {
    try {
      const connectorId = req.params.id;
      const { start_date, end_date } = req.query;

      const costs = await SnowflakeCostTrackingService.getDailyCosts(
        connectorId,
        start_date as string,
        end_date as string
      );

      return res.status(200).json({
        success: true,
        costs,
        count: costs.length,
      });
    } catch (error: any) {
      console.error('[CostTrackingController] Error getting costs:', error);
      return res.status(500).json({
        error: error.message || 'Failed to get cost data',
      });
    }
  }

  /**
   * GET /api/connectors/:id/costs/summary
   * Get cost summary for a period
   */
  async getCostSummary(req: Request, res: Response) {
    try {
      const connectorId = req.params.id;
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({
          error: 'start_date and end_date are required',
        });
      }

      const summary = await SnowflakeCostTrackingService.getCostSummary(
        connectorId,
        start_date as string,
        end_date as string
      );

      return res.status(200).json({
        success: true,
        summary,
      });
    } catch (error: any) {
      console.error('[CostTrackingController] Error getting summary:', error);
      return res.status(500).json({
        error: error.message || 'Failed to get cost summary',
      });
    }
  }

  /**
   * GET /api/connectors/:id/costs/current-month
   * Get current month total costs
   */
  async getCurrentMonthCosts(req: Request, res: Response) {
    try {
      const connectorId = req.params.id;

      const totalCost = await SnowflakeCostTrackingService.getCurrentMonthCosts(connectorId);

      return res.status(200).json({
        success: true,
        total_cost: totalCost,
        period: 'current_month',
      });
    } catch (error: any) {
      console.error('[CostTrackingController] Error getting current month costs:', error);
      return res.status(500).json({
        error: error.message || 'Failed to get current month costs',
      });
    }
  }

  /**
   * POST /api/connectors/:id/costs/bulk
   * Bulk insert cost data (for Snowflake sync)
   */
  async bulkInsertCosts(req: Request, res: Response) {
    try {
      const connectorId = req.params.id;
      const { costs } = req.body;

      if (!Array.isArray(costs) || costs.length === 0) {
        return res.status(400).json({
          error: 'costs array is required and must not be empty',
        });
      }

      // Add connector_id to each cost record
      const costsWithConnector = costs.map(cost => ({
        ...cost,
        connector_id: connectorId,
      }));

      await SnowflakeCostTrackingService.bulkInsertCosts(costsWithConnector);

      return res.status(200).json({
        success: true,
        message: `Successfully inserted ${costs.length} cost records`,
        count: costs.length,
      });
    } catch (error: any) {
      console.error('[CostTrackingController] Error bulk inserting costs:', error);
      return res.status(500).json({
        error: error.message || 'Failed to bulk insert costs',
      });
    }
  }
}

export default new SnowflakeCostTrackingController();
