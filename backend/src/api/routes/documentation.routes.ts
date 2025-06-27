import { Router } from 'express';
import { getDocumentation, updateDocumentation, saveAnalysisSettings } from '../controllers/documentation.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// GET /api/documentation - Get documentation section  
router.get('/', getDocumentation);

// PUT /api/documentation/update - Update documentation section  
router.put('/update', requireAuth, updateDocumentation);

// POST /api/documentation/settings - Save analysis settings  
router.post('/settings', requireAuth, saveAnalysisSettings);

export default router; 