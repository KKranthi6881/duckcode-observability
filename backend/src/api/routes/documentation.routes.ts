import { Router } from 'express';
import { updateDocumentation } from '@/api/controllers/documentation.controller';
import { requireAuth } from '@/api/middlewares/auth.middleware';

const router = Router();

// PUT /api/documentation/update - Update documentation section  
router.put('/update', requireAuth, updateDocumentation);

export default router; 