import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { createConnector, listConnectors, getConnector, testConnector, extractConnector, getConnectorHistory, updateConnectorSchedule } from '../controllers/connectors.controller';
import { listBudgets, createOrUpdateBudget, deleteBudget, listBudgetAlerts, checkBudget } from '../controllers/budgets.controller';
import { getDailyCredits, getWarehouseCosts, getCostByTags, getTopQueries, getFilters } from '../controllers/snowflake-cost.controller';

const router = Router();

router.use(requireAuth);

// Create connector (admin only)
router.post('/', createConnector);

// List connectors by organization
router.get('/', listConnectors);

// Get connector details
router.get('/:id', getConnector);
router.get('/:id/history', getConnectorHistory);

// Test connector (e.g., Snowflake connectivity)
router.post('/:id/test', testConnector);

// Trigger metadata extraction now
router.post('/:id/extract', extractConnector);

// Update sync schedule (none/daily/weekly)
router.patch('/:id/schedule', updateConnectorSchedule);

// Snowflake cost analysis endpoints
router.get('/:id/cost/overview', getDailyCredits);
router.get('/:id/cost/warehouses', getWarehouseCosts);
router.get('/:id/cost/tags', getCostByTags);
router.get('/:id/cost/top-queries', getTopQueries);
router.get('/:id/cost/filters', getFilters);

// Budgets & Alerts
router.get('/:id/budgets', listBudgets);
router.post('/:id/budgets', createOrUpdateBudget); // use ?upsert=1 and body.id to update
router.delete('/:id/budgets/:budgetId', deleteBudget);
router.get('/:id/budgets/:budgetId/check', checkBudget);
router.get('/:id/budgets/alerts', listBudgetAlerts);

export default router;
