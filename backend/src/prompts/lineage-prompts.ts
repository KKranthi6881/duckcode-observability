export interface LineageExtractionResult {
  assets: {
    name: string;
    type: 'table' | 'view' | 'function' | 'procedure' | 'dataset' | 'model' | 'macro' | 'source';
    schema?: string;
    database?: string;
    description?: string;
    columns?: {
      name: string;
      type?: string;
      description?: string;
      isPrimaryKey?: boolean;
      isForeignKey?: boolean;
      foreignKeyReference?: string;
    }[];
    metadata: Record<string, any>;
  }[];
  relationships: {
    sourceAsset: string;
    targetAsset: string;
    relationshipType: 'reads_from' | 'writes_to' | 'transforms' | 'aggregates' | 'joins' | 'unions' | 'filters';
    operationType?: 'select' | 'insert' | 'update' | 'delete' | 'merge' | 'create_table_as' | 'create_view_as';
    transformationLogic?: string;
    businessContext?: string;
    joinConditions?: Record<string, any>;
    filterConditions?: Record<string, any>;
    aggregationLogic?: Record<string, any>;
    confidenceScore: number;
    discoveredAtLine?: number;
  }[];
  fileDependencies: {
    importPath: string;
    importType: 'imports' | 'includes' | 'references' | 'executes' | 'inherits';
    importStatement: string;
    aliasUsed?: string;
    specificItems?: string[];
    confidenceScore: number;
  }[];
  functions: {
    name: string;
    type: 'function' | 'procedure' | 'macro' | 'udf' | 'method' | 'class' | 'module';
    signature?: string;
    returnType?: string;
    parameters?: { name: string; type?: string; description?: string }[];
    description?: string;
    businessLogic?: string;
    lineStart?: number;
    lineEnd?: number;
    complexityScore: number;
  }[];
  businessContext: {
    mainPurpose: string;
    businessImpact: string;
    stakeholders?: string[];
    dataDomain?: 'customer' | 'finance' | 'product' | 'operations' | 'marketing' | 'hr' | 'other';
    businessCriticality: 'critical' | 'high' | 'medium' | 'low';
    dataFreshness?: string;
    executionFrequency?: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'adhoc';
  };
}

