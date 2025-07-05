import express from 'express';
import { ProcessingPhasesController } from '../controllers/processing-phases.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = express.Router();

// ========================================
// DEBUG ROUTES (NO AUTH)
// ========================================

/**
 * @route POST /api/phases/debug/vectors
 * @desc Debug Phase 2: Vector generation without auth
 * @access Public (for debugging)
 */
router.post('/debug/vectors', async (req, res, next) => {
  try {
    const { repositoryFullName } = req.body;
    
    // Auto-detect user ID from repository data
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: repoData } = await supabase
      .from('files')
      .select('user_id')
      .eq('repository_full_name', repositoryFullName)
      .limit(1)
      .single();
    
    if (!repoData?.user_id) {
      return res.status(404).json({ error: 'Repository not found or no user associated' });
    }
    
    req.user = { id: repoData.user_id };
    next();
  } catch (error) {
    console.error('Error auto-detecting user ID:', error);
    return res.status(500).json({ error: 'Failed to auto-detect user ID' });
  }
}, ProcessingPhasesController.processPhase2Vectors);

/**
 * @route POST /api/phases/debug/lineage
 * @desc Debug Phase 3: Lineage extraction without auth
 * @access Public (for debugging)
 */
router.post('/debug/lineage', async (req, res, next) => {
  try {
    const { repositoryFullName } = req.body;
    
    // Auto-detect user ID from repository data
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: repoData } = await supabase
      .from('files')
      .select('user_id')
      .eq('repository_full_name', repositoryFullName)
      .limit(1)
      .single();
    
    if (!repoData?.user_id) {
      return res.status(404).json({ error: 'Repository not found or no user associated' });
    }
    
    req.user = { id: repoData.user_id };
    next();
  } catch (error) {
    console.error('Error auto-detecting user ID:', error);
    return res.status(500).json({ error: 'Failed to auto-detect user ID' });
  }
}, ProcessingPhasesController.processPhase3Lineage);

/**
 * @route POST /api/phases/debug/dependencies
 * @desc Debug Phase 4: Dependencies analysis without auth
 * @access Public (for debugging)
 */
router.post('/debug/dependencies', async (req, res, next) => {
  try {
    const { repositoryFullName } = req.body;
    
    // Auto-detect user ID from repository data
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: repoData } = await supabase
      .from('files')
      .select('user_id')
      .eq('repository_full_name', repositoryFullName)
      .limit(1)
      .single();
    
    if (!repoData?.user_id) {
      return res.status(404).json({ error: 'Repository not found or no user associated' });
    }
    
    req.user = { id: repoData.user_id };
    next();
  } catch (error) {
    console.error('Error auto-detecting user ID:', error);
    return res.status(500).json({ error: 'Failed to auto-detect user ID' });
  }
}, ProcessingPhasesController.processPhase4Dependencies);

/**
 * @route POST /api/phases/debug/analysis
 * @desc Debug Phase 5: Impact analysis without auth
 * @access Public (for debugging)
 */
router.post('/debug/analysis', async (req, res, next) => {
  try {
    const { repositoryFullName } = req.body;
    
    // Auto-detect user ID from repository data
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: repoData } = await supabase
      .from('files')
      .select('user_id')
      .eq('repository_full_name', repositoryFullName)
      .limit(1)
      .single();
    
    if (!repoData?.user_id) {
      return res.status(404).json({ error: 'Repository not found or no user associated' });
    }
    
    req.user = { id: repoData.user_id };
    next();
  } catch (error) {
    console.error('Error auto-detecting user ID:', error);
    return res.status(500).json({ error: 'Failed to auto-detect user ID' });
  }
}, ProcessingPhasesController.processPhase5Analysis);

// Apply authentication middleware to remaining routes
router.use(requireAuth);

// ========================================
// INDIVIDUAL PHASE PROCESSING ROUTES
// ========================================

/**
 * @route POST /api/phases/documentation
 * @desc Phase 1: Repository scanning + Documentation analysis
 * @access Private
 */
router.post('/documentation', ProcessingPhasesController.processPhase1Documentation);

/**
 * @route POST /api/phases/vectors
 * @desc Phase 2: Vector generation for completed documentation
 * @access Private
 */
router.post('/vectors', ProcessingPhasesController.processPhase2Vectors);

/**
 * @route POST /api/phases/lineage
 * @desc Phase 3: Lineage extraction for SQL files
 * @access Private
 */
router.post('/lineage', ProcessingPhasesController.processPhase3Lineage);

/**
 * @route POST /api/phases/dependencies
 * @desc Phase 4: Dependency analysis using lineage data
 * @access Private
 */
router.post('/dependencies', ProcessingPhasesController.processPhase4Dependencies);

/**
 * @route POST /api/phases/analysis
 * @desc Phase 5: Impact analysis and recommendations
 * @access Private
 */
router.post('/analysis', ProcessingPhasesController.processPhase5Analysis);

// ========================================
// STATUS AND MONITORING ROUTES
// ========================================

/**
 * @route GET /api/phases/status/:repositoryFullName/:phase
 * @desc Get status for a specific phase
 * @access Private
 */
router.get('/status/:repositoryFullName/:phase', ProcessingPhasesController.getPhaseStatus);

export default router; 