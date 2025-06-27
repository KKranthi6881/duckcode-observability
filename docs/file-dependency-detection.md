# Universal File Dependency Detection

## Cross-Language Dependency Resolution Algorithm

### Phase 1: Asset Registry Building
```typescript
interface AssetRegistry {
  tables: Map<string, FileInfo[]>;     // table_name -> files that create/modify it
  functions: Map<string, FileInfo[]>;  // function_name -> files that define it
  files: Map<string, FileAssets>;     // file_path -> assets it creates/uses
}

async function buildAssetRegistry(allFiles: FileInfo[]): Promise<AssetRegistry> {
  const registry: AssetRegistry = {
    tables: new Map(),
    functions: new Map(), 
    files: new Map()
  };

  for (const file of allFiles) {
    const assets = await extractAssetsFromFile(file);
    
    // Register tables created by this file
    for (const table of assets.tables_created) {
      if (!registry.tables.has(table.name)) {
        registry.tables.set(table.name, []);
      }
      registry.tables.get(table.name)!.push({
        ...file,
        operation: 'creates',
        line_number: table.line_number
      });
    }
    
    // Register functions defined by this file
    for (const func of assets.functions_defined) {
      if (!registry.functions.has(func.name)) {
        registry.functions.set(func.name, []);
      }
      registry.functions.get(func.name)!.push({
        ...file,
        operation: 'defines',
        line_number: func.line_number
      });
    }
    
    registry.files.set(file.path, assets);
  }
  
  return registry;
}
```

### Phase 2: Dependency Resolution
```typescript
interface FileDependency {
  source_file: string;
  target_file: string;
  dependency_type: 'table_reference' | 'function_call' | 'file_import' | 'data_flow';
  confidence_score: number;
  evidence: string[];
}

async function resolveFileDependencies(
  registry: AssetRegistry
): Promise<FileDependency[]> {
  const dependencies: FileDependency[] = [];
  
  for (const [filePath, assets] of registry.files) {
    
    // 1. Resolve table dependencies
    for (const tableRef of assets.tables_referenced) {
      const creatorsFiles = registry.tables.get(tableRef.name) || [];
      
      for (const creatorFile of creatorsFiles) {
        if (creatorFile.path !== filePath) { // Don't depend on self
          dependencies.push({
            source_file: filePath,
            target_file: creatorFile.path,
            dependency_type: 'table_reference',
            confidence_score: calculateTableRefConfidence(tableRef, creatorFile),
            evidence: [
              `File ${filePath} references table ${tableRef.name}`,
              `Table ${tableRef.name} is created by ${creatorFile.path}`
            ]
          });
        }
      }
    }
    
    // 2. Resolve function dependencies  
    for (const funcCall of assets.functions_called) {
      const definerFiles = registry.functions.get(funcCall.name) || [];
      
      for (const definerFile of definerFiles) {
        if (definerFile.path !== filePath) {
          dependencies.push({
            source_file: filePath,
            target_file: definerFile.path,
            dependency_type: 'function_call',
            confidence_score: calculateFunctionCallConfidence(funcCall, definerFile),
            evidence: [
              `File ${filePath} calls function ${funcCall.name}`,
              `Function ${funcCall.name} is defined in ${definerFile.path}`
            ]
          });
        }
      }
    }
    
    // 3. Resolve explicit imports (Python, Scala, etc.)
    for (const importRef of assets.file_imports) {
      const targetFile = resolveImportToFile(importRef, registry);
      if (targetFile) {
        dependencies.push({
          source_file: filePath,
          target_file: targetFile.path,
          dependency_type: 'file_import',
          confidence_score: 0.95, // High confidence for explicit imports
          evidence: [`File ${filePath} imports from ${targetFile.path}`]
        });
      }
    }
  }
  
  return dependencies;
}
```

## Language-Specific Detection Strategies