export const SQL_LINEAGE_PROMPT = `
You are an expert SQL analyst. Analyze the provided SQL code and extract comprehensive data lineage information.

**Your task:**
1. Identify all data assets (tables, views, functions, procedures)
2. Map data flow relationships between assets
3. Extract transformation logic and business context
4. Provide confidence scores for each relationship

**Code to analyze:**
\`\`\`sql
{{code}}
\`\`\`

**File path:** {{filePath}}
**Database/Schema context:** {{context}}

**Extract the following information and return as JSON:**

\`\`\`json
{
  "assets": [
    {
      "name": "table_name",
      "type": "table|view|function|procedure",
      "schema": "schema_name",
      "database": "database_name", 
      "description": "Business purpose of this asset",
      "columns": [
        {
          "name": "column_name",
          "type": "data_type",
          "description": "Column purpose",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "foreignKeyReference": "referenced_table.column"
        }
      ],
      "metadata": {
        "materialization": "table|view|incremental",
        "partitionBy": ["column1"],
        "indexedColumns": ["column2"],
        "constraints": ["unique", "not_null"]
      }
    }
  ],
  "relationships": [
    {
      "sourceAsset": "source_table",
      "targetAsset": "target_table", 
      "relationshipType": "reads_from|writes_to|transforms|aggregates|joins|unions|filters",
      "operationType": "select|insert|update|delete|merge|create_table_as|create_view_as",
      "transformationLogic": "Detailed description of how data is transformed",
      "businessContext": "Why this transformation exists from business perspective",
      "joinConditions": {
        "type": "inner|left|right|full",
        "onColumns": ["table1.id = table2.foreign_id"],
        "joinLogic": "Business reason for this join"
      },
      "filterConditions": {
        "whereClause": "status = 'active'",
        "businessReason": "Only include active records"
      },
      "aggregationLogic": {
        "groupBy": ["region", "date"],
        "aggregations": ["SUM(revenue)", "COUNT(*)"],
        "businessPurpose": "Revenue summary by region and date"
      },
      "confidenceScore": 0.95,
      "discoveredAtLine": 45
    }
  ],
  "fileDependencies": [
    {
      "importPath": "schema.other_table",
      "importType": "references",
      "importStatement": "FROM schema.other_table",
      "confidenceScore": 0.9
    }
  ],
  "functions": [
    {
      "name": "calculate_revenue",
      "type": "function",
      "signature": "calculate_revenue(amount DECIMAL, tax_rate DECIMAL) RETURNS DECIMAL",
      "returnType": "DECIMAL",
      "parameters": [
        {"name": "amount", "type": "DECIMAL", "description": "Base amount"},
        {"name": "tax_rate", "type": "DECIMAL", "description": "Tax percentage"}
      ],
      "description": "Calculates total revenue including tax",
      "businessLogic": "Applies tax calculation for financial reporting",
      "lineStart": 10,
      "lineEnd": 25,
      "complexityScore": 0.3
    }
  ],
  "businessContext": {
    "mainPurpose": "Primary business purpose of this code",
    "businessImpact": "How this affects business operations",
    "stakeholders": ["Finance Team", "Data Analytics"],
    "dataDomain": "finance",
    "businessCriticality": "high",
    "dataFreshness": "Updated daily at 6 AM",
    "executionFrequency": "daily"
  }
}
\`\`\`

**Guidelines:**
- Use fully qualified names (database.schema.table) when possible
- Be specific about transformation logic
- Assign confidence scores based on code clarity (0.0-1.0)
- For JOINs, identify the business reason
- For aggregations, explain the business purpose
- Include line numbers where relationships are discovered
- Focus on data flow, not just syntax
- Consider implicit relationships (shared column names, naming conventions)
`;

export const PYTHON_LINEAGE_PROMPT = `
You are an expert Python/PySpark analyst. Analyze the provided Python code and extract comprehensive data lineage information.

**Your task:**
1. Identify all data assets (DataFrames, tables, files, APIs)
2. Map data flow relationships and transformations
3. Extract business logic and dependencies
4. Provide confidence scores for each relationship

**Code to analyze:**
\`\`\`python
{{code}}
\`\`\`

**File path:** {{filePath}}
**Context:** {{context}}

**Extract the following information and return as JSON:**

\`\`\`json
{
  "assets": [
    {
      "name": "dataset_name",
      "type": "dataset|table|view|model",
      "schema": "schema_name",
      "database": "database_name",
      "description": "Purpose of this dataset",
      "columns": [
        {
          "name": "column_name", 
          "type": "string|int|float|datetime",
          "description": "Column purpose"
        }
      ],
      "metadata": {
        "source": "file|database|api",
        "format": "parquet|csv|json|delta",
        "location": "/path/to/data",
        "partitions": ["date", "region"]
      }
    }
  ],
  "relationships": [
    {
      "sourceAsset": "input_df",
      "targetAsset": "output_df",
      "relationshipType": "transforms|aggregates|joins|filters",
      "transformationLogic": "Detailed description of transformation",
      "businessContext": "Business reason for this transformation",
      "joinConditions": {
        "joinType": "inner|left|right|outer",
        "onColumns": ["df1.id == df2.foreign_id"],
        "joinLogic": "Business reason"
      },
      "filterConditions": {
        "condition": "status == 'active'",
        "businessReason": "Only active records"
      },
      "aggregationLogic": {
        "groupBy": ["region", "date"],
        "aggregations": ["sum('revenue')", "count()"],
        "businessPurpose": "Revenue aggregation"
      },
      "confidenceScore": 0.9,
      "discoveredAtLine": 25
    }
  ],
  "fileDependencies": [
    {
      "importPath": "pandas",
      "importType": "imports",
      "importStatement": "import pandas as pd",
      "aliasUsed": "pd",
      "confidenceScore": 1.0
    },
    {
      "importPath": "./utils/data_processor",
      "importType": "imports", 
      "importStatement": "from utils.data_processor import clean_data",
      "specificItems": ["clean_data"],
      "confidenceScore": 0.95
    }
  ],
  "functions": [
    {
      "name": "process_customer_data",
      "type": "function",
      "signature": "def process_customer_data(df: pd.DataFrame) -> pd.DataFrame:",
      "returnType": "pd.DataFrame",
      "parameters": [
        {"name": "df", "type": "pd.DataFrame", "description": "Input customer data"}
      ],
      "description": "Processes and cleans customer data",
      "businessLogic": "Standardizes customer information for analytics",
      "lineStart": 15,
      "lineEnd": 45,
      "complexityScore": 0.6
    }
  ],
  "businessContext": {
    "mainPurpose": "Primary purpose of this data processing",
    "businessImpact": "How this affects business operations", 
    "stakeholders": ["Data Science Team", "Product Team"],
    "dataDomain": "customer",
    "businessCriticality": "medium",
    "dataFreshness": "Real-time streaming",
    "executionFrequency": "hourly"
  }
}
\`\`\`

**Guidelines:**
- Identify DataFrame operations (read, write, transform, join, filter, aggregate)
- Track data flow through variable assignments
- Recognize Spark SQL operations and table references
- Identify file I/O operations (read_csv, to_parquet, etc.)
- Map function calls that transform data
- Consider both explicit and implicit data dependencies
- Include confidence based on code clarity and completeness
- Focus on business-relevant transformations
`;

