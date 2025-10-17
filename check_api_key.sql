-- Check API keys for the test user
SELECT 
  k.id,
  k.provider,
  k.key_name,
  k.is_default,  -- ⚠️ MUST BE TRUE
  k.status,      -- ⚠️ MUST BE 'active'
  LENGTH(k.encrypted_key) as key_exists,
  k.created_at
FROM enterprise.organization_api_keys k
WHERE k.organization_id = '08346b45-f58a-43d6-a0ea-e3d1af0dd3b1'
ORDER BY k.created_at DESC;

-- If the key exists but is_default is false, fix it:
-- UPDATE enterprise.organization_api_keys
-- SET is_default = true, status = 'active'
-- WHERE organization_id = '08346b45-f58a-43d6-a0ea-e3d1af0dd3b1'
--   AND provider = 'openai';
