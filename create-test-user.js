#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createTestUser() {
    console.log('🔧 Creating test user for manual testing...\n');

    const testEmail = 'test@duckcode.com';
    const testPassword = 'password123';

    try {
        // Try to delete existing user first (in case it exists)
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers.users.find(u => u.email === testEmail);
        
        if (existingUser) {
            console.log('🗑️  Removing existing test user...');
            await supabase.auth.admin.deleteUser(existingUser.id);
        }

        // Create new test user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: testEmail,
            password: testPassword,
            email_confirm: true
        });

        if (authError) {
            throw new Error(`Failed to create test user: ${authError.message}`);
        }

        console.log('✅ Test user created successfully!');
        console.log(`   Email: ${testEmail}`);
        console.log(`   Password: ${testPassword}`);
        console.log(`   User ID: ${authData.user.id}`);
        
        console.log('\n📋 To test the OAuth flow:');
        console.log('1. Click "Sign In" in the IDE extension');
        console.log('2. Browser will open the login page');
        console.log(`3. Login with: ${testEmail} / ${testPassword}`);
        console.log('4. Should automatically redirect back to IDE');
        
    } catch (error) {
        console.error('❌ Failed to create test user:', error.message);
        process.exit(1);
    }
}

createTestUser();
