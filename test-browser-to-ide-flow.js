#!/usr/bin/env node

/**
 * Test the complete browser-to-IDE authentication flow
 * This simulates the real user experience from IDE login to token acquisition
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Configuration
const BACKEND_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:5175';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testBrowserToIdeFlow() {
    console.log('🚀 Testing Complete Browser-to-IDE Authentication Flow\n');

    try {
        // Step 1: Create a test user for login
        console.log('👤 Step 1: Creating test user for login...');
        
        const testEmail = `test-ide-${Date.now()}@example.com`;
        const testPassword = 'test-password-123';
        
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: testEmail,
            password: testPassword,
            email_confirm: true
        });

        if (authError) {
            throw new Error(`Failed to create test user: ${authError.message}`);
        }

        const userId = authData.user.id;
        console.log(`   ✅ Test user created: ${testEmail} (ID: ${userId})`);

        // Step 2: Simulate IDE initiating OAuth flow
        console.log('\n📱 Step 2: IDE initiates OAuth flow...');
        const state = crypto.randomBytes(16).toString('hex');
        const redirectUri = 'vscode://duckcode.duck-code/auth/callback';
        
        console.log(`   State: ${state}`);
        console.log(`   Redirect URI: ${redirectUri}`);

        // Step 3: Test IDE login endpoint (redirects to frontend)
        console.log('\n🌐 Step 3: Testing IDE login endpoint...');
        const ideLoginUrl = `${BACKEND_URL}/api/auth/ide/login?state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        
        const loginResponse = await fetch(ideLoginUrl, {
            method: 'GET',
            redirect: 'manual'
        });

        console.log(`   IDE login endpoint status: ${loginResponse.status}`);
        
        if (loginResponse.status === 302) {
            const location = loginResponse.headers.get('location');
            console.log(`   ✅ Redirects to: ${location}`);
            
            // Verify the redirect URL contains the correct parameters
            const redirectUrl = new URL(location);
            const redirectState = redirectUrl.searchParams.get('state');
            const redirectRedirectUri = redirectUrl.searchParams.get('redirect_uri');
            
            if (redirectState === state && redirectRedirectUri === redirectUri) {
                console.log(`   ✅ Redirect parameters are correct`);
            } else {
                console.log(`   ❌ Redirect parameters mismatch`);
                console.log(`     Expected state: ${state}, got: ${redirectState}`);
                console.log(`     Expected redirect_uri: ${redirectUri}, got: ${redirectRedirectUri}`);
            }
        } else {
            console.log(`   ❌ Expected 302 redirect, got ${loginResponse.status}`);
        }

        // Step 4: Simulate user login and authorization
        console.log('\n🔐 Step 4: Simulating user login and authorization...');
        
        // First, simulate user login to get a session
        const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: testPassword
        });

        if (sessionError) {
            throw new Error(`Failed to create user session: ${sessionError.message}`);
        }

        console.log(`   ✅ User session created`);

        // Step 5: Test authorization endpoint with session
        console.log('🔑 Step 5: Testing authorization endpoint...');
        const authResponse = await fetch(`${BACKEND_URL}/api/auth/ide/authorize?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${sessionData.session.access_token}`,
                'Cookie': `sb-access-token=${sessionData.session.access_token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`   Authorization endpoint status: ${authResponse.status}`);
        
        if (authResponse.ok) {
            const authData = await authResponse.json();
            console.log(`   ✅ Returns redirect URL: ${authData.redirect_url}`);
            
            // Extract authorization code from redirect URL
            const redirectUrl = new URL(authData.redirect_url);
            const authCode = redirectUrl.searchParams.get('code');
            const returnedState = redirectUrl.searchParams.get('state');
            
            if (authCode && returnedState === state) {
                console.log(`   ✅ Authorization code generated: ${authCode.substring(0, 20)}...`);
            } else {
                throw new Error('Invalid authorization code or state in redirect URL');
            }
            
            // Step 6: Test token exchange
            console.log('\n🔄 Step 6: Testing token exchange...');
            const tokenResponse = await fetch(`${BACKEND_URL}/api/auth/ide/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: authCode,
                    redirect_uri: redirectUri,
                    state: state
                })
            });

            console.log(`   Token exchange status: ${tokenResponse.status}`);
            
            if (tokenResponse.ok) {
                const tokenData = await tokenResponse.json();
                console.log('   ✅ Token exchange successful!');
                console.log(`   Access token: ${tokenData.access_token ? 'present' : 'missing'}`);
                console.log(`   User email: ${tokenData.user?.email || 'not provided'}`);
                console.log(`   Token type: ${tokenData.token_type || 'not provided'}`);
                console.log(`   Expires in: ${tokenData.expires_in || 'not provided'} seconds`);
            } else {
                const errorData = await tokenResponse.text();
                throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorData}`);
            }
        } else {
            console.log(`   ❌ Expected 302 redirect, got ${authResponse.status}`);
            const errorText = await authResponse.text();
            console.log(`   Error: ${errorText}`);
        }

        // Step 7: Manual testing instructions
        console.log('\n🧪 Step 7: Manual Testing Instructions:');
        console.log(`   Frontend URL: ${FRONTEND_URL}`);
        console.log(`   Test user: ${testEmail} / ${testPassword}`);
        console.log(`   
   To test manually:
   1. Open DuckCode IDE extension
   2. Click "Sign In" - this should open: ${ideLoginUrl}
   3. Browser should redirect to: ${FRONTEND_URL}/login?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}
   4. Login with the test credentials above
   5. Should automatically redirect to authorization endpoint
   6. Should generate code and redirect back to IDE
   7. IDE should receive the code and exchange it for a token
   `);

        // Cleanup
        console.log('\n🧹 Cleanup: Removing test user...');
        await supabase.auth.admin.deleteUser(userId);
        console.log(`   ✅ Test user removed`);

        console.log(`\n✨ Browser-to-IDE flow test completed successfully!`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testBrowserToIdeFlow();
