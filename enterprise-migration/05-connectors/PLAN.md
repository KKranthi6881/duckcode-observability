# Phase 5: Enhanced Connector Framework

## 🎯 Objective
Build scalable connector framework to extract metadata from multiple data sources (databases, warehouses, BI tools) - similar to OpenMetadata's connector architecture.

## 🔌 Connector Architecture

### Base Connector Interface
```typescript
interface IConnector {
  name: string;
  type: ConnectorType;
  version: string;
  
  // Lifecycle
  configure(config: ConnectorConfig): Promise<void>;
  testConnection(): Promise<ConnectionTestResult>;
  
  // Metadata extraction
  extractMetadata(): Promise<MetadataExtractionResult>;
  getSchemas(): Promise<Schema[]>;
  getTables(schema: string): Promise<Table[]>;
  getColumns(schema: string, table: string): Promise<Column[]>;
  
  // Incremental
  getChangedObjects(since: Date): Promise<Object[]>;
  
  // Cleanup
  disconnect(): Promise<void>;
}
```

## 📋 Connector Types

### 1. GitHub Connector (✅ Already Exists)
**Status**: Enhance for enterprise

**Enhancements**:
- Support GitHub Enterprise Server
- Private repository access
- Branch-specific extraction
- Commit hook integration
- PR metadata extraction

### 2. Database Connectors

#### Snowflake
```typescript
class SnowflakeConnector implements IConnector {
  config: {
    account: string;
    warehouse: string;
    database: string;
    schema: string;
    username: string;
    password: string; // encrypted
  }
  
  async extractMetadata(): Promise<MetadataExtractionResult> {
    // Query INFORMATION_SCHEMA
    // Extract tables, views, columns
    // Build lineage from view definitions
  }
}
```

#### BigQuery
```typescript
class BigQueryConnector implements IConnector {
  config: {
    projectId: string;
    dataset: string;
    credentials: string; // service account JSON
  }
  
  async extractMetadata(): Promise<MetadataExtractionResult> {
    // Use BigQuery API
    // Query INFORMATION_SCHEMA
    // Extract tables, views, columns, partitions
  }
}
```

#### PostgreSQL / MySQL / Redshift
```typescript
class PostgreSQLConnector implements IConnector {
  config: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
  }
  
  async extractMetadata(): Promise<MetadataExtractionResult> {
    // Connect via pg driver
    // Query pg_catalog
    // Extract schemas, tables, columns, constraints
  }
}
```

#### Databricks
```typescript
class DatabricksConnector implements IConnector {
  config: {
    host: string;
    token: string;
    catalog: string;
    schema: string;
  }
  
  async extractMetadata(): Promise<MetadataExtractionResult> {
    // Use Databricks SQL API
    // Query Unity Catalog
    // Extract tables, views, notebooks
  }
}
```

### 3. BI Tool Connectors

#### Tableau
```typescript
class TableauConnector implements IConnector {
  config: {
    serverUrl: string;
    siteId: string;
    tokenName: string;
    tokenValue: string;
  }
  
  async extractMetadata(): Promise<MetadataExtractionResult> {
    // Use Tableau REST API
    // Extract workbooks, datasources, dashboards
    // Parse calculated fields for lineage
  }
}
```

#### Looker
```typescript
class LookerConnector implements IConnector {
  config: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
  }
  
  async extractMetadata(): Promise<MetadataExtractionResult> {
    // Use Looker API
    // Extract models, explores, views
    // Parse LookML for lineage
  }
}
```

#### Power BI
```typescript
class PowerBIConnector implements IConnector {
  config: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    workspaceId: string;
  }
  
  async extractMetadata(): Promise<MetadataExtractionResult> {
    // Use Power BI REST API
    // Extract datasets, reports, dashboards
    // Parse DAX for lineage
  }
}
```

## 🏭 Connector Factory

