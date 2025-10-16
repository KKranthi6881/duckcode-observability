# Phase 2 Completion Tasks - Systematic Execution Plan

**Architecture:** Frontend → Supabase JS → PostgreSQL (RLS) → RPC Functions

---

## ✅ **TASK 1: Verify & Fix Role Management**

### **1.1 Check RPC Functions Exist**
- [ ] `create_organization_role` function
- [ ] `update_organization_role` function
- [ ] `delete_organization_role` function
- [ ] `assign_user_role` function
- [ ] `revoke_user_role` function

### **1.2 Test Role CRUD**
- [ ] Create custom role
- [ ] Edit role name/description
- [ ] Delete custom role
- [ ] Assign role to user
- [ ] Revoke role from user
- [ ] Verify system roles (Admin, Member, Viewer) can't be deleted

### **1.3 Fix Issues**
- [ ] Add missing RPC functions if needed
- [ ] Fix RLS policies if operations fail
- [ ] Update frontend service if API mismatch
- [ ] Add proper error handling

---

## ✅ **TASK 2: Verify & Fix Team Management**

### **2.1 Test Team CRUD** 
- [ ] Create root team
- [ ] Create child team with parent
- [ ] Edit team name/description
- [ ] Delete team (test cascade behavior)
- [ ] List teams in hierarchy

### **2.2 Test Team Members**
- [ ] Add user to team
- [ ] Remove user from team
- [ ] Change user role in team
- [ ] List team members
- [ ] Verify team hierarchy shows correctly

### **2.3 Fix Issues**
- [ ] Fix RLS policies if needed
- [ ] Add cascade delete handling
- [ ] Fix parent team selection UI
- [ ] Add validation for team operations

---

## ✅ **TASK 3: Verify & Fix API Keys**

### **3.1 Check Encryption Service**
- [ ] Verify `encryptionService.ts` exists
- [ ] Test encryption/decryption works
- [ ] Verify proper encryption algorithm (AES-256-GCM)
- [ ] Check ENCRYPTION_KEY environment variable set

### **3.2 Test API Key Operations**
- [ ] Add OpenAI key
- [ ] Add Anthropic key
- [ ] Add Azure OpenAI key
- [ ] Add Google Gemini key
- [ ] Set default key per provider
- [ ] Delete API key
- [ ] Verify key is encrypted in database
- [ ] Verify key masking in UI

### **3.3 Fix Issues**
- [ ] Implement encryption if missing
- [ ] Add key validation
- [ ] Test key retrieval for actual use
- [ ] Add proper error messages

---

## ✅ **TASK 4: Build Invitation Acceptance Flow** 🔴 CRITICAL

### **4.1 Backend API** 
- [ ] ✅ Endpoint exists: `/api/enterprise/invitations/:token/accept`
- [ ] Test token validation
- [ ] Test user creation if new user
- [ ] Test user assignment to org/team/role
- [ ] Test invitation marked as accepted

### **4.2 Frontend Page**
- [ ] Create `/invite/:token` route
- [ ] Build `InvitationAcceptPage.tsx`
- [ ] Show invitation details (org, role, team)
- [ ] Allow user to set password if new
- [ ] Handle already registered users
- [ ] Redirect to login or dashboard after accept

### **4.3 Email/Token Flow**
- [ ] Generate invitation URL with token
- [ ] Display token in UI (for now, until email service added)
- [ ] Test full flow: Invite → Accept → Login → Dashboard
- [ ] Handle expired invitations
- [ ] Handle already accepted invitations

---

## ✅ **TASK 5: Verify & Fix User Management**

### **5.1 Test Member Operations**
- [ ] List all organization members
- [ ] Search members by name/email
- [ ] Filter members by role
- [ ] View member details (teams, roles)
- [ ] Remove member from organization
- [ ] Deactivate member

### **5.2 Fix Issues**
- [ ] Fix member listing query
- [ ] Add search/filter backend if needed
- [ ] Fix member removal (handle teams/roles)
- [ ] Add confirmation dialogs

---

## ✅ **TASK 6: Verify & Fix Invitations**

