-- Verify snowflake_budgets table has correct schema

-- Check if budget_type column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'enterprise'
  AND table_name = 'snowflake_budgets'
  AND column_name = 'budget_type';

-- Should return 1 row: budget_type | text | NO

-- Check all columns in the table
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'enterprise'
  AND table_name = 'snowflake_budgets'
ORDER BY ordinal_position;

-- Test inserting a sample budget
INSERT INTO enterprise.snowflake_budgets (
    organization_id,
    budget_type,
    budget_name,
    budget_amount,
    budget_period,
    current_period_start,
    current_period_end
) VALUES (
    (SELECT id FROM enterprise.organizations LIMIT 1),
    'organization',
    'Test Budget',
    10000,
    'monthly',
    DATE_TRUNC('month', CURRENT_DATE),
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE
) RETURNING id, budget_name, budget_type;

-- Clean up test
DELETE FROM enterprise.snowflake_budgets WHERE budget_name = 'Test Budget';
