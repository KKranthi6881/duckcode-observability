-- =====================================================
-- Unified Multi-Source Lineage System
-- =====================================================
-- This migration creates a robust system for handling lineage
-- across multiple sources (GitHub/dbt, Snowflake, BigQuery, etc.)
-- while preventing duplicates and enabling cross-source linking.

-- 1. Add unique constraint on FQN to prevent duplicates
-- =====================================================
-- Drop existing constraint if it exists
ALTER TABLE metadata.objects DROP CONSTRAINT IF EXISTS objects_fqn_org_unique;

-- Add unique constraint: same FQN cannot exist twice in same org
ALTER TABLE metadata.objects 
ADD CONSTRAINT objects_fqn_org_unique 
UNIQUE (fqn, organization_id);

-- Add index for faster FQN lookups
CREATE INDEX IF NOT EXISTS idx_objects_fqn_org 
ON metadata.objects(fqn, organization_id);

-- Add index for source_type filtering
CREATE INDEX IF NOT EXISTS idx_objects_source_type 
ON metadata.objects(source_type);


-- 2. Create object mappings table for cross-source linking
-- =====================================================
-- Links logical objects (dbt models) to physical objects (Snowflake tables)
CREATE TABLE IF NOT EXISTS metadata.object_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_object_id UUID NOT NULL REFERENCES metadata.objects(id) ON DELETE CASCADE,
  physical_object_id UUID NOT NULL REFERENCES metadata.objects(id) ON DELETE CASCADE,
  mapping_type TEXT NOT NULL, -- 'dbt_to_snowflake', 'view_to_table', etc.
  confidence NUMERIC(3,2) DEFAULT 1.0, -- 0.0 to 1.0
  metadata JSONB DEFAULT '{}',
  organization_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate mappings
  UNIQUE(logical_object_id, physical_object_id, mapping_type)
);

-- Indexes for object_mappings
CREATE INDEX IF NOT EXISTS idx_object_mappings_logical 
ON metadata.object_mappings(logical_object_id);

CREATE INDEX IF NOT EXISTS idx_object_mappings_physical 
ON metadata.object_mappings(physical_object_id);

CREATE INDEX IF NOT EXISTS idx_object_mappings_org 
ON metadata.object_mappings(organization_id);


-- 3. Create unified lineage view
-- =====================================================
-- Combines all lineage sources into a single queryable view
CREATE OR REPLACE VIEW metadata.unified_lineage AS
-- Source 1: dbt dependencies (model → model)
SELECT 
  s.id as source_id,
  s.name as source_name,
  s.fqn as source_fqn,
  s.source_type as source_type,
  s.object_type as source_object_type,
  t.id as target_id,
  t.name as target_name,
  t.fqn as target_fqn,
  t.source_type as target_type,
  t.object_type as target_object_type,
  'dbt_dependency' as lineage_type,
  1.0 as confidence,
  d.organization_id,
  d.created_at
FROM metadata.dependencies d
JOIN metadata.objects s ON d.source_object_id = s.id
JOIN metadata.objects t ON d.target_object_id = t.id

UNION ALL

-- Source 2: Foreign key constraints (table → table)
SELECT 
  ref_obj.id as source_id,
  ref_obj.name as source_name,
  ref_obj.fqn as source_fqn,
  ref_obj.source_type as source_type,
  ref_obj.object_type as source_object_type,
  obj.id as target_id,
  obj.name as target_name,
  obj.fqn as target_fqn,
  obj.source_type as target_type,
  obj.object_type as target_object_type,
  'foreign_key' as lineage_type,
  1.0 as confidence,
  c.organization_id,
  c.created_at
FROM metadata.constraints c
JOIN metadata.objects obj ON c.object_id = obj.id
JOIN metadata.objects ref_obj ON c.referenced_object_id = ref_obj.id
WHERE c.constraint_type = 'FOREIGN KEY'

UNION ALL

