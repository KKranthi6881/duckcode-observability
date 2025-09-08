const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase connection
console.log('🔗 Using Supabase as primary database');
console.log('📊 Supabase URL:', process.env.SUPABASE_URL || 'Not configured');
console.log('🔑 Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configured' : 'Not configured');

// Import and use auth routes
const authRoutes = require('./dist/routes/auth').default;
const usageRoutes = require('./dist/routes/usage').default;
const billingRoutes = require('./dist/routes/billing').default;

// Load analytics routes with error handling
let analyticsRoutes;
try {
  analyticsRoutes = require('./src/routes/analytics');
  console.log('✅ Analytics routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading analytics routes:', error.message);
  // Create a fallback router
  const express = require('express');
  analyticsRoutes = express.Router();
  analyticsRoutes.get('/', (req, res) => {
    res.json({ message: 'Analytics routes not available', error: error.message });
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'UP', 
    timestamp: new Date().toISOString(),
    message: 'DuckCode Authentication Server Running'
  });
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 DuckCode Authentication Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
  console.log(`📈 Usage endpoints: http://localhost:${PORT}/api/usage`);
  console.log(`💳 Billing endpoints: http://localhost:${PORT}/api/billing`);
  console.log(`📊 Analytics endpoints: http://localhost:${PORT}/api/analytics`);
});
