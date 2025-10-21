# 🧪 Complete SaaS-First Testing Guide

## ✅ Pre-Flight Checklist

- [x] Database reset to clean state
- [x] Auth bypasses removed
- [x] Mock data removed
- [x] Password guidelines added
- [x] Backend running on http://localhost:3001
- [x] Frontend running on http://localhost:5175
- [x] Supabase running (check: `supabase status`)

---

## 🎯 TEST 1: User Registration with Password Guidelines

### **Step 1: Open Registration Page**
```
URL: http://localhost:5175/register
```

### **Step 2: Fill in the Form**

**Test Case 1: Weak Password (Should Fail)**
- Full Name: `Test Admin`
- Email: `admin@example.com`
- Password: `test123` ❌
- Confirm Password: `test123`

**Expected:** 
- Red border on password field
- All checkmarks should be gray circles (○)
- Cannot submit (frontend validation)

**Test Case 2: Medium Password (Should Fail)**
- Password: `TestUser99` ❌ (missing special char)

**Expected:**
- 4 green checkmarks ✓
- 1 gray circle ○ (special character missing)
- Frontend blocks submission

**Test Case 3: Strong Password (Should Pass)**
- Full Name: `Test Admin`
- Email: `admin@example.com`
- Password: `TestAdmin123!` ✅
- Confirm Password: `TestAdmin123!`

**Expected:**
- All 5 checkmarks turn green ✓
- No red border
- Form submits successfully

### **Step 3: Watch Backend Logs**

When you submit, you should see:
```
Creating user with standard Supabase Auth: admin@example.com
User created successfully: [uuid]
Organization created: [uuid]
User assigned as admin
```

### **Step 4: Verify Response**

**Success Response:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "fullName": "Test Admin"
  }
}
```

### **Step 5: Verify Database**

Open Supabase Studio: `http://localhost:54323`

**Check these tables:**

1. **auth.users**
   ```sql
   SELECT id, email, created_at FROM auth.users;
   ```
   Should show: `admin@example.com`

2. **enterprise.organizations**
   ```sql
   SELECT * FROM enterprise.organizations;
   ```
   Should show: `test_admin_org` with plan_type='trial'

3. **enterprise.organization_roles_definitions**
   ```sql
   SELECT name, permissions FROM enterprise.organization_roles_definitions;
   ```
   Should show: Admin, Member, Viewer roles

4. **enterprise.organization_roles**
   ```sql
   SELECT user_id, role_id FROM enterprise.organization_roles;
   ```
   Should show: User assigned to Admin role

---

## 🎯 TEST 2: Login to Admin Portal

### **Step 1: Navigate to Login**
```
URL: http://localhost:5175/login
```

### **Step 2: Sign In**
- Email: `admin@example.com`
- Password: `TestAdmin123!`
- Click "Sign In"

### **Expected Result**
```
✅ Login successful
✅ Redirects to /admin
✅ Shows organization dashboard
✅ Email in sidebar: admin@example.com
✅ Organization name shown
```

### **Step 3: Navigate Admin Pages**

Test each page loads without errors:
```
✅ /admin → Dashboard
✅ /admin/teams → Teams (empty state)
✅ /admin/members → Members (shows you)
✅ /admin/roles → Roles (Admin, Member, Viewer)
✅ /admin/api-keys → API Keys (empty)
✅ /admin/invitations → Invitations (empty)
✅ /admin/settings → Organization Settings
```

---

## 🎯 TEST 3: Create API Key

### **Step 1: Go to API Keys Page**
```
URL: http://localhost:5175/admin/api-keys
```

### **Step 2: Click "Add API Key"**

Fill in the modal:
- **Provider**: OpenAI
- **Key Name**: Production Key
- **API Key**: `sk-test1234567890abcdefghijklmnop` (fake key)
- **Set as default**: ✓

### **Step 3: Submit**

**Expected:**
```
✅ Key encrypted with AES-256-GCM
✅ Stored in database (encrypted)
✅ Displayed masked: sk-test123••••••••••••••••mnop
✅ Status: active
```

### **Verify in Database:**
```sql
SELECT 
  key_name,
  provider,
  status,
  is_default,
  masked_key,
  LENGTH(encrypted_key) as key_length
FROM enterprise.organization_api_keys;
```

Should show:
- masked_key: `sk-test123••••••••••••••••mnop`
- encrypted_key: Long base64 string
- status: active

---

## 🎯 TEST 4: Send Team Invitation

### **Step 1: Go to Members Page**
```
URL: http://localhost:5175/admin/members
```

### **Step 2: Click "Invite Members"**

Fill in the form:
- **Emails**: `developer@example.com, designer@example.com`
- **Role**: Member
- **Message**: "Welcome to the team!"

### **Step 3: Send Invitations**

