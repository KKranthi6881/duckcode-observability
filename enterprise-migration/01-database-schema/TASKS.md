# Phase 1: Database Schema - Task List

## 🎯 Task Breakdown

### 1. Schema Preparation
- [ ] Create `enterprise` schema in Supabase
- [ ] Review OpenMetadata TeamRepository.java for reference patterns
- [ ] Design ER diagram for team hierarchy
- [ ] Document permission matrix (roles vs actions)

### 2. Core Table Creation

#### 2.1 Organizations Table
- [ ] Write migration SQL for `enterprise.organizations`
- [ ] Add indexes (name, domain, status)
- [ ] Create enum type for `plan_type`
- [ ] Create enum type for `status`
- [ ] Add validation constraints (name length, domain format)
- [ ] Test table creation locally

#### 2.2 Teams Table
- [ ] Write migration SQL for `enterprise.teams`
- [ ] Add indexes (organization_id, parent_team_id, team_type)
- [ ] Create enum type for `team_type`
- [ ] Add recursive CTE support for hierarchy queries
- [ ] Add unique constraint on (organization_id, name)
- [ ] Test table creation locally

#### 2.3 Team Members Table
- [ ] Write migration SQL for `enterprise.team_members`
- [ ] Add indexes (team_id, user_id)
- [ ] Create enum type for `role`
- [ ] Add unique constraint on (team_id, user_id)
- [ ] Test table creation locally

#### 2.4 Organization API Keys Table
- [ ] Write migration SQL for `enterprise.organization_api_keys`
- [ ] Add indexes (organization_id, provider, status)
- [ ] Create enum type for `provider`
- [ ] Create enum type for `status`
- [ ] Implement encryption helpers (encrypt/decrypt functions)
- [ ] Add validation for API key format
- [ ] Test table creation locally

#### 2.5 Organization Roles Table
- [ ] Write migration SQL for `enterprise.organization_roles`
- [ ] Add indexes (organization_id, name)
- [ ] Define default roles (Admin, Member, Viewer)
- [ ] Create JSONB schema for permissions array
- [ ] Test table creation locally

#### 2.6 User Organization Roles Table
- [ ] Write migration SQL for `enterprise.user_organization_roles`
- [ ] Add indexes (user_id, organization_id, role_id)
- [ ] Add unique constraint on (user_id, organization_id, role_id)
- [ ] Test table creation locally

#### 2.7 Organization Invitations Table
- [ ] Write migration SQL for `enterprise.organization_invitations`
- [ ] Add indexes (organization_id, email, invitation_token, status)
- [ ] Create enum type for `status`
- [ ] Add expiration logic (default 7 days)
- [ ] Add trigger to update status on expiry
- [ ] Test table creation locally

### 3. Helper Functions

#### 3.1 Organization Functions
- [ ] Create `get_user_organizations(user_id uuid)`
- [ ] Create `is_organization_admin(user_id uuid, org_id uuid)`
- [ ] Create `get_organization_members(org_id uuid)`
- [ ] Create `get_organization_api_keys(org_id uuid)`

#### 3.2 Team Functions
- [ ] Create `get_user_teams(user_id uuid)`
- [ ] Create `is_team_admin(user_id uuid, team_id uuid)`
- [ ] Create `get_team_hierarchy(team_id uuid)` -- recursive
- [ ] Create `get_team_members(team_id uuid)`
- [ ] Create `get_all_child_teams(team_id uuid)` -- recursive

#### 3.3 Permission Functions
- [ ] Create `check_permission(user_id uuid, org_id uuid, permission text)`
- [ ] Create `get_user_permissions(user_id uuid, org_id uuid)`

### 4. Row-Level Security (RLS)

#### 4.1 Enable RLS on Tables
- [ ] Enable RLS on `enterprise.organizations`
- [ ] Enable RLS on `enterprise.teams`
- [ ] Enable RLS on `enterprise.team_members`
- [ ] Enable RLS on `enterprise.organization_api_keys`
- [ ] Enable RLS on `enterprise.organization_roles`
- [ ] Enable RLS on `enterprise.user_organization_roles`
- [ ] Enable RLS on `enterprise.organization_invitations`

#### 4.2 Create RLS Policies

**Organizations**
- [ ] Policy: Users see only their organizations
- [ ] Policy: Service role has full access
- [ ] Policy: Org admins can update org settings

**Teams**
- [ ] Policy: Users see teams in their organization
- [ ] Policy: Team admins can update team details
- [ ] Policy: Service role has full access

**Team Members**
- [ ] Policy: Users see members of their teams
- [ ] Policy: Team admins can add/remove members
- [ ] Policy: Service role has full access

**Organization API Keys**
- [ ] Policy: Only org admins can view/manage API keys
- [ ] Policy: Service role has full access

**Organization Roles**
- [ ] Policy: Users see roles in their organization
- [ ] Policy: Org admins can manage roles
- [ ] Policy: Service role has full access

**User Organization Roles**
- [ ] Policy: Users see role assignments in their organization
- [ ] Policy: Org admins can assign/revoke roles
- [ ] Policy: Service role has full access

**Organization Invitations**
- [ ] Policy: Users see invitations in their organization
- [ ] Policy: Org admins can create/cancel invitations
- [ ] Policy: Service role has full access

### 5. Migration & Data

#### 5.1 Create Migration File
- [ ] Create timestamped migration file (e.g., `20250116000000_create_enterprise_schema.sql`)
- [ ] Add all CREATE TABLE statements
- [ ] Add all CREATE INDEX statements
- [ ] Add all CREATE FUNCTION statements
- [ ] Add all RLS policies
- [ ] Add rollback section (DROP statements)

#### 5.2 Seed Default Data
- [ ] Create default organization roles (Admin, Member, Viewer)
- [ ] Create permission definitions in docs
- [ ] Test migration on local Supabase

#### 5.3 Update Existing Tables
- [ ] Add `organization_id` to `public.profiles`
- [ ] Add `organization_id` to `github_module.github_app_installations`
- [ ] Add migration for existing users (create personal orgs or prompt)

### 6. Testing

#### 6.1 Unit Tests
- [ ] Test organization creation
- [ ] Test team hierarchy (nested teams)
- [ ] Test user invitation flow
- [ ] Test API key encryption/decryption
- [ ] Test role assignment and permissions

#### 6.2 RLS Tests
- [ ] Test user can only see their org data
- [ ] Test admin can manage org/teams
- [ ] Test member has read-only access
- [ ] Test service role bypasses RLS

#### 6.3 Performance Tests
- [ ] Test query performance with 1000 users
- [ ] Test recursive team hierarchy queries
- [ ] Test permission check performance

### 7. Documentation
- [ ] Document schema in README
- [ ] Create ER diagram
- [ ] Document RLS policies
- [ ] Document helper functions with examples
- [ ] Create API usage examples

### 8. Deployment
- [ ] Review migration SQL with team
- [ ] Test migration on staging environment
- [ ] Apply migration to production
- [ ] Verify all policies are active
- [ ] Monitor for errors

## 📊 Progress Tracking

**Total Tasks**: 85
**Completed**: 0
**In Progress**: 0
**Blocked**: 0

## 🎯 Definition of Done

✅ All tables created and tested
✅ All RLS policies active
✅ All helper functions working
✅ Migration tested on staging
✅ Documentation complete
✅ No breaking changes to existing features
