# Clean Reset and Fresh Registration Guide

## ✅ Why This Approach is Best

After fixing the duplicate organization issue, a clean reset ensures:
- No leftover duplicate organizations
- Fresh user accounts with correct organization structure
- Clean API key setup
- Proper organization_id storage in IDE

---

## 🔄 Step-by-Step Clean Reset Process

### Step 1: Stop All Services

```bash
# Stop backend if running
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend
# Press Ctrl+C or:
pkill -f "node.*duckcode-observability"

# Stop frontend if running  
cd /Users/Kranthi_1/duck-main/duckcode-observability/frontend
# Press Ctrl+C or:
pkill -f "vite.*5173"
```

### Step 2: Reset Supabase Database

```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/supabase

# This will:
# - Drop all tables
# - Re-run all migrations (including the duplicate org fix)
# - Start with a clean slate
supabase db reset
```

**Expected output**: Should see all migrations applying successfully, including:
```
Applying migration 20251016000010_prevent_duplicate_organizations.sql...
Applying migration 20251017000001_cleanup_duplicate_organizations.sql... ✅
```

### Step 3: Verify Backend Changes Are In Place

```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend/src/models

# Check that SupabaseUser.ts has the fix (no manual org creation)
grep -A 5 "Profile will be automatically created by database trigger" SupabaseUser.ts
```

**Expected**: Should see comments about relying on database trigger, NOT manual org creation.

### Step 4: Start Backend

```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend
npm run dev

# Wait for:
# ✓ Server listening on port 3001
```

### Step 5: Start Frontend

```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/frontend
npm run dev

# Wait for:
# ✓ Local: http://localhost:5173/
```

### Step 6: Sign Out of IDE (If Logged In)

```bash
# In VS Code:
# 1. Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
# 2. Type: "DuckCode: Sign Out"
# 3. Confirm sign out
```

---

## 🆕 Fresh Registration Process

### Option 1: Register via Web (Recommended for Testing)

1. **Open Registration Page**:
   ```
   http://localhost:5173/register
   ```

2. **Fill in Registration Form**:
   - **Full Name**: Your Name
   - **Organization Name**: Your Company (e.g., "Acme Corporation")
   - **Email**: your@email.com
   - **Password**: SecurePass123! (meet requirements)

3. **Submit Registration**

4. **Verify Success**:
   - Should redirect to admin panel
   - Should see "Welcome! Your organization has been created."

### Option 2: Register via IDE

1. **Open DuckCode in VS Code**

2. **Click "Sign In" button** in the extension

3. **Click "Sign Up"** on the login page

4. **Fill in Form**:
   - **Full Name**: Your Name
   - **Email**: your@email.com  
   - **Password**: SecurePass123!

5. **Verify Success**:
   - Browser should redirect back to IDE
   - IDE should show "Sign In Successful"
   - Should see your name in IDE

---

## ✅ Verification Steps

### 1. Check Database - Should Have ONE Organization

```sql
-- Connect to your database
psql <your-connection-string>

-- Check user has exactly ONE organization
SELECT 
  u.email,
  COUNT(DISTINCT uor.organization_id) as org_count,
  o.name as org_name,
  o.display_name,
  r.name as role
FROM auth.users u
JOIN enterprise.user_organization_roles uor ON uor.user_id = u.id
JOIN enterprise.organizations o ON o.id = uor.organization_id
LEFT JOIN enterprise.organization_roles r ON r.id = uor.role_id
WHERE u.email = 'your@email.com'
GROUP BY u.email, o.name, o.display_name, r.name;
```

**Expected Result**:
```
    email        | org_count |  org_name   | display_name    | role
-----------------+-----------+-------------+-----------------+-------
 your@email.com  |     1     | your_org    | Acme Corporation| Admin
```

✅ **org_count = 1** (not 2!)

### 2. Check Profile Organization ID

```sql
SELECT 
  up.id,
  u.email,
  up.organization_id,
  o.display_name
FROM duckcode.user_profiles up
JOIN auth.users u ON u.id = up.id
JOIN enterprise.organizations o ON o.id = up.organization_id
WHERE u.email = 'your@email.com';
```

**Expected**: organization_id should be populated with a UUID

### 3. Test in IDE (If Registered via IDE)

