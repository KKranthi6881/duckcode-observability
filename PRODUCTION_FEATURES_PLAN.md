# Production-Ready Enterprise Features Implementation Plan

## Overview
Complete implementation of 5 critical features for production-ready enterprise SaaS platform.

## Current Status ✅
- ✅ Database schema with enterprise tables
- ✅ Organization creation on signup
- ✅ 3 default roles (Admin, Member, Viewer)
- ✅ Invitation creation system
- ✅ RLS policies and permissions
- ✅ Rate limiting and security

---

## Feature 1: Email Notifications 📧

### Backend Implementation

#### 1.1 Email Service Setup
**File:** `backend/src/services/EmailService.ts`
```typescript
- Integration with Resend API (modern, reliable)
- Template system for different email types
- Queue system for failed sends
- Email logging and tracking
```

#### 1.2 Email Templates
**Files:** `backend/src/templates/emails/`
- `invitation.html` - Invitation email with accept link
- `invitation-reminder.html` - Reminder before expiry
- `welcome.html` - Welcome email after accepting
- `role-changed.html` - Notification when role changes
- `removed-from-org.html` - Notification when removed

#### 1.3 Backend Routes
**File:** `backend/src/routes/email.routes.ts`
```typescript
POST /api/invitations/:id/resend - Resend invitation email
POST /api/email/test - Test email configuration (admin only)
```

#### 1.4 Environment Variables
```env
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@duckcode.ai
EMAIL_REPLY_TO=support@duckcode.ai
FRONTEND_URL=http://localhost:5175
```

### Frontend Integration
- Add "Resend Invitation" button on invitations page
- Show email status (sent, pending, failed)
- Toast notifications for email actions

---

## Feature 2: Invitation Acceptance 🎫

### Database Changes

#### 2.1 Migration
**File:** `supabase/migrations/20251016000001_add_invitation_metadata.sql`
```sql
- Add email_sent_at timestamp
- Add email_status enum (pending, sent, failed, bounced)
- Add accepted_by_ip, accepted_user_agent columns
- Add invitation_metadata jsonb for tracking
```

### Backend Implementation

#### 2.2 Acceptance API
**File:** `backend/src/routes/invitations.routes.ts`
```typescript
GET /api/invitations/validate/:token - Validate invitation token
POST /api/invitations/accept - Accept invitation and create account
GET /api/invitations/:token/info - Get invitation details (public)
```

#### 2.3 Acceptance Controller
**File:** `backend/src/api/controllers/invitations.controller.ts`
```typescript
- validateInvitationToken() - Check token validity & expiry
- acceptInvitation() - Create user account, assign role
- getInvitationInfo() - Return org name, role, inviter info
- handleExpiredInvitation() - Mark as expired, notify admin
```

### Frontend Implementation

#### 2.4 Public Acceptance Page
**File:** `frontend/src/pages/public/AcceptInvitationPage.tsx`
```typescript
Components:
- InvitationHeader (org logo, name)
- InvitationDetails (role, inviter, expiry)
- AcceptanceForm (name, password, terms)
- ExpiryWarning (if < 24 hours remaining)
- ErrorStates (expired, invalid, already used)
```

#### 2.5 Routes
```typescript
/invite/:token - Public invitation acceptance page
/invite/:token/expired - Expired invitation page
/invite/:token/success - Success confirmation page
```

---

## Feature 3: Team Management 👥

### Database Schema

#### 3.1 Teams Table Enhancement
**File:** `supabase/migrations/20251016000002_enhance_teams.sql`
```sql
ALTER TABLE enterprise.teams ADD COLUMN:
- description TEXT
- avatar_url TEXT
- settings JSONB (email notifications, visibility)
- member_count INTEGER (cached)
- project_count INTEGER (cached)
```

#### 3.2 RLS Policies for Teams
```sql
- Members can view teams they belong to
- Admins can create/edit/delete teams
- Members can view team member list
```

### Backend Implementation

#### 3.3 Teams API
**File:** `backend/src/routes/teams.routes.ts`
```typescript
POST /api/organizations/:orgId/teams - Create team
GET /api/organizations/:orgId/teams - List teams
GET /api/teams/:id - Get team details
PATCH /api/teams/:id - Update team
DELETE /api/teams/:id - Delete team
POST /api/teams/:id/members - Add member to team
DELETE /api/teams/:id/members/:userId - Remove member
```

### Frontend Implementation

