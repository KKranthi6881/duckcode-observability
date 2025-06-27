# LLM Prompt Engineering for Universal Data Lineage

## Multi-Stage Processing Pipeline

### Stage 1: Asset Discovery & Inventory

#### SQL Files - Table & View Discovery
```json
{
  "system_prompt": "You are a data lineage expert analyzing SQL code. Extract ALL data assets (tables, views, CTEs, temp tables) from this SQL file. Focus on identifying:\n\n1. **Source Tables/Views**: Tables being read from (FROM, JOIN clauses)\n2. **Target Tables/Views**: Tables being written to (INSERT, CREATE, UPDATE)\n3. **Intermediate Assets**: CTEs, temp tables, derived tables\n4. **Schema Context**: Database and schema names when available\n\nBe comprehensive - capture every data asset reference, even if it appears multiple times.",
  
  "user_prompt_template": "Analyze this SQL file and extract all data assets:\n\n**File Path**: {file_path}\n**Language**: {language}\n\n**Code Content**:\n```sql\n{code_content}\n```\n\nReturn a JSON response with this exact structure:",
  
  "expected_output": {
    "assets": [
      {
        "asset_name": "users",
        "asset_type": "table|view|cte|temp_table",
        "schema_name": "public",
        "database_name": "analytics",
        "full_qualified_name": "analytics.public.users",
        "access_pattern": "source|target|intermediate",
        "line_numbers": [12, 45, 67],
        "context_snippet": "SELECT * FROM analytics.public.users u",
        "metadata": {
          "referenced_columns": ["user_id", "email", "created_at"],
          "operations": ["select", "join"],
          "conditions": ["WHERE u.status = 'active'"]
        }
      }
    ],
    "confidence_score": 0.95,
    "parsing_notes": "All table references successfully identified",
    "schema_inference": {
      "default_database": "analytics",
      "default_schema": "public"
    }
  }
}
```

#### Python/PySpark Files - Data Asset Discovery
```json
{
  "system_prompt": "You are analyzing Python/PySpark code for data lineage. Focus on:\n\n1. **DataFrame Operations**: spark.read, pandas.read_sql, etc.\n2. **Table References**: .table(), .sql() calls\n3. **File I/O**: Reading/writing CSV, Parquet, Delta tables\n4. **Database Connections**: SQL queries within Python\n5. **Variable Assignments**: DataFrames stored in variables\n\nExtract both explicit table names and inferred dataset names from file paths.",
  
  "user_prompt_template": "Analyze this Python file for data assets:\n\n**File Path**: {file_path}\n**Language**: {language}\n\n**Code Content**:\n```python\n{code_content}\n```\n\nReturn JSON with this structure:",
  
  "expected_output": {
    "assets": [
      {
        "asset_name": "customer_orders",
        "asset_type": "dataframe|table|file|dataset",
        "source_type": "spark_table|parquet_file|csv_file|sql_query|api_endpoint",
        "file_path": "/data/warehouse/customer_orders.parquet",
        "access_pattern": "read|write|transform",
        "line_numbers": [23],
        "context_snippet": "df = spark.read.parquet('/data/warehouse/customer_orders.parquet')",
        "inferred_schema": {
          "database": "data_warehouse",
          "schema": "sales"
        },
        "operations": ["read", "groupBy", "agg"],
        "variable_name": "df_orders"
      }
    ],
    "functions_defined": [
      {
        "function_name": "process_customer_data",
        "parameters": ["input_df", "date_filter"],
        "return_type": "DataFrame",
        "line_start": 45,
        "line_end": 78,
        "transforms_data": true
      }
    ],
    "imports": [
      {"module": "pyspark.sql", "functions": ["SparkSession", "DataFrame"]},
      {"module": "pandas", "alias": "pd"}
    ],
    "confidence_score": 0.88
  }
}
```

### Stage 2: Relationship & Lineage Extraction

