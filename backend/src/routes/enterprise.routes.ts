import express from 'express';
import { requireAuth } from '../api/middlewares/auth.middleware';
import * as enterpriseController from '../api/controllers/enterprise.controller';

const router = express.Router();

// ==================== API KEYS (Protected) ====================

/**
 * POST /api/enterprise/api-keys
 * Create and encrypt a new API key
 */
router.post('/api-keys', requireAuth, enterpriseController.createApiKey);

/**
 * GET /api/enterprise/api-keys/:organizationId
 * Get all API keys for an organization
 */
router.get('/api-keys/:organizationId', requireAuth, enterpriseController.getApiKeys);

/**
 * PATCH /api/enterprise/api-keys/:keyId/status
 * Update API key status (activate, revoke, etc.)
 */
router.patch('/api-keys/:keyId/status', requireAuth, enterpriseController.updateApiKeyStatus);

/**
 * DELETE /api/enterprise/api-keys/:keyId
 * Delete an API key
 */
router.delete('/api-keys/:keyId', requireAuth, enterpriseController.deleteApiKey);

/**
 * POST /api/enterprise/api-keys/:keyId/decrypt
 * Decrypt an API key for display (admin only)
 */
router.post('/api-keys/:keyId/decrypt', requireAuth, enterpriseController.decryptApiKey);

// ==================== INVITATIONS ====================

/**
 * GET /api/enterprise/invitations/:token
 * Get invitation details by token (PUBLIC - no auth required)
 */
router.get('/invitations/:token', enterpriseController.getInvitationByToken);

/**
 * POST /api/enterprise/invitations
 * Send invitation emails to users (Protected)
 */
router.post('/invitations', requireAuth, enterpriseController.sendInvitations);

/**
 * POST /api/enterprise/invitations/:token/accept
 * Accept an invitation (PUBLIC - no auth required, creates user if needed)
 */
router.post('/invitations/:token/accept', enterpriseController.acceptInvitation);

/**
 * DELETE /api/enterprise/invitations/:invitationId
 * Cancel an invitation (Protected)
 */
router.delete('/invitations/:invitationId', requireAuth, enterpriseController.cancelInvitation);

// ==================== ORGANIZATIONS (Protected) ====================

/**
 * DELETE /api/enterprise/organizations/:organizationId
 * Delete an organization and all related data
 */
router.delete('/organizations/:organizationId', requireAuth, enterpriseController.deleteOrganization);

/**
 * PATCH /api/enterprise/organizations/:organizationId
 * Update organization settings
 */
router.patch('/organizations/:organizationId', requireAuth, enterpriseController.updateOrganization);

// ==================== PERMISSIONS (Protected) ====================

/**
 * POST /api/enterprise/permissions/check
 * Check if user has a specific permission
 */
router.post('/permissions/check', requireAuth, enterpriseController.checkPermission);

// ==================== SSO CONFIGURATION (Protected) ====================

router.get('/sso/:organizationId/connections', requireAuth, enterpriseController.getSsoConnections);
router.post('/sso/connections', requireAuth, enterpriseController.upsertSsoConnection);
router.delete('/sso/connections/:connectionId', requireAuth, enterpriseController.deleteSsoConnection);
router.post('/sso/domains', requireAuth, enterpriseController.createSsoDomain);
router.post('/sso/domains/:domainId/verify', requireAuth, enterpriseController.verifySsoDomain);
router.delete('/sso/domains/:domainId', requireAuth, enterpriseController.deleteSsoDomain);

export default router;