### SQL Files - Pattern Recognition
```typescript
const SQL_PATTERNS = {
  table_creation: [
    /CREATE\s+(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_.]*)/gi,
    /INTO\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi,
    /INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi
  ],
  table_reference: [
    /FROM\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi,
    /JOIN\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi,
    /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi
  ],
  stored_procedure_calls: [
    /EXEC(?:UTE)?\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi,
    /CALL\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi
  ]
};

async function extractSQLAssets(fileContent: string, filePath: string): Promise<FileAssets> {
  const assets: FileAssets = {
    tables_created: [],
    tables_referenced: [],
    functions_called: [],
    file_imports: []
  };
  
  // Extract table creations
  for (const pattern of SQL_PATTERNS.table_creation) {
    const matches = [...fileContent.matchAll(pattern)];
    for (const match of matches) {
      assets.tables_created.push({
        name: match[1],
        line_number: getLineNumber(fileContent, match.index!),
        context: match[0]
      });
    }
  }
  
  // Extract table references
  for (const pattern of SQL_PATTERNS.table_reference) {
    const matches = [...fileContent.matchAll(pattern)];
    for (const match of matches) {
      assets.tables_referenced.push({
        name: match[1],
        line_number: getLineNumber(fileContent, match.index!),
        context: match[0]
      });
    }
  }
  
  return assets;
}
```

### Python Files - AST Analysis + Pattern Recognition
```typescript
async function extractPythonAssets(fileContent: string, filePath: string): Promise<FileAssets> {
  const assets: FileAssets = {
    tables_created: [],
    tables_referenced: [],
    functions_called: [],
    functions_defined: [],
    file_imports: []
  };
  
  // 1. Extract imports (direct file dependencies)
  const importPatterns = [
    /^from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import/gm,
    /^import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gm
  ];
  
  for (const pattern of importPatterns) {
    const matches = [...fileContent.matchAll(pattern)];
    for (const match of matches) {
      assets.file_imports.push({
        module: match[1],
        line_number: getLineNumber(fileContent, match.index!),
        import_type: match[0].startsWith('from') ? 'from_import' : 'direct_import'
      });
    }
  }
  
  // 2. Extract Spark/Pandas table operations
  const tablePatterns = [
    /spark\.table\(['"]([^'"]+)['"]\)/gi,
    /spark\.read\.table\(['"]([^'"]+)['"]\)/gi,
    /pd\.read_sql.*from\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi,
    /\.saveAsTable\(['"]([^'"]+)['"]\)/gi,
    /\.write\.mode.*\.saveAsTable\(['"]([^'"]+)['"]\)/gi
  ];
  
  for (const pattern of tablePatterns) {
    const matches = [...fileContent.matchAll(pattern)];
    for (const match of matches) {
      const isWrite = /saveAsTable|write/.test(match[0]);
      
      if (isWrite) {
        assets.tables_created.push({
          name: match[1],
          line_number: getLineNumber(fileContent, match.index!),
          context: match[0]
        });
      } else {
        assets.tables_referenced.push({
          name: match[1], 
          line_number: getLineNumber(fileContent, match.index!),
          context: match[0]
        });
      }
    }
  }
  
  // 3. Extract function definitions
  const functionDefPattern = /^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm;
  const matches = [...fileContent.matchAll(functionDefPattern)];
  for (const match of matches) {
    assets.functions_defined.push({
      name: match[1],
      line_number: getLineNumber(fileContent, match.index!),
      context: match[0]
    });
  }
  
  return assets;
}
```

