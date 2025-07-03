import { Router } from 'express';
import { MetadataProcessingController } from '../controllers/metadata-processing.controller';
import { ImpactAnalysisController } from '../controllers/impact-analysis.controller';

const router = Router();

/**
 * @openapi
 * /api/metadata/process:
 *   post:
 *     summary: Start comprehensive metadata processing pipeline
 *     description: Initiates end-to-end processing including documentation, vectors, lineage, and dependency analysis
 *     tags:
 *       - Metadata Processing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               repositoryId:
 *                 type: string
 *                 description: Repository identifier
 *               phases:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Processing phases to execute
 *     responses:
 *       200:
 *         description: Processing pipeline started successfully
 *       500:
 *         description: Failed to start processing pipeline
 */
router.post('/process', MetadataProcessingController.startProcessingPipeline);

/**
 * @openapi
 * /api/metadata/status/{jobId}:
 *   get:
 *     summary: Get processing job status
 *     description: Returns the status of a metadata processing job
 *     tags:
 *       - Metadata Processing
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Processing job ID
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *       404:
 *         description: Job not found
 */
router.get('/status/:jobId', MetadataProcessingController.getProcessingStatus);

/**
 * @openapi
 * /api/metadata/repositories/{repositoryId}:
 *   get:
 *     summary: Get repository metadata summary
 *     description: Returns comprehensive metadata for a repository
 *     tags:
 *       - Metadata Processing
 *     parameters:
 *       - in: path
 *         name: repositoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: Repository identifier
 *     responses:
 *       200:
 *         description: Repository metadata retrieved successfully
 *       500:
 *         description: Failed to retrieve metadata
 */
router.get('/repositories/:repositoryId', MetadataProcessingController.getRepositoryMetadata);

/**
 * @openapi
 * /api/metadata/scan:
 *   post:
 *     summary: Scan repository for files
 *     description: Discovers and catalogs files in a repository
 *     tags:
 *       - Metadata Processing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               repositoryId:
 *                 type: string
 *                 description: Repository identifier
 *     responses:
 *       200:
 *         description: Repository scan initiated successfully
 */
router.post('/scan', async (req, res) => {
  try {
    const { repositoryId } = req.body;
    
    // This would typically trigger GitHub API scanning
    // For now, return mock data
    res.json({
      message: 'Repository scan initiated',
      repositoryId,
      totalFiles: 42, // Mock data
      eligibleFiles: 38
    });
  } catch (error) {
    res.status(500).json({ error: 'Scan failed' });
  }
});

/**
 * @openapi
 * /api/metadata/dependencies/resolve:
 *   post:
 *     summary: Resolve repository dependencies
 *     description: Analyzes and resolves dependencies across files and data assets
 *     tags:
 *       - Metadata Processing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               repositoryId:
 *                 type: string
 *                 description: Repository identifier
 *     responses:
 *       200:
 *         description: Dependencies resolved successfully
 *       500:
 *         description: Dependency resolution failed
 */
router.post('/dependencies/resolve', async (req, res) => {
  try {
    const { repositoryId } = req.body;
    
    // Call the metadata processing controller method
    const result = await MetadataProcessingController.resolveDependencies(repositoryId);
    res.json(result);
  } catch (error) {
    console.error('Error resolving dependencies:', error);
    res.status(500).json({ 
      error: 'Dependency resolution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /api/metadata/impact/column:
 *   post:
 *     summary: Analyze column impact
 *     description: Analyzes the impact of changes to a specific column
 *     tags:
 *       - Impact Analysis
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               objectId:
 *                 type: string
 *                 description: Column identifier
 *               changeType:
 *                 type: string
 *                 description: Type of change (modification, deletion, etc.)
 *               maxDepth:
 *                 type: integer
 *                 description: Maximum depth for impact analysis
 *     responses:
 *       200:
 *         description: Column impact analysis completed
 *       500:
 *         description: Impact analysis failed
 */
router.post('/impact/column', ImpactAnalysisController.analyzeColumnImpact);

/**
 * @openapi
 * /api/metadata/impact/file:
 *   post:
 *     summary: Analyze file impact
 *     description: Analyzes the impact of changes to a specific file
 *     tags:
 *       - Impact Analysis
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               objectId:
 *                 type: string
 *                 description: File identifier
 *               changeType:
 *                 type: string
 *                 description: Type of change (modification, deletion, etc.)
 *               maxDepth:
 *                 type: integer
 *                 description: Maximum depth for impact analysis
 *     responses:
 *       200:
 *         description: File impact analysis completed
 *       500:
 *         description: Impact analysis failed
 */
router.post('/impact/file', ImpactAnalysisController.analyzeFileImpact);

export default router; 