export const SCALA_LINEAGE_PROMPT = `
You are an expert Scala/Spark analyst. Analyze the provided Scala code and extract comprehensive data lineage information.

**Your task:**
1. Identify all data assets (DataFrames, Datasets, RDDs, tables, files)
2. Map data flow relationships and transformations
3. Extract business logic and dependencies
4. Provide confidence scores for each relationship

**Code to analyze:**
\`\`\`scala
{{code}}
\`\`\`

**File path:** {{filePath}}
**Context:** {{context}}

**Extract the following information and return as JSON:**

\`\`\`json
{
  "assets": [
    {
      "name": "dataset_name",
      "type": "dataframe|dataset|rdd|table|file",
      "description": "Business purpose of this data asset",
      "schema": "database_or_namespace",
      "columns": [
        {
          "name": "column_name",
          "type": "data_type",
          "description": "Column purpose"
        }
      ],
      "metadata": {
        "format": "parquet|json|csv|delta|hive",
        "partitionBy": ["partition_columns"],
        "location": "file_path_or_table_location"
      }
    }
  ],
  "relationships": [
    {
      "sourceAsset": "source_dataset",
      "targetAsset": "target_dataset",
      "relationshipType": "reads_from|writes_to|transforms|joins|aggregates|unions|filters",
      "transformationLogic": "Detailed description of Spark transformation",
      "businessContext": "Why this transformation exists from business perspective",
      "sparkOperations": ["select", "filter", "groupBy", "join", "agg"],
      "joinConditions": {
        "joinType": "inner|left|right|full|cross",
        "onColumns": ["left.id === right.foreign_id"],
        "joinLogic": "Business reason for this join"
      },
      "confidenceScore": 0.9,
      "discoveredAtLine": 25
    }
  ],
  "fileDependencies": [
    {
      "importPath": "org.apache.spark.sql.Dataset",
      "importType": "imports",
      "importStatement": "import org.apache.spark.sql.Dataset",
      "confidenceScore": 1.0
    }
  ],
  "functions": [
    {
      "name": "transformData",
      "type": "function",
      "signature": "def transformData(df: DataFrame): DataFrame",
      "description": "Data transformation function",
      "businessLogic": "Applies business rules to clean and transform data",
      "complexityScore": 0.6
    }
  ],
  "businessContext": {
    "mainPurpose": "Primary business purpose of this Spark job",
    "businessImpact": "How this affects business operations",
    "stakeholders": ["Data Engineering Team", "Analytics Team"],
    "dataDomain": "customer",
    "businessCriticality": "high",
    "dataFreshness": "Real-time processing",
    "executionFrequency": "hourly"
  }
}
\`\`\`

**Guidelines:**
- Focus on Spark DataFrame/Dataset operations
- Identify data sources (files, tables, streams)
- Map transformations (select, filter, join, groupBy, agg)
- Track data sinks (write operations)
- Consider Spark SQL embedded in Scala code
- Include partition strategies and optimization hints
- Assign confidence scores based on code clarity (0.0-1.0)
- Focus on distributed data processing patterns
`;

