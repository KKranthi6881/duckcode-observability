import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import apiRoutes from './api/routes'; // Imports the main router from routes/index.ts
import authRoutes from './routes/auth';
import usageRoutes from './routes/usage';
import billingRoutes from './routes/billing';

// Load environment variables
dotenv.config();

const app: Express = express();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/duckcode-observability';
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// --- Middleware ---
// Enable CORS
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));

// Set security-related HTTP headers
app.use(helmet());

// Parse incoming requests with JSON payloads
app.use(express.json());

// Parse incoming requests with URL-encoded payloads
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/usage', usageRoutes); // Usage tracking routes
app.use('/api/billing', billingRoutes); // Billing and pricing routes

// --- Error Handling Middleware (example) ---
// This should be defined after all other app.use() and routes calls
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

export default app;