import { Router } from 'express';
import { WaitlistController } from '../controllers/waitlist.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';

const router = Router();

// Public: Join waitlist
router.post('/join', WaitlistController.join);

// Admin: List waitlist by status (default pending)
router.get('/', requireAuth, requireAdmin, WaitlistController.list);

// Admin: Approve and send invite
router.put('/:id/approve', requireAuth, requireAdmin, WaitlistController.approve);

// Admin: Reject
router.put('/:id/reject', requireAuth, requireAdmin, WaitlistController.reject);

export default router;