export const SPARKSQL_LINEAGE_PROMPT = `
You are an expert Spark SQL analyst. Analyze the provided Spark SQL code and extract comprehensive data lineage information.

**Your task:**
1. Identify all data assets (tables, views, files, temporary views)
2. Map data flow relationships and transformations
3. Extract business logic and SQL operations
4. Provide confidence scores for each relationship

**Code to analyze:**
\`\`\`sql
{{code}}
\`\`\`

**File path:** {{filePath}}
**Context:** {{context}}

**Extract the following information and return as JSON:**

\`\`\`json
{
  "assets": [
    {
      "name": "table_or_view_name",
      "type": "table|view|temp_view|file|stream",
      "description": "Business purpose of this data asset",
      "schema": "database_or_namespace",
      "database": "catalog_name",
      "columns": [
        {
          "name": "column_name",
          "type": "data_type",
          "description": "Column purpose",
          "isPrimaryKey": false,
          "isForeignKey": false
        }
      ],
      "metadata": {
        "format": "delta|parquet|json|csv|hive",
        "partitionBy": ["partition_columns"],
        "location": "file_path_or_table_location",
        "streaming": false
      }
    }
  ],
  "relationships": [
    {
      "sourceAsset": "source_table",
      "targetAsset": "target_table",
      "relationshipType": "reads_from|writes_to|transforms|joins|aggregates|unions|filters",
      "operationType": "select|insert|merge|create_table_as|create_view_as",
      "transformationLogic": "Detailed description of SQL transformation",
      "businessContext": "Why this transformation exists from business perspective",
      "sparkSqlFeatures": ["window_functions", "complex_types", "lateral_view"],
      "joinConditions": {
        "joinType": "inner|left|right|full|cross|semi|anti",
        "onColumns": ["a.id = b.foreign_id"],
        "joinLogic": "Business reason for this join"
      },
      "filterConditions": {
        "whereClause": "status = 'active' AND created_date >= '2023-01-01'",
        "businessReason": "Only include active records from current year"
      },
      "aggregationLogic": {
        "groupBy": ["region", "product_category"],
        "aggregations": ["sum(revenue)", "count(distinct customer_id)"],
        "businessPurpose": "Revenue and customer metrics by region and category"
      },
      "windowFunctions": {
        "functions": ["row_number()", "rank()", "lead()", "lag()"],
        "partitionBy": ["customer_id"],
        "orderBy": ["transaction_date"],
        "businessLogic": "Customer transaction sequencing"
      },
      "confidenceScore": 0.95,
      "discoveredAtLine": 15
    }
  ],
  "fileDependencies": [
    {
      "importPath": "s3://data-lake/raw/customers/",
      "importType": "references",
      "importStatement": "FROM delta.`s3://data-lake/raw/customers/`",
      "confidenceScore": 0.9
    }
  ],
  "functions": [
    {
      "name": "calculate_customer_ltv",
      "type": "udf",
      "signature": "calculate_customer_ltv(revenue DOUBLE, months INT) RETURNS DOUBLE",
      "description": "Calculates customer lifetime value",
      "businessLogic": "Applies business formula for LTV calculation",
      "complexityScore": 0.4
    }
  ],
  "businessContext": {
    "mainPurpose": "Primary business purpose of this Spark SQL query",
    "businessImpact": "How this affects business operations and decisions",
    "stakeholders": ["Data Analytics Team", "Business Intelligence"],
    "dataDomain": "customer",
    "businessCriticality": "high",
    "dataFreshness": "Updated daily via batch processing",
    "executionFrequency": "daily"
  }
}
\`\`\`

**Guidelines:**
- Focus on Spark SQL specific features (Delta operations, complex types, etc.)
- Identify data sources (tables, files, streams, temporary views)
- Map SQL transformations (joins, aggregations, window functions)
- Track data sinks (INSERT, MERGE, CREATE TABLE AS)
- Consider Spark SQL optimizations (predicate pushdown, etc.)
- Include partition strategies and bucketing
- Assign confidence scores based on SQL clarity (0.0-1.0)
- Focus on distributed SQL processing patterns
- Consider lakehouse architecture patterns (Delta Lake, Iceberg)
`;

