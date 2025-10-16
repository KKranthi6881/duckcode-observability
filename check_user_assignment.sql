-- Check if user is properly assigned to organization

-- 1. Check users
SELECT '=== USERS ===' as section;
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check profiles
SELECT '=== PROFILES ===' as section;
SELECT id, email, full_name, organization_id, created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check organizations
SELECT '=== ORGANIZATIONS ===' as section;
SELECT id, name, display_name, created_at
FROM enterprise.organizations
ORDER BY created_at DESC;

-- 4. Check roles  
SELECT '=== ROLES ===' as section;
SELECT org.name as org_name, r.name as role_name, r.display_name, r.is_default
FROM enterprise.organization_roles r
JOIN enterprise.organizations org ON org.id = r.organization_id
ORDER BY org.name, r.name;

-- 5. Check user-organization-role assignments (THIS IS THE CRITICAL ONE)
SELECT '=== USER ASSIGNMENTS ===' as section;
SELECT 
  u.email as user_email,
  o.name as org_name,
  r.name as role_name,
  uor.created_at
FROM enterprise.user_organization_roles uor
JOIN auth.users u ON u.id = uor.user_id
JOIN enterprise.organizations o ON o.id = uor.organization_id
JOIN enterprise.organization_roles r ON r.id = uor.role_id
ORDER BY uor.created_at DESC;

-- 6. Find orphaned users (users with no role assignment)
SELECT '=== ORPHANED USERS (NO ROLE ASSIGNMENT) ===' as section;
SELECT 
  u.id,
  u.email,
  p.organization_id,
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN enterprise.user_organization_roles uor ON uor.user_id = u.id
WHERE uor.id IS NULL
ORDER BY u.created_at DESC;
