# Snowflake Metadata Extraction - Analysis & Implementation Plan

## Executive Summary

After analyzing both your DuckCode Observability implementation and OpenMetadata's production-grade Snowflake connector, I've identified **critical architectural gaps** that are preventing proper metadata extraction and lineage display.

**Status:** ❌ Extraction partially working but lineage integration broken  
**Root Cause:** Missing integration layer between Snowflake connector and existing dbt metadata schema  
**Impact:** High - Users cannot see unified lineage across Snowflake + dbt sources

---

## Current Architecture Analysis

### ✅ What's Working

1. **Snowflake Connector** (`SnowflakeConnector.ts`)
   - Connection management ✓
   - Table/view extraction via SHOW commands ✓
   - Column metadata from INFORMATION_SCHEMA ✓
   - View definition extraction via GET_DDL ✓
   - Proper session context (warehouse, database, schema) ✓

2. **Extraction Orchestrator** (`ConnectorExtractionOrchestrator.ts`)
   - Connector lifecycle management ✓
   - Encryption/decryption of credentials ✓
   - Sync history tracking ✓
   - Column-level lineage extraction using Python SQLGlot ✓

3. **Database Schema** (metadata schema)
   - repositories, files, objects, columns tables ✓
   - columns_lineage table ✓
   - Proper foreign key relationships ✓

### ❌ Critical Issues Identified

#### 1. **Metadata Schema Mismatch**
**Problem:** Snowflake objects stored in `metadata.objects` but frontend expects dbt-style structure

```typescript
// Current: Snowflake creates virtual files per schema
const absolute_path = `${result.repository.path}/${schemaName}.virtual.sql`;
// Issue: Frontend lineage queries expect real file paths from dbt manifest
```

**Impact:** 
- Lineage graph cannot find Snowflake objects
- No integration between dbt models and Snowflake tables
- Duplicate data structures instead of unified view

#### 2. **Missing Cross-Source Lineage Resolution**
**Problem:** No mechanism to link dbt models → Snowflake tables

```sql
-- dbt model: models/marts/customers.sql
SELECT * FROM {{ ref('stg_customers') }}

-- Snowflake table: ANALYTICS.MARTS.CUSTOMERS
-- ❌ No link between these two representations
```

**OpenMetadata Solution:**
- Uses fully qualified names (FQN) for object resolution
- Maintains name normalization across sources
- Cross-references via database.schema.table matching

#### 3. **Frontend Lineage Query Limitations**
**Problem:** Current lineage API only queries dbt-extracted metadata

```typescript
// Current: backend/src/api/controllers/metadata-lineage.controller.ts
// Only queries objects from connection_id (dbt connections)
// ❌ Ignores connector_id (Snowflake connectors)
```

**Impact:**
- Snowflake-extracted objects invisible in lineage graph
- Cannot show upstream Snowflake sources for dbt models
- Missing "Apply to Data" lineage feature

#### 4. **Incomplete Column Lineage Integration**
**Problem:** Column lineage extracted but not displayed in UI

```typescript
// Backend extracts column lineage ✓
await supabase.schema('metadata').from('columns_lineage').upsert({...})

// Frontend: ColumnLineageView.tsx
// ❌ Only shows mock data, doesn't query columns_lineage table
```

#### 5. **No Incremental Extraction Strategy**
**Problem:** Full re-extraction on every sync (inefficient for large warehouses)

**OpenMetadata Solution:**
- Incremental extraction based on timestamps
- Change detection via Snowflake's INFORMATION_SCHEMA
- Selective object updates

---

## OpenMetadata Best Practices (Reference)

### 1. **Multi-Source Architecture**
```python
# OpenMetadata: ingestion/source/database/snowflake/metadata.py
class SnowflakeSource(MultiDBSource, CommonDbSourceService):
    """
    - Iterates through databases
    - Extracts schemas per database
    - Normalizes names for cross-source matching
    - Builds FQN: service.database.schema.table
    """
```

### 2. **Lineage Extraction**
```python
# OpenMetadata: ingestion/source/database/snowflake/lineage.py
class SnowflakeLineageSource:
    """
    - Queries ACCOUNT_USAGE.QUERY_HISTORY
    - Parses SQL for table dependencies
    - Extracts column-level lineage from query AST
    - Links to existing metadata via FQN matching
    """
```

### 3. **Name Normalization**
```python
# OpenMetadata handles case-insensitive matching
SnowflakeDialect.normalize_name = normalize_names
# Ensures: CUSTOMERS = customers = Customers
```

### 4. **External Table Lineage**
```python
# OpenMetadata: ExternalTableLineageMixin
# Links Snowflake external tables → S3/GCS sources
# Provides complete data lineage from source to consumption
```

---

## Recommended Implementation Plan

### Phase 1: Backend Architecture Fixes (Priority: CRITICAL)

