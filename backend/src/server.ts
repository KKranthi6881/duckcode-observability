import app from './app';
// No need to import dotenv here if app.ts already does it,
// but ensure environment variables (like PORT) are loaded before this runs.

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  console.log('Press CTRL-C to stop\n');
});

// Graceful shutdown (optional but good practice)
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});