### Scala/PySpark Files
```typescript
async function extractScalaAssets(fileContent: string, filePath: string): Promise<FileAssets> {
  const assets: FileAssets = {
    tables_created: [],
    tables_referenced: [],
    functions_called: [],
    functions_defined: [],
    file_imports: []
  };
  
  // Scala-specific patterns
  const scalaPatterns = {
    imports: /^import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gm,
    spark_reads: /spark\.read\.table\(['"]([^'"]+)['"]\)/gi,
    spark_writes: /\.write\.mode.*\.saveAsTable\(['"]([^'"]+)['"]\)/gi,
    dataframe_ops: /\.createOrReplaceTempView\(['"]([^'"]+)['"]\)/gi
  };
  
  // Extract imports
  const importMatches = [...fileContent.matchAll(scalaPatterns.imports)];
  for (const match of importMatches) {
    assets.file_imports.push({
      module: match[1],
      line_number: getLineNumber(fileContent, match.index!),
      import_type: 'scala_import'
    });
  }
  
  // Extract table operations
  const readMatches = [...fileContent.matchAll(scalaPatterns.spark_reads)];
  for (const match of readMatches) {
    assets.tables_referenced.push({
      name: match[1],
      line_number: getLineNumber(fileContent, match.index!),
      context: match[0]
    });
  }
  
  const writeMatches = [...fileContent.matchAll(scalaPatterns.spark_writes)];
  for (const match of writeMatches) {
    assets.tables_created.push({
      name: match[1],
      line_number: getLineNumber(fileContent, match.index!),
      context: match[0]
    });
  }
  
  return assets;
}
```

## Confidence Scoring for Dependencies

```typescript
function calculateDependencyConfidence(
  dependency: FileDependency,
  evidence: string[]
): number {
  let confidence = 0.5; // Base confidence
  
  // Boost confidence based on dependency type
  switch (dependency.dependency_type) {
    case 'file_import':
      confidence += 0.4; // Very high confidence for explicit imports
      break;
    case 'table_reference':
      confidence += 0.3; // High confidence for table references
      break;
    case 'function_call':
      confidence += 0.2; // Medium confidence for function calls
      break;
    case 'data_flow':
      confidence += 0.1; // Lower confidence for inferred data flow
      break;
  }
  
  // Boost confidence based on evidence quality
  if (evidence.some(e => e.includes('explicit'))) confidence += 0.1;
  if (evidence.length > 2) confidence += 0.05;
  
  return Math.min(0.99, confidence);
}
```

## Execution Order Determination

```typescript
async function determineExecutionOrder(
  dependencies: FileDependency[]
): Promise<string[][]> {
  // Build dependency graph
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  
  for (const dep of dependencies) {
    if (!graph.has(dep.target_file)) {
      graph.set(dep.target_file, []);
    }
    graph.get(dep.target_file)!.push(dep.source_file);
    
    inDegree.set(dep.source_file, (inDegree.get(dep.source_file) || 0) + 1);
    if (!inDegree.has(dep.target_file)) {
      inDegree.set(dep.target_file, 0);
    }
  }
  
  // Topological sort to determine execution order
  const executionOrder: string[][] = [];
  const queue: string[] = [];
  
  // Find files with no dependencies (can run first)
  for (const [file, degree] of inDegree) {
    if (degree === 0) {
      queue.push(file);
    }
  }
  
  while (queue.length > 0) {
    const currentBatch = [...queue];
    queue.length = 0;
    executionOrder.push(currentBatch);
    
    for (const file of currentBatch) {
      const dependents = graph.get(file) || [];
      for (const dependent of dependents) {
        inDegree.set(dependent, inDegree.get(dependent)! - 1);
        if (inDegree.get(dependent) === 0) {
          queue.push(dependent);
        }
      }
    }
  }
  
  return executionOrder;
}
```

## Visual Example: File Dependency Chain

```
Raw Data Sources
├── data_ingestion.py (creates: raw_customers, raw_orders)
│
├── customer_cleanup.sql (depends on: raw_customers)
│   └── creates: clean_customers
│
├── order_processing.py (depends on: raw_orders, clean_customers)  
│   └── creates: processed_orders
│
└── analytics_dashboard.py (depends on: clean_customers, processed_orders)
    └── creates: customer_metrics, order_analytics
```

This approach gives us **dbt-like dependency tracking** without requiring dbt migration. We automatically discover:

1. **What each file creates** (tables, views, functions)
2. **What each file depends on** (other tables, functions, files)
3. **Execution order** (which files must run before others)
4. **Impact analysis** (what breaks if we change a file)

The key insight is that **dependencies exist in the code itself** - we just need to extract them intelligently across different languages! 