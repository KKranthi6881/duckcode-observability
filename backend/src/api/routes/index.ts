import { Router } from 'express';
import githubRoutes from './github.routes';
import insightsRoutes from './insights.routes'; // Import the new insights routes

const router = Router();

// Mount the GitHub routes
router.use('/github', githubRoutes);

// Mount the Insights routes
router.use('/insights', insightsRoutes);

export default router;