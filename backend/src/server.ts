import app from './app';
import { startConnectorSyncJob } from './jobs/connectorSync';
import JobScheduler from './jobs/scheduler';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  console.log('Press CTRL-C to stop\n');
  
  // Start connector sync job
  startConnectorSyncJob();
  
  // Start production automation jobs (budget alerts, notifications, etc.)
  console.log('[Server] Starting production automation scheduler...');
  JobScheduler.start();
  console.log('[Server] Production automation active:');
  console.log('  - Snowflake data sync: Daily at 2 AM');
  console.log('  - Budget alerts check: Every hour');
  console.log('  - Notification processing: Every 5 minutes');
  console.log('  - Budget snapshots: Daily at midnight\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received: closing HTTP server');
  JobScheduler.stop(); // Stop all scheduled jobs
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.info('SIGINT signal received: closing HTTP server');
  JobScheduler.stop(); // Stop all scheduled jobs
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});