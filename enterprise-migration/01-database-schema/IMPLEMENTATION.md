# Phase 1: Database Schema - Implementation Guide

## 🎉 Phase 1 Complete!

All migration files have been created and are ready to deploy.

## 📁 Migration Files Created

```
duckcode-observability/supabase/migrations/
├── 20250115000000_cleanup_unused_schemas.sql       # Removes code_insights schema
├── 20250115000001_create_enterprise_schema.sql     # Creates enterprise tables
├── 20250115000002_create_enterprise_functions.sql  # Helper functions
├── 20250115000003_create_enterprise_rls_policies.sql # Security policies
└── 20250115000004_add_organization_to_existing_tables.sql # Links to existing data
```

## 🚀 Deployment Steps

### Option 1: Local Supabase (Development)

```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability

# Reset database (CAUTION: destroys all data)
supabase db reset

# Or apply migrations only
supabase db push
```

### Option 2: Supabase Cloud (Production)

```bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Verify migrations applied
supabase db pull
```

### Option 3: Manual SQL

1. Open Supabase Dashboard → SQL Editor
2. Run each migration file in order:
   - `20250115000000_cleanup_unused_schemas.sql`
   - `20250115000001_create_enterprise_schema.sql`
   - `20250115000002_create_enterprise_functions.sql`
   - `20250115000003_create_enterprise_rls_policies.sql`
   - `20250115000004_add_organization_to_existing_tables.sql`

## ✅ Verification Checklist

### 1. Verify Schema Created
```sql
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'enterprise';
-- Should return 'enterprise'
```

### 2. Verify Tables Created
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'enterprise'
ORDER BY table_name;
-- Should return 7 tables:
-- organization_api_keys
-- organization_invitations
-- organization_roles
-- organizations
-- team_members
-- teams
-- user_organization_roles
```

### 3. Verify RLS Enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'enterprise';
-- All should show rowsecurity = TRUE
```

### 4. Verify Functions Created
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'enterprise'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
-- Should show all helper functions
```

### 5. Test Organization Creation
```sql
-- Create test organization
INSERT INTO enterprise.organizations (name, display_name)
VALUES ('test_org', 'Test Organization')
RETURNING *;

-- Verify default roles were created
SELECT name, display_name, permissions 
FROM enterprise.organization_roles
WHERE organization_id = (SELECT id FROM enterprise.organizations WHERE name = 'test_org');
-- Should return Admin, Member, Viewer roles
```

## 🧪 Testing Guide

### Create Test Data

```sql
BEGIN;

-- 1. Create organization
INSERT INTO enterprise.organizations (name, display_name, plan_type, status)
VALUES ('acme_corp', 'Acme Corporation', 'enterprise', 'active')
RETURNING id AS org_id \gset

-- 2. Create teams
INSERT INTO enterprise.teams (organization_id, name, display_name, team_type)
VALUES 
  (:org_id, 'engineering', 'Engineering', 'division'),
  (:org_id, 'data_platform', 'Data Platform', 'department')
RETURNING id AS team_id \gset

-- 3. Add user to organization (replace with real user ID)
INSERT INTO enterprise.user_organization_roles (
  user_id,
  organization_id,
  role_id
)
SELECT 
  auth.uid(), -- Current user
  :org_id,
  r.id
FROM enterprise.organization_roles r
WHERE r.organization_id = :org_id
  AND r.name = 'Admin';

-- 4. Add user to team
INSERT INTO enterprise.team_members (team_id, user_id, role)
VALUES (:team_id, auth.uid(), 'admin');

COMMIT;
```

### Test Helper Functions

```sql
-- Get user's organizations
SELECT * FROM enterprise.get_user_organizations(auth.uid());

-- Check if user is admin
SELECT enterprise.is_organization_admin(auth.uid(), '<org_id>');

-- Get user's teams
SELECT * FROM enterprise.get_user_teams(auth.uid());

-- Get team hierarchy
SELECT * FROM enterprise.get_team_hierarchy('<team_id>');

-- Check permission
SELECT enterprise.check_permission(auth.uid(), '<org_id>', 'metadata:read');
```

### Test RLS Policies

```sql
-- As authenticated user, try to see organizations
SET ROLE authenticated;
SELECT * FROM enterprise.organizations;
-- Should only see organizations user belongs to

-- Reset role
RESET ROLE;
```

## 🔄 Migrate Existing Users

### Migrate Single User
```sql
SELECT enterprise.migrate_user_to_personal_organization('<user_id>');
```

### Migrate All Users (Batch)
```sql
-- Get count of users needing migration
SELECT COUNT(*) FROM auth.users
WHERE id NOT IN (
  SELECT id FROM public.profiles WHERE organization_id IS NOT NULL
);

-- Migrate in batches of 10
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  FOR v_user_id IN (
    SELECT id FROM auth.users
    WHERE id NOT IN (
      SELECT id FROM public.profiles WHERE organization_id IS NOT NULL
    )
    LIMIT 10
  )
  LOOP
    PERFORM enterprise.migrate_user_to_personal_organization(v_user_id);
    RAISE NOTICE 'Migrated user: %', v_user_id;
  END LOOP;
END $$;
```

## 🐛 Troubleshooting

### Issue: RLS blocks service_role queries
**Solution**: Ensure you're using `service_role` key, not `anon` key

### Issue: Foreign key constraint violations
**Solution**: Verify parent records exist before inserting child records

### Issue: Migration fails with "already exists"
**Solution**: Check if migration was partially applied. Reset or drop conflicting objects.

### Issue: Users can't see their data
**Solution**: Verify RLS policies and that user has role in organization

## 📊 Database Diagram

```
enterprise.organizations (1) ─────┐
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
  organization_roles    organization_api_keys    teams (hierarchy)
         │                                              │
         │                                              ▼
         │                                      team_members
         │                                              │
         └──────────────┬───────────────────────────────┘
                        ▼
           user_organization_roles
                        │
                        ▼
                   auth.users
```

## 📝 What's Next

### Phase 2: Admin Portal
- Build React UI for organization management
- Team hierarchy visual editor
- User invitation flow
- Connector configuration interface

### Phase 3: Metadata Service
- Cloud-based metadata extraction
- Replicate duck-code SQLglot logic
- Store in new `metadata` schema (to be created)

### Phase 4: Sync Engine
- Sync metadata from cloud to local IDE
- Incremental updates
- Conflict resolution

## 🎯 Success Criteria

- [x] All migration files created
- [ ] Migrations applied to staging database
- [ ] All tests pass
- [ ] Existing users migrated
- [ ] No breaking changes to existing features
- [ ] Documentation complete
- [ ] Team trained on new schema

## 📞 Need Help?

- Review `/enterprise-migration/01-database-schema/PLAN.md` for design details
- Check `/enterprise-migration/01-database-schema/TASKS.md` for task list
- Open issue or reach out to database lead

---

**Phase 1 Status**: ✅ Implementation Complete | 🔄 Testing In Progress
