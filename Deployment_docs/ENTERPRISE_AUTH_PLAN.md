# Enterprise Authentication Integration Plan

## Current State Analysis

### ✅ What's Working
1. **Backend Auth Routes** (`/api/auth/*`)
   - Registration with bcrypt password hashing
   - Login with JWT token generation (30-day expiry)
   - IDE OAuth flow with authorization codes
   - Token exchange endpoint for IDE sessions
   - Session management with 7-day expiry

2. **Supabase Integration**
   - Local Supabase instance configured
   - Multiple schema support (public, code_insights, duckcode)
   - User management via SupabaseUser model
   - Billing info tracking via SupabaseBilling model

3. **IDE OAuth Flow**
   - State parameter for CSRF protection
   - Authorization code generation
   - Token exchange with user data
   - Session token creation for IDE

### ❌ Issues to Fix

1. **Waitlist Blocking User Access**
   - RegisterPage uses `joinWaitlist()` instead of actual registration
   - IDERegisterPage also uses waitlist
   - Users can't actually sign up and use the product

2. **Disconnected Flows**
   - IDE signup redirects to waitlist page
   - No automatic IDE authorization after signup
   - Missing seamless experience

3. **Missing Features**
   - No real-time data sync from IDE to SaaS dashboard
   - No usage analytics display in SaaS
   - No session management UI
   - No audit logs

## Implementation Plan

### Phase 1: Remove Waitlist & Enable Direct Signup ✅
1. Update RegisterPage to use `/api/auth/register` endpoint
2. Update IDERegisterPage to register + auto-authorize IDE
3. Remove waitlist service and components
4. Update LoginPage for IDE OAuth flow

### Phase 2: Seamless IDE-SaaS Integration ✅
1. After signup, automatically authorize IDE
2. Redirect back to IDE with auth code
3. IDE exchanges code for session token
4. User authenticated in both IDE and SaaS

### Phase 3: Real-time Data Sync 🔄
1. IDE sends chat analytics to SaaS backend
2. SaaS dashboard displays user activity
3. Usage metrics, token consumption, costs
4. Session tracking across devices

### Phase 4: Enterprise Security Features 🔄
1. Session management UI (view/revoke sessions)
2. Audit log tracking (login, logout, API calls)
3. Two-factor authentication
4. IP whitelisting for enterprise teams
5. SSO integration (Google, Microsoft, GitHub)

### Phase 5: Team Collaboration 🔄
1. Organization/team management
2. Shared prompts and settings
3. Team analytics dashboard
4. Role-based access control

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Flow                            │
└─────────────────────────────────────────────────────────────┘

1. IDE Startup → AuthGuard → Not authenticated
2. IDE opens browser → http://localhost:5173/register
3. User fills form → POST /api/auth/register
4. Backend creates user → Returns JWT token
5. Frontend auto-calls → POST /api/auth/ide/authorize
6. Backend creates auth code → Returns code
7. Frontend redirects → vscode://DuckCode.duck-code/auth/callback?code=xxx
8. IDE receives callback → POST /api/auth/ide/token
9. Backend exchanges code → Returns session token + user data
10. IDE stores session → User authenticated ✅

┌─────────────────────────────────────────────────────────────┐
│                    Data Sync Flow                            │
└─────────────────────────────────────────────────────────────┘

IDE Activity → Chat Analytics Service → POST /api/chat-analytics/*
                                      ↓
                              Supabase (duckcode schema)
                                      ↓
                              SaaS Dashboard (Real-time display)

```

## Security Measures

1. **Authentication**
   - JWT tokens with 30-day expiry for web
   - Session tokens with 7-day expiry for IDE
   - Bcrypt password hashing (10 rounds)
   - CSRF protection via state parameter

2. **Authorization**
   - Bearer token authentication on all protected routes
   - User ID verification from JWT payload
   - Session validation before data access

3. **Data Protection**
   - HTTPS only in production
   - Secure cookie flags
   - SQL injection prevention (parameterized queries)
   - XSS protection (input sanitization)

4. **Audit & Monitoring**
   - All auth events logged
   - Failed login attempt tracking
   - Session creation/revocation logging
   - API usage metrics

## Database Schema

### Existing Tables
- `public.users` - User accounts
- `public.billing_info` - Subscription data
- `public.ide_auth_codes` - OAuth authorization codes
- `public.ide_sessions` - IDE session tokens
- `duckcode.conversation_analytics` - Chat analytics
- `duckcode.daily_conversation_stats` - Aggregated stats

### New Tables Needed
- `public.audit_logs` - Security event tracking
- `public.organizations` - Team/org management
- `public.organization_members` - Team membership
- `public.api_keys` - User API keys for programmatic access

## Next Steps

1. ✅ Remove waitlist functionality
2. ✅ Implement direct signup with auto-authorization
3. ✅ Test end-to-end IDE authentication flow
4. 🔄 Add SaaS dashboard for user analytics
5. 🔄 Implement session management UI
6. 🔄 Add audit logging
7. 🔄 Build team collaboration features

---

**Status**: Phase 1 in progress
**Target**: Enterprise-ready authentication like Cursor/Windsurf