#### 1.1 Unified Metadata Model
**File:** `backend/src/services/metadata/storage/MetadataStorageService.ts`

**Changes:**
```typescript
// Add source_type field to objects table
ALTER TABLE metadata.objects 
  ADD COLUMN source_type TEXT CHECK (source_type IN ('dbt', 'snowflake', 'bigquery'));

// Add FQN (Fully Qualified Name) for cross-source matching
ALTER TABLE metadata.objects 
  ADD COLUMN fqn TEXT UNIQUE;

// Update storage service
async storeObject(objectData: any) {
  const fqn = this.buildFQN(
    objectData.database_name,
    objectData.schema_name,
    objectData.name
  );
  
  return await supabase.schema('metadata').from('objects').upsert({
    ...objectData,
    fqn,
    source_type: objectData.connector_id ? 'snowflake' : 'dbt'
  });
}

private buildFQN(db?: string, schema?: string, name?: string): string {
  return [db, schema, name]
    .filter(Boolean)
    .map(s => s.toUpperCase())
    .join('.');
}
```

#### 1.2 Cross-Source Lineage Resolution
**File:** `backend/src/services/connectors/ConnectorExtractionOrchestrator.ts`

**Changes:**
```typescript
// After extracting Snowflake metadata, link to dbt models
async linkToDbtModels(snowflakeObjects: ExtractedObject[], orgId: string) {
  for (const sfObj of snowflakeObjects) {
    const fqn = this.buildFQN(sfObj.database_name, sfObj.schema_name, sfObj.name);
    
    // Find matching dbt model
    const { data: dbtModel } = await supabase
      .schema('metadata')
      .from('objects')
      .select('id')
      .eq('organization_id', orgId)
      .eq('fqn', fqn)
      .eq('source_type', 'dbt')
      .single();
    
    if (dbtModel) {
      // Create bidirectional dependency
      await supabase.schema('metadata').from('dependencies').upsert({
        organization_id: orgId,
        source_object_id: sfObj.id,
        target_object_id: dbtModel.id,
        dependency_type: 'materialization'
      });
    }
  }
}
```

#### 1.3 Enhanced Lineage API
**File:** `backend/src/api/controllers/metadata-lineage.controller.ts`

**Changes:**
```typescript
export async function getUnifiedLineage(req: Request, res: Response) {
  const { organizationId } = req.query;
  
  // Query BOTH connection_id AND connector_id
  const { data: objects } = await supabase
    .schema('metadata')
    .from('objects')
    .select(`
      *,
      upstream:dependencies!target_object_id(source_object_id, dependency_type),
      downstream:dependencies!source_object_id(target_object_id, dependency_type)
    `)
    .eq('organization_id', organizationId)
    .or('connection_id.not.is.null,connector_id.not.is.null');
  
  // Build unified graph with both dbt + Snowflake nodes
  return res.json({ lineage: buildLineageGraph(objects) });
}
```

### Phase 2: Frontend Integration (Priority: HIGH)

#### 2.1 Unified Lineage Display
**File:** `frontend/src/components/lineage/CodeLineageView.tsx`

**Changes:**
```typescript
// Fetch lineage from new unified API
const fetchUnifiedLineage = async () => {
  const response = await fetch(
    `${API_URL}/api/metadata/lineage/unified?organizationId=${orgId}`
  );
  const { lineage } = await response.json();
  
  // Render nodes with source type badges
  return lineage.map(node => ({
    ...node,
    badge: node.source_type, // 'dbt' | 'snowflake'
    color: node.source_type === 'dbt' ? '#FF6B4A' : '#29B5E8'
  }));
};
```

#### 2.2 Column Lineage Display
**File:** `frontend/src/components/lineage/ColumnLineageView.tsx`

**Changes:**
```typescript
// Replace mock data with real API call
const fetchColumnLineage = async (objectId: string) => {
  const response = await fetch(
    `${API_URL}/api/metadata/lineage/columns?objectId=${objectId}`
  );
  const { lineage } = await response.json();
  
  // Display column-level transformations
  return lineage.map(edge => ({
    source: edge.source_column,
    target: edge.target_column,
    transformation: edge.transformation_type,
    expression: edge.expression,
    confidence: edge.confidence
  }));
};
```

#### 2.3 Source Type Indicators
**File:** `frontend/src/components/lineage/ModernModelNode.tsx`

**Changes:**
```tsx
// Add visual indicators for source type
<div className="node-badge">
  {node.source_type === 'snowflake' && (
    <SnowflakeIcon className="w-4 h-4 text-blue-500" />
  )}
  {node.source_type === 'dbt' && (
    <DbtIcon className="w-4 h-4 text-orange-500" />
  )}
</div>
```

### Phase 3: User Experience Improvements (Priority: MEDIUM)