-- Source 3: View column lineage (aggregated to table level)
SELECT DISTINCT
  s.id as source_id,
  s.name as source_name,
  s.fqn as source_fqn,
  s.source_type as source_type,
  s.object_type as source_object_type,
  t.id as target_id,
  t.name as target_name,
  t.fqn as target_fqn,
  t.source_type as target_type,
  t.object_type as target_object_type,
  'view_lineage' as lineage_type,
  AVG(cl.confidence) as confidence,
  cl.organization_id,
  MIN(cl.created_at) as created_at
FROM metadata.columns_lineage cl
JOIN metadata.objects s ON cl.source_object_id = s.id
JOIN metadata.objects t ON cl.target_object_id = t.id
GROUP BY s.id, s.name, s.fqn, s.source_type, s.object_type,
         t.id, t.name, t.fqn, t.source_type, t.object_type,
         cl.organization_id;

-- Create index on the view for better performance
CREATE INDEX IF NOT EXISTS idx_unified_lineage_org 
ON metadata.dependencies(organization_id);

CREATE INDEX IF NOT EXISTS idx_constraints_org_type 
ON metadata.constraints(organization_id, constraint_type);

CREATE INDEX IF NOT EXISTS idx_columns_lineage_org 
ON metadata.columns_lineage(organization_id);


-- 4. Create function to get full lineage graph
-- =====================================================
-- Returns upstream and downstream lineage for a given object
CREATE OR REPLACE FUNCTION metadata.get_lineage_graph(
  p_object_id UUID,
  p_organization_id UUID,
  p_depth INT DEFAULT 3,
  p_direction TEXT DEFAULT 'both' -- 'upstream', 'downstream', 'both'
)
RETURNS TABLE (
  source_id UUID,
  source_name TEXT,
  source_fqn TEXT,
  source_type TEXT,
  target_id UUID,
  target_name TEXT,
  target_fqn TEXT,
  target_type TEXT,
  lineage_type TEXT,
  confidence NUMERIC,
  depth INT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE lineage_tree AS (
    -- Base case: direct connections
    SELECT 
      ul.source_id,
      ul.source_name,
      ul.source_fqn,
      ul.source_type,
      ul.target_id,
      ul.target_name,
      ul.target_fqn,
      ul.target_type,
      ul.lineage_type,
      ul.confidence,
      1 as depth
    FROM metadata.unified_lineage ul
    WHERE ul.organization_id = p_organization_id
      AND (
        (p_direction IN ('downstream', 'both') AND ul.source_id = p_object_id) OR
        (p_direction IN ('upstream', 'both') AND ul.target_id = p_object_id)
      )
    
    UNION
    
    -- Recursive case: follow connections
    SELECT 
      ul.source_id,
      ul.source_name,
      ul.source_fqn,
      ul.source_type,
      ul.target_id,
      ul.target_name,
      ul.target_fqn,
      ul.target_type,
      ul.lineage_type,
      ul.confidence,
      lt.depth + 1
    FROM metadata.unified_lineage ul
    INNER JOIN lineage_tree lt ON (
      (p_direction IN ('downstream', 'both') AND ul.source_id = lt.target_id) OR
      (p_direction IN ('upstream', 'both') AND ul.target_id = lt.source_id)
    )
    WHERE ul.organization_id = p_organization_id
      AND lt.depth < p_depth
  )
  SELECT DISTINCT * FROM lineage_tree
  ORDER BY depth, source_name;
END;
$$ LANGUAGE plpgsql STABLE;


-- 5. Add comments for documentation
-- =====================================================
COMMENT ON TABLE metadata.object_mappings IS 
'Links logical objects (e.g., dbt models) to physical objects (e.g., Snowflake tables). Enables cross-source lineage tracking.';

COMMENT ON VIEW metadata.unified_lineage IS 
'Unified view combining lineage from all sources: dbt dependencies, foreign keys, and view definitions. Use this for multi-source lineage queries.';

COMMENT ON FUNCTION metadata.get_lineage_graph IS 
'Recursively retrieves upstream and/or downstream lineage for an object up to specified depth. Returns full lineage graph.';

COMMENT ON CONSTRAINT objects_fqn_org_unique ON metadata.objects IS 
'Ensures FQN uniqueness per organization to prevent duplicate objects from different sources.';
