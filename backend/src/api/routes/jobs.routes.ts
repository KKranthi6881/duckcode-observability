import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import JobsController from '../controllers/jobs.controller';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Job management routes
router.get('/status', JobsController.getStatus.bind(JobsController));
router.post('/run/:jobName', JobsController.runJob.bind(JobsController));
router.post('/sync-connector/:connectorId', JobsController.syncConnector.bind(JobsController));

// Testing routes
router.post('/test-email', JobsController.testEmail.bind(JobsController));
router.post('/test-slack', JobsController.testSlack.bind(JobsController));

export default router;
