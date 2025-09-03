const { default: fetch } = require('node-fetch');

const BASE_URL = 'http://localhost:3002';
let authToken = '';

async function testRegistration() {
  console.log('\n🔐 Testing User Registration...');
  
  const response = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'test@duckcode.ai',
      password: 'testpassword123',
      fullName: 'Test User'
    })
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log('✅ Registration successful');
    console.log(`User ID: ${data.user.id}`);
    console.log(`Email: ${data.user.email}`);
    authToken = data.token;
    return true;
  } else {
    console.log('❌ Registration failed:', data);
    return false;
  }
}

async function testLogin() {
  console.log('\n🔑 Testing User Login...');
  
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'test@duckcode.ai',
      password: 'testpassword123'
    })
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log('✅ Login successful');
    authToken = data.token;
    return true;
  } else {
    console.log('❌ Login failed:', data);
    return false;
  }
}

async function testUsageTracking() {
  console.log('\n📊 Testing Usage Tracking...');
  
  const response = await fetch(`${BASE_URL}/api/usage/track`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      type: 'completion',
      tokens: 150,
      model: 'gpt-4o-mini',
      prompt: 'Test prompt',
      completion: 'Test completion',
      timestamp: Date.now()
    })
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log('✅ Usage tracking successful');
    return true;
  } else {
    console.log('❌ Usage tracking failed:', data);
    return false;
  }
}

async function testUsageStats() {
  console.log('\n📈 Testing Usage Stats...');
  
  const response = await fetch(`${BASE_URL}/api/usage/stats`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log('✅ Usage stats retrieved');
    console.log(`Total tokens: ${data.summary.totalTokens}`);
    console.log(`Total requests: ${data.summary.totalRequests}`);
    return true;
  } else {
    console.log('❌ Usage stats failed:', data);
    return false;
  }
}

async function testBillingInfo() {
  console.log('\n💳 Testing Billing Info...');
  
  const response = await fetch(`${BASE_URL}/api/billing/info`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log('✅ Billing info retrieved');
    console.log(`Subscription: ${data.currentTier.name}`);
    console.log(`Tokens used: ${data.usage.tokens.used}/${data.usage.tokens.limit}`);
    return true;
  } else {
    console.log('❌ Billing info failed:', data);
    return false;
  }
}

async function testPricingTiers() {
  console.log('\n💰 Testing Pricing Tiers...');
  
  const response = await fetch(`${BASE_URL}/api/billing/tiers`, {
    method: 'GET'
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log('✅ Pricing tiers retrieved');
    console.log(`Available tiers: ${Object.keys(data).join(', ')}`);
    return true;
  } else {
    console.log('❌ Pricing tiers failed:', data);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting DuckCode Authentication Integration Tests\n');
  
  try {
    // Test registration or login
    let authSuccess = await testRegistration();
    if (!authSuccess) {
      console.log('Registration failed, trying login...');
      authSuccess = await testLogin();
    }
    
    if (!authSuccess) {
      console.log('❌ Authentication failed, stopping tests');
      return;
    }

    // Test usage tracking
    await testUsageTracking();
    
    // Test usage stats
    await testUsageStats();
    
    // Test billing info
    await testBillingInfo();
    
    // Test pricing tiers
    await testPricingTiers();
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Check if server is running
fetch(`${BASE_URL}/api/health`)
  .then(response => {
    if (response.ok) {
      console.log('✅ Server is running');
      runTests();
    } else {
      console.log('❌ Server health check failed');
    }
  })
  .catch(error => {
    console.log('❌ Cannot connect to server. Make sure it\'s running on port 3000');
    console.log('Run: cd backend && npm start');
  });
