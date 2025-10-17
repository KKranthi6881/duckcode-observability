# Duplicate Organization Fix - Implementation Strategy

## Solution Overview

**Remove manual organization creation from `SupabaseUser.create()`** and rely entirely on the database trigger mechanism for consistent, standardized organization creation.

## Why This Approach?

### Advantages of Trigger-Based Approach:
1. **Single Source of Truth**: Organization creation logic in one place (database function)
2. **Consistency**: All users follow same organization creation pattern
3. **Atomicity**: Database handles the entire flow transactionally
4. **Maintainability**: Changes to organization creation logic only need to be made in one place
5. **Race Condition Protection**: Database handles concurrent user registrations properly

### Why Not Keep Manual Code?
1. **Duplication**: Two code paths doing the same thing
2. **Naming Conflicts**: Different naming patterns between trigger and manual code
3. **Custom Organization Names**: Can be handled differently (see below)

## Implementation Plan

### Step 1: Remove Manual Organization Creation from Backend Model
**File**: `/backend/src/models/SupabaseUser.ts`

Remove lines 71-124 (the entire try-catch block that creates organizations manually).

The trigger will automatically:
- Create organization when profile is created
- Assign user as Admin
- Set up default roles

### Step 2: Handle Custom Organization Names (Optional Enhancement)

If we want to support custom organization names from the registration form, we have two options:

#### Option A: Store in metadata, rename later
1. Store `organizationName` in user metadata during registration
2. After profile is created, update the organization's `display_name`
3. Keep the slug-based `name` for uniqueness

#### Option B: Pass to trigger function
1. Modify the trigger function to accept optional display name
2. Pass through user metadata or profile column
3. More complex but allows custom names immediately

**Recommendation**: Option A - simpler, safer, allows validation

### Step 3: Update Registration Logic to Handle Custom Org Names

```typescript
// After user creation, if organizationName was provided
if (userData.organizationName) {
  // Wait for trigger to complete (small delay or query check)
  const profile = await getUserProfile(authData.user.id);
  
  if (profile?.organization_id) {
    await supabaseEnterprise
      .from('organizations')
      .update({ display_name: userData.organizationName })
      .eq('id', profile.organization_id);
  }
}
```

### Step 4: Clean Up Existing Duplicate Organizations

Create a migration to:
1. Identify users with multiple organizations
2. Keep the first organization (by created_at)
3. Migrate data to the kept organization
4. Delete duplicate organizations
5. Ensure user_profiles.organization_id points to correct org

## Files to Modify

### Required Changes:
1. `/backend/src/models/SupabaseUser.ts` - Remove manual org creation (lines 71-124)

### Optional Enhancements:
2. `/backend/src/models/SupabaseUser.ts` - Add custom org name handling
3. `/supabase/migrations/[new]_cleanup_duplicate_organizations.sql` - Data cleanup

## Testing Plan

1. **Test New Registration**:
   - Register new user via web form
   - Verify only ONE organization created
   - Verify user is assigned as Admin
   - Verify organization has correct name pattern

2. **Test IDE Registration**:
   - Register via IDE flow
   - Same verifications as above

3. **Test Custom Organization Names**:
   - Register with custom org name
   - Verify display_name is set correctly
   - Verify slug-based name for uniqueness

4. **Test Existing Users**:
   - Ensure existing users' organizations are not affected
   - Verify login still works correctly

## Rollback Plan

If issues arise:
1. Keep a backup of `SupabaseUser.ts` before changes
2. Temporarily disable trigger if needed:
   ```sql
   ALTER TABLE duckcode.user_profiles DISABLE TRIGGER trigger_auto_create_organization;
   ```
3. Re-enable manual creation code
4. Investigate and fix trigger issues

## Migration Strategy for Existing Duplicates

```sql
-- Find users with multiple organizations
WITH user_orgs AS (
  SELECT 
    user_id,
    COUNT(*) as org_count,
    ARRAY_AGG(organization_id ORDER BY assigned_at) as org_ids
  FROM enterprise.user_organization_roles
  GROUP BY user_id
  HAVING COUNT(*) > 1
)
SELECT * FROM user_orgs;

-- For each user with duplicates:
-- 1. Keep first organization
-- 2. Update user_profiles to point to first org
-- 3. Delete roles from duplicate orgs
-- 4. Delete duplicate orgs
```

## Success Criteria

- ✅ Only ONE organization created per new user registration
- ✅ No duplicate organizations in database
- ✅ All existing users can still access their data
- ✅ Custom organization names work correctly (if implemented)
- ✅ IDE and web registration both work identically
- ✅ No breaking changes to authentication flow
