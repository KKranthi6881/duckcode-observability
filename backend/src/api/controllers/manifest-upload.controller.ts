import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { ManifestParser } from '../../services/metadata/parsers/ManifestParser';
import { ExtractionOrchestrator } from '../../services/metadata/extraction/ExtractionOrchestrator';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

/**
 * Upload manifest.json manually when dbt parse fails
 * 
 * Process:
 * 1. User runs `dbt parse` locally
 * 2. Uploads target/manifest.json
 * 3. Backend validates and processes
 * 4. Stores as GOLD tier metadata
 */
export const uploadManifest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId } = req.params;
    const userOrgId = (req.user as any)?.organization_id;

    console.log('📤 [MANIFEST-UPLOAD] Starting upload for connection:', connectionId);

    if (!userOrgId) {
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized' 
      });
    }

    // Get connection details and verify access
    const { data: connection, error: connError } = await supabase
      .schema('enterprise')
      .from('github_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('organization_id', userOrgId)
      .single();

    if (connError || !connection) {
      console.error('❌ [MANIFEST-UPLOAD] Connection not found or access denied');
      return res.status(404).json({ 
        success: false,
        message: 'Connection not found or access denied' 
      });
    }

    // Get manifest content from request body
    const { manifestJson } = req.body;

    if (!manifestJson) {
      return res.status(400).json({ 
        success: false,
        message: 'No manifest data provided. Expected JSON in request body.' 
      });
    }

    console.log('✅ [MANIFEST-UPLOAD] Manifest received, validating...');

    // Parse manifest string to JSON
    let manifest: any;
    try {
      manifest = typeof manifestJson === 'string' 
        ? JSON.parse(manifestJson) 
        : manifestJson;
    } catch (error) {
      console.error('❌ [MANIFEST-UPLOAD] Invalid JSON format');
      return res.status(400).json({ 
        success: false,
        message: 'Invalid JSON format' 
      });
    }

    // Validate manifest structure
    if (!manifest.metadata || !manifest.nodes) {
      console.error('❌ [MANIFEST-UPLOAD] Invalid manifest structure');
      return res.status(400).json({ 
        success: false,
        message: 'Invalid manifest.json format. Must contain "metadata" and "nodes" fields.' 
      });
    }

    console.log('✅ [MANIFEST-UPLOAD] Manifest validated');
    console.log(`   dbt version: ${manifest.metadata.dbt_version || 'unknown'}`);
    console.log(`   Schema version: ${manifest.metadata.dbt_schema_version || 'unknown'}`);

    // Update connection status to extracting
    await supabase
      .schema('enterprise')
      .from('github_connections')
      .update({
        status: 'extracting',
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId);

    console.log('🔄 [MANIFEST-UPLOAD] Processing manifest...');

    // Parse manifest using existing parser
    const manifestParser = new ManifestParser();
    const parsed = await manifestParser.parseManifest(JSON.stringify(manifest));

    console.log(`📊 [MANIFEST-UPLOAD] Parsed manifest:`);
    console.log(`   Models: ${parsed.models.length}`);
    console.log(`   Sources: ${parsed.sources.length}`);
    console.log(`   Dependencies: ${parsed.dependencies.length}`);
    console.log(`   Column Lineage: ${parsed.columnLineage.length}`);

    // Store metadata using orchestrator's storage method
    const orchestrator = new ExtractionOrchestrator();
    await (orchestrator as any).storeManifestData(
      connectionId,
      userOrgId,
      parsed
    );

    console.log('💾 [MANIFEST-UPLOAD] Metadata stored');

    // Mark as completed with GOLD tier
    await supabase
      .schema('enterprise')
      .from('github_connections')
      .update({
        status: 'completed',
        manifest_uploaded: true,
        extraction_tier: 'GOLD',
        manifest_version: manifest.metadata.dbt_version,
        extraction_warnings: parsed.warnings || null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId);

    console.log('✅ [MANIFEST-UPLOAD] Upload completed successfully');

    return res.json({
      success: true,
      data: {
        models: parsed.models.length,
        sources: parsed.sources.length,
        dependencies: parsed.dependencies.length,
        columnLineage: parsed.columnLineage.length,
        dbtVersion: manifest.metadata.dbt_version,
        extractionTier: 'GOLD'
      },
      message: 'Manifest uploaded and processed successfully'
    });

  } catch (error: any) {
    console.error('❌ [MANIFEST-UPLOAD] Upload failed:', error);
    
    // Update connection with error
    const { connectionId } = req.params;
    await supabase
      .schema('enterprise')
      .from('github_connections')
      .update({
        status: 'failed',
        error_message: `Manifest upload failed: ${error.message}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId);

    return res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to process manifest' 
    });
  }
};

/**
 * Get detailed error information for a failed extraction
 */
export const getExtractionError = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId } = req.params;
    const userOrgId = (req.user as any)?.organization_id;

    const { data: connection, error } = await supabase
      .schema('enterprise')
      .from('github_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('organization_id', userOrgId)
      .single();

    if (error || !connection) {
      return res.status(404).json({ 
        success: false,
        message: 'Connection not found' 
      });
    }

    // Parse error message to provide guidance
    const errorMessage = connection.error_message || 'Unknown error';
    const guidance = getErrorGuidance(errorMessage);

    return res.json({
      success: true,
      data: {
        status: connection.status,
        errorMessage,
        guidance,
        recoveryOptions: [
          {
            type: 'retry',
            title: 'Retry Extraction',
            description: 'Fix the issues in your dbt project and try extraction again'
          },
          {
            type: 'upload',
            title: 'Upload Manifest',
            description: 'Run "dbt parse" locally and upload manifest.json'
          }
        ]
      }
    });

  } catch (error: any) {
    console.error('❌ [ERROR-INFO] Failed to get error info:', error);
    return res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

/**
 * Provide actionable guidance based on error message
 */
function getErrorGuidance(errorMessage: string): string[] {
  const guidance: string[] = [];
  const lower = errorMessage.toLowerCase();

  if (lower.includes('profiles.yml') || lower.includes('profile')) {
    guidance.push('❌ profiles.yml configuration issue');
    guidance.push('');
    guidance.push('Fix: Ensure profiles.yml exists and is properly configured');
    guidance.push('Location: ~/.dbt/profiles.yml or your project directory');
  }

  if (lower.includes('packages.yml') || lower.includes('package')) {
    guidance.push('❌ Package dependencies issue');
    guidance.push('');
    guidance.push('Fix: Install package dependencies');
    guidance.push('Run: dbt deps');
  }

  if (lower.includes('compilation error') || lower.includes('compile')) {
    guidance.push('❌ SQL compilation error');
    guidance.push('');
    guidance.push('Fix: Check your SQL syntax in model files');
    guidance.push('Run: dbt compile --select <model_name>');
  }

  if (lower.includes('doc(') || lower.includes('documentation')) {
    guidance.push('❌ Missing documentation reference');
    guidance.push('');
    guidance.push('Fix: Check schema.yml files for undefined doc() calls');
    guidance.push('Remove doc() calls or define them in docs blocks');
  }

  if (lower.includes('env_var')) {
    guidance.push('❌ Environment variable not set');
    guidance.push('');
    guidance.push('Fix: Set required environment variables');
    guidance.push('Check dbt_project.yml and profiles.yml for env_var() calls');
  }

  if (guidance.length === 0) {
    guidance.push('❌ dbt parse failed');
    guidance.push('');
    guidance.push('General troubleshooting:');
    guidance.push('1. Run "dbt parse" locally to see the full error');
    guidance.push('2. Check logs for specific compilation errors');
    guidance.push('3. Verify all dependencies are installed (dbt deps)');
  }

  guidance.push('');
  guidance.push('📝 To test locally:');
  guidance.push('');
  guidance.push('  cd /path/to/your/dbt/project');
  guidance.push('  dbt deps  # Install dependencies');
  guidance.push('  dbt parse --no-partial-parse');
  guidance.push('  ls -lh target/manifest.json  # Verify it was created');
  guidance.push('');
  guidance.push('Once manifest.json is generated, you can upload it here.');

  return guidance;
}
