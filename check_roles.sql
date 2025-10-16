-- Check if roles exist (should be empty until organization is created)
SELECT name, display_name, is_default, 
       CASE 
         WHEN permissions::text = '["*"]' THEN 'All permissions'
         ELSE jsonb_array_length(permissions)::text || ' permissions'
       END as permission_count
FROM enterprise.organization_roles 
ORDER BY name;
