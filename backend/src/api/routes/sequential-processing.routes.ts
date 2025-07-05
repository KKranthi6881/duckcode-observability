import { Router } from 'express';
import { SequentialProcessingController } from '../controllers/sequential-processing.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @route POST /api/sequential/reset-stale/:repositoryFullName
 * @desc Reset stale leased jobs for debugging
 * @access Public (for debugging)
 */
router.post('/reset-stale/:repositoryFullName', (req, res, next) => {
  // Skip auth for debugging
  req.user = { id: '59b6ce64-afe7-4973-9872-083bd6795973' }; // Your user ID
  next();
}, SequentialProcessingController.resetStaleJobs);

/**
 * @route GET /api/sequential/debug/:repositoryFullName
 * @desc Debug job states for a repository
 * @access Public (for debugging)
 */
router.get('/debug/:repositoryFullName', (req, res, next) => {
  // Skip auth for debugging
  req.user = { id: '59b6ce64-afe7-4973-9872-083bd6795973' }; // Your user ID
  next();
}, SequentialProcessingController.debugJobStates);

/**
 * @route POST /api/sequential/create-mock-data/:repositoryFullName
 * @desc Create mock data for testing sequential processing
 * @access Public (for debugging)
 */
router.post('/create-mock-data/:repositoryFullName', (req, res, next) => {
  // Skip auth for debugging
  req.user = { id: '59b6ce64-afe7-4973-9872-083bd6795973' }; // Your user ID
  next();
}, SequentialProcessingController.createMockData);

/**
 * @route GET /api/sequential/debug-status/:repositoryFullName
 * @desc Debug sequential processing status without auth
 * @access Public (for debugging)
 */
router.get('/debug-status/:repositoryFullName', (req, res, next) => {
  // Skip auth for debugging - use the ACTUAL user ID from the database
  req.user = { id: '81e6a25e-2dc5-4208-8807-aa2e9408ef4f' }; // Actual user ID from processing jobs
  next();
}, SequentialProcessingController.getSequentialStatus);

/**
 * @route POST /api/sequential/advance/:repositoryFullName
 * @desc Manually advance sequential processing to next phase
 * @access Public (for debugging)
 */
router.post('/advance/:repositoryFullName', (req, res, next) => {
  // Skip auth for debugging
  req.user = { id: '59b6ce64-afe7-4973-9872-083bd6795973' }; // Your user ID
  req.headers.authorization = 'Bearer dummy-token-for-debugging';
  next();
}, SequentialProcessingController.advanceToNextPhase);

/**
 * @route POST /api/sequential/sync/:repositoryFullName
 * @desc Sync existing processing jobs with sequential processing
 * @access Public (for debugging)
 */
router.post('/sync/:repositoryFullName', (req, res, next) => {
  // Skip auth for debugging - use the ACTUAL user ID from the database
  req.user = { id: '7b69fb81-8d64-4295-89fa-4fbce6e4873b' }; // Actual user ID from processing jobs
  next();
}, SequentialProcessingController.syncExistingJobs);

/**
 * @route GET /api/sequential/debug-all/:repositoryFullName
 * @desc Debug all processing jobs regardless of user
 * @access Public (for debugging)
 */
router.get('/debug-all/:repositoryFullName', SequentialProcessingController.debugAllJobs);

/**
 * @route POST /api/sequential/start-monitoring/:repositoryFullName
 * @desc Manually start monitoring for a specific phase
 * @access Public (for debugging)
 */
router.post('/start-monitoring/:repositoryFullName', (req, res, next) => {
  // Skip auth for debugging - use the ACTUAL user ID from the database
  req.user = { id: '7b69fb81-8d64-4295-89fa-4fbce6e4873b' }; // Actual user ID from processing jobs
  req.headers.authorization = 'Bearer dummy-token-for-debugging';
  next();
}, SequentialProcessingController.startMonitoring);

/**
 * @route POST /api/sequential/release-jobs/:repositoryFullName
 * @desc Release leased jobs for a specific phase
 * @access Public (for debugging)
 */