#### Data Flow Analysis
```json
{
  "system_prompt": "You are analyzing code to map data lineage relationships. Focus on:\n\n1. **Data Flow**: How data moves from source to target\n2. **Transformations**: What happens to data between source and target\n3. **Join Relationships**: How tables are connected\n4. **Aggregations**: GROUP BY, window functions, etc.\n5. **Filtering**: WHERE clauses, HAVING, filter conditions\n\nFor each relationship, identify the business logic and technical implementation.",
  
  "user_prompt_template": "Analyze the data flow relationships in this code:\n\n**Previously Identified Assets**:\n{discovered_assets}\n\n**Code Content**:\n```{language}\n{code_content}\n```\n\nMap all data lineage relationships:",
  
  "expected_output": {
    "table_relationships": [
      {
        "source_asset": "raw_customer_data",
        "target_asset": "clean_customers",
        "relationship_type": "transforms",
        "operation_type": "create_table_as",
        "transformation_logic": "Data cleaning: standardize phone numbers, validate emails, remove duplicates",
        "business_context": "Customer data standardization for downstream analytics",
        "confidence_score": 0.92,
        "discovered_at_line": 45,
        "technical_details": {
          "join_conditions": [],
          "filter_conditions": ["email IS NOT NULL", "phone ~ '^[0-9-]+$'"],
          "aggregation_logic": {"type": "deduplication", "key": "customer_id"}
        },
        "estimated_row_impact": "1:0.8 ratio (removes ~20% duplicates)",
        "execution_frequency": "daily"
      }
    ],
    "column_relationships": [
      {
        "source_column": "raw_customer_data.customer_email",
        "target_column": "clean_customers.email",
        "transformation_type": "direct",
        "transformation_logic": "LOWER(TRIM(customer_email))",
        "business_rule": "Normalize email addresses to lowercase",
        "quality_impact": "improves",
        "data_loss_risk": "none"
      }
    ],
    "join_analysis": [
      {
        "left_table": "customers",
        "right_table": "orders",
        "join_type": "LEFT JOIN",
        "join_condition": "customers.id = orders.customer_id",
        "business_meaning": "Include all customers even if they have no orders",
        "cardinality": "1:N"
      }
    ]
  }
}
```

### Stage 3: Business Context & Impact Analysis

#### Business Logic Extraction
```json
{
  "system_prompt": "You are a business analyst examining code for business impact. Focus on:\n\n1. **Business Rules**: What business logic is implemented\n2. **Data Quality Rules**: Validation, constraints, cleaning logic\n3. **Performance Implications**: Large joins, complex aggregations\n4. **Stakeholder Impact**: Who would be affected by changes\n5. **Criticality Assessment**: How important is this data pipeline\n\nProvide business-focused explanations that non-technical stakeholders can understand.",
  
  "user_prompt_template": "Analyze the business context and impact:\n\n**Discovered Lineage**:\n{lineage_relationships}\n\n**Code Context**:\n```{language}\n{code_content}\n```\n\nProvide business analysis:",
  
  "expected_output": {
    "business_impact_analysis": {
      "primary_business_function": "Customer analytics and reporting",
      "stakeholders_affected": ["Marketing team", "Customer Success", "Executive reporting"],
      "business_criticality": "high",
      "data_domains": ["customer", "sales", "marketing"],
      "sla_requirements": {
        "freshness": "Within 24 hours",
        "availability": "99.5%",
        "accuracy": "Customer data must be >98% accurate"
      }
    },
    "change_impact_assessment": [
      {
        "asset_name": "customer_summary",
        "change_scenario": "Remove email column",
        "impact_type": "breaking",
        "impact_description": "Marketing automation workflows will fail",
        "affected_downstream": ["email_campaigns", "lead_scoring", "crm_sync"],
        "estimated_severity": "high",
        "mitigation_strategy": "Deprecation period with alternative data source",
        "stakeholder_notification": ["marketing_team", "it_operations"],
        "estimated_fix_effort": "major"
      }
    ],
    "data_quality_rules": [
      {
        "rule_type": "validation",
        "description": "Email addresses must be valid format",
        "implementation": "WHERE email ~ '^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
        "business_justification": "Ensure marketing campaigns reach valid addresses"
      }
    ],
    "performance_considerations": {
      "bottlenecks": ["Large customer table scan", "Complex join with order history"],
      "optimization_opportunities": ["Add index on customer_id", "Partition by date"],
      "resource_usage": "High memory usage due to customer dimension size",
      "scalability_notes": "Performance degrades with customer base growth"
    }
  }
}
```