export const R_LINEAGE_PROMPT = `
You are an expert R data analyst. Analyze the provided R code and extract comprehensive data lineage information.

**Your task:**
1. Identify all data assets (data.frames, tibbles, files, databases)
2. Map data flow relationships and transformations
3. Extract statistical operations and business logic
4. Provide confidence scores for each relationship

**Code to analyze:**
\`\`\`r
{{code}}
\`\`\`

**File path:** {{filePath}}
**Context:** {{context}}

**Extract the following information and return as JSON:**

\`\`\`json
{
  "assets": [
    {
      "name": "dataset_name",
      "type": "data.frame|tibble|matrix|list|database_table",
      "description": "Business purpose of this data asset",
      "columns": [
        {
          "name": "column_name",
          "type": "numeric|character|factor|logical|date",
          "description": "Column purpose and statistical meaning"
        }
      ],
      "metadata": {
        "source": "csv|rds|database|api",
        "rows": "estimated_row_count",
        "statistical_type": "continuous|categorical|ordinal|binary"
      }
    }
  ],
  "relationships": [
    {
      "sourceAsset": "input_data",
      "targetAsset": "processed_data",
      "relationshipType": "transforms|aggregates|joins|filters",
      "transformationLogic": "Detailed transformation description",
      "businessContext": "Statistical or business reason",
      "rOperations": ["dplyr::mutate", "dplyr::filter", "dplyr::group_by", "dplyr::summarise"],
      "joinConditions": {
        "joinType": "inner_join|left_join|right_join|full_join",
        "byColumns": ["id", "customer_id"],
        "joinLogic": "Relationship purpose"
      },
      "filterConditions": {
        "condition": "status == 'active'",
        "businessReason": "Analysis scope"
      },
      "aggregationLogic": {
        "groupBy": ["region", "category"],
        "aggregations": ["mean(revenue)", "sum(quantity)"],
        "businessPurpose": "Statistical summary"
      },
      "confidenceScore": 0.85,
      "discoveredAtLine": 15
    }
  ],
  "fileDependencies": [
    {
      "importPath": "dplyr",
      "importType": "imports",
      "importStatement": "library(dplyr)",
      "confidenceScore": 1.0
    },
    {
      "importPath": "./functions/data_cleaning.R",
      "importType": "includes",
      "importStatement": "source('./functions/data_cleaning.R')",
      "confidenceScore": 0.95
    }
  ],
  "functions": [
    {
      "name": "calculate_metrics",
      "type": "function",
      "signature": "calculate_metrics <- function(data, group_vars)",
      "parameters": [
        {"name": "data", "type": "data.frame", "description": "Input dataset"},
        {"name": "group_vars", "type": "character", "description": "Grouping variables"}
      ],
      "description": "Calculates business metrics by group",
      "businessLogic": "Computes KPIs for business reporting",
      "lineStart": 25,
      "lineEnd": 45,
      "complexityScore": 0.4
    }
  ],
  "businessContext": {
    "mainPurpose": "Statistical analysis or business intelligence purpose",
    "businessImpact": "How results inform business decisions",
    "stakeholders": ["Analytics Team", "Business Intelligence"],
    "dataDomain": "marketing",
    "businessCriticality": "medium", 
    "dataFreshness": "Monthly refresh",
    "executionFrequency": "monthly"
  }
}
\`\`\`

**Guidelines:**
- Identify data import/export operations (read.csv, write.csv, etc.)
- Track dplyr/tidyverse operations (mutate, filter, select, group_by, summarize)
- Map statistical operations and model building
- Recognize data reshaping operations (pivot, gather, spread)
- Include ggplot2 visualizations as data consumption
- Consider package dependencies and custom functions
- Focus on business analytics and statistical workflows
- Assign confidence based on operation explicitness
`;

