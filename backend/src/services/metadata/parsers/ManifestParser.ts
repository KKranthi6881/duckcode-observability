/**
 * DBT Manifest Parser
 * 
 * Parses manifest.json from dbt projects to extract:
 * - Models, sources, seeds, snapshots
 * - Model-level dependencies (100% accurate)
 * - Column definitions with data types
 * - Compiled SQL (no Jinja, ready for lineage parsing)
 * 
 * This provides GOLD-tier accuracy compared to raw SQL parsing.
 */

export interface DBTManifest {
  metadata: {
    dbt_version: string;
    generated_at: string;
    adapter_type: string;
  };
  nodes: Record<string, DBTNode>;
  sources: Record<string, DBTSource>;
  parent_map?: Record<string, string[]>;
  child_map?: Record<string, string[]>;
}

export interface DBTNode {
  unique_id: string;        // "model.jaffle_shop.customers"
  name: string;              // "customers"
  resource_type: 'model' | 'seed' | 'snapshot' | 'analysis' | 'test';
  database: string;
  schema: string;
  alias: string;
  
  // Column definitions
  columns: Record<string, DBTColumn>;
  
  // Dependencies
  depends_on: {
    nodes: string[];         // ["model.jaffle_shop.stg_customers"]
    macros: string[];
  };
  
  // SQL code
  raw_code: string;          // Original with Jinja
  compiled_code?: string;    // Compiled SQL (best for lineage)
  
  // Metadata
  description: string;
  tags: string[];
  meta: Record<string, any>;
  
  // DBT v1.6+ column lineage
  column_lineage?: Record<string, ColumnLineageInfo>;
}

export interface DBTColumn {
  name: string;
  data_type?: string;
  description?: string;
  meta?: Record<string, any>;
  tags?: string[];
}

export interface DBTSource {
  unique_id: string;         // "source.jaffle_shop.raw.customers"
  name: string;
  source_name: string;
  database: string;
  schema: string;
  identifier: string;
  columns: Record<string, DBTColumn>;
}

export interface ColumnLineageInfo {
  columns: Array<{
    name: string;
    node_id: string;         // Source model unique_id
  }>;
}

export interface ParsedManifestResult {
  models: ParsedModel[];
  sources: ParsedSource[];
  dependencies: ParsedDependency[];
  columnLineage: ParsedColumnLineage[];
}

export interface ParsedModel {
  name: string;
  schema: string;
  database: string;
  object_type: 'model' | 'seed' | 'snapshot';
  description: string;
  columns: Array<{
    name: string;
    data_type: string;
    description: string;
    position: number;
  }>;
  compiled_sql: string;      // For lineage extraction
  raw_sql: string;
  tags: string[];
  unique_id: string;
}

export interface ParsedSource {
  name: string;
  source_name: string;
  schema: string;
  database: string;
  identifier: string;
  columns: Array<{
    name: string;
    data_type: string;
    description: string;
  }>;
  unique_id: string;
}

export interface ParsedDependency {
  source_unique_id: string;
  target_unique_id: string;
  source_name: string;
  target_name: string;
  confidence: number;        // Always 1.0 from manifest
}

export interface ParsedColumnLineage {
  target_model: string;
  target_column: string;
  source_columns: Array<{
    model: string;
    column: string;
  }>;
  confidence: number;
}

export class ManifestParser {
  
  /**
   * Parse manifest.json file
   */
  async parseManifest(manifestContent: string): Promise<ParsedManifestResult> {
    const manifest: DBTManifest = JSON.parse(manifestContent);
    
    console.log(`📦 Parsing manifest.json - dbt v${manifest.metadata.dbt_version}`);
    console.log(`   Adapter: ${manifest.metadata.adapter_type}`);
    
    const models = this.extractModels(manifest);
    const sources = this.extractSources(manifest);
    const dependencies = this.extractDependencies(manifest);
    const columnLineage = this.extractColumnLineage(manifest);
    
    console.log(`✅ Extracted from manifest:`);
    console.log(`   📊 ${models.length} models`);
    console.log(`   📁 ${sources.length} sources`);
    console.log(`   🔗 ${dependencies.length} dependencies (100% accurate)`);
    console.log(`   📈 ${columnLineage.length} column lineages`);
    
    return {
      models,
      sources,
      dependencies,
      columnLineage
    };
  }
  
