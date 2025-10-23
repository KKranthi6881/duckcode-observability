import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import apiRoutes from './api/routes'; // Imports the main router from routes/index.ts
import authRoutes from './routes/auth';
import billingRoutes from './routes/billing';
import analyticsRoutes from './routes/analytics';
import enterpriseRoutes from './routes/enterprise.routes';
import emailRoutes from './routes/email.routes';
import invitationsRoutes from './routes/invitations.routes';
import apiKeysRoutes from './api/routes/apiKeys.routes';
import organizationAnalyticsRoutes from './api/routes/organization-analytics.routes';
import userAnalyticsRoutes from './api/routes/user-analytics.routes';
import adminMetadataRoutes from './api/routes/admin-metadata.routes';
import metadataRoutes from './api/routes/metadata.routes'; // Import first (exports orchestrator)
import metadataLineageRoutes from './api/routes/metadata-lineage.routes'; // Lineage visualization API
import webhookRoutes from './api/routes/webhook.routes'; // Import second (uses orchestrator)
import repositoryRoutes from './api/routes/repository.routes'; // Organization repositories (admin-connected)
import universalRepositoryRoutes from './api/routes/universal-repository.routes'; // Universal repository API (GitHub + GitLab)

// Load environment variables
dotenv.config();

const app: Express = express();

// Supabase is initialized in individual models/services as needed
// No database connection setup required here since we use Supabase client

// --- Middleware ---
// Enable CORS
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5175' }));

// Set security-related HTTP headers
app.use(helmet());

// Parse incoming requests with JSON payloads
app.use(express.json());

// Parse incoming requests with URL-encoded payloads
app.use(express.urlencoded({ extended: true }));

// Parse cookies
app.use(cookieParser());

// HTTP request logger (morgan)
app.use(morgan('dev')); // Use 'combined' for production logging

// --- Basic Routes (for testing) ---
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Backend server is running!' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Register API routes
app.use('/api', apiRoutes); // Mounts all routes (GitHub, Insights, etc.) under /api
app.use('/api/auth', authRoutes); // Authentication routes
app.use('/api/billing', billingRoutes); // Billing and pricing routes
app.use('/api/analytics', analyticsRoutes); // Analytics and profit tracking routes
app.use('/api/enterprise', enterpriseRoutes); // Enterprise management routes (organizations, teams, roles, API keys)
app.use('/api/email', emailRoutes); // Email service routes (testing and notifications)
app.use('/api/invitations', invitationsRoutes); // Invitation management with email sending
app.use('/api', apiKeysRoutes); // Organization API keys management
app.use('/api/organizations', organizationAnalyticsRoutes); // Organization analytics endpoints
app.use('/api/user-analytics', userAnalyticsRoutes); // Individual user analytics endpoints
app.use('/api/admin/metadata', adminMetadataRoutes); // Enterprise metadata extraction and catalog
app.use('/api/metadata', metadataRoutes); // Automatic extraction and lineage API
app.use('/api/metadata/lineage', metadataLineageRoutes); // Lineage visualization API
app.use('/api/webhooks', webhookRoutes); // GitHub webhooks for auto-extraction
app.use('/api/repositories', repositoryRoutes); // Organization repositories (all users can view)
app.use('/api/repos', universalRepositoryRoutes); // Universal repository API (GitHub + GitLab)

// --- Error Handling Middleware (example) ---
// This should be defined after all other app.use() and routes calls
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

export default app;