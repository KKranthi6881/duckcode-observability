import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middlewares/auth.middleware';
import * as chatAnalyticsController from '../controllers/chat-analytics.controller';

const router = Router();

/**
 * @swagger
 * /api/chat-analytics/conversation/start:
 *   post:
 *     summary: Start a new conversation
 *     tags: [Chat Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversationId
 *               - topicTitle
 *               - modelName
 *             properties:
 *               conversationId:
 *                 type: string
 *                 description: IDE-generated conversation ID
 *               topicTitle:
 *                 type: string
 *                 description: Conversation topic/title from first user message
 *               modelName:
 *                 type: string
 *                 description: AI model being used
 *               providerName:
 *                 type: string
 *                 description: AI provider (anthropic, openai, etc.)
 *               modeName:
 *                 type: string
 *                 description: IDE mode (coding, analysis, etc.)
 *               workspacePath:
 *                 type: string
 *                 description: Current workspace path
 *               metadata:
 *                 type: object
 *                 description: Additional conversation metadata
 *     responses:
 *       201:
 *         description: Conversation started successfully
 *       400:
 *         description: Bad Request - Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/conversation/start', requireAuth, [
  body('conversationId').notEmpty().withMessage('Conversation ID is required'),
  body('topicTitle').notEmpty().withMessage('Topic title is required'),
  body('modelName').notEmpty().withMessage('Model name is required')
], chatAnalyticsController.startConversation);

/**
 * @swagger
 * /api/chat-analytics/conversation/update:
 *   post:
 *     summary: Update conversation with final metrics
 *     tags: [Chat Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversationId
 *               - apiMetrics
 *             properties:
 *               conversationId:
 *                 type: string
 *                 description: IDE-generated conversation ID
 *               apiMetrics:
 *                 type: object
 *                 description: Final API metrics from IDE
 *                 properties:
 *                   totalTokensIn:
 *                     type: integer
 *                   totalTokensOut:
 *                     type: integer
 *                   totalTokens:
 *                     type: integer
 *                     description: Convenience field (totalTokensIn + totalTokensOut)
 *                   totalCacheWrites:
 *                     type: integer
 *                   totalCacheReads:
 *                     type: integer
 *                   cacheTokens:
 *                     type: integer
 *                     description: Convenience field (totalCacheWrites + totalCacheReads)
 *                   totalCost:
 *                     type: number
 *                   inputCost:
 *                     type: number
 *                     description: Optional cost breakdown for input tokens
 *                   outputCost:
 *                     type: number
 *                     description: Optional cost breakdown for output tokens
 *                   cacheWriteCost:
 *                     type: number
 *                     description: Optional cost breakdown for cache writes
 *                   cacheReadCost:
 *                     type: number
 *                     description: Optional cost breakdown for cache reads
 *                   contextTokens:
 *                     type: integer
 *               messageCount:
 *                 type: integer
 *                 description: Total messages in conversation
 *               toolCalls:
 *                 type: array
 *                 description: Array of tool names used
 *               status:
 *                 type: string
 *                 enum: [completed, abandoned, error]
 *                 description: Final conversation status
 *     responses:
 *       200:
 *         description: Conversation updated successfully
 *       404:
 *         description: Conversation not found
 */
router.post('/conversation/update', requireAuth, [
  body('conversationId').notEmpty().withMessage('Conversation ID is required'),
  body('apiMetrics').isObject().withMessage('API metrics are required')
], chatAnalyticsController.updateConversation);

// Remove individual message tracking - we now focus on conversation-level metrics

/**
 * @swagger
 * /api/chat-analytics/stats:
 *   get:
 *     summary: Get user chat statistics
 *     tags: [Chat Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: Chat statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', requireAuth, chatAnalyticsController.getChatStats);

/**
 * @swagger
 * /api/chat-analytics/conversations:
 *   get:
 *     summary: Get user conversations
 *     tags: [Chat Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of conversations to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of conversations to skip
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, abandoned, error]
 *         description: Filter by conversation status
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/conversations', requireAuth, chatAnalyticsController.getConversations);

/**
 * @swagger
 * /api/chat-analytics/daily-stats:
 *   get:
 *     summary: Get daily usage statistics
 *     tags: [Chat Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: Daily statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/daily-stats', requireAuth, chatAnalyticsController.getDailyStats);

/**
 * @swagger
 * /api/chat-analytics/model-stats:
 *   get:
 *     summary: Get model usage statistics
 *     tags: [Chat Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: Model statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/model-stats', requireAuth, chatAnalyticsController.getModelStats);

export default router;