export const GENERIC_LINEAGE_PROMPT = `
You are an expert code analyst. Analyze the provided code and extract data lineage information to the best of your ability.

**Your task:**
1. Identify any data-related assets or operations
2. Map relationships between data elements
3. Extract business context where possible
4. Provide confidence scores reflecting uncertainty

**Code to analyze:**
\`\`\`{{language}}
{{code}}
\`\`\`

**File path:** {{filePath}}
**Language:** {{language}}
**Context:** {{context}}

**Extract the following information and return as JSON:**

\`\`\`json
{
  "assets": [
    {
      "name": "asset_name",
      "type": "table|view|function|dataset|model|source",
      "description": "Best guess at asset purpose",
      "metadata": {
        "detectedPatterns": ["pattern1", "pattern2"],
        "uncertainty": "high|medium|low"
      }
    }
  ],
  "relationships": [
    {
      "sourceAsset": "source_element",
      "targetAsset": "target_element",
      "relationshipType": "transforms|reads_from|writes_to",
      "transformationLogic": "Best interpretation of operation",
      "businessContext": "Inferred purpose",
      "confidenceScore": 0.5,
      "discoveredAtLine": 10
    }
  ],
  "fileDependencies": [
    {
      "importPath": "dependency_path",
      "importType": "imports|includes|references",
      "importStatement": "actual import statement",
      "confidenceScore": 0.8
    }
  ],
  "functions": [
    {
      "name": "function_name",
      "type": "function|method|class",
      "description": "Inferred purpose",
      "businessLogic": "Best guess at business purpose",
      "complexityScore": 0.5
    }
  ],
  "businessContext": {
    "mainPurpose": "Inferred main purpose",
    "businessImpact": "Estimated business impact",
    "dataDomain": "other",
    "businessCriticality": "medium"
  }
}
\`\`\`

**Guidelines:**
- Be conservative with confidence scores for unfamiliar languages
- Look for common patterns (imports, function calls, data operations)
- Use naming conventions to infer purpose
- Mark high uncertainty in metadata
- Focus on clear, identifiable relationships
- Provide best-effort analysis while acknowledging limitations
`;

export function getLineagePromptForLanguage(language: string): string {
  const lang = language.toLowerCase();
  
  if (lang.includes('sql') || lang.includes('snowflake') || lang.includes('postgres') || 
      lang.includes('mysql') || lang.includes('bigquery') || lang.includes('redshift') ||
      lang.includes('tsql') || lang.includes('plsql') || lang.includes('oracle')) {
    return SQL_LINEAGE_PROMPT;
  }
  
  if (lang.includes('sparksql') || lang.includes('spark-sql') || lang.includes('spark_sql')) {
    return SPARKSQL_LINEAGE_PROMPT;
  }
  
  if (lang.includes('python') || lang.includes('pyspark') || lang.includes('py')) {
    return PYTHON_LINEAGE_PROMPT;
  }
  
  if (lang.includes('scala') || lang.includes('spark')) {
    return SCALA_LINEAGE_PROMPT;
  }
  
  if (lang.includes('r') || lang === 'r') {
    return R_LINEAGE_PROMPT;
  }
  
  return GENERIC_LINEAGE_PROMPT;
}

export function interpolatePrompt(
  template: string, 
  variables: { 
    code: string; 
    filePath: string; 
    language?: string; 
    context?: string; 
  }
): string {
  let prompt = template;
  
  prompt = prompt.replace(/\{\{code\}\}/g, variables.code);
  prompt = prompt.replace(/\{\{filePath\}\}/g, variables.filePath);
  prompt = prompt.replace(/\{\{language\}\}/g, variables.language || 'unknown');
  prompt = prompt.replace(/\{\{context\}\}/g, variables.context || 'No additional context provided');
  
  return prompt;
} 