**Expected:**
```
✅ 2 invitations created
✅ Invitation tokens generated
✅ Console log: "Email sending not yet implemented"
✅ Status: pending
```

### **Verify in Database:**
```sql
SELECT 
  email,
  status,
  expires_at,
  invitation_token
FROM enterprise.organization_invitations;
```

Should show:
- 2 rows (developer@example.com, designer@example.com)
- status: pending
- expires_at: 7 days from now
- invitation_token: Random UUID

---

## 🎯 TEST 5: Password Requirements Edge Cases

### **Test Invalid Passwords:**

| Password | Issue | Expected |
|----------|-------|----------|
| `Test123!` | Too short (8 chars) | ❌ Red border, "12 characters" not checked |
| `testadmin123!` | No uppercase | ❌ "One uppercase letter" not checked |
| `TESTADMIN123!` | No lowercase | ❌ "One lowercase letter" not checked |
| `TestAdmin!` | No number | ❌ "One number" not checked |
| `TestAdmin123` | No special char | ❌ "One special character" not checked |
| `password123!` | Common password | ❌ Backend rejects (even if frontend passes) |

### **Test Valid Passwords:**

| Password | Status |
|----------|--------|
| `TestAdmin123!` | ✅ All requirements met |
| `MySecurePass99@` | ✅ All requirements met |
| `HelloWorld2024#` | ✅ All requirements met |
| `Admin#Password$123` | ✅ Extra characters OK |

---

## 🎯 TEST 6: Organization Features

### **View Organization Settings**

1. Go to: `http://localhost:5175/admin/settings`
2. Should see:
   - Organization name
   - Plan type (Trial)
   - Max users (10)
   - Status (Active)

### **Check Organization Members**

1. Go to: `http://localhost:5175/admin/members`
2. Should see:
   - You listed as "Admin"
   - Email: admin@example.com
   - Joined date

### **View Roles & Permissions**

1. Go to: `http://localhost:5175/admin/roles`
2. Should see 3 default roles:
   - **Admin**: All permissions (36 total)
   - **Member**: Limited permissions
   - **Viewer**: Read-only permissions

---

## 🚨 Common Issues & Solutions

### Issue 1: "Password does not meet requirements"
**Solution:** Check all 5 requirements are met:
- 12+ characters
- Upper + lowercase letters
- Number
- Special character

### Issue 2: "User already exists"
**Solution:** 
```bash
# Reset database
cd supabase
supabase db reset
```

### Issue 3: Backend not responding
**Solution:**
```bash
# Check if backend is running
lsof -i:3001

# Restart backend
cd backend
npm run dev
```

### Issue 4: "Could not load organizations"
**Solution:**
- Check backend logs for errors
- Verify user is assigned to organization
- Check RLS policies are enabled

### Issue 5: Frontend shows "Loading..." forever
**Solution:**
- Open browser DevTools → Console
- Check for errors
- Verify auth token exists (Application → Cookies)
- Try logging out and back in

---

## ✅ Success Criteria

After completing all tests, you should have:

- [x] Successfully registered with strong password
- [x] Organization auto-created (`test_admin_org`)
- [x] User assigned as Admin
- [x] Can access all 8 admin pages
- [x] Can see organization data (not mock data)
- [x] Can create API keys (encrypted)
- [x] Can send invitations
- [x] All password requirements working
- [x] No console errors
- [x] No authentication failures

---

## 📊 Database State After Tests

You should have:

**Users Table:**
- 1 user (admin@example.com)

**Organizations:**
- 1 organization (test_admin_org)

**Roles:**
- 3 role definitions (Admin, Member, Viewer)
- 1 role assignment (you as Admin)

**Invitations:**
- 2 pending invitations (if you tested invitations)

**API Keys:**
- 1 encrypted API key (if you tested API keys)

---

## 🎉 Next Steps

Once all tests pass:

1. **Test IDE OAuth Flow** (when implemented)
2. **Add Email Service** (SendGrid/AWS SES)
3. **Test Team Member Acceptance**
4. **Add Toast Notifications**
5. **Production Deployment**

---

## 📝 Test Report Template

```markdown
# Test Report - [Date]

## Environment
- Backend: ✅ Running
- Frontend: ✅ Running  
- Database: ✅ Clean state

## Test Results

### Registration
- [ ] Weak password blocked
- [ ] Strong password accepted
- [ ] Organization auto-created
- [ ] User assigned as admin

### Admin Portal
- [ ] Login successful
- [ ] All 8 pages load
- [ ] Organization data shown
- [ ] No mock data

### API Keys
- [ ] Can create key
- [ ] Key encrypted
- [ ] Key masked properly

### Invitations
- [ ] Can send invitations
- [ ] Tokens generated
- [ ] Status: pending

## Issues Found
[List any issues]

## Notes
[Any additional observations]
```

---

**Ready to test?** Start with TEST 1 and work through each section! 🚀
