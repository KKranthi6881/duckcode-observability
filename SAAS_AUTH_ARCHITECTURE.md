# SaaS-First Authentication Architecture

## 🎯 Overview

DuckCode now uses a **SaaS-First authentication model** where users register on the web platform first, and the IDE authenticates via OAuth to sync with their account.

---

## 🏢 Registration Flow

### **Admin Registration (Primary Entry Point)**

```
1. User visits duckcode-observability.com
   ↓
2. Clicks "Sign Up" → Enters details
   - Email
   - Password (min 8 chars)
   - Full Name
   ↓
3. Backend creates:
   ✅ Supabase Auth user (auth.users)
   ✅ User profile (public.profiles)
   ✅ Organization (enterprise.organizations)
   ✅ Default roles (Admin, Member, Viewer)
   ✅ User assigned as Admin
   ↓
4. User lands on Admin Portal Dashboard
   - Can configure organization
   - Can create teams
   - Can invite members
   - Can add API keys
```

### **Team Member Registration (Via Invitation)**

```
1. Admin invites team member
   ↓
2. Member receives email with invitation link
   ↓
3. Clicks link → /invite/{token}
   ↓
4. Completes registration (password only, email pre-filled)
   ↓
5. Backend:
   ✅ Creates Supabase Auth user
   ✅ Assigns to organization
   ✅ Assigns pre-defined role
   ✅ Adds to specified teams
   ✅ Marks invitation as accepted
   ↓
6. User lands on Dashboard
   - Sees organization they joined
   - Has assigned role & permissions
   - Can download IDE extension
```

---

## 🔐 Authentication Architecture

### **Primary Auth: Supabase Auth (Public Schema)**

```
auth.users                    (Supabase managed)
  ↓
public.profiles              (Auto-created by trigger)
  ↓
enterprise.organization_roles (User → Org → Role mapping)
  ↓
enterprise.organization_roles_definitions (Role → Permissions)
```

### **Database Schema Usage**

| Schema | Purpose | Used For |
|--------|---------|----------|
| `public` | Standard Supabase | Auth users, profiles |
| `enterprise` | Multi-tenant features | Orgs, teams, roles, API keys |
| `duckcode` | IDE analytics | Chat sessions, usage tracking (optional) |

---

## 🔄 IDE Authentication (OAuth Flow)

### **Step 1: User Clicks "Sign In" in IDE**
```typescript
// IDE Extension
vscode.commands.registerCommand('duckcode.signIn', () => {
  // Opens browser to duckcode-observability.com/ide/auth
  vscode.env.openExternal(authUrl);
});
```

### **Step 2: User Authenticates on Website**
```
Browser opens: duckcode-observability.com/ide/auth
  ↓
User logs in (or registers if new)
  ↓
Website generates authorization code
  ↓
Redirects to: vscode://duckcode/auth/callback?code=xyz123
```

### **Step 3: IDE Exchanges Code for Token**
```typescript
// IDE receives callback
POST /api/auth/ide/token
{
  code: "xyz123",
  grant_type: "authorization_code"
}

// Backend validates code, returns token
{
  access_token: "jwt_token_here",
  user: { id, email, fullName },
  organizations: [
    { id, name, role, permissions }
  ]
}
```

### **Step 4: IDE Stores Token & Syncs**
```typescript
// IDE stores token
context.secrets.store('duckcode_token', token);

// IDE fetches user data
GET /api/enterprise/user/organizations
Authorization: Bearer {token}

// IDE fetches organization API keys
GET /api/enterprise/api-keys/{orgId}
Authorization: Bearer {token}

// IDE is ready - uses org API keys for LLM calls
```

---

## 📝 Key Changes from Old Architecture

### **Old (IDE-First)**
❌ Users registered directly in IDE  
❌ Used `duckcode.user_profiles` table  
❌ No organization concept  
❌ Each user had their own API keys  
❌ No team management  

### **New (SaaS-First)**
✅ Users register on website  
✅ Uses standard `auth.users` + `public.profiles`  
✅ Multi-tenant organizations  
✅ Shared organization API keys  
✅ Full team & role management  
✅ IDE syncs with organization settings  

---

## 🛠️ Implementation Details

### **Backend Changes**

#### **SupabaseUser Model** (`backend/src/models/SupabaseUser.ts`)
```typescript
// OLD
import { supabaseDuckCode } from '../config/supabaseClient';
const { data } = await supabaseDuckCode.from('user_profiles')...

// NEW
import { supabase, supabaseEnterprise } from '../config/supabase';
const { data } = await supabase.auth.admin.createUser(...);
```

