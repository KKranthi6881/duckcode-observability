# Phase 8: Deployment & Migration Strategy

## 🎯 Objective
Execute smooth migration from current individual-user architecture to enterprise multi-tenant platform with zero downtime and data integrity.

## 📋 Migration Strategy

### Migration Phases

#### Phase 8.1: Pre-Migration (2 weeks)
**Goal**: Prepare infrastructure and test migration scripts

**Tasks**:
- Set up staging environment mirroring production
- Create comprehensive database backup strategy
- Write migration scripts for all schema changes
- Test migration on staging with production data copy
- Document rollback procedures
- Train support team on new features

#### Phase 8.2: Schema Migration (1 week)
**Goal**: Deploy new enterprise schema without breaking existing features

**Tasks**:
- Deploy `enterprise` schema to production Supabase
- Run migration scripts to add `organization_id` to existing tables
- Enable RLS policies (initially permissive for testing)
- Create default organizations for existing users
- Verify schema integrity

#### Phase 8.3: Backend Deployment (1 week)
**Goal**: Deploy new backend services supporting both old and new features

**Tasks**:
- Deploy metadata extraction service
- Deploy admin portal backend APIs
- Deploy sync engine APIs
- Deploy connector framework
- Enable feature flags for gradual rollout
- Monitor performance and errors

#### Phase 8.4: Frontend Deployment (1 week)
**Goal**: Deploy admin portal and IDE updates

**Tasks**:
- Deploy admin portal React app
- Update IDE extension with sync service
- Deploy documentation UI
- Enable team management features
- Monitor user adoption

#### Phase 8.5: Data Migration (2 weeks)
**Goal**: Migrate existing metadata to enterprise schema

**Tasks**:
- Identify existing users and their data
- Create organizations for users (or prompt them)
- Migrate GitHub connections to organization ownership
- Migrate existing metadata to cloud
- Test metadata sync to IDE
- Verify data integrity

#### Phase 8.6: Feature Cutover (1 week)
**Goal**: Switch from old to new system fully

**Tasks**:
- Disable old individual-user features
- Enable all enterprise features
- Force organization selection on login
- Redirect users to admin portal for setup
- Monitor and fix issues quickly

## 🗄️ Database Migration Scripts

### Migration 1: Create Enterprise Schema
```sql
-- File: 20250120000000_create_enterprise_schema.sql

BEGIN;

-- Create enterprise schema
CREATE SCHEMA IF NOT EXISTS enterprise;

-- Create organizations table
CREATE TABLE enterprise.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  domain TEXT,
  plan_type TEXT DEFAULT 'starter',
  max_users INTEGER DEFAULT 5,
  status TEXT DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create teams table (with hierarchy support)
CREATE TABLE enterprise.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  parent_team_id UUID REFERENCES enterprise.teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  team_type TEXT NOT NULL,
  description TEXT,
  email TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Create team_members table
CREATE TABLE enterprise.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES enterprise.teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Create organization_api_keys table
CREATE TABLE enterprise.organization_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Create organization_roles table
CREATE TABLE enterprise.organization_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Create user_organization_roles table
CREATE TABLE enterprise.user_organization_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  role_id UUID REFERENCES enterprise.organization_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id, role_id)
);

-- Create indexes
CREATE INDEX idx_teams_org ON enterprise.teams(organization_id);
CREATE INDEX idx_teams_parent ON enterprise.teams(parent_team_id);
CREATE INDEX idx_team_members_team ON enterprise.team_members(team_id);
CREATE INDEX idx_team_members_user ON enterprise.team_members(user_id);
CREATE INDEX idx_api_keys_org ON enterprise.organization_api_keys(organization_id);
CREATE INDEX idx_user_org_roles_user ON enterprise.user_organization_roles(user_id);
CREATE INDEX idx_user_org_roles_org ON enterprise.user_organization_roles(organization_id);

COMMIT;
```

### Migration 2: Add Organization ID to Existing Tables
```sql
-- File: 20250121000000_add_organization_to_existing.sql

BEGIN;

-- Add organization_id to profiles
ALTER TABLE public.profiles 
ADD COLUMN organization_id UUID REFERENCES enterprise.organizations(id);

-- Add organization_id to GitHub installations
ALTER TABLE github_module.github_app_installations
ADD COLUMN organization_id UUID REFERENCES enterprise.organizations(id);

-- Create metadata schema
CREATE SCHEMA IF NOT EXISTS metadata;

-- Create repositories table in metadata schema
CREATE TABLE metadata.repositories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  connector_id UUID,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'git_repo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX idx_github_installations_org ON github_module.github_app_installations(organization_id);
CREATE INDEX idx_metadata_repos_org ON metadata.repositories(organization_id);

COMMIT;
```