```typescript
class ConnectorFactory {
  static create(type: ConnectorType, config: ConnectorConfig): IConnector {
    switch (type) {
      case 'github':
        return new GitHubConnector(config);
      case 'snowflake':
        return new SnowflakeConnector(config);
      case 'bigquery':
        return new BigQueryConnector(config);
      case 'postgresql':
        return new PostgreSQLConnector(config);
      case 'tableau':
        return new TableauConnector(config);
      // ... etc
      default:
        throw new Error(`Unknown connector type: ${type}`);
    }
  }
}
```

## 📊 Connector Management

### Database Schema (Supabase)
```sql
CREATE TABLE enterprise.connectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES enterprise.organizations(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'github', 'snowflake', 'bigquery', etc.
  config JSONB NOT NULL, -- encrypted connection details
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'error'
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE enterprise.connector_sync_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id UUID REFERENCES enterprise.connectors(id),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL, -- 'running', 'completed', 'failed'
  objects_extracted INTEGER,
  error_message TEXT,
  metadata JSONB
);
```

## 🔄 Extraction Workflow

### 1. Connector Configuration (Admin Portal)
```typescript
// User fills out connector form
const connector = await createConnector({
  organizationId: currentOrg.id,
  type: 'snowflake',
  name: 'Production Snowflake',
  config: {
    account: 'abc123.us-east-1',
    warehouse: 'COMPUTE_WH',
    database: 'PROD_DB',
    username: 'svc_duckcode',
    password: encrypt('secret'),
  }
});
```

### 2. Test Connection
```typescript
const connector = ConnectorFactory.create('snowflake', config);
const testResult = await connector.testConnection();

if (!testResult.success) {
  throw new Error(`Connection failed: ${testResult.error}`);
}
```

### 3. Schedule Extraction
```typescript
// Queue extraction job
await queueMetadataExtraction({
  connectorId: connector.id,
  organizationId: connector.organization_id,
  schedule: 'daily', // or cron expression
});
```

### 4. Extract Metadata
```typescript
const connector = ConnectorFactory.create(connectorType, connectorConfig);
await connector.configure(config);

const result = await connector.extractMetadata();
// result contains: schemas, tables, columns, lineage

await metadataStorageService.storeExtractedMetadata(
  organizationId,
  connectorId,
  result
);
```

## 🔐 Security

### Credential Encryption
```typescript
// Encrypt sensitive fields before storing
import { encrypt, decrypt } from './encryption';

const encryptedConfig = {
  ...config,
  password: encrypt(config.password),
  token: encrypt(config.token),
};

// Decrypt when using
const decryptedConfig = {
  ...config,
  password: decrypt(config.password),
  token: decrypt(config.token),
};
```

### Secrets Management
- Store credentials in Supabase Vault
- Or use environment variable references
- Never log sensitive values
- Rotate credentials regularly

## 📊 Monitoring

### Connector Health Checks
```typescript
// Periodic health check
setInterval(async () => {
  const connectors = await getActiveConnectors(organizationId);
  
  for (const connector of connectors) {
    const health = await checkConnectorHealth(connector);
    
    if (!health.isHealthy) {
      await notifyAdmins({
        subject: `Connector ${connector.name} is unhealthy`,
        message: health.error,
      });
    }
  }
}, 15 * 60 * 1000); // every 15 minutes
```

### Extraction Metrics
- Objects extracted per run
- Extraction duration
- Error rate
- Data freshness

## ✅ Acceptance Criteria

- [ ] Connector framework supports 10+ data sources
- [ ] GitHub connector enhanced for enterprise
- [ ] Database connectors (Snowflake, BigQuery, PostgreSQL) working
- [ ] BI tool connectors (Tableau, Looker) working
- [ ] Connector configuration UI in admin portal
- [ ] Test connection validates before save
- [ ] Scheduled extraction jobs working
- [ ] Connector health monitoring active
- [ ] Credentials encrypted and secure
- [ ] Documentation for adding new connectors

## 🚀 Connector Plugin System (Future)

### Allow Custom Connectors
```typescript
// User uploads connector package
interface CustomConnectorPlugin {
  manifest: {
    name: string;
    version: string;
    author: string;
  };
  connector: IConnector; // implements interface
}

// Load at runtime
await ConnectorRegistry.register(customPlugin);
```