**Key Methods Updated:**
- `create()` - Now uses Supabase Auth + auto-creates organization
- `findByEmail()` - Queries auth.users via admin API
- `findById()` - Gets user from auth + profile from public.profiles
- `verifyPassword()` - Uses standard Supabase signInWithPassword

#### **Auto-Create Organization on Registration**
```typescript
// When user registers:
1. Create Supabase Auth user
2. Create organization (enterprise.organizations)
3. Create default roles (Admin, Member, Viewer)
4. Assign user as Admin
```

### **Frontend Changes**

#### **Registration Page** (`frontend/src/features/auth/components/RegisterPage.tsx`)
- No changes needed - already uses standard endpoints
- Sends to: `POST /api/auth/register`

#### **Admin Portal**
- Auto-loads user's organizations
- Shows organization selector
- Displays user's role & permissions

---

## 🧪 Testing the New Flow

### **Test 1: New User Registration**
```bash
# 1. Register new user
POST http://localhost:3001/api/auth/register
{
  "email": "admin@example.com",
  "password": "Password123!",
  "fullName": "Admin User"
}

# Expected:
✅ User created in auth.users
✅ Profile created in public.profiles
✅ Organization auto-created
✅ User assigned as Admin
✅ Returns JWT token

# 2. Access Admin Portal
GET http://localhost:5175/admin
Authorization: Bearer {token}

# Expected:
✅ Shows organization dashboard
✅ Can create teams
✅ Can invite members
✅ Can add API keys
```

### **Test 2: Team Member Invitation**
```bash
# 1. Admin sends invitation
POST http://localhost:3001/api/enterprise/invitations
{
  "organization_id": "org-id",
  "emails": ["member@example.com"],
  "role_id": "member-role-id"
}

# Expected:
✅ Invitation created
✅ Token generated
✅ Email sent (when email service configured)

# 2. Member accepts invitation
POST http://localhost:3001/api/auth/register-with-invitation
{
  "token": "invitation-token",
  "password": "Password123!"
}

# Expected:
✅ User created
✅ Assigned to organization
✅ Assigned specified role
✅ Invitation marked as accepted
```

### **Test 3: IDE Authentication**
```bash
# 1. IDE requests auth (opens browser)
https://duckcode-observability.com/ide/auth

# 2. User logs in on website
# 3. Website redirects with code
vscode://duckcode/auth/callback?code=abc123

# 4. IDE exchanges code for token
POST http://localhost:3001/api/auth/ide/token
{
  "code": "abc123",
  "grant_type": "authorization_code"
}

# Expected:
✅ Valid JWT token returned
✅ User organizations returned
✅ User permissions returned
```

---

## 🔧 Configuration Required

### **Environment Variables**
```bash
# Standard Supabase (required)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret

# Encryption for API keys (required)
ENCRYPTION_KEY=your-32-byte-hex-string

# Email service (optional for now)
# SENDGRID_API_KEY=your-key
# EMAIL_FROM=noreply@duckcode.com
```

### **Database Migrations**
All enterprise schema migrations must be applied:
```bash
cd supabase
supabase db reset  # Applies all migrations
```

---

## 📋 Migration Checklist

If migrating from old IDE-first auth:

- [ ] Update `SupabaseUser` model to use standard Supabase Auth
- [ ] Update `SupabaseBilling` if needed (optional)
- [ ] Remove auth bypass in `ProtectedRoute.tsx`
- [ ] Remove mock organization in `AdminLayout.tsx`
- [ ] Test registration creates organization
- [ ] Test invitation flow
- [ ] Test IDE OAuth flow
- [ ] Update any hardcoded references to `duckcode.user_profiles`

---

## 🚀 Benefits

### **For Admins**
✅ Full control from web dashboard  
✅ Easy team management  
✅ Clear billing & subscription management  
✅ Professional onboarding experience  

### **For Team Members**
✅ Clear invitation with context  
✅ Smooth onboarding  
✅ IDE inherits organization settings  
✅ Shared API keys (no individual setup)  

### **For Business**
✅ Enterprise-grade multi-tenancy  
✅ Better upsell opportunities  
✅ Clearer analytics & metrics  
✅ Professional brand image  
✅ Scalable architecture  

---

## 📞 Support

For issues with authentication:
1. Check Supabase is running: `supabase status`
2. Verify environment variables are set
3. Check backend logs for detailed errors
4. Ensure all migrations are applied

---

**Status**: ✅ Implemented  
**Last Updated**: October 15, 2025  
**Version**: 2.0 (SaaS-First)
