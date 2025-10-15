# Phase 1: Database Schema - Team & Organization Management

## 🎯 Objective
Create enterprise-grade database schema for multi-tenant team management, inspired by OpenMetadata's team hierarchy model.

## 📊 Schema Design

### Team Hierarchy Model
```
Organization (Root)
  └── Division (Optional)
      └── Department (Optional)
          └── Business Unit (Optional)
              └── Group/Team (Leaf)
                  └── Users
```

### Core Tables

#### 1. `organizations` (enterprise schema)
Primary entity for enterprise customers.

```sql
- id (uuid, primary key)
- name (text, unique)
- display_name (text)
- domain (text) -- e.g., "acme.com"
- plan_type (enum: starter, professional, enterprise)
- max_users (int)
- created_at (timestamp)
- updated_at (timestamp)
- settings (jsonb) -- org-wide settings
- status (enum: active, suspended, trial)
```

#### 2. `teams` (enterprise schema)
Flexible team hierarchy supporting nested structures.

```sql
- id (uuid, primary key)
- organization_id (uuid, FK to organizations)
- parent_team_id (uuid, FK to teams, nullable)
- name (text)
- display_name (text)
- team_type (enum: organization, division, department, business_unit, group)
- description (text)
- email (text)
- created_at (timestamp)
- updated_at (timestamp)
- metadata (jsonb)
```

#### 3. `team_members` (enterprise schema)
Maps users to teams with roles.

```sql
- id (uuid, primary key)
- team_id (uuid, FK to teams)
- user_id (uuid, FK to auth.users)
- role (enum: admin, member, viewer)
- joined_at (timestamp)
- updated_at (timestamp)
```

#### 4. `organization_api_keys` (enterprise schema)
LLM API keys owned by organization (not DuckCode).

```sql
- id (uuid, primary key)
- organization_id (uuid, FK to organizations)
- provider (enum: openai, anthropic, azure, gemini)
- encrypted_key (text) -- encrypted API key
- key_name (text) -- user-friendly name
- is_default (boolean)
- created_by (uuid, FK to auth.users)
- created_at (timestamp)
- last_used_at (timestamp)
- status (enum: active, inactive, expired)
```

#### 5. `organization_roles` (enterprise schema)
Custom roles with permissions.

```sql
- id (uuid, primary key)
- organization_id (uuid, FK to organizations)
- name (text) -- e.g., "Data Engineer", "Analyst"
- display_name (text)
- permissions (jsonb) -- permission array
- is_default (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 6. `user_organization_roles` (enterprise schema)
Maps users to organization-level roles.

```sql
- id (uuid, primary key)
- user_id (uuid, FK to auth.users)
- organization_id (uuid, FK to organizations)
- role_id (uuid, FK to organization_roles)
- assigned_by (uuid, FK to auth.users)
- assigned_at (timestamp)
```

#### 7. `organization_invitations` (enterprise schema)
Manage user invitations to organizations.

```sql
- id (uuid, primary key)
- organization_id (uuid, FK to organizations)
- email (text)
- invited_by (uuid, FK to auth.users)
- team_id (uuid, FK to teams, nullable)
- role_id (uuid, FK to organization_roles)
- status (enum: pending, accepted, expired, cancelled)
- invitation_token (text, unique)
- expires_at (timestamp)
- created_at (timestamp)
```

## 🔐 Row-Level Security (RLS)

### Policies to Implement

1. **Organization Isolation**
   - Users only see data from their organization
   - Super admins can see all organizations

2. **Team-Based Access**
   - Users see teams they belong to
   - Admins see all teams in their organization

3. **Role-Based Permissions**
   - Admins can manage teams and users
   - Members can view but not modify
   - Viewers have read-only access

## 🔄 Migration from Current Schema

### Update Existing Tables

1. **Add organization_id to existing tables**
   - `public.profiles` → add `organization_id`
   - `github_module.github_app_installations` → add `organization_id`
   - `code_insights.*` tables → add `organization_id`

2. **Create default organization for existing users**
   - Migrate current individual users to personal organizations
   - Or prompt users to join/create organizations

## ✅ Acceptance Criteria

- [ ] All tables created in `enterprise` schema
- [ ] Foreign key constraints enforced
- [ ] RLS policies active and tested
- [ ] Indexes created for performance
- [ ] Migration script tested on staging
- [ ] Rollback script prepared
- [ ] Documentation updated

## 🚀 Implementation Order

1. Create `organizations` table
2. Create `teams` table with hierarchy support
3. Create `team_members` mapping table
4. Create `organization_api_keys` table
5. Create `organization_roles` and `user_organization_roles`
6. Create `organization_invitations` table
7. Apply RLS policies
8. Create helper functions (get_user_organizations, is_org_admin, etc.)
9. Test with sample data

## 📝 Notes

- Use Supabase schema qualifier: `enterprise.organizations`
- Keep `public` schema for authentication/profiles
- Keep `github_module` for GitHub-specific data
- New `enterprise` schema for team management
- Consider using OpenMetadata's team repository logic as reference
