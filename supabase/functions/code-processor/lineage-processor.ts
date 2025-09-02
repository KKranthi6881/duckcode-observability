// Enhanced Lineage Processor - Phase 2E
// Automatically populates column_dependency_graph and cross-file relationships

import { createClient } from 'supabase-js';

interface ColumnDependency {
    sourceColumnId: string;
    targetColumnId: string;
    dependencyType: 'direct_copy' | 'calculation' | 'aggregation' | 'join_key' | 'filter_condition' | 'transformation' | 'concatenation' | 'lookup';
    transformationExpression?: string;
    businessRule?: string;
    confidenceScore: number;
    discoveredInFileId: string;
    discoveredAtLine?: number;
}

interface CrossFileRelationship {
    sourceFileId: string;
    targetFileId: string;
    relationshipType: 'imports' | 'references' | 'executes' | 'inherits';
    confidenceScore: number;
    specificAssets: string[];
}

export class EnhancedLineageProcessor {
    private supabase: any;

    constructor(supabaseUrl: string, supabaseKey: string) {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
            db: { schema: 'code_insights' },
            auth: { persistSession: false, autoRefreshToken: false }
        });
    }

    /**
     * Process repository-wide lineage to build comprehensive dependency graph
     */
    async processRepositoryLineage(repositoryId: string): Promise<{
        columnDependencies: number;
        crossFileRelationships: number;
        circularDependencies: string[];
    }> {
        console.log(`🔄 Processing repository-wide lineage for: ${repositoryId}`);

        try {
            // 1. Extract column-level dependencies from existing data
            const columnDeps = await this.extractColumnDependencies(repositoryId);
            console.log(`📊 Found ${columnDeps.length} column dependencies`);

            // 2. Extract cross-file relationships
            const crossFileRels = await this.extractCrossFileRelationships(repositoryId);
            console.log(`🔗 Found ${crossFileRels.length} cross-file relationships`);

            // 3. Store column dependencies
            await this.storeColumnDependencies(columnDeps);

            // 4. Store cross-file relationships
            await this.storeCrossFileRelationships(crossFileRels);

            // 5. Detect circular dependencies
            const circularDeps = await this.detectCircularDependencies(repositoryId);
            console.log(`⚠️ Found ${circularDeps.length} circular dependencies`);

            // 6. Update repository summary
            await this.updateRepositorySummary(repositoryId, columnDeps.length, crossFileRels.length, circularDeps.length);

            return {
                columnDependencies: columnDeps.length,
                crossFileRelationships: crossFileRels.length,
                circularDependencies: circularDeps
            };

        } catch (error) {
            console.error('❌ Error processing repository lineage:', error);
            throw error;
        }
    }

    /**
     * Extract column-level dependencies from existing lineage data
     */
    private async extractColumnDependencies(repositoryId: string): Promise<ColumnDependency[]> {
        const dependencies: ColumnDependency[] = [];

        // Get all data lineage relationships for this repository
        const { data: lineageData, error } = await this.supabase
            .from('data_lineage')
            .select(`
                *,
                source_asset:data_assets!source_asset_id(
                    id, asset_name, file_id,
                    columns:data_columns(id, column_name, column_type)
                ),
                target_asset:data_assets!target_asset_id(
                    id, asset_name, file_id,
                    columns:data_columns(id, column_name, column_type)
                ),
                discovered_file:files!discovered_in_file_id(repository_id)
            `)
            .eq('discovered_file.repository_id', repositoryId);

        if (error) {
            console.error('Error fetching lineage data:', error);
            return dependencies;
        }

        // Process each lineage relationship to extract column dependencies
        for (const lineage of lineageData || []) {
            if (!lineage.source_asset?.columns || !lineage.target_asset?.columns) {
                continue;
            }

            // Analyze transformation logic to map columns
            const columnMappings = this.analyzeColumnMappings(
                lineage.source_asset.columns,
                lineage.target_asset.columns,
                lineage.transformation_logic,
                lineage.relationship_type
            );

            for (const mapping of columnMappings) {
                dependencies.push({
                    sourceColumnId: mapping.sourceColumnId,
                    targetColumnId: mapping.targetColumnId,
                    dependencyType: mapping.dependencyType,
                    transformationExpression: mapping.transformationExpression,
                    businessRule: lineage.business_context,
                    confidenceScore: mapping.confidenceScore,
                    discoveredInFileId: lineage.discovered_in_file_id,
                    discoveredAtLine: lineage.discovered_at_line
                });
            }
        }

        return dependencies;
    }

    /**
     * Analyze column mappings between source and target assets
     */
    private analyzeColumnMappings(
        sourceColumns: any[],
        targetColumns: any[],
        transformationLogic?: string,
        relationshipType?: string
    ): Array<{
        sourceColumnId: string;
        targetColumnId: string;
        dependencyType: ColumnDependency['dependencyType'];
        transformationExpression?: string;
        confidenceScore: number;
    }> {
        const mappings: Array<{
            sourceColumnId: string;
            targetColumnId: string;
            dependencyType: ColumnDependency['dependencyType'];
            transformationExpression?: string;
            confidenceScore: number;
        }> = [];

        // Strategy 1: Exact name matching (high confidence)
        for (const targetCol of targetColumns) {
            const sourceCol = sourceColumns.find(sc => 
                sc.column_name.toLowerCase() === targetCol.column_name.toLowerCase()
            );
            
            if (sourceCol) {
                mappings.push({
                    sourceColumnId: sourceCol.id,
                    targetColumnId: targetCol.id,
                    dependencyType: 'direct_copy',
                    transformationExpression: `${sourceCol.column_name} -> ${targetCol.column_name}`,
                    confidenceScore: 0.95
                });
            }
        }

        // Strategy 2: Pattern-based matching from transformation logic
        if (transformationLogic) {
            const additionalMappings = this.extractMappingsFromTransformationLogic(
                sourceColumns,
                targetColumns,
                transformationLogic
            );
            mappings.push(...additionalMappings);
        }

        // Strategy 3: Type-based matching for common patterns
        if (relationshipType === 'aggregation') {
            const aggMappings = this.identifyAggregationMappings(sourceColumns, targetColumns);
            mappings.push(...aggMappings);
        }

        // Strategy 4: Join key identification
        if (relationshipType === 'join') {
            const joinMappings = this.identifyJoinKeyMappings(sourceColumns, targetColumns);
            mappings.push(...joinMappings);
        }

        return mappings;
    }

    /**
     * Extract column mappings from transformation logic text
     */
    private extractMappingsFromTransformationLogic(
        sourceColumns: any[],
        targetColumns: any[],
        transformationLogic: string
    ): Array<{
        sourceColumnId: string;
        targetColumnId: string;
        dependencyType: ColumnDependency['dependencyType'];
        transformationExpression?: string;
        confidenceScore: number;
    }> {
        const mappings: Array<{
            sourceColumnId: string;
            targetColumnId: string;
            dependencyType: ColumnDependency['dependencyType'];
            transformationExpression?: string;
            confidenceScore: number;
        }> = [];

        // Look for SQL patterns like "SELECT col1, col2 FROM..." 
        const selectPattern = /SELECT\s+(.*?)\s+FROM/gi;
        const selectMatch = selectPattern.exec(transformationLogic);
        
        if (selectMatch) {
            const selectedColumns = selectMatch[1].split(',').map(col => col.trim());
            
            for (const selectedCol of selectedColumns) {
                // Handle aliases: "column_name AS alias" or "column_name alias"
                const aliasPattern = /^(.*?)\s+(?:AS\s+)?(\w+)$/i;
                const aliasMatch = aliasPattern.exec(selectedCol);
                
                let sourceColName = selectedCol;
                let targetColName = selectedCol;
                let dependencyType: ColumnDependency['dependencyType'] = 'direct_copy';
                
                if (aliasMatch) {
                    sourceColName = aliasMatch[1].trim();
                    targetColName = aliasMatch[2].trim();
                }

                // Check for calculations
                if (sourceColName.includes('(') || sourceColName.includes('+') || sourceColName.includes('-') || sourceColName.includes('*') || sourceColName.includes('/')) {
                    dependencyType = 'calculation';
                }

                // Check for aggregations
                if (/\b(SUM|COUNT|AVG|MAX|MIN|STRING_AGG)\s*\(/i.test(sourceColName)) {
                    dependencyType = 'aggregation';
                }

                const sourceCol = sourceColumns.find(sc => 
                    sourceColName.toLowerCase().includes(sc.column_name.toLowerCase()) ||
                    sc.column_name.toLowerCase().includes(sourceColName.toLowerCase())
                );
                
                const targetCol = targetColumns.find(tc => 
                    tc.column_name.toLowerCase() === targetColName.toLowerCase()
                );

                if (sourceCol && targetCol) {
                    mappings.push({
                        sourceColumnId: sourceCol.id,
                        targetColumnId: targetCol.id,
                        dependencyType,
                        transformationExpression: selectedCol,
                        confidenceScore: 0.8
                    });
                }
            }
        }

        return mappings;
    }

    /**
     * Identify aggregation column mappings
     */
    private identifyAggregationMappings(sourceColumns: any[], targetColumns: any[]): Array<{
        sourceColumnId: string;
        targetColumnId: string;
        dependencyType: ColumnDependency['dependencyType'];
        transformationExpression?: string;
        confidenceScore: number;
    }> {
        const mappings: Array<{
            sourceColumnId: string;
            targetColumnId: string;
            dependencyType: ColumnDependency['dependencyType'];
            transformationExpression?: string;
            confidenceScore: number;
        }> = [];

        // Common aggregation patterns
        const aggPatterns = [
            { pattern: /total_|sum_|_total|_sum/, type: 'SUM' },
            { pattern: /count_|_count|num_|_num/, type: 'COUNT' },
            { pattern: /avg_|average_|mean_/, type: 'AVG' },
            { pattern: /max_|maximum_/, type: 'MAX' },
            { pattern: /min_|minimum_/, type: 'MIN' }
        ];

        for (const targetCol of targetColumns) {
            for (const aggPattern of aggPatterns) {
                if (aggPattern.pattern.test(targetCol.column_name.toLowerCase())) {
                    // Find potential source columns (usually numeric columns)
                    const numericSourceCols = sourceColumns.filter(sc => 
                        sc.column_type && 
                        /(int|decimal|numeric|float|double|money)/i.test(sc.column_type)
                    );

                    for (const sourceCol of numericSourceCols) {
                        mappings.push({
                            sourceColumnId: sourceCol.id,
                            targetColumnId: targetCol.id,
                            dependencyType: 'aggregation',
                            transformationExpression: `${aggPattern.type}(${sourceCol.column_name})`,
                            confidenceScore: 0.7
                        });
                    }
                    break;
                }
            }
        }

        return mappings;
    }

    /**
     * Identify join key mappings
     */
    private identifyJoinKeyMappings(sourceColumns: any[], targetColumns: any[]): Array<{
        sourceColumnId: string;
        targetColumnId: string;
        dependencyType: ColumnDependency['dependencyType'];
        transformationExpression?: string;
        confidenceScore: number;
    }> {
        const mappings: Array<{
            sourceColumnId: string;
            targetColumnId: string;
            dependencyType: ColumnDependency['dependencyType'];
            transformationExpression?: string;
            confidenceScore: number;
        }> = [];

        // Common join key patterns
        const joinKeyPatterns = [
            /.*_id$/,
            /.*_key$/,
            /^id$/,
            /^key$/,
            /.*_code$/,
            /.*_number$/
        ];

        for (const pattern of joinKeyPatterns) {
            const sourceJoinCols = sourceColumns.filter(sc => pattern.test(sc.column_name.toLowerCase()));
            const targetJoinCols = targetColumns.filter(tc => pattern.test(tc.column_name.toLowerCase()));

            for (const sourceCol of sourceJoinCols) {
                for (const targetCol of targetJoinCols) {
                    if (sourceCol.column_name.toLowerCase() === targetCol.column_name.toLowerCase()) {
                        mappings.push({
                            sourceColumnId: sourceCol.id,
                            targetColumnId: targetCol.id,
                            dependencyType: 'join_key',
                            transformationExpression: `JOIN ON ${sourceCol.column_name} = ${targetCol.column_name}`,
                            confidenceScore: 0.9
                        });
                    }
                }
            }
        }

        return mappings;
    }

    /**
     * Extract cross-file relationships
     */
    private async extractCrossFileRelationships(repositoryId: string): Promise<CrossFileRelationship[]> {
        const relationships: CrossFileRelationship[] = [];

        // Get existing file dependencies
        const { data: fileDeps, error } = await this.supabase
            .from('file_dependencies')
            .select(`
                *,
                source_file:files!source_file_id(repository_id),
                target_file:files!target_file_id(repository_id)
            `)
            .eq('source_file.repository_id', repositoryId);

        if (error) {
            console.error('Error fetching file dependencies:', error);
            return relationships;
        }

        // Convert existing file dependencies to cross-file relationships
        for (const fileDep of fileDeps || []) {
            relationships.push({
                sourceFileId: fileDep.source_file_id,
                targetFileId: fileDep.target_file_id,
                relationshipType: fileDep.dependency_type as CrossFileRelationship['relationshipType'],
                confidenceScore: fileDep.confidence_score || 0.8,
                specificAssets: fileDep.specific_items || []
            });
        }

        // Find additional relationships through asset name matching
        const assetRelationships = await this.findAssetBasedRelationships(repositoryId);
        relationships.push(...assetRelationships);

        return relationships;
    }

    /**
     * Find relationships based on asset name matching across files
     */
    private async findAssetBasedRelationships(repositoryId: string): Promise<CrossFileRelationship[]> {
        const relationships: CrossFileRelationship[] = [];

        // Find assets with same names across different files
        const { data: assetMatches, error } = await this.supabase
            .rpc('find_cross_file_asset_matches', { p_repository_id: repositoryId });

        if (error) {
            console.warn('Could not find cross-file asset matches:', error);
            return relationships;
        }

        for (const match of assetMatches || []) {
            relationships.push({
                sourceFileId: match.source_file_id,
                targetFileId: match.target_file_id,
                relationshipType: 'references',
                confidenceScore: match.confidence_score || 0.7,
                specificAssets: [match.asset_name]
            });
        }

        return relationships;
    }

    /**
     * Store column dependencies in the database
     */
    private async storeColumnDependencies(dependencies: ColumnDependency[]): Promise<void> {
        if (dependencies.length === 0) return;

        console.log(`📊 Storing ${dependencies.length} column dependencies...`);

        // Batch insert column dependencies
        const batchSize = 100;
        for (let i = 0; i < dependencies.length; i += batchSize) {
            const batch = dependencies.slice(i, i + batchSize);
            
            const { error } = await this.supabase
                .from('column_dependency_graph')
                .upsert(batch.map(dep => ({
                    source_column_id: dep.sourceColumnId,
                    target_column_id: dep.targetColumnId,
                    dependency_type: dep.dependencyType,
                    transformation_expression: dep.transformationExpression,
                    business_rule: dep.businessRule,
                    confidence_score: dep.confidenceScore,
                    discovered_in_file_id: dep.discoveredInFileId,
                    discovered_at_line: dep.discoveredAtLine
                })), {
                    onConflict: 'source_column_id,target_column_id,dependency_type'
                });

            if (error) {
                console.error(`Error storing column dependencies batch ${i}-${i + batchSize}:`, error);
            } else {
                console.log(`✅ Stored column dependencies batch ${i}-${i + batchSize}`);
            }
        }
    }

    /**
     * Store cross-file relationships
     */
    private async storeCrossFileRelationships(relationships: CrossFileRelationship[]): Promise<void> {
        if (relationships.length === 0) return;

        console.log(`🔗 Storing ${relationships.length} cross-file relationships...`);

        // Note: These would be stored in a cross_file_relationships table
        // For now, we'll enhance the existing file_dependencies table
        const { error } = await this.supabase
            .from('file_dependencies')
            .upsert(relationships.map(rel => ({
                source_file_id: rel.sourceFileId,
                target_file_id: rel.targetFileId,
                dependency_type: rel.relationshipType,
                confidence_score: rel.confidenceScore,
                specific_items: rel.specificAssets
            })), {
                onConflict: 'source_file_id,target_file_id,dependency_type'
            });

        if (error) {
            console.error('Error storing cross-file relationships:', error);
        } else {
            console.log(`✅ Stored ${relationships.length} cross-file relationships`);
        }
    }

    /**
     * Detect circular dependencies
     */
    private async detectCircularDependencies(repositoryId: string): Promise<string[]> {
        const { data, error } = await this.supabase
            .rpc('detect_circular_dependencies', { p_repository_id: repositoryId });

        if (error) {
            console.warn('Could not detect circular dependencies:', error);
            return [];
        }

        return data?.map((cycle: any) => cycle.dependency_path.join(' -> ')) || [];
    }

    /**
     * Update repository summary with lineage statistics
     */
    private async updateRepositorySummary(
        repositoryId: string,
        columnDependencies: number,
        crossFileRelationships: number,
        circularDependencies: number
    ): Promise<void> {
        // Get current counts
        const { data: fileCounts } = await this.supabase
            .from('files')
            .select('id, language')
            .eq('repository_id', repositoryId);

        const { data: assetCounts } = await this.supabase
            .from('data_assets')
            .select('id')
            .in('file_id', fileCounts?.map(f => f.id) || []);

        const { data: columnCounts } = await this.supabase
            .from('data_columns')
            .select('id')
            .in('asset_id', assetCounts?.map(a => a.id) || []);

        const { data: functionCounts } = await this.supabase
            .from('code_functions')
            .select('id')
            .in('file_id', fileCounts?.map(f => f.id) || []);

        // Calculate language distribution
        const languageDistribution = fileCounts?.reduce((acc: any, file) => {
            acc[file.language] = (acc[file.language] || 0) + 1;
            return acc;
        }, {}) || {};

        // Upsert repository summary
        const { error } = await this.supabase
            .from('repository_dependency_summary')
            .upsert({
                repository_id: repositoryId,
                total_files: fileCounts?.length || 0,
                total_assets: assetCounts?.length || 0,
                total_columns: columnCounts?.length || 0,
                total_functions: functionCounts?.length || 0,
                total_dependencies: crossFileRelationships,
                dependency_depth: Math.max(1, Math.ceil(Math.log2(crossFileRelationships + 1))),
                circular_dependencies: circularDependencies,
                language_distribution: languageDistribution,
                complexity_score: this.calculateComplexityScore(
                    fileCounts?.length || 0,
                    crossFileRelationships,
                    circularDependencies
                ),
                last_analyzed_at: new Date().toISOString()
            }, {
                onConflict: 'repository_id'
            });

        if (error) {
            console.error('Error updating repository summary:', error);
        } else {
            console.log('✅ Updated repository dependency summary');
        }
    }

    /**
     * Calculate complexity score based on various factors
     */
    private calculateComplexityScore(
        totalFiles: number,
        totalDependencies: number,
        circularDependencies: number
    ): number {
        // Base complexity from file count
        let complexity = Math.min(0.3, totalFiles / 1000);
        
        // Add complexity from dependencies
        complexity += Math.min(0.4, totalDependencies / 500);
        
        // Penalty for circular dependencies
        complexity += Math.min(0.3, circularDependencies / 10);
        
        return Math.min(1.0, complexity);
    }
}

// Usage example:
// const processor = new EnhancedLineageProcessor(supabaseUrl, supabaseKey);
// const result = await processor.processRepositoryLineage(repositoryId); 