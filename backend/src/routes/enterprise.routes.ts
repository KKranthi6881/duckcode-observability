import express from 'express';
import { requireAuth } from '../api/middlewares/auth.middleware';
import * as enterpriseController from '../api/controllers/enterprise.controller';

const router = express.Router();

// All enterprise routes require authentication
router.use(requireAuth);

// ==================== API KEYS ====================

/**
 * POST /api/enterprise/api-keys
 * Create and encrypt a new API key
 */
router.post('/api-keys', enterpriseController.createApiKey);

/**
 * GET /api/enterprise/api-keys/:organizationId
 * Get all API keys for an organization
 */
router.get('/api-keys/:organizationId', enterpriseController.getApiKeys);

/**
 * PATCH /api/enterprise/api-keys/:keyId/status
 * Update API key status (activate, revoke, etc.)
 */
router.patch('/api-keys/:keyId/status', enterpriseController.updateApiKeyStatus);

/**
 * DELETE /api/enterprise/api-keys/:keyId
 * Delete an API key
 */
router.delete('/api-keys/:keyId', enterpriseController.deleteApiKey);

/**
 * POST /api/enterprise/api-keys/:keyId/decrypt
 * Decrypt an API key for display (admin only)
 */
router.post('/api-keys/:keyId/decrypt', enterpriseController.decryptApiKey);

// ==================== INVITATIONS ====================

/**
 * POST /api/enterprise/invitations
 * Send invitation emails to users
 */
router.post('/invitations', enterpriseController.sendInvitations);

/**
 * POST /api/enterprise/invitations/:token/accept
 * Accept an invitation (public endpoint, no auth required)
 */
router.post('/invitations/:token/accept', enterpriseController.acceptInvitation);

/**
 * DELETE /api/enterprise/invitations/:invitationId
 * Cancel an invitation
 */
router.delete('/invitations/:invitationId', enterpriseController.cancelInvitation);

// ==================== ORGANIZATIONS ====================

/**
 * DELETE /api/enterprise/organizations/:organizationId
 * Delete an organization and all related data
 */
router.delete('/organizations/:organizationId', enterpriseController.deleteOrganization);

/**
 * PATCH /api/enterprise/organizations/:organizationId
 * Update organization settings
 */
router.patch('/organizations/:organizationId', enterpriseController.updateOrganization);

// ==================== PERMISSIONS ====================

/**
 * POST /api/enterprise/permissions/check
 * Check if user has a specific permission
 */
router.post('/permissions/check', enterpriseController.checkPermission);

export default router;
