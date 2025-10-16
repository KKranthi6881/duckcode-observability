-- Debug: Check organizations and their roles

-- 1. Check if any organizations exist
SELECT 'Organizations:' as check_type;
SELECT id, name, display_name, created_at 
FROM enterprise.organizations 
ORDER BY created_at DESC;

-- 2. Check if any roles exist
SELECT 'Roles:' as check_type;
SELECT org.name as org_name, r.name as role_name, r.display_name, r.is_default, r.permissions
FROM enterprise.organization_roles r
LEFT JOIN enterprise.organizations org ON org.id = r.organization_id
ORDER BY org.name, r.name;

-- 3. Check profiles (users)
SELECT 'Users:' as check_type;
SELECT id, email, full_name, created_at
FROM public.profiles
ORDER BY created_at DESC;
