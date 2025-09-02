# Phase 2D: Advanced Cross-Language Dependency Analysis

## 🎯 **Overview**

Phase 2D provides comprehensive impact analysis and dependency tracking for **all programming languages** (SQL, Python, dbt, PySpark, Scala, R, etc.). This system answers critical questions like:

- **"If I change this column, what scripts are impacted?"**
- **"If I modify this file, what dependencies are affected?"**
- **"What's the complete dependency chain for this data asset?"**

## 🏗️ **Architecture**

### **Core Tables**
1. **`column_dependency_graph`** - Column-level dependencies across files
2. **`repository_dependency_summary`** - Repository-wide dependency metrics
3. **`cross_language_asset_mapping`** - Assets that exist across multiple languages
4. **`comprehensive_impact_analysis`** - Impact analysis results

### **Key Functions**
1. **`analyze_column_impact()`** - Column impact analysis
2. **`analyze_file_impact()`** - File impact analysis
3. **`generate_repository_dependency_report()`** - Repository overview

## 🚀 **Usage Examples**

### **1. Column Impact Analysis**

```sql
-- Find all columns affected by changing a specific column
SELECT * FROM code_insights.analyze_column_impact(
    'your-column-id-here',
    'modification',  -- change type
    10              -- max depth
);
```

**API Usage:**
```bash
curl -X POST http://localhost:3000/api/impact/column \
  -H "Content-Type: application/json" \
  -d '{
    "objectId": "column-uuid",
    "changeType": "modification",
    "maxDepth": 10
  }'
```

**Response:**
```json
{
  "changedObject": {
    "type": "column",
    "name": "customer_id",
    "dataType": "UUID",
    "asset": "customers_table",
    "file": "models/staging/stg_customers.sql",
    "language": "sql"
  },
  "impactAnalysis": {
    "totalImpactedColumns": 15,
    "maxImpactLevel": 4,
    "criticalImpacts": 2,
    "highImpacts": 5,
    "mediumImpacts": 6,
    "lowImpacts": 2
  },
  "impactedColumns": [
    {
      "level": 1,
      "columnName": "customer_id",
      "assetName": "customer_orders",
      "filePath": "models/marts/customer_orders.sql",
      "impactType": "join_key",
      "severity": "critical",
      "transformationChain": ["JOIN ON customers.customer_id = orders.customer_id"],
      "businessImpact": "Primary key relationship",
      "fixComplexity": "high"
    }
  ],
  "recommendations": [
    "⚠️ CRITICAL: 2 critical dependencies found. Coordinate with stakeholders before making changes.",
    "🔥 HIGH IMPACT: 5 high-impact dependencies. Thorough testing required.",
    "📊 DEEP IMPACT: Dependencies found up to 4 levels deep. Consider phased rollout."
  ]
}
```

### **2. File Impact Analysis**

```sql
-- Find all files affected by changing a specific file
SELECT * FROM code_insights.analyze_file_impact(
    'your-file-id-here',
    'modification',  -- change type
    10              -- max depth
);
```

**API Usage:**
```bash
curl -X POST http://localhost:3000/api/impact/file \
  -H "Content-Type: application/json" \
  -d '{
    "objectId": "file-uuid",
    "changeType": "modification",
    "maxDepth": 10
  }'
```

### **3. Repository Dependency Report**

```sql
-- Get comprehensive repository dependency overview
SELECT * FROM code_insights.generate_repository_dependency_report('your-repo-id');
```

**API Usage:**
```bash
curl http://localhost:3000/api/impact/repository/your-repo-id/report
```

## 🔍 **Search Dependencies**

```bash
# Search for all dependencies related to "customer_id"
curl "http://localhost:3000/api/impact/search?query=customer_id&repositoryId=repo-uuid&objectType=all&limit=50"
```

## 📊 **Understanding Impact Levels**

### **Impact Severity:**
- **Critical**: Breaking changes, primary keys, required fields
- **High**: Important business logic, frequently used columns
- **Medium**: Secondary relationships, calculated fields
- **Low**: Optional fields, metadata columns

### **Dependency Types:**
- **direct_copy**: Column copied as-is
- **calculation**: Mathematical transformation
- **aggregation**: SUM, COUNT, AVG operations
- **join_key**: Used in JOIN operations
- **filter_condition**: Used in WHERE clauses
- **transformation**: Data type or format changes