router.post('/release-jobs/:repositoryFullName', (req, res, next) => {
  // Skip auth for debugging - use the ACTUAL user ID from the database
  req.user = { id: '7b69fb81-8d64-4295-89fa-4fbce6e4873b' }; // Actual user ID from processing jobs
  next();
}, SequentialProcessingController.releaseJobs);

/**
 * @route POST /api/sequential/fix-stuck-doc
 * @desc Fix stuck documentation phase when it's actually complete
 * @access Public (for debugging)
 */
router.post('/fix-stuck-doc', (req, res, next) => {
  // Skip auth for debugging - use the ACTUAL user ID from the database
  req.user = { id: '81e6a25e-2dc5-4208-8807-aa2e9408ef4f' }; // Actual user ID from processing jobs
  req.headers.authorization = 'Bearer dummy-token-for-debugging';
  next();
}, SequentialProcessingController.fixStuckDocumentationPhase);

/**
 * @route POST /api/sequential/create-from-existing
 * @desc Create sequential processing job from existing processing jobs
 * @access Public (for debugging)
 */
router.post('/create-from-existing', (req, res, next) => {
  // Skip auth for debugging - use the ACTUAL user ID from the database
  req.user = { id: '81e6a25e-2dc5-4208-8807-aa2e9408ef4f' }; // Actual user ID from processing jobs
  req.headers.authorization = 'Bearer dummy-token-for-debugging';
  next();
}, SequentialProcessingController.createSequentialFromExisting);

/**
 * @route GET /api/sequential/diagnose/:repositoryFullName
 * @desc Diagnose phase transition issues
 * @access Public (for debugging)
 */
router.get('/diagnose/:repositoryFullName', (req, res, next) => {
  // Skip auth for debugging - use the ACTUAL user ID from the database
  req.user = { id: '81e6a25e-2dc5-4208-8807-aa2e9408ef4f' }; // Actual user ID from processing jobs
  next();
}, SequentialProcessingController.diagnosePhaseTransition);

/**
 * @route POST /api/sequential/fix-lineage
 * @desc Fix and restart lineage processing phase
 * @access Public (for debugging)
 */
router.post('/fix-lineage', (req, res, next) => {
  // Skip auth for debugging - use the ACTUAL user ID from the database
  req.user = { id: '81e6a25e-2dc5-4208-8807-aa2e9408ef4f' }; // Actual user ID from processing jobs
  req.headers.authorization = 'Bearer dummy-token-for-debugging';
  next();
}, SequentialProcessingController.fixLineagePhase);

/**
 * @route POST /api/sequential/complete-all
 * @desc Manually complete all phases for demo purposes
 * @access Public (for debugging)
 */
router.post('/complete-all', (req, res, next) => {
  // Skip auth for debugging - use the ACTUAL user ID from the database
  req.user = { id: '81e6a25e-2dc5-4208-8807-aa2e9408ef4f' }; // Actual user ID from processing jobs
  next();
}, SequentialProcessingController.completeAllPhases);

/**
 * @route POST /api/sequential/debug-start
 * @desc Start processing without auth for debugging
 * @access Public (for debugging)
 */
router.post('/debug-start', (req, res, next) => {
  // Skip auth for debugging
  req.user = { id: '59b6ce64-afe7-4973-9872-083bd6795973' }; // Your user ID
  req.headers.authorization = 'Bearer dummy-token-for-debugging';
  next();
}, SequentialProcessingController.startSequentialProcessing);

// Apply authentication middleware to remaining routes
router.use(requireAuth);

/**
 * @route POST /api/sequential/start
 * @desc Start sequential processing pipeline for a repository
 * @access Private
 */
router.post('/start', (req, res, next) => {
  console.log('🔥 Sequential processing route hit:', {
    method: req.method,
    url: req.url,
    body: req.body,
    hasAuthHeader: !!req.headers.authorization
  });
  next();
}, SequentialProcessingController.startSequentialProcessing);

/**
 * @route GET /api/sequential/status/:repositoryFullName
 * @desc Get sequential processing status for a repository
 * @access Private
 */
router.get('/status/:repositoryFullName', SequentialProcessingController.getSequentialStatus);

export default router; 