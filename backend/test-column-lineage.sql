-- Test Column Lineage Extraction
-- Run this after extraction completes

-- 1. Check how many column lineage relationships were created
SELECT COUNT(*) as total_lineages
FROM metadata.columns_lineage cl
JOIN metadata.objects o ON cl.target_object_id = o.id
WHERE o.connection_id = (
  SELECT id FROM enterprise.github_connections 
  WHERE repository_url LIKE '%jaffle-shop%' 
  ORDER BY created_at DESC LIMIT 1
);

-- 2. View all column lineage relationships
SELECT 
  so.name as source_model,
  cl.source_column,
  '→' as arrow,
  tgt.name as target_model,
  cl.target_column,
  cl.confidence,
  cl.transformation_type,
  cl.extracted_from
FROM metadata.columns_lineage cl
JOIN metadata.objects so ON cl.source_object_id = so.id
JOIN metadata.objects tgt ON cl.target_object_id = tgt.id
WHERE tgt.connection_id = (
  SELECT id FROM enterprise.github_connections 
  WHERE repository_url LIKE '%jaffle-shop%' 
  ORDER BY created_at DESC LIMIT 1
)
ORDER BY target_model, target_column, source_model;

-- 3. Get lineage for a specific model (e.g., customers)
SELECT 
  so.name as source_model,
  cl.source_column,
  '→' as arrow,
  tgt.name as target_model,
  cl.target_column
FROM metadata.columns_lineage cl
JOIN metadata.objects so ON cl.source_object_id = so.id
JOIN metadata.objects tgt ON cl.target_object_id = tgt.id
WHERE tgt.name = 'customers'
  AND tgt.connection_id = (
    SELECT id FROM enterprise.github_connections 
    WHERE repository_url LIKE '%jaffle-shop%' 
    ORDER BY created_at DESC LIMIT 1
  )
ORDER BY target_column, source_model;

-- 4. Check which models have lineage
SELECT 
  o.name as model_name,
  COUNT(DISTINCT cl.target_column) as columns_with_lineage,
  COUNT(*) as total_lineage_relationships
FROM metadata.objects o
LEFT JOIN metadata.columns_lineage cl ON o.id = cl.target_object_id
WHERE o.connection_id = (
  SELECT id FROM enterprise.github_connections 
  WHERE repository_url LIKE '%jaffle-shop%' 
  ORDER BY created_at DESC LIMIT 1
)
GROUP BY o.name
ORDER BY columns_with_lineage DESC;

-- 5. Find multi-source columns (columns derived from multiple sources)
SELECT 
  tgt.name as target_model,
  cl.target_column,
  COUNT(DISTINCT cl.source_object_id) as source_count,
  STRING_AGG(DISTINCT so.name || '.' || cl.source_column, ', ') as sources
FROM metadata.columns_lineage cl
JOIN metadata.objects so ON cl.source_object_id = so.id
JOIN metadata.objects tgt ON cl.target_object_id = tgt.id
WHERE tgt.connection_id = (
  SELECT id FROM enterprise.github_connections 
  WHERE repository_url LIKE '%jaffle-shop%' 
  ORDER BY created_at DESC LIMIT 1
)
GROUP BY tgt.name, cl.target_column
HAVING COUNT(DISTINCT cl.source_object_id) > 1
ORDER BY source_count DESC, target_model;

-- 6. Get full lineage path for a specific column (recursive)
WITH RECURSIVE lineage_path AS (
  -- Base case: start with target column
  SELECT 
    cl.target_object_id as object_id,
    cl.target_column as column_name,
    cl.source_object_id as prev_object_id,
    cl.source_column as prev_column_name,
    1 as depth,
    ARRAY[cl.target_object_id] as path
  FROM metadata.columns_lineage cl
  JOIN metadata.objects o ON cl.target_object_id = o.id
  WHERE o.name = 'customers' -- Change this to your target model
    AND cl.target_column = 'customer_id' -- Change this to your target column
    AND o.connection_id = (
      SELECT id FROM enterprise.github_connections 
      WHERE repository_url LIKE '%jaffle-shop%' 
      ORDER BY created_at DESC LIMIT 1
    )
  
  UNION ALL
  
  -- Recursive case: find sources of previous sources
  SELECT 
    cl2.target_object_id,
    cl2.target_column,
    cl2.source_object_id,
    cl2.source_column,
    lp.depth + 1,
    lp.path || cl2.target_object_id
  FROM lineage_path lp
  JOIN metadata.columns_lineage cl2 
    ON cl2.target_object_id = lp.prev_object_id 
    AND cl2.target_column = lp.prev_column_name
  WHERE NOT (cl2.target_object_id = ANY(lp.path)) -- Prevent cycles
    AND lp.depth < 10 -- Max depth
)
SELECT 
  o.name as model,
  lp.column_name,
  lp.depth,
  prev_o.name as source_model,
  lp.prev_column_name as source_column
FROM lineage_path lp
JOIN metadata.objects o ON lp.object_id = o.id
LEFT JOIN metadata.objects prev_o ON lp.prev_object_id = prev_o.id
ORDER BY lp.depth DESC;

-- 7. Verify data quality
SELECT 
  'Total Objects' as metric,
  COUNT(*)::text as value
FROM metadata.objects
WHERE connection_id = (
  SELECT id FROM enterprise.github_connections 
  WHERE repository_url LIKE '%jaffle-shop%' 
  ORDER BY created_at DESC LIMIT 1
)

UNION ALL

SELECT 
  'Total Columns' as metric,
  COUNT(*)::text as value
FROM metadata.columns c
JOIN metadata.objects o ON c.object_id = o.id
WHERE o.connection_id = (
  SELECT id FROM enterprise.github_connections 
  WHERE repository_url LIKE '%jaffle-shop%' 
  ORDER BY created_at DESC LIMIT 1
)

UNION ALL

SELECT 
  'Column Lineages' as metric,
  COUNT(*)::text as value
FROM metadata.columns_lineage cl
JOIN metadata.objects o ON cl.target_object_id = o.id
WHERE o.connection_id = (
  SELECT id FROM enterprise.github_connections 
  WHERE repository_url LIKE '%jaffle-shop%' 
  ORDER BY created_at DESC LIMIT 1
)

UNION ALL

SELECT 
  'Model Dependencies' as metric,
  COUNT(*)::text as value
FROM metadata.dependencies d
JOIN metadata.objects o ON d.source_object_id = o.id
WHERE o.connection_id = (
  SELECT id FROM enterprise.github_connections 
  WHERE repository_url LIKE '%jaffle-shop%' 
  ORDER BY created_at DESC LIMIT 1
);
