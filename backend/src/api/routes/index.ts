import { Router } from 'express';
import githubRoutes from './github.routes';
import insightsRoutes from './insights.routes';
import documentationRoutes from './documentation.routes';
import searchRoutes from './search.routes';
import lineageRoutes from './lineage.routes';

const router = Router();

// Mount the GitHub routes
router.use('/github', githubRoutes);

// Mount the Insights routes
router.use('/insights', insightsRoutes);

// Mount the Documentation routes
router.use('/documentation', documentationRoutes);

// Mount the Search routes
router.use('/search', searchRoutes);

// Mount the Lineage routes
router.use('/lineage', lineageRoutes);

export default router;