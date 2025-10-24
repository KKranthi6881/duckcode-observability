/**
 * Metadata Objects Routes
 * Routes for fetching metadata objects for documentation
 */

import { Router } from 'express';
import { getOrganizationObjects } from '../controllers/metadata-objects.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/metadata-objects/organizations/:organizationId/objects
// Get all metadata objects for an organization
router.get('/organizations/:organizationId/objects', getOrganizationObjects);

export default router;
