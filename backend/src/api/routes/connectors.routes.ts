import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
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
router.get('/:id/cost/daily-credits', getDailyCredits); // Legacy: daily credits
router.get('/:id/cost/overview', getCostOverviewFromDB); // Phase 1 - Complete overview from DB
router.get('/:id/cost/warehouses', getWarehouseCosts);
router.get('/:id/cost/tags', getCostByTags);
router.get('/:id/cost/top-queries', getTopQueries);
router.get('/:id/cost/filters', getFilters);

// Phase 1: Storage & Waste Detection (database-first)
router.get('/:id/cost/storage-usage', getStorageUsageFromDB); // Table-level storage from DB
router.get('/:id/cost/storage-costs', getStorageCosts); // Historical storage costs
router.get('/:id/cost/waste-detection', getWasteDetectionFromDB); // Waste opportunities from DB
router.get('/:id/cost/data-transfer', getDataTransferCosts); // Data egress costs

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
