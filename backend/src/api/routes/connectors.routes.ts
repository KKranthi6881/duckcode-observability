import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { cacheMiddleware, invalidateCacheMiddleware } from '../../middlewares/cache.middleware';
import { 
  createConnector, 
  listConnectors, 
  getConnector, 
  testConnector, 
  extractConnector, 
  getConnectorHistory, 
  updateConnectorSchedule,
  deleteConnector,
  updateConnector,
  getExtractionStatus
} from '../controllers/connectors.controller';
import { listBudgets, createBudget, updateBudget, deleteBudget, getBudgetCurrentSpend, getBudgetAlerts, checkBudgetAlerts } from '../controllers/budgets.controller';
import { 
  getDailyCredits, 
  getWarehouseCosts, 
  getCostByTags, 
  getTopQueries, 
  getFilters,
  getStorageCosts,
  getDataTransferCosts
} from '../controllers/snowflake-cost.controller';
import {
  getCostOverviewFromDB,
  getStorageUsageFromDB,
  getWasteDetectionFromDB
} from '../controllers/snowflake-cost-db.controller';
import {
  listRecommendations,
  getRecommendationsSummary,
  applyRecommendation,
  dismissRecommendation,
  getROI,
  generateRecommendations,
} from '../controllers/snowflake-recommendations.controller';
import {
  getTopExpensiveUsers,
  getUserCostDetails,
  getAccessPatterns,
  getAnomalies,
  detectAnomalies,
  getRolePermissions,
  getSecurityIssues,
  getPermissionIssues,
  getSecuritySummary,
} from '../controllers/security-monitoring.controller';
import SnowflakeCostTrackingController from '../controllers/snowflake-cost-tracking.controller';

const router = Router();

router.use(requireAuth);

// Create connector (admin only)
router.post('/', createConnector);

// List connectors by organization
router.get('/', listConnectors);

// Get connector details
router.get('/:id', getConnector);
router.get('/:id/history', getConnectorHistory);
router.get('/:id/status', getExtractionStatus);

// Update connector
router.patch('/:id', updateConnector);

// Delete connector
router.delete('/:id', deleteConnector);

// Test connector (e.g., Snowflake connectivity)
router.post('/:id/test', testConnector);

// Trigger metadata extraction now
router.post('/:id/extract', extractConnector);

// Update sync schedule (none/daily/weekly)
router.patch('/:id/schedule', updateConnectorSchedule);

// Snowflake cost analysis endpoints (database-first with real-time fallback)
// Cache for 5 minutes (300 seconds) for most queries, 10 minutes for expensive ones
router.get('/:id/cost/overview', cacheMiddleware(300), getCostOverviewFromDB);
router.get('/:id/cost/daily-credits', cacheMiddleware(300), getDailyCredits);
router.get('/:id/cost/warehouses', cacheMiddleware(300), getWarehouseCosts);
router.get('/:id/cost/tags', cacheMiddleware(300), getCostByTags);
router.get('/:id/cost/top-queries', cacheMiddleware(180), getTopQueries); // 3 min cache
router.get('/:id/cost/filters', cacheMiddleware(300), getFilters);

// Phase 1: Storage & Waste Detection (database-first)
// Cache for 10 minutes (600 seconds) - expensive queries
router.get('/:id/cost/storage-usage', cacheMiddleware(600), getStorageUsageFromDB); // Table-level storage from DB
router.get('/:id/cost/storage-costs', cacheMiddleware(600), getStorageCosts); // Historical storage costs
router.get('/:id/cost/waste-detection', cacheMiddleware(600), getWasteDetectionFromDB); // Waste opportunities from DB - EXPENSIVE!
router.get('/:id/cost/data-transfer', cacheMiddleware(300), getDataTransferCosts); // Data egress costs

// Budgets & Alerts
router.get('/:id/budgets', listBudgets);
router.post('/:id/budgets', createBudget);
router.put('/:id/budgets/:budgetId', updateBudget);
router.delete('/:id/budgets/:budgetId', deleteBudget);
router.get('/:id/budgets/:budgetId/spend', getBudgetCurrentSpend);
router.get('/:id/budgets/:budgetId/alerts', getBudgetAlerts);
router.post('/:id/budgets/:budgetId/check', checkBudgetAlerts);

// Phase 2: Smart Recommendations & ROI
router.get('/:id/recommendations', listRecommendations); // List all recommendations
router.get('/:id/recommendations/summary', getRecommendationsSummary); // Summary stats
router.post('/:id/recommendations/generate', generateRecommendations); // Manual trigger
router.post('/:id/recommendations/:recommendationId/apply', applyRecommendation); // Apply recommendation
router.put('/:id/recommendations/:recommendationId/dismiss', dismissRecommendation); // Dismiss recommendation
router.get('/:id/roi', getROI); // ROI tracking

// Cost Tracking (for Budget calculations)
router.post('/:id/costs', SnowflakeCostTrackingController.upsertDailyCost.bind(SnowflakeCostTrackingController)); // Add/update daily cost
router.get('/:id/costs', SnowflakeCostTrackingController.getDailyCosts.bind(SnowflakeCostTrackingController)); // Get cost history
router.get('/:id/costs/summary', SnowflakeCostTrackingController.getCostSummary.bind(SnowflakeCostTrackingController)); // Cost summary
router.get('/:id/costs/current-month', SnowflakeCostTrackingController.getCurrentMonthCosts.bind(SnowflakeCostTrackingController)); // Current month total
router.post('/:id/costs/bulk', SnowflakeCostTrackingController.bulkInsertCosts.bind(SnowflakeCostTrackingController)); // Bulk insert

// Security & Access Monitoring
router.get('/:id/security/summary', getSecuritySummary); // Security overview
router.get('/:id/security/user-costs', getTopExpensiveUsers); // Top expensive users
router.get('/:id/security/user-costs/:userName', getUserCostDetails); // Specific user details
router.get('/:id/security/access-patterns', getAccessPatterns); // Access logs
router.get('/:id/security/anomalies', getAnomalies); // Detected anomalies
router.post('/:id/security/detect-anomalies', detectAnomalies); // Trigger anomaly detection
router.get('/:id/security/permissions', getRolePermissions); // Role permissions
router.get('/:id/security/issues', getSecurityIssues); // Security issues summary
router.get('/:id/security/permission-issues', getPermissionIssues); // Permission problems

export default router;
