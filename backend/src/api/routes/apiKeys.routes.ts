/**
 * API Keys Routes
 * Routes for managing organization API keys
 */

import express from 'express';
import {
  getOrganizationAPIKeys,
  upsertOrganizationAPIKey,
  deleteOrganizationAPIKey,
  getActiveAPIKeysForExtension,
} from '../controllers/apiKeys.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Admin routes - manage API keys
router.get('/organizations/:organizationId/api-keys', getOrganizationAPIKeys);
router.post('/organizations/:organizationId/api-keys', upsertOrganizationAPIKey);
router.delete('/organizations/:organizationId/api-keys/:keyId', deleteOrganizationAPIKey);

// Extension route - get active keys for use
router.get('/organizations/:organizationId/api-keys/active', getActiveAPIKeysForExtension);

export default router;
