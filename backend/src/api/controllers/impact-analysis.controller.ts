import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

interface ImpactAnalysisRequest {
    objectType: 'file' | 'asset' | 'column' | 'function';
    objectId: string;
    changeType?: 'modification' | 'deletion' | 'rename' | 'type_change';
    maxDepth?: number;
}

export class ImpactAnalysisController {
    
    /**
     * Analyze the impact of changing a specific column
     * Example: "If I change this column, what other columns are affected?"
     */
    static async analyzeColumnImpact(req: Request, res: Response) {
        try {
            const { objectId, changeType = 'modification', maxDepth = 10 } = req.body as ImpactAnalysisRequest;

            console.log(`🔍 Analyzing column impact for: ${objectId}, change: ${changeType}`);

            // Call the database function for column impact analysis
            const { data, error } = await supabase
                .rpc('analyze_column_impact', {
                    p_column_id: objectId,
                    p_change_type: changeType,
                    p_max_depth: maxDepth
                });

            if (error) {
                console.error('Error analyzing column impact:', error);
                return res.status(500).json({ 
                    error: 'Failed to analyze column impact',
                    details: error.message
                });
            }

            // Get column details for context
            const { data: columnData, error: columnError } = await supabase
                .from('data_columns')
                .select(`
                    id, column_name, column_type, column_description,
                    asset:data_assets!inner(
                        id, asset_name, asset_type,
                        file:files!inner(id, file_path, language, repository_full_name)
                    )
                `)
                .eq('id', objectId)
                .single();

            if (columnError) {
                console.error('Error fetching column details:', columnError);
                return res.status(404).json({ 
                    error: 'Column not found',
                    details: columnError.message
                });
            }

            // Safely access the nested data
            const asset = Array.isArray(columnData.asset) ? columnData.asset[0] : columnData.asset;
            const file = asset && Array.isArray(asset.file) ? asset.file[0] : asset?.file;

            const impactSummary = {
                changedObject: {
                    type: 'column',
                    id: objectId,
                    name: columnData.column_name,
                    dataType: columnData.column_type,
                    asset: asset?.asset_name || 'Unknown',
                    file: (file && !Array.isArray(file)) ? file.file_path : 'Unknown',
                    language: (file && !Array.isArray(file)) ? file.language : 'Unknown',
                    repository: (file && !Array.isArray(file)) ? file.repository_full_name : 'Unknown'
                },
                changeType,
                impactAnalysis: {
                    totalImpactedColumns: data?.length || 0,
                    maxImpactLevel: Math.max(...(data?.map((d: any) => d.impact_level) || [0])),
                    criticalImpacts: data?.filter((d: any) => d.impact_severity === 'critical').length || 0,
                    highImpacts: data?.filter((d: any) => d.impact_severity === 'high').length || 0,
                    mediumImpacts: data?.filter((d: any) => d.impact_severity === 'medium').length || 0,
                    lowImpacts: data?.filter((d: any) => d.impact_severity === 'low').length || 0
                },
                impactedColumns: data?.map((impact: any) => ({
                    level: impact.impact_level,
                    columnId: impact.impacted_column_id,
                    columnName: impact.impacted_column_name,
                    assetName: impact.impacted_asset_name,
                    filePath: impact.impacted_file_path,
                    impactType: impact.impact_type,
                    severity: impact.impact_severity,
                    transformationChain: impact.transformation_chain,
                    businessImpact: impact.business_impact,
                    fixComplexity: impact.fix_complexity
                })) || [],
                recommendations: ImpactAnalysisController.generateColumnRecommendations(data, changeType)
            };

            res.json(impactSummary);

        } catch (error) {
            console.error('Error in analyzeColumnImpact:', error);
            res.status(500).json({ 
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Analyze the impact of changing a specific file
     * Example: "If I change this file, what other files are affected?"
     */
    static async analyzeFileImpact(req: Request, res: Response) {
        try {
            const { objectId, changeType = 'modification', maxDepth = 10 } = req.body as ImpactAnalysisRequest;

            console.log(`🔍 Analyzing file impact for: ${objectId}, change: ${changeType}`);

            // Call the database function for file impact analysis
            const { data, error } = await supabase
                .rpc('analyze_file_impact', {
                    p_file_id: objectId,
                    p_change_type: changeType,
                    p_max_depth: maxDepth
                });

            if (error) {
                console.error('Error analyzing file impact:', error);
                return res.status(500).json({ 
                    error: 'Failed to analyze file impact',
                    details: error.message
                });
            }

            // Get file details for context
            const { data: fileData, error: fileError } = await supabase
                .from('files')
                .select(`
                    id, file_path, language, repository_full_name,
                    assets:data_assets(id, asset_name, asset_type),
                    functions:code_functions(id, function_name, function_type)
                `)
                .eq('id', objectId)
                .single();

            if (fileError) {
                console.error('Error fetching file details:', fileError);
                return res.status(404).json({ 
                    error: 'File not found',
                    details: fileError.message
                });
            }

            const impactSummary = {
                changedObject: {
                    type: 'file',
                    id: objectId,
                    path: fileData.file_path,
                    language: fileData.language,
                    repository: fileData.repository_full_name,
                    assets: fileData.assets?.map((a: any) => ({ id: a.id, name: a.asset_name, type: a.asset_type })) || [],
                    functions: fileData.functions?.map((f: any) => ({ id: f.id, name: f.function_name, type: f.function_type })) || []
                },
                changeType,
                impactAnalysis: {
                    totalImpactedFiles: data?.length || 0,
                    maxImpactLevel: Math.max(...(data?.map((d: any) => d.impact_level) || [0])),
                    criticalImpacts: data?.filter((d: any) => d.impact_severity === 'critical').length || 0,
                    highImpacts: data?.filter((d: any) => d.impact_severity === 'high').length || 0,
                    mediumImpacts: data?.filter((d: any) => d.impact_severity === 'medium').length || 0,
                    lowImpacts: data?.filter((d: any) => d.impact_severity === 'low').length || 0,
                    executionOrderImpacted: data?.some((d: any) => d.execution_order_impact) || false
                },
                impactedFiles: data?.map((impact: any) => ({
                    level: impact.impact_level,
                    fileId: impact.impacted_file_id,
                    filePath: impact.impacted_file_path,
                    impactedAssets: impact.impacted_assets,
                    impactType: impact.impact_type,
                    severity: impact.impact_severity,
                    dependencyChain: impact.dependency_chain,
                    executionOrderImpact: impact.execution_order_impact,
                    businessImpact: impact.business_impact,
                    recommendedActions: impact.recommended_actions
                })) || [],
                recommendations: ImpactAnalysisController.generateFileRecommendations(data, changeType)
            };

            res.json(impactSummary);

        } catch (error) {
            console.error('Error in analyzeFileImpact:', error);
            res.status(500).json({ 
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Generate recommendations for column impact
     */
    private static generateColumnRecommendations(impactData: any[], changeType: string): string[] {
        const recommendations: string[] = [];

        if (!impactData || impactData.length === 0) {
            recommendations.push('No downstream dependencies detected. Change appears safe.');
            return recommendations;
        }

        const criticalCount = impactData.filter(d => d.impact_severity === 'critical').length;
        const highCount = impactData.filter(d => d.impact_severity === 'high').length;

        if (criticalCount > 0) {
            recommendations.push(`⚠️ CRITICAL: ${criticalCount} critical dependencies found. Coordinate with stakeholders before making changes.`);
        }

        if (highCount > 0) {
            recommendations.push(`🔥 HIGH IMPACT: ${highCount} high-impact dependencies. Thorough testing required.`);
        }

        if (changeType === 'deletion') {
            recommendations.push('🗑️ DELETION: Ensure all dependent queries/scripts are updated or will be removed.');
        }

        if (changeType === 'type_change') {
            recommendations.push('🔄 TYPE CHANGE: Verify data type compatibility across all dependent columns.');
        }

        const maxLevel = Math.max(...impactData.map(d => d.impact_level));
        if (maxLevel > 3) {
            recommendations.push(`📊 DEEP IMPACT: Dependencies found up to ${maxLevel} levels deep. Consider phased rollout.`);
        }

        recommendations.push('✅ Run impact analysis again after implementing changes to verify resolution.');

        return recommendations;
    }

    /**
     * Generate recommendations for file impact
     */
    private static generateFileRecommendations(impactData: any[], changeType: string): string[] {
        const recommendations: string[] = [];

        if (!impactData || impactData.length === 0) {
            recommendations.push('No file dependencies detected. Change appears isolated.');
            return recommendations;
        }

        const executionOrderImpacted = impactData.some(d => d.execution_order_impact);
        if (executionOrderImpacted) {
            recommendations.push('⚠️ EXECUTION ORDER: Changes may affect execution sequence. Review orchestration logic.');
        }

        const criticalCount = impactData.filter(d => d.impact_severity === 'critical').length;
        if (criticalCount > 0) {
            recommendations.push(`🚨 CRITICAL FILES: ${criticalCount} critical files affected. Coordinate deployment carefully.`);
        }

        if (changeType === 'deletion') {
            recommendations.push('🗑️ FILE DELETION: Ensure all import statements and references are updated.');
        }

        if (changeType === 'rename') {
            recommendations.push('📝 FILE RENAME: Update all references to the old file name.');
        }

        const maxLevel = Math.max(...impactData.map(d => d.impact_level));
        if (maxLevel > 2) {
            recommendations.push(`🔗 CASCADING IMPACT: File dependencies extend ${maxLevel} levels deep.`);
        }

        recommendations.push('🧪 Test all dependent files after making changes.');

        return recommendations;
    }
}