#### 3.1 Extraction Progress Tracking
**File:** `frontend/src/pages/dashboard/ConnectorsPage.tsx`

**Changes:**
```typescript
// Real-time extraction progress via WebSocket or polling
const [extractionProgress, setExtractionProgress] = useState<{
  phase: string;
  progress: number;
  objectsExtracted: number;
}>({});

// Poll extraction status every 2 seconds
useEffect(() => {
  if (extracting) {
    const interval = setInterval(async () => {
      const status = await connectorsService.getExtractionStatus(connectorId);
      setExtractionProgress(status);
    }, 2000);
    return () => clearInterval(interval);
  }
}, [extracting]);
```

#### 3.2 Lineage Filters
**File:** `frontend/src/components/lineage/LineageFilters.tsx`

**Changes:**
```typescript
// Filter by source type
<select onChange={(e) => setSourceFilter(e.target.value)}>
  <option value="all">All Sources</option>
  <option value="dbt">dbt Models Only</option>
  <option value="snowflake">Snowflake Tables Only</option>
</select>

// Filter by object type
<select onChange={(e) => setTypeFilter(e.target.value)}>
  <option value="all">All Types</option>
  <option value="table">Tables</option>
  <option value="view">Views</option>
  <option value="model">dbt Models</option>
</select>
```

#### 3.3 Error Handling & Retry
**File:** `backend/src/services/connectors/SnowflakeConnector.ts`

**Changes:**
```typescript
// Add retry logic for transient failures
private async execWithRetry(sql: string, maxRetries = 3): Promise<any[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.exec(sql);
    } catch (e: any) {
      if (attempt === maxRetries) throw e;
      
      // Retry on specific errors
      if (e.message.includes('timeout') || e.message.includes('network')) {
        console.log(`[SNOWFLAKE] Retry ${attempt}/${maxRetries} after error:`, e.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw e;
    }
  }
}
```

---

## Database Migration Plan

### Migration 1: Add FQN and Source Type
```sql
-- File: supabase/migrations/20251104000001_add_fqn_source_type.sql

BEGIN;

-- Add FQN for cross-source matching
ALTER TABLE metadata.objects 
  ADD COLUMN IF NOT EXISTS fqn TEXT;

-- Add source type to distinguish dbt vs Snowflake
ALTER TABLE metadata.objects 
  ADD COLUMN IF NOT EXISTS source_type TEXT 
  CHECK (source_type IN ('dbt', 'snowflake', 'bigquery', 'redshift'));

-- Create index for FQN lookups
CREATE INDEX IF NOT EXISTS idx_objects_fqn 
  ON metadata.objects(fqn);

-- Create index for source type filtering
CREATE INDEX IF NOT EXISTS idx_objects_source_type 
  ON metadata.objects(source_type);

-- Backfill existing data
UPDATE metadata.objects 
SET source_type = CASE 
  WHEN connection_id IS NOT NULL THEN 'dbt'
  WHEN connector_id IS NOT NULL THEN 'snowflake'
  ELSE 'dbt'
END
WHERE source_type IS NULL;

-- Build FQN for existing records
UPDATE metadata.objects 
SET fqn = UPPER(
  COALESCE(database_name || '.', '') || 
  COALESCE(schema_name || '.', '') || 
  name
)
WHERE fqn IS NULL;

COMMIT;
```

### Migration 2: Enhanced Dependencies
```sql
-- File: supabase/migrations/20251104000002_enhance_dependencies.sql

BEGIN;

-- Add dependency metadata
ALTER TABLE metadata.dependencies 
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add confidence score for auto-detected dependencies
ALTER TABLE metadata.dependencies 
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(3,2) DEFAULT 1.0;

-- Create index for metadata queries
CREATE INDEX IF NOT EXISTS idx_dependencies_metadata 
  ON metadata.dependencies USING gin(metadata);

COMMIT;
```

---

## Testing Strategy

### Unit Tests
```typescript
// backend/src/services/connectors/__tests__/SnowflakeConnector.test.ts
describe('SnowflakeConnector', () => {
  it('should extract tables and views', async () => {
    const connector = new SnowflakeConnector('test', mockConfig);
    const result = await connector.extractMetadata();
    expect(result.objects.length).toBeGreaterThan(0);
    expect(result.objects[0]).toHaveProperty('fqn');
  });
  
  it('should handle connection failures gracefully', async () => {
    const connector = new SnowflakeConnector('test', invalidConfig);
    await expect(connector.testConnection()).rejects.toThrow();
  });
});
```

