import { Router } from 'express';
import { RepositoryController } from '../controllers/repository.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * Repository Routes
 * Available to all authenticated users in the organization
 * Shows admin-connected repositories
 */

// Get all repositories for user's organization
router.get('/', RepositoryController.listRepositories);

// Get statistics for a specific repository
router.get('/:repositoryId/stats', RepositoryController.getRepositoryStats);

// Get metadata objects for a repository
router.get('/:repositoryId/metadata', RepositoryController.getRepositoryMetadata);

export default router;