#### 3.4 Teams Page
**File:** `frontend/src/pages/admin/Teams.tsx`
```typescript
Components:
- TeamsList (grid view with cards)
- TeamCard (name, description, member count)
- CreateTeamModal (name, description, initial members)
- TeamDetailsModal (members, settings, actions)
- AddMembersModal (search and add members)
```

#### 3.5 Team Features
- Create teams with names and descriptions
- Add/remove members
- Assign team leads (special permission)
- View team activity
- Delete teams (admin only)

---

## Feature 4: Member Management 👤

### Backend Implementation

#### 4.1 Members API
**File:** `backend/src/routes/members.routes.ts`
```typescript
GET /api/organizations/:orgId/members - List all members
GET /api/members/:userId - Get member details
PATCH /api/members/:userId/role - Change member role
DELETE /api/members/:userId - Remove member from org
GET /api/members/:userId/activity - Get member activity log
POST /api/members/:userId/suspend - Suspend member access
POST /api/members/:userId/reactivate - Reactivate member
```

#### 4.2 Member Controller
**File:** `backend/src/api/controllers/members.controller.ts`
```typescript
- listMembers() - Paginated member list with filters
- getMemberDetails() - Full member info + teams + activity
- changeRole() - Update role with audit log
- removeMember() - Remove from org, clean up assignments
- suspendMember() - Temporary access suspension
- getMemberActivity() - Activity timeline
```

### Frontend Implementation

#### 4.3 Members Page
**File:** `frontend/src/pages/admin/Members.tsx`
```typescript
Components:
- MembersTable (sortable, filterable)
- MemberRow (avatar, name, email, role, teams, actions)
- RoleChangeModal (select new role, reason)
- RemoveMemberModal (confirmation, reassign tasks)
- MemberDetailsDrawer (profile, teams, activity)
- MemberFilters (role, team, status)
```

#### 4.4 Member Actions
- View member list with search/filter
- Change member roles (with confirmation)
- Remove members (with reassignment options)
- View member activity history
- Suspend/reactivate accounts
- Bulk actions (export, role changes)

---

## Feature 5: Role Permissions 🔐

### Permission Matrix

#### 5.1 Define Permissions
**File:** `backend/src/constants/permissions.ts`
```typescript
export const PERMISSIONS = {
  // Organization Management
  ORG_VIEW: 'org:view',
  ORG_EDIT: 'org:edit',
  ORG_DELETE: 'org:delete',
  ORG_BILLING: 'org:billing',
  
  // Member Management
  MEMBERS_VIEW: 'members:view',
  MEMBERS_INVITE: 'members:invite',
  MEMBERS_EDIT_ROLE: 'members:edit_role',
  MEMBERS_REMOVE: 'members:remove',
  
  // Team Management
  TEAMS_VIEW: 'teams:view',
  TEAMS_CREATE: 'teams:create',
  TEAMS_EDIT: 'teams:edit',
  TEAMS_DELETE: 'teams:delete',
  TEAMS_MANAGE_MEMBERS: 'teams:manage_members',
  
  // Data Access
  DATA_VIEW: 'data:view',
  DATA_CREATE: 'data:create',
  DATA_EDIT: 'data:edit',
  DATA_DELETE: 'data:delete',
  DATA_EXPORT: 'data:export',
  
  // Analytics
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_ADVANCED: 'analytics:advanced',
  
  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  SETTINGS_API_KEYS: 'settings:api_keys',
};

export const ROLE_PERMISSIONS = {
  Admin: Object.values(PERMISSIONS), // All permissions
  Member: [
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.MEMBERS_VIEW,
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE_MEMBERS,
    PERMISSIONS.DATA_VIEW,
    PERMISSIONS.DATA_CREATE,
    PERMISSIONS.DATA_EDIT,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
  ],
  Viewer: [
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.MEMBERS_VIEW,
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.DATA_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
};
```

### Backend Implementation

#### 5.2 Permission Middleware
**File:** `backend/src/middleware/permissions.ts`
```typescript
export const requirePermission = (permission: string) => {
  return async (req, res, next) => {
    const user = req.user;
    const userRole = await getUserRole(user.id, req.organizationId);
    const permissions = ROLE_PERMISSIONS[userRole];
    
    if (!permissions.includes(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Usage in routes:
router.delete(
  '/members/:id',
  requireAuth,
  requirePermission(PERMISSIONS.MEMBERS_REMOVE),
  membersController.removeMember
);
```

#### 5.3 Permission Helper Functions
**File:** `backend/src/utils/permissions.ts`
```typescript
- hasPermission(userId, orgId, permission)
- hasAnyPermission(userId, orgId, permissions[])
- hasAllPermissions(userId, orgId, permissions[])
- getUserPermissions(userId, orgId)
- canAccessResource(userId, resourceId, action)
```