  /**
   * Extract models from manifest
   */
  private extractModels(manifest: DBTManifest): ParsedModel[] {
    const models: ParsedModel[] = [];
    
    for (const [uniqueId, node] of Object.entries(manifest.nodes)) {
      // Only process models, seeds, snapshots
      if (!['model', 'seed', 'snapshot'].includes(node.resource_type)) {
        continue;
      }
      
      const columns = Object.values(node.columns || {}).map((col, idx) => ({
        name: col.name,
        data_type: col.data_type || 'unknown',
        description: col.description || '',
        position: idx + 1
      }));
      
      models.push({
        name: node.name,
        schema: node.schema,
        database: node.database,
        object_type: node.resource_type as 'model' | 'seed' | 'snapshot',
        description: node.description || '',
        columns,
        compiled_sql: node.compiled_code || node.raw_code,
        raw_sql: node.raw_code,
        tags: node.tags || [],
        unique_id: uniqueId
      });
    }
    
    return models;
  }
  
  /**
   * Extract sources from manifest
   */
  private extractSources(manifest: DBTManifest): ParsedSource[] {
    const sources: ParsedSource[] = [];
    
    for (const [uniqueId, source] of Object.entries(manifest.sources || {})) {
      const columns = Object.values(source.columns || {}).map(col => ({
        name: col.name,
        data_type: col.data_type || 'unknown',
        description: col.description || ''
      }));
      
      sources.push({
        name: source.name,
        source_name: source.source_name,
        schema: source.schema,
        database: source.database,
        identifier: source.identifier,
        columns,
        unique_id: uniqueId
      });
    }
    
    return sources;
  }
  
  /**
   * Extract model-level dependencies from manifest
   * 100% accurate - comes directly from dbt compiler
   */
  private extractDependencies(manifest: DBTManifest): ParsedDependency[] {
    const dependencies: ParsedDependency[] = [];
    
    for (const [uniqueId, node] of Object.entries(manifest.nodes)) {
      if (!node.depends_on) continue;
      
      // Ensure nodes is an array before iterating
      const dependencyNodes = Array.isArray(node.depends_on.nodes) 
        ? node.depends_on.nodes 
        : [];
      
      for (const depId of dependencyNodes) {
        dependencies.push({
          source_unique_id: uniqueId,
          target_unique_id: depId,
          source_name: this.extractName(uniqueId),
          target_name: this.extractName(depId),
          confidence: 1.0  // 100% from manifest!
        });
      }
    }
    
    return dependencies;
  }
  
  /**
   * Extract column-level lineage from manifest (dbt v1.6+)
   * Falls back to empty array if not available
   */
  private extractColumnLineage(manifest: DBTManifest): ParsedColumnLineage[] {
    const lineages: ParsedColumnLineage[] = [];
    
    for (const [uniqueId, node] of Object.entries(manifest.nodes)) {
      if (!node.column_lineage) continue;
      
      const modelName = this.extractName(uniqueId);
      
      for (const [columnName, lineageInfo] of Object.entries(node.column_lineage)) {
        const sourceColumns = lineageInfo.columns.map(col => ({
          model: this.extractName(col.node_id),
          column: col.name
        }));
        
        lineages.push({
          target_model: modelName,
          target_column: columnName,
          source_columns: sourceColumns,
          confidence: 1.0  // From manifest
        });
      }
    }
    
    return lineages;
  }
  
  /**
   * Extract model/source name from unique_id
   * "model.jaffle_shop.customers" → "customers"
   */
  private extractName(uniqueId: string): string {
    return uniqueId.split('.').pop() || uniqueId;
  }
  
  /**
   * Check if manifest has column lineage info (dbt v1.6+)
   */
  hasColumnLineage(manifest: DBTManifest): boolean {
    for (const node of Object.values(manifest.nodes)) {
      if (node.column_lineage && Object.keys(node.column_lineage).length > 0) {
        return true;
      }
    }
    return false;
  }
}
