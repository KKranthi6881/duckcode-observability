import { Router, Request, Response } from 'express';
import EmailService from '../services/EmailService';
import { requireAuth } from '../api/middlewares/auth.middleware';

const router = Router();

/**
 * Test email endpoint (authenticated only)
 */
router.post('/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Send test invitation email
    const result = await EmailService.sendInvitationEmail(email, {
      inviterName: 'Test User',
      organizationName: 'Test Organization',
      roleName: 'Member',
      acceptUrl: 'http://localhost:5175/invite/test-token-123',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully!',
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to send email',
      });
    }
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