## 🛠️ **Implementation Guide**

### **Step 1: Process Existing Data**

After your lineage processing is complete, run the enhanced processor:

```bash
# Call the lineage processor edge function
curl -X POST http://localhost:54321/functions/v1/lineage-processor \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"repositoryId": "your-repo-uuid"}'
```

### **Step 2: Query Dependencies**

Use the new views for easy querying:

```sql
-- View file dependency network
SELECT * FROM code_insights.v_file_dependency_network 
WHERE source_file LIKE '%customer%';

-- View column lineage network
SELECT * FROM code_insights.v_column_lineage_network 
WHERE source_column = 'customer_id';
```

### **Step 3: Monitor Repository Health**

```sql
-- Check repository dependency summary
SELECT * FROM code_insights.repository_dependency_summary 
WHERE repository_id = 'your-repo-uuid';
```

## 🎯 **Use Cases**

### **1. Data Migration Planning**
```sql
-- Before changing a column type, check impact
SELECT 
    impacted_column_name,
    impacted_asset_name,
    impact_severity,
    fix_complexity
FROM code_insights.analyze_column_impact('column-id', 'type_change');
```

### **2. Refactoring Assessment**
```sql
-- Before refactoring a file, check dependencies
SELECT 
    impacted_file_path,
    impact_severity,
    recommended_actions
FROM code_insights.analyze_file_impact('file-id', 'modification');
```

### **3. Breaking Change Analysis**
```sql
-- Assess impact of removing a column
SELECT * FROM code_insights.analyze_column_impact('column-id', 'deletion');
```

## 🔄 **Cross-Language Support**

The system works across all programming languages:

### **SQL/dbt**
- Table and column dependencies
- JOIN relationships
- Transformation logic

### **Python/PySpark**
- DataFrame operations
- Column transformations
- Function dependencies

### **Scala/Spark**
- Dataset operations
- Column mappings
- UDF dependencies

### **R**
- Data frame operations
- Variable dependencies
- Function calls

## 📈 **Performance Optimization**

### **Indexes Created:**
- `idx_column_dependency_graph_source`
- `idx_column_dependency_graph_target`
- `idx_cross_language_mapping_canonical`
- `idx_comprehensive_impact_changed`

### **Batch Processing:**
- Column dependencies processed in batches of 100
- Cross-file relationships optimized for large repositories
- Repository summaries cached and updated incrementally

## 🚨 **Best Practices**

### **1. Regular Analysis**
- Run repository-wide analysis weekly
- Check impact before major changes
- Monitor circular dependencies

### **2. Change Management**
- Always run impact analysis before modifications
- Document breaking changes
- Coordinate with stakeholders for critical impacts

### **3. Testing Strategy**
- Test all high and critical impact changes
- Use staging environment for validation
- Implement rollback strategies

## 🔧 **Troubleshooting**

### **Common Issues:**

**1. No Dependencies Found**
```sql
-- Check if lineage data exists
SELECT COUNT(*) FROM code_insights.data_lineage;
SELECT COUNT(*) FROM code_insights.column_dependency_graph;
```

**2. Low Confidence Scores**
```sql
-- Review confidence scores
SELECT dependency_type, AVG(confidence_score) 
FROM code_insights.column_dependency_graph 
GROUP BY dependency_type;
```

**3. Missing Cross-File Relationships**
```sql
-- Check file dependencies
SELECT COUNT(*) FROM code_insights.file_dependencies;
```

## 🎉 **Next Steps**

1. **Populate Initial Data**: Run lineage processing on your repository
2. **Test Impact Analysis**: Try column and file impact queries
3. **Integrate with CI/CD**: Add impact analysis to your deployment pipeline
4. **Monitor Health**: Set up regular repository health checks
5. **Customize Alerts**: Configure notifications for critical dependencies

## 🤝 **Enterprise Features**

This system provides the foundation for:
- **Migration Intelligence**: Smart SQL to dbt migrations
- **Business Impact Assessment**: Stakeholder notification systems
- **Quality Scoring**: Data asset reliability metrics
- **Automated Testing**: Dependency-aware test generation

The goal is to make dependency management as easy as dbt but work across **all data processing languages** in your organization! 