### Integration Tests
```typescript
// backend/src/services/connectors/__tests__/integration.test.ts
describe('Snowflake → dbt Integration', () => {
  it('should link Snowflake table to dbt model', async () => {
    // 1. Extract Snowflake metadata
    await orchestrator.extract(snowflakeConnectorId, userId);
    
    // 2. Extract dbt metadata
    await dbtExtractor.extract(connectionId, userId);
    
    // 3. Verify cross-source lineage
    const lineage = await getUnifiedLineage(orgId);
    const sfTable = lineage.find(n => n.source_type === 'snowflake');
    const dbtModel = lineage.find(n => n.source_type === 'dbt');
    
    expect(sfTable.downstream).toContain(dbtModel.id);
  });
});
```

### E2E Tests
```typescript
// frontend/cypress/e2e/snowflake-lineage.cy.ts
describe('Snowflake Lineage Display', () => {
  it('should show unified lineage graph', () => {
    cy.visit('/dashboard/lineage');
    cy.get('[data-testid="lineage-graph"]').should('exist');
    cy.get('[data-testid="node-snowflake"]').should('have.length.greaterThan', 0);
    cy.get('[data-testid="node-dbt"]').should('have.length.greaterThan', 0);
  });
  
  it('should filter by source type', () => {
    cy.get('[data-testid="source-filter"]').select('snowflake');
    cy.get('[data-testid="node-dbt"]').should('not.exist');
    cy.get('[data-testid="node-snowflake"]').should('exist');
  });
});
```

---

## Performance Optimization

### 1. Batch Processing
```typescript
// Process objects in batches to avoid memory issues
const BATCH_SIZE = 100;
for (let i = 0; i < objects.length; i += BATCH_SIZE) {
  const batch = objects.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(obj => storage.storeObject(obj)));
}
```

### 2. Parallel Extraction
```typescript
// Extract tables and views in parallel
const [tables, views] = await Promise.all([
  this.exec(`SHOW TABLES ${showScope}`),
  this.exec(`SHOW VIEWS ${showScope}`)
]);
```

### 3. Caching
```typescript
// Cache connector configs to avoid repeated decryption
const configCache = new Map<string, ConnectorConfig>();

async getConfig(connectorId: string): Promise<ConnectorConfig> {
  if (configCache.has(connectorId)) {
    return configCache.get(connectorId)!;
  }
  
  const config = await this.fetchAndDecryptConfig(connectorId);
  configCache.set(connectorId, config);
  return config;
}
```

---

## Monitoring & Observability

### 1. Extraction Metrics
```typescript
// Track extraction performance
interface ExtractionMetrics {
  connectorId: string;
  startTime: Date;
  endTime: Date;
  objectsExtracted: number;
  columnsExtracted: number;
  lineageEdges: number;
  errors: string[];
}

// Store in enterprise.connector_sync_history.metadata
await supabase.schema('enterprise').from('connector_sync_history').update({
  metadata: {
    duration_ms: endTime - startTime,
    objects_per_second: objectsExtracted / (duration_ms / 1000),
    errors: errors
  }
});
```

### 2. Lineage Quality Metrics
```typescript
// Track lineage accuracy
interface LineageQuality {
  totalEdges: number;
  autoDetected: number;
  manuallyVerified: number;
  averageConfidence: number;
  brokenLinks: number;
}
```

---

## Rollout Plan

### Week 1: Backend Foundation
- [ ] Implement FQN and source_type fields
- [ ] Update MetadataStorageService
- [ ] Add cross-source lineage resolution
- [ ] Write unit tests

### Week 2: API & Integration
- [ ] Create unified lineage API endpoint
- [ ] Implement column lineage API
- [ ] Add extraction progress tracking
- [ ] Integration tests

### Week 3: Frontend Updates
- [ ] Update LineageGraph to show both sources
- [ ] Implement source type filters
- [ ] Add column lineage display
- [ ] UI/UX polish

### Week 4: Testing & Launch
- [ ] E2E testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Beta launch with select users

---

## Success Metrics

1. **Extraction Success Rate:** >95% of Snowflake objects extracted without errors
2. **Lineage Accuracy:** >90% of dbt ↔ Snowflake links correctly identified
3. **Performance:** <5 minutes for 1000 objects extraction
4. **User Satisfaction:** Users can see complete data lineage from Snowflake → dbt → BI tools

---

## Next Steps

1. **Review this document** with your team
2. **Prioritize phases** based on business needs
3. **Start with Phase 1.1** (Unified Metadata Model) - highest impact
4. **Set up monitoring** before rolling out to production
5. **Iterate based on user feedback**

---

## References

- OpenMetadata Snowflake Source: `/Users/Kranthi_1/duck-main/OpenMetadata/ingestion/src/metadata/ingestion/source/database/snowflake/`
- Current Implementation: `/Users/Kranthi_1/duck-main/duckcode-observability/backend/src/services/connectors/`
- Metadata Schema: `/Users/Kranthi_1/duck-main/duckcode-observability/supabase/migrations/`

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-03  
**Author:** Cascade AI Analysis
