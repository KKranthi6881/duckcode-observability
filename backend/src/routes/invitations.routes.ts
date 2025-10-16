import express from 'express';
import { requireAuth } from '../api/middlewares/auth.middleware';
import * as invitationsController from '../api/controllers/invitations.controller';

const router = express.Router();

/**
 * Get invitation details by token (PUBLIC - no auth required)
 * GET /api/invitations/token/:token
 */
router.get('/token/:token', invitationsController.getInvitationByToken);

/**
 * Accept invitation and create account (PUBLIC - no auth required)
 * POST /api/invitations/accept
 */
router.post('/accept', invitationsController.acceptInvitation);

/**
 * Send invitations to multiple users (PROTECTED)
 * POST /api/invitations/send
 */
router.post('/send', requireAuth, invitationsController.sendInvitations);

/**
 * Resend invitation email (PROTECTED)
 * POST /api/invitations/:id/resend
 */
router.post('/:id/resend', requireAuth, invitationsController.resendInvitation);

export default router;