- Check bottom-right of VS Code
- Should show your email/name
- Click on it to see profile info

---

## 🔑 Add API Key (For Sync Testing)

### Via Admin Panel UI (Easiest)

1. **Navigate to Admin Panel**:
   ```
   http://localhost:5173/admin
   ```

2. **Go to API Keys Section**:
   - Look for "Organization Settings" or "API Keys" menu item

3. **Add OpenAI API Key**:
   - Click "Add API Key"
   - Provider: OpenAI
   - Key Name: "Default OpenAI Key"
   - API Key: `sk-...` (your actual key)
   - ✅ **Check "Set as Default"**
   - Status: Active
   - Click "Save"

### Via Database (Alternative)

```sql
-- First, get your organization ID
SELECT id FROM enterprise.organizations 
WHERE name IN (
  SELECT o.name 
  FROM enterprise.user_organization_roles uor
  JOIN enterprise.organizations o ON o.id = uor.organization_id
  WHERE uor.user_id = (SELECT id FROM auth.users WHERE email = 'your@email.com')
);

-- Then insert the API key (you'll need to encrypt it properly)
-- OR use the admin panel UI (recommended)
```

---

## 🧪 Test API Key Sync in IDE

1. **Open VS Code with DuckCode extension**

2. **Go to Settings**:
   - Click settings icon in extension
   - Navigate to OpenAI provider

3. **Click "🔑 Sync Organization API Key"**

4. **Expected Result**:
   - Status: "🔄 Syncing..."
   - Then: "✅ Organization API key synced successfully!"
   - API Key field should populate with: `sk-...` (masked)

5. **If Error Occurs**:
   - Check backend logs for specific error
   - Verify API key is marked as `is_default=true` in database
   - Try signing out and back in to refresh organization_id

---

## 🎯 Success Checklist

After clean reset and registration:

- [ ] Database reset completed without errors
- [ ] All migrations applied successfully (including duplicate org fix)
- [ ] Backend started successfully (port 3001)
- [ ] Frontend started successfully (port 5173)
- [ ] New user registered successfully
- [ ] User has exactly ONE organization (verified in database)
- [ ] User has Admin role in that organization
- [ ] Profile has organization_id populated
- [ ] API key added in admin panel with `is_default=true`
- [ ] IDE can sync organization API key successfully
- [ ] API key field populates when "Sync" is clicked

---

## 🐛 Troubleshooting

### Migration Error During Reset

If you see errors during `supabase db reset`:

```bash
# Check the specific migration that failed
# Fix the SQL syntax error (we already fixed the ARRAY_AGG issue)
# Then run reset again
supabase db reset
```

### Backend Won't Start

```bash
# Check if port is in use
lsof -ti:3001 | xargs kill -9

# Check environment variables
cd backend
cat .env | grep -E "(DATABASE_URL|JWT_SECRET)"

# Restart
npm run dev
```

### Registration Fails with "User already exists"

```bash
# You may have a leftover user from before reset
# Either:
# 1. Use a different email
# 2. Or reset database again to clear everything
cd supabase
supabase db reset
```

### API Key Sync Still Fails

```bash
# 1. Check organization_id is stored in IDE
# In VS Code → Help → Toggle Developer Tools → Console:
await vscode.globalState.get('duckcode.organizationId')

# 2. If null or wrong, sign out and back in
# Command Palette → DuckCode: Sign Out → Sign In again

# 3. Check backend logs when clicking sync
# Should see organization_id in API call
```

---

## 📝 Summary

**Clean Reset Flow**:
```
1. Stop services
2. supabase db reset (with fixed migrations)
3. Start backend + frontend
4. Register new account
5. Verify ONE organization created
6. Add API key (mark as default)
7. Test sync in IDE
```

**Key Points**:
- ✅ Fixed backend code (no manual org creation)
- ✅ Fixed migration (no duplicate orgs)
- ✅ Clean database state
- ✅ Proper organization_id flow
- ✅ API key sync working

---

## 🚀 Ready to Start Fresh!

You now have:
1. Fixed duplicate organization code
2. Fixed database migration
3. Clean reset procedure
4. Complete verification steps

Just run through the steps above and you'll have a clean, working setup with proper API key sync! 🎉
