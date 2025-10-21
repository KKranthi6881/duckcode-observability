# 🔍 Role Selection Debugging Guide

## Problem: Not seeing role options in Send Invitation modal

---

## ✅ **Quick Fixes Applied**

1. **Added console logging** - Check browser console for "Loaded roles:"
2. **Removed is_default filter** - Shows all roles temporarily
3. **Added fallback message** - Shows warning if no roles found
4. **Better default selection** - Tries Member → Viewer → First role

---

## 🧪 **Step-by-Step Debugging**

### **Step 1: Check Browser Console**

```bash
1. Open http://localhost:5175/admin/invitations
2. Open browser DevTools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Click "Send Invitation" button
5. Look for: "Loaded roles: [...]"
```

**Expected Output:**
```javascript
Loaded roles: [
  { id: "...", name: "Admin", display_name: "Administrator", is_default: true, ... },
  { id: "...", name: "Member", display_name: "Member", is_default: true, ... },
  { id: "...", name: "Viewer", display_name: "Viewer", is_default: true, ... }
]
```

**If Empty Array `[]`:**
→ Roles not created. Need to reset database.

---

### **Step 2: Reset Database** (If Roles Empty)

The new migration that creates simplified roles needs to be applied:

```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability

# Reset database (applies all migrations)
npx supabase db reset
```

**This will:**
- ✅ Drop and recreate all tables
- ✅ Apply ALL migrations including the new one (20251015000004_update_simplified_roles.sql)
- ✅ Create default roles for existing organizations
- ⚠️ **WARNING:** This deletes all data!

---

### **Step 3: Verify Roles in Database**

```bash
# Connect to Supabase Studio
npx supabase studio

# Or check via SQL:
SELECT name, display_name, is_default, permissions 
FROM enterprise.organization_roles 
ORDER BY name;
```

**Expected Result:**
```
name   | display_name  | is_default | permissions
-------|---------------|------------|---------------------------
Admin  | Administrator | true       | ["*"]
Member | Member        | true       | ["metadata:read", ...]
Viewer | Viewer        | true       | ["metadata:read", "teams:read"]
```

---

### **Step 4: Re-register** (If Database Reset)

After `db reset`, you'll need to re-register:

```bash
1. Go to http://localhost:5175/register
2. Fill in:
   - Email: admin@example.com
   - Password: Test123!
   - Full Name: Admin User
   - Organization Name: Test Org
3. Click "Create Account"
4. Login
5. Go to /admin/invitations
6. Click "Send Invitation"
7. ✅ Should now see 3 role cards!
```

---

## 🎯 **What You Should See**

### **After Fix:**
```
┌─────────────────────────────────────┐
│  Assign Role                        │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ⃝  👁️  Viewer               │ │
│  │    Can view data and          │ │
│  │    analytics (read-only)      │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ◉  🔧  Member          ← SELECTED│ │
│  │    Can work with data and     │ │
│  │    run operations             │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ⃝  👑  Admin                 │ │
│  │    Full administrative        │ │
│  │    access and control         │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 🔍 **Common Issues**

### **Issue 1: Yellow Warning Box**
```
"No roles found. Please refresh the page or contact support."
```
**Cause:** Roles array is empty
**Fix:** Reset database (Step 2 above)

---

### **Issue 2: Roles Show But No Descriptions**
**Cause:** Role names don't match expected ("Admin", "Member", "Viewer")
**Fix:** Check role names in database
```sql
SELECT name FROM enterprise.organization_roles;
```

---

### **Issue 3: Console Shows Error**
```
Failed to load invitations: Error: ...
```
**Cause:** Backend or Supabase not running
**Fix:**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Supabase
cd ..
npx supabase start
```

---

## ✅ **Verification Checklist**

- [ ] Backend running on http://localhost:3001
- [ ] Frontend running on http://localhost:5175
- [ ] Supabase running (check `npx supabase status`)
- [ ] Database migrations applied (`db reset` or manual migration)
- [ ] User registered and logged in
- [ ] Browser console shows "Loaded roles: [...]" with 3 roles
- [ ] Send Invitation modal shows 3 role cards
- [ ] Can click and select each role card
- [ ] Selected role highlights in blue

---

## 🚀 **Quick Reset Script**

If you need to start fresh:

```bash
#!/bin/bash
# Reset everything

cd /Users/Kranthi_1/duck-main/duckcode-observability

# 1. Reset database
npx supabase db reset

# 2. Wait for it to finish
echo "Database reset complete!"

# 3. Open frontend
echo "Now go to http://localhost:5175/register"
echo "1. Register new account"
echo "2. Go to /admin/invitations"
echo "3. Click 'Send Invitation'"
echo "4. Should see 3 role cards! ✅"
```

---

**Let me know what you see in the console and we'll fix it!** 🔧
