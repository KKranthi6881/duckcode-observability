import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app: Express = express();

// --- Middleware ---
// Enable CORS
app.use(cors()); // Add options here if needed, e.g., app.use(cors({ origin: process.env.FRONTEND_URL }));

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
  res.send('Hello from DuckCode Observability Backend!');
});

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// TODO: Import and use main router from ./api/routes
// import mainRouter from './api/routes';
// app.use('/api', mainRouter);

// --- Error Handling Middleware (example) ---
// This should be defined after all other app.use() and routes calls
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

export default app;