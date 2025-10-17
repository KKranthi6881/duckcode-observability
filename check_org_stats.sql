-- Check if organization_daily_stats has data
SELECT 
  usage_date,
  organization_id,
  total_conversations,
  total_cost,
  total_tokens_in,
  total_tokens_out,
  active_users
FROM duckcode.organization_daily_stats
ORDER BY usage_date DESC
LIMIT 10;

-- Check if conversation_analytics has organization_id set
SELECT 
  conversation_id,
  user_id,
  organization_id,
  total_cost,
  total_tokens_in,
  total_tokens_out,
  started_at
FROM duckcode.conversation_analytics
WHERE organization_id IS NOT NULL
ORDER BY started_at DESC
LIMIT 10;

-- Count conversations with vs without org_id
SELECT 
  CASE 
    WHEN organization_id IS NOT NULL THEN 'With Org ID'
    ELSE 'Without Org ID'
  END as status,
  COUNT(*) as count,
  SUM(total_cost) as total_cost,
  SUM(total_tokens_in + total_tokens_out) as total_tokens
FROM duckcode.conversation_analytics
WHERE started_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY CASE WHEN organization_id IS NOT NULL THEN 'With Org ID' ELSE 'Without Org ID' END;
