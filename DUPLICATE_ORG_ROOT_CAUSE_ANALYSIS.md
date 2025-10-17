# Duplicate Organization Creation - Root Cause Analysis

## Problem Statement
When a user registers through admin register (RegisterPage.tsx), TWO rows are being created in `enterprise.organizations` table instead of one.

## Root Cause Identified

### Dual Organization Creation Flow

There are **TWO separate mechanisms** creating organizations during user registration:

#### 1. **Backend Model Layer** (`SupabaseUser.create()` - Lines 71-124)
Located in: `/backend/src/models/SupabaseUser.ts`

```typescript
// After creating user in Supabase Auth...
const { data: orgData, error: orgError } = await supabaseEnterprise
  .from('organizations')
  .insert({
    name: orgSlug,
    display_name: displayName,
    plan_type: 'trial',
    max_users: 10,
    status: 'trial',
    settings: {},
  })
  .select()
  .single();
```

This code **explicitly creates an organization** when the user is registered.

#### 2. **Database Trigger** (`trigger_auto_create_organization`)
Located in: `/supabase/migrations/20251015000004_add_organization_to_existing_tables.sql`

```sql
CREATE TRIGGER trigger_auto_create_organization
  AFTER INSERT ON duckcode.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION enterprise.auto_create_organization_for_user();
```

This trigger fires **automatically** when a profile is inserted into `duckcode.user_profiles`, which happens when a user is created in `auth.users` (via the `on_auth_user_created` trigger).

### Execution Flow

```
1. RegisterPage.tsx submits form
   ↓
2. Backend /api/auth/register receives request
   ↓
3. SupabaseUser.create() is called
   ↓
4. Supabase Auth creates user in auth.users
   ↓
5. Trigger: on_auth_user_created → Creates profile in duckcode.user_profiles
   ↓
6. Trigger: trigger_auto_create_organization → Creates Organization #1 ❌
   ↓
7. SupabaseUser.create() continues execution (lines 71-124)
   ↓
8. Manual INSERT into organizations → Creates Organization #2 ❌
```

## Why Deduplication Safeguards Failed

The migration `20251016000010_prevent_duplicate_organizations.sql` added safeguards to the `migrate_user_to_personal_organization()` function:

1. Check if user already has `organization_id` in profile
2. Check if organization with same name pattern exists
3. Add unique constraint on `organizations.name`

**However**, these safeguards fail in the registration flow because:

1. The **trigger fires first** (creates org, assigns it to profile)
2. The **manual code fires second** (tries to create another org with **different name pattern**)
   - Trigger uses: `email.split('@')[0]_org` 
   - Manual code uses: `organizationName` from form OR `email.split('@')[0]` (without `_org` suffix)
3. Different name patterns = unique constraint doesn't catch it
4. Both organizations get created successfully

## Evidence

Looking at `SupabaseUser.ts` line 67:
```typescript
const orgSlug = (userData.organizationName || userData.email.split('@')[0])
  .replace(/[^a-z0-9]/gi, '_')
  .toLowerCase();
```

Compared to `migrate_user_to_personal_organization` line 47:
```typescript
v_org_name := regexp_replace(lower(v_user_email), '[^a-z0-9]', '_', 'g') || '_org';
```

**These produce different organization names!**

## Impact

- Users registering through `/register` or `/ide-register` endpoints get TWO organizations
- First org is created by trigger (follows standard naming pattern)
- Second org is created by manual code (may use custom organization name from form)
- This violates the "one organization per user" principle for personal accounts
- Causes confusion in organization selection/management

## Affected Endpoints

1. `POST /api/auth/register` (Line 31 in `auth.ts`)
   - Used by `RegisterPage.tsx` (web registration)
   - Used by `IDERegisterPage.tsx` (IDE registration)

Both endpoints call `SupabaseUser.create()` which has the manual organization creation logic.
