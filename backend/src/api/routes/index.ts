import { Router } from 'express';
import githubRoutes from './github.routes';
import insightsRoutes from './insights.routes';
import documentationRoutes from './documentation.routes';
import searchRoutes from './search.routes';
import lineageRoutes from './lineage.routes';
import metadataProcessingRoutes from './metadata-processing.routes'; // NEW: Comprehensive processing
import sequentialProcessingRoutes from './sequential-processing.routes'; // NEW: Sequential processing
import chatAnalyticsRoutes from './chat-analytics.routes'; // NEW: Chat analytics

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mount existing routes (PRESERVING ORIGINAL STRUCTURE)
router.use('/github', githubRoutes);
router.use('/insights', insightsRoutes);
router.use('/documentation', documentationRoutes);
router.use('/search', searchRoutes);
router.use('/lineage', lineageRoutes);

// NEW: Mount comprehensive metadata processing routes
router.use('/metadata', metadataProcessingRoutes);

// NEW: Mount sequential processing routes  
router.use('/sequential', sequentialProcessingRoutes);

// NEW: Mount chat analytics routes
router.use('/chat-analytics', chatAnalyticsRoutes);

export default router;