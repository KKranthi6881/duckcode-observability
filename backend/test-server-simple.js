const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for testing
const users = new Map();
const usageData = new Map();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'UP', 
    timestamp: new Date().toISOString(),
    message: 'DuckCode Authentication Server Running (In-Memory Mode)'
  });
});

// Auth middleware
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    // Check if user exists
    if (users.has(email)) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = {
      id: `user_${Date.now()}`,
      email,
      password: hashedPassword,
      fullName,
      avatarUrl: '',
      subscriptionTier: 'free',
      totalTokensUsed: 0,
      createdAt: new Date()
    };

    users.set(email, user);

    // Create JWT
    const token = jwt.sign(
      { user: { id: user.id, email: user.email, fullName: user.fullName } },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = users.get(email);
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Create JWT
    const token = jwt.sign(
      { user: { id: user.id, email: user.email, fullName: user.fullName } },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Usage tracking endpoint
app.post('/api/usage/track', auth, (req, res) => {
  try {
    const { type, tokens = 0, model, prompt, completion, error, timestamp } = req.body;
    
    const usageRecord = {
      id: `usage_${Date.now()}`,
      userId: req.user.id,
      type,
      tokens: parseInt(tokens) || 0,
      model: model || 'unknown',
      prompt: type === 'prompt' ? prompt : undefined,
      completion: type === 'completion' ? completion : undefined,
      error: type === 'error' ? error : undefined,
      timestamp: new Date(timestamp || Date.now())
    };

    // Store usage data
    if (!usageData.has(req.user.id)) {
      usageData.set(req.user.id, []);
    }
    usageData.get(req.user.id).push(usageRecord);

    res.json({ success: true, message: 'Usage tracked successfully' });
  } catch (err) {
    console.error('Usage tracking error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Usage stats endpoint
app.get('/api/usage/stats', auth, (req, res) => {
  try {
    const userUsage = usageData.get(req.user.id) || [];
    
    const totalTokens = userUsage.reduce((sum, record) => sum + record.tokens, 0);
    const totalRequests = userUsage.length;
    
    res.json({
      period: '30d',
      summary: {
        totalTokens,
        totalRequests,
        avgTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0
      },
      dailyBreakdown: [],
      modelBreakdown: []
    });
  } catch (err) {
    console.error('Usage stats error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Billing info endpoint
app.get('/api/billing/info', auth, (req, res) => {
  try {
    // Find user by email (since we store by email in our Map)
    let user = null;
    for (const [email, userData] of users.entries()) {
      if (userData.id === req.user.id) {
        user = userData;
        break;
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userUsage = usageData.get(req.user.id) || [];
    const totalTokens = userUsage.reduce((sum, record) => sum + record.tokens, 0);

    const tiers = {
      free: { name: 'Free', monthlyPrice: 0, tokenLimit: 10000, requestLimit: 50 },
      pro: { name: 'Pro', monthlyPrice: 29, tokenLimit: 500000, requestLimit: 2000 },
      enterprise: { name: 'Enterprise', monthlyPrice: 199, tokenLimit: 5000000, requestLimit: 20000 }
    };

    const currentTier = tiers[user.subscriptionTier];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        createdAt: user.createdAt
      },
      currentTier,
      usage: {
        tokens: {
          used: totalTokens,
          limit: currentTier.tokenLimit,
          percentage: (totalTokens / currentTier.tokenLimit) * 100
        },
        requests: {
          used: userUsage.length,
          limit: currentTier.requestLimit,
          percentage: (userUsage.length / currentTier.requestLimit) * 100
        },
        cost: totalTokens * 0.0001 // Simple cost calculation
      },
      billingPeriod: {
        start: new Date().toISOString(),
        end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
  } catch (err) {
    console.error('Billing info error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Pricing tiers endpoint
app.get('/api/billing/tiers', (req, res) => {
  const tiers = {
    free: {
      name: 'Free',
      monthlyPrice: 0,
      tokenLimit: 10000,
      requestLimit: 50,
      features: ['Basic AI assistance', 'Limited token usage', 'Community support']
    },
    pro: {
      name: 'Pro',
      monthlyPrice: 29,
      tokenLimit: 500000,
      requestLimit: 2000,
      features: ['Advanced AI models', 'Priority support', 'Usage analytics', 'Custom prompts']
    },
    enterprise: {
      name: 'Enterprise',
      monthlyPrice: 199,
      tokenLimit: 5000000,
      requestLimit: 20000,
      features: ['All AI models', 'Dedicated support', 'Advanced analytics', 'Custom integrations', 'Team management']
    }
  };
  
  res.json(tiers);
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`🚀 DuckCode Authentication Test Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
  console.log(`📈 Usage endpoints: http://localhost:${PORT}/api/usage`);
  console.log(`💳 Billing endpoints: http://localhost:${PORT}/api/billing`);
  console.log(`💾 Running in in-memory mode (no database required)`);
});