### Frontend Implementation

#### 5.4 Permission Context
**File:** `frontend/src/contexts/PermissionsContext.tsx`
```typescript
export const PermissionsProvider = ({ children }) => {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<string>('');
  
  const hasPermission = (permission: string) => {
    return permissions.includes(permission);
  };
  
  const hasAnyPermission = (perms: string[]) => {
    return perms.some(p => permissions.includes(p));
  };
  
  return (
    <PermissionsContext.Provider value={{ permissions, role, hasPermission, hasAnyPermission }}>
      {children}
    </PermissionsContext.Provider>
  );
};
```

#### 5.5 Permission Components
**File:** `frontend/src/components/permissions/`
```typescript
// Show/hide based on permission
<RequirePermission permission="members:invite">
  <Button>Invite Member</Button>
</RequirePermission>

// Disable if no permission
<RequirePermission permission="members:remove" fallback="disabled">
  <Button>Remove Member</Button>
</RequirePermission>

// Show different UI based on role
<RoleSwitch
  admin={<AdminDashboard />}
  member={<MemberDashboard />}
  viewer={<ViewerDashboard />}
/>
```

---

## Database Migrations Summary

### Required Migrations
1. `20251016000001_add_invitation_metadata.sql` - Email tracking
2. `20251016000002_enhance_teams.sql` - Team enhancements
3. `20251016000003_add_member_status.sql` - Member suspension
4. `20251016000004_add_permissions_cache.sql` - Permission caching
5. `20251016000005_add_activity_log.sql` - Activity tracking

---

## Testing Checklist

### Email Notifications
- [ ] Invitation email sends successfully
- [ ] Email contains correct accept link
- [ ] Reminder emails send before expiry
- [ ] Failed emails retry automatically
- [ ] Email logs are created

### Invitation Acceptance
- [ ] Valid token loads invitation details
- [ ] Expired tokens show error message
- [ ] Accepting creates user account
- [ ] User assigned correct role
- [ ] Redirect to dashboard after acceptance

### Team Management
- [ ] Create team with members
- [ ] Add/remove team members
- [ ] Delete team reassigns members
- [ ] Team visibility respects RLS
- [ ] Member counts update correctly

### Member Management
- [ ] View all organization members
- [ ] Change member roles
- [ ] Remove members from organization
- [ ] Suspended members can't access
- [ ] Activity log tracks all actions

### Role Permissions
- [ ] Admin has all permissions
- [ ] Member has subset of permissions
- [ ] Viewer has read-only access
- [ ] Permission checks work on all routes
- [ ] UI hides/disables based on permissions

---

## Implementation Order

### Phase 1: Email & Invitations (Day 1-2)
1. Set up Resend API integration
2. Create email templates
3. Add email service to invitation creation
4. Build public acceptance page
5. Test complete invitation flow

### Phase 2: Teams & Members (Day 3-4)
1. Enhance teams database schema
2. Build teams management API
3. Create teams frontend UI
4. Build member management page
5. Add member action handlers

### Phase 3: Permissions (Day 5)
1. Define permission matrix
2. Implement permission middleware
3. Add permission checks to all routes
4. Create permission context for frontend
5. Update UI with permission controls

### Phase 4: Testing & Polish (Day 6)
1. Integration testing
2. Security audit
3. Performance optimization
4. Documentation
5. Production deployment

---

## Success Metrics

### Functionality
- ✅ 100% invitation acceptance rate
- ✅ < 5 second email delivery
- ✅ Zero permission bypass vulnerabilities
- ✅ < 100ms permission check latency

### User Experience
- ✅ Clear invitation emails
- ✅ Simple acceptance flow
- ✅ Intuitive team management
- ✅ Easy member administration
- ✅ Transparent permissions

### Security
- ✅ All actions audited
- ✅ RLS enforced everywhere
- ✅ Proper permission checks
- ✅ Rate limiting on sensitive actions
- ✅ Email verification required

---

## Next Steps

Ready to start implementation? Let me know which feature you'd like to begin with:

1. **Email Notifications** - Quick win, immediate value
2. **Invitation Acceptance** - Critical for onboarding
3. **Team Management** - Organize large organizations
4. **Member Management** - Essential admin tool
5. **Role Permissions** - Security foundation

Or proceed in the recommended order (Phase 1 → Phase 2 → Phase 3 → Phase 4)?
