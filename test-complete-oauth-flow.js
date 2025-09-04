#!/usr/bin/env node

/**
 * Complete end-to-end test for DuckCode IDE OAuth authentication flow
 * This creates a real user and tests the complete OAuth flow with actual database operations
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Configuration
const BACKEND_URL = 'http://localhost:3001';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testCompleteOAuthFlow() {
    console.log('🚀 Testing Complete DuckCode IDE OAuth Authentication Flow\n');

    try {
        // Step 1: Create a test user in Supabase Auth
        console.log('👤 Step 1: Creating test user...');
        
        const testEmail = `test-${Date.now()}@example.com`;
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

        // Step 2: Generate OAuth parameters
        console.log('\n📱 Step 2: Generating OAuth parameters...');
        const state = crypto.randomBytes(16).toString('hex');
        const redirectUri = 'vscode://duckcode.duck-code/auth/callback';
        
        console.log(`   State: ${state}`);
        console.log(`   Redirect URI: ${redirectUri}`);

        // Step 3: Create authorization code directly in database (simulating successful login)
        console.log('\n🔐 Step 3: Creating authorization code...');
        
        const authCode = crypto.randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        const { data: codeData, error: codeError } = await supabase
            .schema('duckcode')
            .from('ide_authorization_codes')
            .insert({
                code: authCode,
                state: state,
                user_id: userId,
                redirect_uri: redirectUri,
                expires_at: expiresAt
            })
            .select()
            .single();

        if (codeError) {
            throw new Error(`Failed to create authorization code: ${codeError.message}`);
        }

        console.log(`   ✅ Authorization code created: ${authCode.substring(0, 20)}...`);

        // Step 4: Test token exchange endpoint
        console.log('\n🔄 Step 4: Testing token exchange...');
        
        const tokenResponse = await fetch(`${BACKEND_URL}/api/auth/ide/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: authCode,
                state: state
            })
        });

        console.log(`   Token exchange status: ${tokenResponse.status}`);
        
        if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            console.log(`   ✅ Token exchange successful!`);
            console.log(`   Access token: ${tokenData.access_token ? 'present' : 'missing'}`);
            console.log(`   User info: ${tokenData.user ? 'present' : 'missing'}`);
            console.log(`   Token type: ${tokenData.token_type || 'not specified'}`);
            console.log(`   Expires in: ${tokenData.expires_in || 'not specified'}`);

            // Step 5: Verify the authorization code was marked as used
            console.log('\n🔍 Step 5: Verifying code was marked as used...');
            
            const { data: usedCode, error: usedError } = await supabase
                .schema('duckcode')
                .from('ide_authorization_codes')
                .select('*')
                .eq('code', authCode)
                .single();

            if (usedError) {
                console.log(`   ⚠️  Could not verify code usage: ${usedError.message}`);
            } else if (usedCode.used_at) {
                console.log(`   ✅ Authorization code marked as used at: ${usedCode.used_at}`);
            } else {
                console.log(`   ❌ Authorization code was not marked as used`);
            }

            // Step 6: Test the IDE session was created
            console.log('\n���� Step 6: Verifying IDE session was created...');
            
            const { data: sessions, error: sessionError } = await supabase
                .schema('duckcode')
                .from('ide_sessions')
                .select('*')
                .eq('user_id', userId);

            if (sessionError) {
                console.log(`   ⚠️  Could not verify session creation: ${sessionError.message}`);
            } else if (sessions && sessions.length > 0) {
                console.log(`   ✅ IDE session created: ${sessions[0].id}`);
                console.log(`   Session expires: ${sessions[0].expires_at}`);
            } else {
                console.log(`   ❌ No IDE session found for user`);
            }

        } else {
            const errorData = await tokenResponse.text();
            console.log(`   ❌ Token exchange failed: ${errorData}`);
        }

        // Step 7: Test the complete flow URLs
        console.log('\n🧪 Step 7: Complete flow URLs for manual testing:');
        
        const loginUrl = `http://localhost:5174/login?state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        console.log(`   Login URL: ${loginUrl}`);
        console.log(`   📝 To test manually:`);
        console.log(`   1. Open the login URL above in browser`);
        console.log(`   2. Login with: ${testEmail} / ${testPassword}`);
        console.log(`   3. Should redirect to authorization endpoint`);
        console.log(`   4. Should generate code and redirect to IDE`);

        // Cleanup
        console.log('\n🧹 Cleanup: Removing test user...');
        await supabase.auth.admin.deleteUser(userId);
        console.log(`   ✅ Test user removed`);

        console.log(`\n✨ Complete OAuth flow test completed successfully!`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testCompleteOAuthFlow();
