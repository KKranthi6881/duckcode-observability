import { Router } from 'express';
import githubRoutes from './github.routes';
import insightsRoutes from './insights.routes';
import documentationRoutes from './documentation.routes';
import searchRoutes from './search.routes';
import lineageRoutes from './lineage.routes';
import metadataProcessingRoutes from './metadata-processing.routes'; // NEW: Comprehensive processing
import sequentialProcessingRoutes from './sequential-processing.routes'; // NEW: Sequential processing
import chatAnalyticsRoutes from './chat-analytics.routes'; // NEW: Chat analytics
import waitlistRoutes from './waitlist.routes'; // NEW: Waitlist onboarding
import aiDocumentationRoutes from './ai-documentation.routes'; // NEW: AI Documentation Generation
import metadataObjectsRoutes from './metadata-objects.routes'; // NEW: Metadata objects for docs
import metadataSyncRoutes from './metadata-sync.routes'; // NEW: IDE Metadata Sync
import snowflakeRecommendationsRoutes from './snowflake-recommendations.routes'; // NEW: Snowflake recommendations

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

// NEW: Mount waitlist routes
router.use('/waitlist', waitlistRoutes);

// NEW: Mount AI documentation generation routes
router.use('/ai-documentation', aiDocumentationRoutes);

// NEW: Mount metadata objects routes
router.use('/metadata-objects', metadataObjectsRoutes);

// NEW: Mount metadata sync routes
router.use('/metadata-sync', metadataSyncRoutes);

// NEW: Mount Snowflake recommendations routes
router.use('/connectors', snowflakeRecommendationsRoutes);

export default router;