### Migration 3: Migrate Existing Users
```sql
-- File: 20250122000000_migrate_existing_users.sql

BEGIN;

-- Create default organizations for existing users
INSERT INTO enterprise.organizations (name, display_name, plan_type, status)
SELECT 
  email || '_org' as name,
  email as display_name,
  'trial' as plan_type,
  'active' as status
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- Link users to their organizations
UPDATE public.profiles p
SET organization_id = o.id
FROM enterprise.organizations o, auth.users u
WHERE p.id = u.id 
  AND o.name = u.email || '_org';

-- Create default Admin role for each organization
INSERT INTO enterprise.organization_roles (organization_id, name, display_name, permissions, is_default)
SELECT 
  id as organization_id,
  'Admin' as name,
  'Administrator' as display_name,
  '["*"]'::jsonb as permissions,
  true as is_default
FROM enterprise.organizations;

-- Assign users as admins of their organizations
INSERT INTO enterprise.user_organization_roles (user_id, organization_id, role_id, assigned_by)
SELECT 
  p.id as user_id,
  p.organization_id,
  r.id as role_id,
  p.id as assigned_by
FROM public.profiles p
JOIN enterprise.organization_roles r ON r.organization_id = p.organization_id AND r.name = 'Admin'
WHERE p.organization_id IS NOT NULL;

COMMIT;
```

## 🔄 Rollback Strategy

### Rollback Scripts
```sql
-- File: rollback_enterprise_schema.sql

BEGIN;

-- Drop enterprise schema and all tables
DROP SCHEMA IF EXISTS enterprise CASCADE;
DROP SCHEMA IF EXISTS metadata CASCADE;

-- Remove organization_id columns
ALTER TABLE public.profiles DROP COLUMN IF EXISTS organization_id;
ALTER TABLE github_module.github_app_installations DROP COLUMN IF EXISTS organization_id;

COMMIT;
```

### Rollback Procedure
1. Stop all backend services
2. Run rollback SQL scripts
3. Restore from database backup if needed
4. Deploy previous version of backend
5. Deploy previous version of IDE extension
6. Notify users of temporary rollback
7. Investigate and fix issues
8. Re-attempt migration

## 🧪 Testing Strategy

### Pre-Migration Testing
- [ ] Unit tests pass for all new features
- [ ] Integration tests pass
- [ ] Load tests with 1000 concurrent users
- [ ] Security penetration testing
- [ ] Migration scripts tested on staging

### Migration Testing Checklist
- [ ] Schema migrations applied successfully
- [ ] Existing data intact and queryable
- [ ] New features accessible
- [ ] Old features still working
- [ ] Performance within acceptable limits
- [ ] No data loss or corruption
- [ ] RLS policies enforcing isolation

### Post-Migration Validation
- [ ] All users can log in
- [ ] Organizations created correctly
- [ ] Teams and members assigned
- [ ] Connectors working
- [ ] Metadata sync functioning
- [ ] Admin portal accessible
- [ ] Audit logs capturing events

## 📊 Monitoring & Alerting

### Metrics to Monitor
```typescript
const migrationMetrics = {
  // Database
  totalOrganizations: number,
  totalUsers: number,
  usersWithOrganizations: number,
  usersWithoutOrganizations: number,
  
  // Migration progress
  migratedUsers: number,
  migratedConnections: number,
  migratedMetadata: number,
  
  // Performance
  databaseQueryLatency: number,
  apiResponseTime: number,
  syncLatency: number,
  
  // Errors
  migrationErrors: string[],
  authenticationErrors: number,
  syncErrors: number,
};
```

### Alerts
- Database migration failures
- API error rate > 5%
- User authentication failures spike
- Sync failures > 10%
- RLS policy violations

## 📚 Documentation

### User-Facing Documentation
- [ ] Migration announcement (email to all users)
- [ ] New features guide
- [ ] Admin portal documentation
- [ ] IDE extension updates guide
- [ ] Troubleshooting FAQ
- [ ] Video tutorials

### Developer Documentation
- [ ] Architecture diagrams updated
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Database schema documentation
- [ ] Migration runbook
- [ ] Rollback procedures
- [ ] Monitoring dashboards

## ✅ Go-Live Checklist

### 1 Week Before
- [ ] Final staging migration test
- [ ] Performance tests passed
- [ ] Security audit completed
- [ ] Documentation finalized
- [ ] Support team trained
- [ ] Rollback procedure documented

### 1 Day Before
- [ ] Database backup created
- [ ] Monitoring dashboards configured
- [ ] Alert thresholds set
- [ ] On-call team assigned
- [ ] Communication plan ready

### Go-Live Day
- [ ] Announce maintenance window
- [ ] Run migration scripts
- [ ] Deploy backend services
- [ ] Deploy frontend applications
- [ ] Verify all systems operational
- [ ] Send completion notification
- [ ] Monitor for 24 hours

### 1 Week After
- [ ] Gather user feedback
- [ ] Fix reported issues
- [ ] Optimize performance
- [ ] Update documentation
- [ ] Conduct retrospective

## 🚀 Feature Flags

### Gradual Rollout
```typescript
const featureFlags = {
  enterpriseMode: true,
  adminPortal: true,
  metadataSync: false, // Enable after 1 week
  aiDocumentation: false, // Enable after 2 weeks
  advancedConnectors: false, // Enable after 1 month
};
```

### Flag Management
- Use LaunchDarkly or custom flag service
- Enable features per organization
- Monitor adoption and issues
- Disable if problems detected

## 📈 Success Metrics

### Week 1
- [ ] 80% of users logged in successfully
- [ ] 50% of users joined/created organizations
- [ ] Zero critical bugs

### Week 2
- [ ] 90% of users in organizations
- [ ] 50% of organizations added connectors
- [ ] < 1% error rate

### Month 1
- [ ] 100% of users migrated
- [ ] 70% of organizations active
- [ ] Positive user feedback
- [ ] All enterprise features stable
