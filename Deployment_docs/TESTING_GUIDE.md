# DuckCode Pro Testing Guide

## Understanding Debug Mode vs Production

### The Issue You're Experiencing

When you press **F5** to debug the extension, VS Code creates a **separate Extension Development Host** with:
- ❌ Fresh storage (no authentication data)
- ❌ Separate extension instance
- ❌ Default "Guest User" profile
- ❌ Duplicate registration errors

**This is expected behavior** - debug mode is isolated from your installed extension.

### Two Ways to Test

#### Option 1: Test Installed Extension (Recommended)
```bash
# Build and install the extension
cd /Users/Kranthi_1/duck-main/duck-code
npm run vsix:pro

# Install the .vsix file
code --install-extension bin/duckcode-pro.vsix

# Restart VS Code normally (not debug mode)
# Your authentication will persist
```

#### Option 2: Test in Debug Mode
If you need to debug, you'll need to sign up fresh each time because debug mode has isolated storage.

---

## Complete Authentication Flow Test

### Prerequisites
1. ✅ Backend running: `http://localhost:3001`
2. ✅ Frontend running: `http://localhost:5173`
3. ✅ Supabase running: `http://127.0.0.1:54321`

### Test Steps

#### 1. Fresh Signup Flow
```
1. Open VS Code (NOT debug mode)
2. Open DuckCode Pro sidebar
3. You should see "Authentication Required" screen
4. Click "Sign Up"
5. Browser opens → Fill form:
   - Full name: Your Name
   - Email: test@example.com
   - Password: password123
   - Confirm: password123
6. Click "Create account"
7. Browser redirects back to IDE
8. IDE shows your profile with real data
```

**Expected Result**:
- ✅ User created in Supabase
- ✅ Billing info initialized (free tier)
- ✅ IDE shows your name and email
- ✅ Profile tab shows your information
- ✅ Logout button visible

#### 2. Verify Profile Display
```
1. Click on Settings/Profile tab
2. Should see:
   - Your full name
   - Your email address
   - Subscription: Free
   - Logout button
```

#### 3. Test Logout
```
1. Click "Logout" button
2. IDE should return to "Authentication Required" screen
3. All chat history cleared
4. Profile reset to Guest User
```

#### 4. Test Login (Existing User)
```
1. Click "Sign In"
2. Browser opens → Enter credentials
3. Click "Sign in"
4. Browser redirects back to IDE
5. IDE shows your profile again
```

---

## Backend Logs to Verify

### Successful Signup
```
POST /api/auth/register 200 - User created
POST /api/auth/ide/authorize 200 - Auth code generated
POST /api/auth/ide/token 200 - Session token created
```

### Successful Login
```
POST /api/auth/login 200 - User authenticated
POST /api/auth/ide/authorize 200 - Auth code generated
POST /api/auth/ide/token 200 - Session token created
```

---

## Troubleshooting

### Issue: "Guest User" Still Showing After Signup

**Cause**: Running in debug mode (F5) or authentication didn't complete

**Solution**:
1. Check backend logs for errors
2. Verify browser redirected to `vscode://DuckCode.duck-code/auth/callback`
3. Check VS Code Developer Tools (Help → Toggle Developer Tools)
4. Look for errors in Console

### Issue: "View provider already registered"

**Cause**: Extension activated twice (debug mode + installed)

**Solution**:
1. Uninstall the production extension: `code --uninstall-extension DuckCode.duck-code-pro`
2. OR test only in debug mode (but you'll need to signup fresh each time)

### Issue: Authentication Works But Profile Not Updating

**Cause**: Webview not receiving auth state change event

**Solution**:
1. Check `DuckCodeCloudService` is emitting `auth-state-changed`
2. Check `AuthService` is listening for the event
3. Restart VS Code

---

## Verifying Data in Supabase

### Check User Created
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

-- View users
SELECT id, email, created_at FROM auth.users;

-- View user profiles
SELECT * FROM duckcode.user_profiles;

-- View billing info
SELECT * FROM duckcode.billing_info;

-- View IDE sessions
SELECT * FROM public.ide_sessions;
```

### Expected Data After Signup
```sql
-- auth.users table
id: uuid
email: test@example.com
created_at: timestamp

-- duckcode.user_profiles table
id: same uuid
email: test@example.com
full_name: Your Name
subscription_tier: free

-- duckcode.billing_info table
user_id: same uuid
subscription_tier: free
monthly_token_limit: 10000
current_tokens_used: 0

-- public.ide_sessions table
user_id: same uuid
session_token: jwt token
expires_at: now() + 7 days
```

---

## Production Deployment Checklist

### Before Deploying

- [ ] Test signup flow (fresh user)
- [ ] Test login flow (existing user)
- [ ] Test logout flow
- [ ] Verify profile displays correctly
- [ ] Test chat analytics sync
- [ ] Verify session persistence across restarts
- [ ] Test token expiry (7 days)
- [ ] Test multiple devices

### Environment Variables

**Backend (.env)**
```bash
JWT_SECRET=your_production_secret_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FRONTEND_URL=https://app.duckcode.ai
PORT=3001
```

**Frontend (.env)**
```bash
VITE_API_URL=https://api.duckcode.ai
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**IDE (.env.pro)**
```bash
DUCKCODE_EDITION=pro
SAAS_API_URL=https://api.duckcode.ai
SAAS_AUTH_URL=https://app.duckcode.ai
```

---

## Current Status

✅ **Completed**:
- Direct signup (no waitlist)
- Automatic IDE authorization
- JWT token authentication
- Billing schema fixed
- Session management (7-day expiry)

⏳ **Pending**:
- Real user profile display after auth
- Logout functionality in profile page
- Remove waitlist components from IDE
- Add SaaS dashboard for analytics

---

## Quick Test Command

```bash
# Terminal 1: Backend
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend
npm run dev

# Terminal 2: Frontend
cd /Users/Kranthi_1/duck-main/duckcode-observability/frontend
npm run dev

# Terminal 3: Build and install extension
cd /Users/Kranthi_1/duck-main/duck-code
npm run vsix:pro
code --install-extension bin/duckcode-pro.vsix

# Restart VS Code (not debug mode)
# Test signup flow
```

---

**Last Updated**: 2025-09-30  
**Status**: Authentication working, profile display needs verification
