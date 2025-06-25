import { Router } from 'express';
import githubRoutes from './github.routes';
import insightsRoutes from './insights.routes';
import documentationRoutes from './documentation.routes';

const router = Router();

// Mount the GitHub routes
router.use('/github', githubRoutes);

// Mount the Insights routes
router.use('/insights', insightsRoutes);

// Mount the Documentation routes
router.use('/documentation', documentationRoutes);

export default router;