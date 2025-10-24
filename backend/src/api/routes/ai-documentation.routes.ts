/**
 * AI Documentation Generation Routes
 * Routes for managing AI-powered documentation generation jobs
 */

import { Router } from 'express';
import {
  createDocumentationJob,
  getJobStatus,
  listJobs,
  cancelJob,
  pauseJob,
  resumeJob,
  getObjectDocumentation
} from '../controllers/ai-documentation.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * Job Management Routes
 */

// POST /api/ai-documentation/organizations/:organizationId/jobs
// Create a new documentation generation job
router.post('/organizations/:organizationId/jobs', createDocumentationJob);

// GET /api/ai-documentation/organizations/:organizationId/jobs
// List all jobs for an organization
router.get('/organizations/:organizationId/jobs', listJobs);

// GET /api/ai-documentation/jobs/:jobId
// Get job status and details
router.get('/jobs/:jobId', getJobStatus);

// POST /api/ai-documentation/jobs/:jobId/cancel
// Cancel a running or queued job
router.post('/jobs/:jobId/cancel', cancelJob);

// POST /api/ai-documentation/jobs/:jobId/pause
// Pause a running job
router.post('/jobs/:jobId/pause', pauseJob);

// POST /api/ai-documentation/jobs/:jobId/resume
// Resume a paused job
router.post('/jobs/:jobId/resume', resumeJob);

/**
 * Documentation Access Routes
 */

// GET /api/ai-documentation/objects/:objectId/documentation
// Get generated documentation for an object
router.get('/objects/:objectId/documentation', getObjectDocumentation);

export default router;