### **6.1 Test Invitation CRUD**
- [ ] Create invitation with email
- [ ] Assign role to invitee
- [ ] Assign team to invitee  
- [ ] List pending invitations
- [ ] Cancel invitation
- [ ] Test invitation expiration (7 days)

### **6.2 Fix Issues**
- [ ] Add invitation expiration check
- [ ] Prevent duplicate invitations
- [ ] Add resend invitation option
- [ ] Show invitation URL in UI

---

## ✅ **TASK 7: Verify & Fix Organization Settings**

### **7.1 Test Organization Updates**
- [ ] Update organization name
- [ ] Update display name
- [ ] Update max users
- [ ] Update settings JSON
- [ ] Verify only admins can update

### **7.2 Fix Issues**
- [ ] Add validation
- [ ] Add success/error messages
- [ ] Test RLS policies
- [ ] Add loading states

---

## ✅ **TASK 8: Test End-to-End Workflows**

### **8.1 Complete User Onboarding**
- [ ] Register → Org Created → Dashboard
- [ ] Create Teams → Add Members → Assign Roles
- [ ] Invite User → Accept → Login → Access Dashboard
- [ ] Add API Key → Verify Encrypted → Use in System

### **8.2 Admin Workflows**
- [ ] Admin creates custom role with permissions
- [ ] Admin creates team hierarchy (3 levels)
- [ ] Admin assigns users to teams
- [ ] Admin assigns roles to users
- [ ] Admin adds API keys for all providers
- [ ] Admin updates organization settings

### **8.3 Security Tests**
- [ ] Non-admin can't create roles
- [ ] Non-admin can't delete teams
- [ ] User can't see other orgs' data
- [ ] API keys are encrypted in database
- [ ] RLS policies prevent cross-org access

---

## ✅ **TASK 9: Polish & UX**

### **9.1 Loading States**
- [ ] Add loading spinners on all operations
- [ ] Disable buttons during operations
- [ ] Show loading skeletons for lists

### **9.2 Error Handling**
- [ ] Show user-friendly error messages
- [ ] Add retry mechanisms
- [ ] Log errors for debugging
- [ ] Add toast notifications

### **9.3 Validation**
- [ ] Client-side form validation
- [ ] Server-side validation
- [ ] Helpful validation messages
- [ ] Prevent duplicate submissions

### **9.4 Success Feedback**
- [ ] Success toasts for operations
- [ ] Auto-refresh lists after changes
- [ ] Optimistic UI updates
- [ ] Confirmation dialogs for destructive actions

---

## ✅ **TASK 10: Testing Checklist**

### **10.1 Functional Testing**
- [ ] All buttons work
- [ ] All forms submit
- [ ] All pages load
- [ ] No console errors
- [ ] No network errors

### **10.2 Security Testing**
- [ ] RLS policies enforced
- [ ] API keys encrypted
- [ ] Permissions checked
- [ ] Cross-org access blocked

### **10.3 Multi-user Testing**
- [ ] Test with 2 organizations
- [ ] Test with multiple users
- [ ] Test role permissions
- [ ] Test team access

---

## 📋 **EXECUTION ORDER**

### **Day 1: Core Verification**
1. Verify API key encryption (CRITICAL)
2. Test team CRUD operations
3. Test role CRUD operations
4. Fix any broken operations

### **Day 2: Critical Features**
1. Build invitation acceptance page
2. Test full invitation flow
3. Test user management operations
4. Fix member operations

### **Day 3: Polish & Testing**
1. Add loading states and error handling
2. End-to-end workflow testing
3. Security testing
4. Multi-user testing

---

## 🎯 **DEFINITION OF DONE**

✅ All CRUD operations work (create, read, update, delete)
✅ Invitation flow complete (invite → accept → login → dashboard)
✅ API keys encrypted and functional
✅ RLS policies enforced
✅ Error handling on all operations
✅ Loading states on all operations
✅ No console errors
✅ Multi-user tested
✅ Security verified

---

**Let's start with Task 1: Verify Role Management!**