## Language-Specific Prompt Variations

### SQL Dialects
```json
{
  "snowflake": {
    "additional_context": "Look for Snowflake-specific features: QUALIFY, LATERAL joins, VARIANT data types, stages, streams, tasks",
    "asset_patterns": ["TRANSIENT tables", "SECURE views", "MASKING policies"]
  },
  "bigquery": {
    "additional_context": "Identify BigQuery features: ARRAY/STRUCT types, ML.* functions, partition/cluster keys",
    "asset_patterns": ["Dataset.table notation", "Wildcard tables", "External tables"]
  },
  "databricks": {
    "additional_context": "Focus on Delta Lake features: MERGE operations, time travel, streaming tables",
    "asset_patterns": ["Delta tables", "LIVE tables", "Streaming sources"]
  }
}
```

### Python Data Processing
```json
{
  "pandas": {
    "key_patterns": ["pd.read_sql", "to_sql", "merge", "groupby", "apply"],
    "asset_inference": "Infer table names from SQL strings and file paths"
  },
  "pyspark": {
    "key_patterns": ["spark.read", "write.mode", "createOrReplaceTempView", "sql"],
    "catalog_awareness": "Use spark.catalog to identify available tables"
  },
  "dbt_python": {
    "key_patterns": ["ref()", "source()", "var()", "model"],
    "special_handling": "Map dbt references to actual table names"
  }
}
```

## Confidence Scoring Rules

### High Confidence (0.9+)
- Explicit table names in FROM/JOIN clauses
- Direct INSERT INTO statements
- Clear CREATE TABLE AS statements
- Exact column mappings in SELECT lists

### Medium Confidence (0.7-0.9)
- Dynamic SQL with variable table names
- Complex CTEs with multiple levels
- Python DataFrame operations with clear lineage
- Stored procedure calls with known behavior

### Low Confidence (0.5-0.7)
- Dynamic table names from variables
- Complex conditional logic
- External API calls
- Generic function calls without context

### Processing Strategy by Confidence
```json
{
  "high_confidence": "Auto-approve and store relationships",
  "medium_confidence": "Store with manual review flag",
  "low_confidence": "Store as tentative, require validation"
}
```

## Incremental Processing Strategy

### Batch Processing for 500+ Files
1. **Parallel Processing**: Process files in batches of 10-20
2. **Dependency Ordering**: Process upstream files first when possible
3. **Cross-Reference Resolution**: Second pass to resolve references between files
4. **Conflict Resolution**: Handle duplicate asset definitions
5. **Validation Pass**: Check for orphaned references and circular dependencies

### Progress Tracking
```json
{
  "processing_stages": {
    "asset_discovery": "Extract all data assets from code",
    "relationship_mapping": "Map data lineage relationships", 
    "business_analysis": "Extract business context and impact",
    "cross_file_resolution": "Resolve references between files",
    "validation": "Validate lineage graph for consistency",
    "vector_generation": "Generate embeddings for search"
  },
  "estimated_time_per_file": {
    "small_file": "30-60 seconds",
    "medium_file": "1-2 minutes", 
    "large_file": "2-5 minutes"
  }
}
```

This comprehensive prompt engineering approach ensures we capture complete data lineage across all programming languages while maintaining high accuracy and business relevance. 