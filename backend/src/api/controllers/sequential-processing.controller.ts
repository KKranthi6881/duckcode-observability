import { Request, Response } from 'express';
import { supabaseCodeInsights } from '../../config/supabaseClient';
import supabaseAdmin from '../../config/supabaseClient';
import { getOctokitForUser, listAllRepoFiles } from '../../services/github.service';
import axios from 'axios';

interface ProcessingPhase {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  startTime?: Date;
  endTime?: Date;
  progress: number;
  details?: any;
  nextPhase?: string;
}

export class SequentialProcessingController {
  
  /**
   * Start sequential processing pipeline
   * Only starts with Documentation Analysis - other phases auto-trigger
   */
  static async startSequentialProcessing(req: Request, res: Response) {
    try {
      const { repositoryFullName, selectedLanguage } = req.body;
      const userId = req.user?.id;
      
      // Extract the JWT token from the Authorization header
      const authHeader = req.headers.authorization;
      const jwtToken = authHeader?.split(' ')[1];
      
      console.log('🔍 Sequential Processing Debug:', {
        hasRepoName: !!repositoryFullName,
        repositoryFullName,
        hasUser: !!req.user,
        userId,
        hasJwtToken: !!jwtToken,
        userKeys: req.user ? Object.keys(req.user) : null
      });
      
      if (!userId) {
        console.error('❌ User not authenticated - req.user:', req.user);
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!jwtToken) {
        console.error('❌ No JWT token found in request');
        return res.status(401).json({ error: 'No authentication token found' });
      }

      if (!repositoryFullName || !repositoryFullName.includes('/')) {
        return res.status(400).json({ message: 'A valid repositoryFullName (e.g., "owner/repo") is required.' });
      }
      
      console.log(`🚀 Starting sequential processing for repository: ${repositoryFullName}`);
      
      // ===== STEP 1: SCAN REPOSITORY AND CREATE JOBS =====
      console.log(`📁 Step 1: Scanning repository ${repositoryFullName} for files...`);
      
      // Get GitHub connection for the user
      const octokit = await getOctokitForUser(userId);
      if (!octokit) {
        return res.status(404).json({ message: 'GitHub connection not found for this user.' });
      }

      // Get installation ID
      const { data: installationData, error: installationError } = await supabaseAdmin
        .schema('github_module')
        .from('github_app_installations')
        .select('installation_id')
        .eq('supabase_user_id', userId)
        .single();

      if (installationError || !installationData) {
        console.error(`GitHub App installation not found for user ${userId}:`, installationError);
        return res.status(404).json({ message: 'GitHub App installation not found for your account.' });
      }

      const githubInstallationId = installationData.installation_id;
      const [owner, repo] = repositoryFullName.split('/');

      // Scan repository files
      const allFiles = await listAllRepoFiles(octokit, owner, repo);
      
      // Filter for allowed file types
      const ALLOWED_EXTENSIONS = ['.sql', '.py', '.js', '.ts', '.java', '.cpp', '.c', '.h', '.cs', '.php', '.rb', '.go', '.rs', '.kt', '.swift', '.scala', '.r', '.m', '.sh', '.yml', '.yaml', '.json', '.xml', '.md'];
      const filesToProcess = allFiles.filter((file: any) => {
        if (ALLOWED_EXTENSIONS.length === 0) return true;
        return ALLOWED_EXTENSIONS.some(ext => file.path.endsWith(ext));
      });

      if (filesToProcess.length === 0) {
        return res.status(200).json({ 
          message: 'Repository scanned. No files matching the criteria to process.',
          totalFilesScanned: allFiles.length,
          totalFilesToProcess: 0
        });
      }

      console.log(`📋 Found ${filesToProcess.length} files to process in ${repositoryFullName}`);

      // Helper function to detect language from file path
      const getLanguageFromFilePath = (filePath: string): string => {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const languageMap: { [key: string]: string } = {
          'sql': 'sql',
          'py': 'python',
          'js': 'javascript',
          'ts': 'typescript',
          'java': 'java',
          'cpp': 'cpp',
          'c': 'c',
          'h': 'c',
          'cs': 'csharp',
          'php': 'php',
          'rb': 'ruby',
          'go': 'go',
          'rs': 'rust',
          'kt': 'kotlin',
          'swift': 'swift',
          'scala': 'scala',
          'r': 'r',
          'm': 'matlab',
          'sh': 'bash',
          'yml': 'yaml',
          'yaml': 'yaml',
          'json': 'json',
          'xml': 'xml',
          'md': 'markdown'
        };
        return languageMap[ext || ''] || 'unknown';
      };

      // Create file records
      const fileRecords = filesToProcess.map((file: any) => ({
        user_id: userId,
        repository_full_name: repositoryFullName,
        file_path: file.path,
        file_hash: file.sha,
        language: getLanguageFromFilePath(file.path),
        parsing_status: 'pending',
        github_installation_id: githubInstallationId,
      }));

      console.log(`💾 Upserting ${fileRecords.length} files into database...`);
      
      // Upsert files
      const { data: upsertedFiles, error: filesError } = await supabaseCodeInsights
        .from('files')
        .upsert(fileRecords, {
          onConflict: 'repository_full_name, file_path',
          ignoreDuplicates: false,
        })
        .select();

      if (filesError) {
        console.error('Error upserting files:', filesError);
        return res.status(500).json({ error: 'Failed to save file data', details: filesError.message });
      }

      console.log(`✅ Successfully upserted ${upsertedFiles?.length || 0} files`);

      // Create processing jobs for each file
      if (upsertedFiles && upsertedFiles.length > 0) {
        const jobRecords = upsertedFiles.map(file => {
          // Determine if this file should have lineage processing enabled
          const isLineageEligible = file.language?.toLowerCase().includes('sql') || 
                                    file.language?.toLowerCase().includes('postgres') ||
                                    file.language?.toLowerCase().includes('mysql') ||
                                    file.language?.toLowerCase().includes('snowflake') ||
                                    file.language?.toLowerCase().includes('bigquery') ||
                                    file.language?.toLowerCase().includes('redshift') ||
                                    file.file_path?.toLowerCase().endsWith('.sql');

          return {
            file_id: file.id,
            status: 'pending', // Start with documentation pending
            vector_status: null, // Will be set to 'pending' after docs complete
            lineage_status: isLineageEligible ? null : null, // Will be set to 'pending' after vectors complete (for SQL files)
            retry_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            analysis_language: selectedLanguage || 'default',
          };
        });

        console.log(`🔧 Creating ${jobRecords.length} processing jobs...`);
        const lineageEnabledCount = jobRecords.filter(job => 
          upsertedFiles.find(f => f.id === job.file_id)?.language?.toLowerCase().includes('sql')
        ).length;
        console.log(`📊 ${lineageEnabledCount} SQL files will be eligible for lineage processing`);

        const { error: jobError } = await supabaseCodeInsights
          .from('processing_jobs')
          .insert(jobRecords);

        if (jobError) {
          console.error('Error creating processing jobs:', jobError);
          return res.status(500).json({ error: 'Failed to create processing jobs', details: jobError.message });
        }

        console.log(`✅ Successfully created ${jobRecords.length} processing jobs`);
      }

      // ===== STEP 2: CREATE SEQUENTIAL PROCESSING JOB =====
      console.log(`📋 Step 2: Creating sequential processing job...`);
      
      // Create sequential processing job record
      const processingJob = {
        repository_full_name: repositoryFullName,
        user_id: userId,
        job_type: 'sequential_metadata',
        status: 'processing',
        current_phase: 'documentation',
        phases: {
          documentation: { status: 'pending', progress: 0 },
          vectors: { status: 'pending', progress: 0 },
          lineage: { status: 'pending', progress: 0 },
          dependencies: { status: 'pending', progress: 0 },
          analysis: { status: 'pending', progress: 0 }
        },
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: jobData, error: jobError } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .insert(processingJob)
        .select()
        .single();

      if (jobError) {
        console.error('❌ Error creating sequential processing job:', jobError);
        return res.status(500).json({ error: 'Failed to create processing job', details: jobError.message });
      }

      console.log(`✅ Sequential processing job created with ID: ${jobData.id}`);

      // ===== STEP 3: START PHASE 1 - DOCUMENTATION =====
      console.log(`🚀 Step 3: Starting Phase 1 - Documentation Analysis...`);
      
      // Start Phase 1: Documentation Analysis
      await SequentialProcessingController.triggerDocumentationProcessing(repositoryFullName, jwtToken, jobData.id, userId, selectedLanguage);

      res.json({
        message: 'Sequential processing started with Documentation Analysis',
        jobId: jobData.id,
        filesScanned: allFiles.length,
        filesQueued: filesToProcess.length,
        currentPhase: 'documentation',
        phases: [
          { id: 'documentation', name: '📄 Documentation Analysis', status: 'processing' },
          { id: 'vectors', name: '🔍 Vector Generation', status: 'pending' },
          { id: 'lineage', name: '🔗 Lineage Extraction', status: 'pending' },
          { id: 'dependencies', name: '🌐 Dependency Resolution', status: 'pending' },
          { id: 'analysis', name: '📊 Impact Analysis', status: 'pending' }
        ]
      });

    } catch (error) {
      console.error('Error starting sequential processing:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Phase 1: Documentation Analysis
   */
  static async triggerDocumentationProcessing(repositoryFullName: string, jwtToken: string, jobId: string, userId: string, selectedLanguage?: string) {
    try {
      console.log(`🔄 Triggering Phase 1: Documentation processing for ${repositoryFullName}`);
      
      // Call the dedicated Phase 1 endpoint
      const response = await axios.post(
        `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/phases/documentation`,
        {
          repositoryFullName,
          selectedLanguage
        },
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 300000 // 5 minutes timeout
        }
      );

      // Accept both 200 (OK) and 202 (Accepted) as success for async processing
      if (response.status === 200 || response.status === 202) {
        console.log(`✅ Phase 1 Documentation triggered successfully for ${repositoryFullName} (status: ${response.status})`);
        
        // Update job to processing state
        await this.updateJobPhase(jobId, 'documentation', 'processing', 10);
        
        // Start monitoring
        await this.monitorDocumentationProgress(repositoryFullName, jwtToken, jobId, userId);
      } else {
        throw new Error(`Phase 1 Documentation failed with status: ${response.status}`);
      }
    } catch (error: any) {
      console.error(`❌ Error triggering Phase 1 Documentation:`, error.message);
      await this.updateJobPhase(jobId, 'documentation', 'error', 0, error.message);
      throw error;
    }
  }

  /**
   * Monitor Phase 1: Documentation Progress
   * Enhanced monitoring with better error handling
   */
  static async monitorDocumentationProgress(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    const checkProgress = async () => {
      try {
        // Check documentation completion status
        const { data: statusData, error } = await supabaseCodeInsights
          .rpc('get_repository_processing_status', {
            repo_full_name: repositoryFullName,
            user_id_param: userId
          });

        if (error) {
          console.error('Error checking documentation progress:', error);
          return false;
        }

        const status = statusData?.[0];
        if (!status) {
          console.log('No status data found, continuing monitoring...');
          return false;
        }

        const progress = status.total_files > 0 ? 
          Math.round((status.documentation_completed / status.total_files) * 100) : 0;

        console.log(`📊 Documentation Progress: ${status.documentation_completed}/${status.total_files} (${progress}%)`);
        
        // Update job progress
        await this.updateJobPhase(jobId, 'documentation', 'processing', progress);

        // Check if documentation is complete
        if (status.documentation_completed >= status.total_files && status.total_files > 0) {
          console.log(`✅ Phase 1 Documentation completed for ${repositoryFullName}`);
          
          // Update job to completed and advance to next phase
          await this.updateJobPhase(jobId, 'documentation', 'completed', 100);
          await this.updateJobCurrentPhase(jobId, '2'); // Move to Phase 2
          
          // Trigger Phase 2: Vector Processing
          await this.triggerVectorProcessing(repositoryFullName, jwtToken, jobId, userId);
          return true;
        }

        return false;
      } catch (error: any) {
        console.error('Error monitoring documentation progress:', error);
        await this.updateJobPhase(jobId, 'documentation', 'error', 0, error.message);
        return true; // Stop monitoring on error
      }
    };

    // Start monitoring with interval
    const monitorInterval = setInterval(async () => {
      const isComplete = await checkProgress();
      if (isComplete) {
        clearInterval(monitorInterval);
      }
    }, 5000); // Check every 5 seconds

    // Initial check
    await checkProgress();
  }

  /**
   * Phase 2: Vector Generation
   */
  static async triggerVectorProcessing(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    try {
      console.log(`🔄 Triggering Phase 2: Vector processing for ${repositoryFullName}`);
      
      // FIRST: Set up vector processing jobs properly
      console.log(`🔧 Setting up vector processing jobs for ${repositoryFullName}`);
      
      // Find completed documentation jobs that need vector processing
      const { data: completedDocs, error: findError } = await supabaseCodeInsights
        .from('processing_jobs')
        .select(`
          id,
          file_id,
          status,
          vector_status,
          files!inner(repository_full_name, file_path, language, user_id)
        `)
        .eq('files.repository_full_name', repositoryFullName)
        .eq('files.user_id', userId)
        .eq('status', 'completed') // Documentation must be completed
        .is('vector_status', null); // No vector processing yet

      if (findError) {
        console.error('Error finding completed documentation files:', findError);
        throw new Error(`Failed to find files ready for vector processing: ${findError.message}`);
      }

      console.log(`🔍 Found ${completedDocs?.length || 0} files with completed documentation`);

      if (!completedDocs || completedDocs.length === 0) {
        console.log('No files found with completed documentation ready for vector processing');
        // Update job to completed since no work to do
        await SequentialProcessingController.updateJobPhase(jobId, 'vectors', 'completed', 100);
        await SequentialProcessingController.updateJobCurrentPhase(jobId, 'lineage');
        await SequentialProcessingController.triggerLineageProcessing(repositoryFullName, jwtToken, jobId, userId);
        return;
      }

      // Set vector_status to 'pending' for all eligible jobs
      const jobIds = completedDocs.map(job => job.id);
      
      console.log(`🔧 Enabling vector processing for ${jobIds.length} jobs...`);
      
      const { error: updateError } = await supabaseCodeInsights
        .from('processing_jobs')
        .update({
          vector_status: 'pending',
          leased_at: null, // Ensure not leased
          updated_at: new Date().toISOString()
        })
        .in('id', jobIds);

      if (updateError) {
        console.error('Error enabling vector processing:', updateError);
        throw new Error(`Failed to enable vector processing: ${updateError.message}`);
      }

      console.log(`✅ Successfully enabled vector processing for ${completedDocs.length} files`);
      
      // SECOND: Now call the edge function (it will find the pending jobs)
      console.log(`🚀 Vector jobs ready - edge function will pick them up automatically`);
      
      // Update job to processing state
      await SequentialProcessingController.updateJobPhase(jobId, 'vectors', 'processing', 10);
      
      // Start monitoring
      await SequentialProcessingController.monitorVectorProgress(repositoryFullName, jwtToken, jobId, userId);
      
    } catch (error: any) {
      console.error(`❌ Error triggering Phase 2 Vector processing:`, error.message);
      await SequentialProcessingController.updateJobPhase(jobId, 'vectors', 'error', 0, error.message);
      throw error;
    }
  }

  /**
   * Monitor Phase 2: Vector Progress
   * Enhanced monitoring with better error handling
   */
  static async monitorVectorProgress(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    const checkProgress = async () => {
      try {
        // Check vector completion status
        const { data: statusData, error } = await supabaseCodeInsights
          .rpc('get_repository_processing_status', {
            repo_full_name: repositoryFullName,
            user_id_param: userId
          });

        if (error) {
          console.error('Error checking vector progress:', error);
          return false;
        }

        const status = statusData?.[0];
        if (!status) {
          console.log('No status data found, continuing monitoring...');
          return false;
        }

        const progress = status.total_files > 0 ? 
          Math.round((status.vector_completed / status.total_files) * 100) : 0;

        console.log(`📊 Vector Progress: ${status.vector_completed}/${status.total_files} (${progress}%)`);
        
        // Update job progress
        await this.updateJobPhase(jobId, 'vectors', 'processing', progress);

        // Check if vectors are complete
        if (status.vector_completed >= status.total_files && status.total_files > 0) {
          console.log(`✅ Phase 2 Vector processing completed for ${repositoryFullName}`);
          
          // Update job to completed and advance to next phase
          await this.updateJobPhase(jobId, 'vectors', 'completed', 100);
          await this.updateJobCurrentPhase(jobId, 'lineage'); // Move to Phase 3
          
          // Trigger Phase 3: Lineage Processing
          await this.triggerLineageProcessing(repositoryFullName, jwtToken, jobId, userId);
          return true;
        }

        return false;
      } catch (error: any) {
        console.error('Error monitoring vector progress:', error);
        await this.updateJobPhase(jobId, 'vectors', 'error', 0, error.message);
        return true; // Stop monitoring on error
      }
    };

    // Start monitoring with interval
    const monitorInterval = setInterval(async () => {
      const isComplete = await checkProgress();
      if (isComplete) {
        clearInterval(monitorInterval);
      }
    }, 5000); // Check every 5 seconds

    // Initial check
    await checkProgress();
  }

  /**
   * Phase 3: Lineage Processing
   */
  static async triggerLineageProcessing(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    try {
      console.log(`🔄 Triggering Phase 3: Lineage processing for ${repositoryFullName}`);
      
      // FIRST: Set up lineage processing jobs properly
      console.log(`🔧 Setting up lineage processing jobs for ${repositoryFullName}`);
      
      // Find completed documentation jobs that need lineage processing
      const { data: allCompletedJobs, error: findError } = await supabaseCodeInsights
        .from('processing_jobs')
        .select(`
          id,
          file_id,
          status,
          lineage_status,
          files!inner(repository_full_name, file_path, language, user_id)
        `)
        .eq('files.repository_full_name', repositoryFullName)
        .eq('files.user_id', userId)
        .eq('status', 'completed') // Documentation must be completed
        .is('lineage_status', null); // No lineage processing yet

      if (findError) {
        console.error('Error finding completed documentation files:', findError);
        throw new Error(`Failed to find files ready for lineage processing: ${findError.message}`);
      }

      // Filter for SQL files in JavaScript (more reliable than complex PostgREST queries)
      const eligibleJobs = allCompletedJobs?.filter(job => {
        const filePath = (job as any).files?.file_path?.toLowerCase() || '';
        const language = (job as any).files?.language?.toLowerCase() || '';
        
        // Check if it's a SQL file by extension or language
        return filePath.endsWith('.sql') || 
               language.includes('sql') || 
               language.includes('postgres') || 
               language.includes('mysql') || 
               language.includes('snowflake') || 
               language.includes('bigquery') || 
               language.includes('redshift');
             }) || [];

      console.log(`🔍 Found ${eligibleJobs?.length || 0} SQL files eligible for lineage processing`);

      if (!eligibleJobs || eligibleJobs.length === 0) {
        console.log('No SQL files found ready for lineage processing');
        // Update job to completed since no work to do
        await SequentialProcessingController.updateJobPhase(jobId, 'lineage', 'completed', 100);
        await SequentialProcessingController.updateJobCurrentPhase(jobId, 'dependencies');
        await SequentialProcessingController.triggerDependenciesProcessing(repositoryFullName, jwtToken, jobId, userId);
        return;
      }

      // Set lineage_status to 'pending' for all eligible jobs
      const jobIds = eligibleJobs.map(job => job.id);
      
      console.log(`🔧 Enabling lineage processing for ${jobIds.length} jobs...`);
      
      const { error: updateError } = await supabaseCodeInsights
        .from('processing_jobs')
        .update({
          lineage_status: 'pending',
          leased_at: null, // Ensure not leased
          updated_at: new Date().toISOString()
        })
        .in('id', jobIds);

      if (updateError) {
        console.error('Error enabling lineage processing:', updateError);
        throw new Error(`Failed to enable lineage processing: ${updateError.message}`);
      }

      console.log(`✅ Successfully enabled lineage processing for ${eligibleJobs.length} files`);
      
      // SECOND: Now the edge function will pick up the pending jobs
      console.log(`🚀 Lineage jobs ready - edge function will pick them up automatically`);
      
      // Update job to processing state
      await SequentialProcessingController.updateJobPhase(jobId, 'lineage', 'processing', 10);
      
      // Start monitoring
      await SequentialProcessingController.monitorLineageProgress(repositoryFullName, jwtToken, jobId, userId);
      
    } catch (error: any) {
      console.error(`❌ Error triggering Phase 3 Lineage processing:`, error.message);
      await SequentialProcessingController.updateJobPhase(jobId, 'lineage', 'error', 0, error.message);
      throw error;
    }
  }

  /**
   * Helper function to determine if a file is eligible for lineage extraction.
   * This logic must be kept in sync with the edge function.
   */
  private static isFileEligibleForLineage(filePath: string, language: string): boolean {
    const lowerPath = filePath.toLowerCase();
    const lowerLang = language?.toLowerCase() || '';

    // Exclude common non-lineage files, tests, and dependencies
    if (
      lowerPath.includes('/test/') ||
      lowerPath.includes('/tests/') ||
      lowerPath.includes('__tests__') ||
      lowerPath.endsWith('.spec.ts') ||
      lowerPath.endsWith('.test.ts') ||
      lowerPath.endsWith('.spec.js') ||
      lowerPath.endsWith('.test.js') ||
      lowerPath.includes('dbt_packages') ||
      lowerPath.includes('node_modules')
    ) {
      return false;
    }

    // Include primary data-related languages and frameworks
    if (
      lowerLang.includes('sql') ||
      lowerLang === 'python' ||
      lowerPath.includes('dbt_project.yml') ||
      (lowerPath.includes('/models/') && lowerPath.endsWith('.sql')) || // dbt models
      (lowerPath.includes('/dags/') && lowerLang === 'python') // Airflow DAGs
    ) {
      return true;
    }

    return false;
  }

    /**
   * Monitor Phase 3: Lineage Progress
   * Enhanced monitoring with eligibility check and RLS-aware queries.
   */
    static async monitorLineageProgress(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
      const checkProgress = async () => {
        try {
          // Step 1: Get all files for the repository to determine eligibility
          const { data: allFiles, error: filesError } = await supabaseCodeInsights
            .from('files')
            .select('id, file_path, language')
            .eq('repository_full_name', repositoryFullName)
            .eq('user_id', userId);
  
          if (filesError) {
            console.error('Error fetching files for lineage eligibility:', filesError);
            return false; // Continue trying
          }
  
          // Step 2: Filter for eligible files using the helper function
          const eligibleFiles = allFiles.filter(file =>
            SequentialProcessingController.isFileEligibleForLineage(file.file_path as any, file.language as any)
          );
          const eligibleFileIds = eligibleFiles.map(file => file.id);
          const totalEligibleFiles = eligibleFileIds.length;
  
          if (totalEligibleFiles === 0) {
            console.log('✅ No files eligible for lineage. Completing phase.');
            await this.updateJobPhase(jobId, 'lineage', 'completed', 100);
            await this.updateJobCurrentPhase(jobId, 'dependencies');
            await this.triggerDependenciesProcessing(repositoryFullName, jwtToken, jobId, userId);
            return true; // Stop monitoring
          }
  
          // Step 3: Fetch completed and failed jobs, ensuring we filter by user_id to respect RLS.
          // This is the critical fix: `files!inner(user_id)` and `.eq('files.user_id', userId)`
          const { data: completedJobsData, error: completedError } = await supabaseCodeInsights
            .from('processing_jobs')
            .select(`
              id,
              lineage_status,
              files!inner(user_id)
            `)
            .eq('files.user_id', userId)
            .in('file_id', eligibleFileIds)
            .eq('lineage_status', 'completed');
  
          const { data: failedJobsData, error: failedError } = await supabaseCodeInsights
            .from('processing_jobs')
            .select(`
              id,
              lineage_status,
              files!inner(user_id)
            `)
            .eq('files.user_id', userId)
            .in('file_id', eligibleFileIds)
            .eq('lineage_status', 'failed');
  
          if (completedError || failedError) {
            console.error('Error fetching lineage job data:', completedError || failedError);
            return false; // Continue trying
          }
  
          const safeCompletedJobs = completedJobsData?.length ?? 0;
          const safeFailedJobs = failedJobsData?.length ?? 0;
          const processedJobs = safeCompletedJobs + safeFailedJobs;
  
          const progress = totalEligibleFiles > 0 ? Math.round((safeCompletedJobs / totalEligibleFiles) * 100) : 0;
          
          console.log(`📊 Lineage Progress: ${safeCompletedJobs}/${totalEligibleFiles} eligible files processed (${progress}%)`);
          await this.updateJobPhase(jobId, 'lineage', 'processing', progress);
  
          // Step 4: Check for completion
          if (processedJobs >= totalEligibleFiles) {
            console.log(`✅ Phase 3 Lineage processing completed for ${repositoryFullName}`);
            
            await this.updateJobPhase(jobId, 'lineage', 'completed', 100);
            await this.updateJobCurrentPhase(jobId, 'dependencies');
            await this.triggerDependenciesProcessing(repositoryFullName, jwtToken, jobId, userId);
            return true; // Stop monitoring
          }
  
          return false; // Continue monitoring
        } catch (error: any) {
          console.error('Error in monitorLineageProgress:', error);
          await this.updateJobPhase(jobId, 'lineage', 'failed', 0, `Error in monitorLineageProgress: ${error.message}`);
          return true; // Stop monitoring on unexpected error
        }
      };
  
      const interval = setInterval(async () => {
        const shouldStop = await checkProgress();
        if (shouldStop) {
          clearInterval(interval);
        }
      }, 10000); // Check every 10 seconds
    }


  /**
   * Phase 4: Dependencies Processing
   */
  static async triggerDependenciesProcessing(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    try {
      console.log(`🔄 Triggering Phase 4: Dependencies processing for ${repositoryFullName}`);
      
      // Call the dedicated Phase 4 endpoint (using regular endpoint as it doesn't require edge function)
      const response = await axios.post(
        `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/phases/debug/dependencies`,
        {
          repositoryFullName
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 600000 // 10 minutes timeout for dependencies processing
        }
      );

      // Accept both 200 (OK) and 202 (Accepted) as success for async processing
      if (response.status === 200 || response.status === 202) {
        console.log(`✅ Phase 4 Dependencies processing triggered successfully for ${repositoryFullName} (status: ${response.status})`);
        
        // Update job to processing state
        await SequentialProcessingController.updateJobPhase(jobId, 'dependencies', 'processing', 10);
        
        // Start monitoring
        await SequentialProcessingController.monitorDependenciesProgress(repositoryFullName, jwtToken, jobId, userId);
      } else {
        throw new Error(`Phase 4 Dependencies processing failed with status: ${response.status}`);
      }
    } catch (error: any) {
      console.error(`❌ Error triggering Phase 4 Dependencies processing:`, error.message);
      await SequentialProcessingController.updateJobPhase(jobId, 'dependencies', 'error', 0, error.message);
      throw error;
    }
  }

  /**
   * Monitor Phase 4: Dependencies Progress
   * Enhanced monitoring with completion detection
   */
  static async monitorDependenciesProgress(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    const checkProgress = async () => {
      try {
        // Check if dependency analysis is complete
        const { data: depAnalysis, error } = await supabaseCodeInsights
          .from('repository_dependency_analysis')
          .select('status, total_nodes, total_edges')
          .eq('repository_full_name', repositoryFullName)
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking dependencies progress:', error);
          return false;
        }

        if (depAnalysis && depAnalysis.status === 'completed') {
          console.log(`✅ Phase 4 Dependencies processing completed for ${repositoryFullName}`);
          console.log(`📊 Dependency Graph: ${depAnalysis.total_nodes} nodes, ${depAnalysis.total_edges} edges`);
          
          // Update job to completed and advance to next phase
          await this.updateJobPhase(jobId, 'dependencies', 'completed', 100);
          await this.updateJobCurrentPhase(jobId, 'analysis'); // Move to Phase 5
          
          // Trigger Phase 5: Analysis Processing
          await this.triggerAnalysisProcessing(repositoryFullName, jwtToken, jobId, userId);
          return true;
        }

        // Still processing, update progress with meaningful details
        await this.updateJobPhase(jobId, 'dependencies', 'processing', 50, null, {
          totalFiles: 1,
          completedFiles: 0,
          pendingFiles: 1,
          failedFiles: 0,
          details: 'Analyzing cross-file dependencies and building dependency graph...'
        });
        console.log(`📊 Dependencies processing in progress for ${repositoryFullName}`);

        return false;
      } catch (error: any) {
        console.error('Error monitoring dependencies progress:', error);
        await this.updateJobPhase(jobId, 'dependencies', 'error', 0, error.message);
        return true; // Stop monitoring on error
      }
    };

    // Start monitoring with interval
    const monitorInterval = setInterval(async () => {
      const isComplete = await checkProgress();
      if (isComplete) {
        clearInterval(monitorInterval);
      }
    }, 10000); // Check every 10 seconds

    // Initial check with delay to allow processing to start
    setTimeout(async () => {
      await checkProgress();
    }, 2000);
  }

  /**
   * Phase 5: Analysis Processing
   */
  static async triggerAnalysisProcessing(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    try {
      console.log(`🔄 Triggering Phase 5: Analysis processing for ${repositoryFullName}`);
      
      // Call the dedicated Phase 5 endpoint
      const response = await axios.post(
        `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/phases/debug/analysis`,
        {
          repositoryFullName
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 600000 // 10 minutes timeout for analysis processing
        }
      );

      // Accept both 200 (OK) and 202 (Accepted) as success for async processing
      if (response.status === 200 || response.status === 202) {
        console.log(`✅ Phase 5 Analysis processing triggered successfully for ${repositoryFullName} (status: ${response.status})`);
        
        // Update job to processing state
        await this.updateJobPhase(jobId, 'analysis', 'processing', 10);
        
        // Start monitoring
        await this.monitorAnalysisProgress(repositoryFullName, jwtToken, jobId, userId);
      } else {
        throw new Error(`Phase 5 Analysis processing failed with status: ${response.status}`);
      }
    } catch (error: any) {
      console.error(`❌ Error triggering Phase 5 Analysis processing:`, error.message);
      await this.updateJobPhase(jobId, 'analysis', 'error', 0, error.message);
      throw error;
    }
  }

  /**
   * Monitor Phase 5: Analysis Progress
   * Enhanced monitoring with completion detection
   */
  static async monitorAnalysisProgress(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    const checkProgress = async () => {
      try {
        // Check if impact analysis is complete
        const { data: impactAnalysis, error } = await supabaseCodeInsights
          .from('repository_impact_analysis')
          .select('status, overall_risk_score, business_impact_score')
          .eq('repository_full_name', repositoryFullName)
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking analysis progress:', error);
          return false;
        }

        if (impactAnalysis && impactAnalysis.status === 'completed') {
          console.log(`✅ Phase 5 Analysis processing completed for ${repositoryFullName}`);
          console.log(`📊 Analysis Results: Risk Score ${impactAnalysis.overall_risk_score}%, Business Impact ${impactAnalysis.business_impact_score}%`);
          
          // Update job to completed and complete the entire job
          await this.updateJobPhase(jobId, 'analysis', 'completed', 100, null, {
            totalFiles: 1,
            completedFiles: 1,
            pendingFiles: 0,
            failedFiles: 0,
            details: `Impact analysis completed: ${impactAnalysis.overall_risk_score}% risk, ${impactAnalysis.business_impact_score}% business impact`
          });
          await this.updateJobCurrentPhase(jobId, 'completed');
          await this.completeSequentialJob(jobId);
          
          return true;
        }

        // Still processing, update progress with meaningful details
        await this.updateJobPhase(jobId, 'analysis', 'processing', 50, null, {
          totalFiles: 1,
          completedFiles: 0,
          pendingFiles: 1,
          failedFiles: 0,
          details: 'Generating comprehensive impact analysis and business recommendations...'
        });
        console.log(`📊 Analysis processing in progress for ${repositoryFullName}`);

        return false;
      } catch (error: any) {
        console.error('Error monitoring analysis progress:', error);
        await this.updateJobPhase(jobId, 'analysis', 'error', 0, error.message);
        return true; // Stop monitoring on error
      }
    };

    // Start monitoring with interval
    const monitorInterval = setInterval(async () => {
      const isComplete = await checkProgress();
      if (isComplete) {
        clearInterval(monitorInterval);
      }
    }, 10000); // Check every 10 seconds

    // Initial check with delay to allow processing to start
    setTimeout(async () => {
      await checkProgress();
    }, 2000);
  }
  /**
   * Get sequential processing status with real-time file counts.
   * This is the definitive, RLS-aware status endpoint.
   */
  static async getSequentialStatus(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get the main sequential job entry
      const { data: jobData, error: jobError } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .select('id, status, current_phase, phases, created_at, completed_at')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (jobError || !jobData) {
        return res.status(404).json({ message: 'No sequential processing job found' });
      }

      // Get LIVE processing status for all files in the repo, respecting RLS
      const { data: allJobs, error: filesError } = await supabaseCodeInsights
        .from('processing_jobs')
        .select(`
          status,
          vector_status,
          lineage_status,
          files!inner(
            file_path,
            language
          )
        `)
        .eq('files.user_id', userId)
        .eq('files.repository_full_name', repositoryFullName);

      if (filesError) {
        console.error('Error fetching live job statuses:', filesError);
        return res.status(500).json({ error: 'Could not fetch file processing status' });
      }

      // Calculate counts for each phase from the live data
      const docCounts = { completed: 0, failed: 0, pending: 0, total: allJobs.length };
      const vectorCounts = { completed: 0, failed: 0, pending: 0, total: allJobs.length };
      
      const eligibleLineageFiles = allJobs.filter(j => {
        const fileData = j.files as any;
        if (!fileData) return false;
        return SequentialProcessingController.isFileEligibleForLineage(fileData.file_path, fileData.language);
      });
      const lineageCounts = { completed: 0, failed: 0, pending: 0, total: eligibleLineageFiles.length };

      allJobs.forEach(job => {
        // Documentation
        if (job.status === 'completed') docCounts.completed++;
        else if (job.status === 'failed') docCounts.failed++;
        else docCounts.pending++;
        // Vectors
        if (job.vector_status === 'completed') vectorCounts.completed++;
        else if (job.vector_status === 'failed') vectorCounts.failed++;
        else vectorCounts.pending++;
      });

      eligibleLineageFiles.forEach(job => {
        if (job.lineage_status === 'completed') lineageCounts.completed++;
        else if (job.lineage_status === 'failed') lineageCounts.failed++;
        else lineageCounts.pending++;
      });

      // Get dependency and analysis status
      const { data: depData } = await supabaseCodeInsights.from('repository_dependency_analysis').select('status').eq('repository_full_name', repositoryFullName).single();
      const { data: analysisData } = await supabaseCodeInsights.from('repository_impact_analysis').select('status').eq('repository_full_name', repositoryFullName).single();

      // Build the final, accurate phase object
      const enhancedPhases = {
        documentation: { ...jobData.phases.documentation, ...docCounts },
        vectors: { ...jobData.phases.vectors, ...vectorCounts },
        lineage: { ...jobData.phases.lineage, ...lineageCounts },
        dependencies: {
          ...jobData.phases.dependencies,
          status: depData?.status === 'completed' ? 'completed' : jobData.phases.dependencies?.status || 'pending',
          total: 1,
          completed: depData?.status === 'completed' ? 1 : 0,
          pending: depData?.status === 'completed' ? 0 : 1,
          details: lineageCounts.completed >= lineageCounts.total ? (jobData.phases.dependencies?.details || 'Ready') : 'Waiting for lineage completion'
        },
        analysis: {
          ...jobData.phases.analysis,
          status: analysisData?.status === 'completed' ? 'completed' : jobData.phases.analysis?.status || 'pending',
          total: 1,
          completed: analysisData?.status === 'completed' ? 1 : 0,
          pending: analysisData?.status === 'completed' ? 0 : 1,
          details: depData?.status === 'completed' ? (jobData.phases.analysis?.details || 'Ready') : 'Waiting for dependency analysis'
        }
      };

      // Recalculate progress based on live counts
      enhancedPhases.documentation.progress = docCounts.total > 0 ? Math.round((docCounts.completed / docCounts.total) * 100) : 0;
      enhancedPhases.vectors.progress = vectorCounts.total > 0 ? Math.round((vectorCounts.completed / vectorCounts.total) * 100) : 0;
      enhancedPhases.lineage.progress = lineageCounts.total > 0 ? Math.round((lineageCounts.completed / lineageCounts.total) * 100) : 0;

      return res.json({
        jobId: jobData.id,
        status: jobData.status,
        currentPhase: jobData.current_phase,
        phases: enhancedPhases,
        createdAt: jobData.created_at,
        completedAt: jobData.completed_at
      });

    } catch (error: any) {
      console.error('Error in getSequentialStatus:', error);
      return res.status(500).json({ error: 'Failed to get sequential status', details: error.message });
    }
  }
  

  /**
   * Helper: Update job phase status
   */
  static async updateJobPhase(jobId: string, phase: string, status: string, progress: number, error?: any, details?: any) {
    // First, get the current phases
    const { data: currentJob, error: fetchError } = await supabaseCodeInsights
      .from('sequential_processing_jobs')
      .select('phases')
      .eq('id', jobId)
      .single();

    if (fetchError) {
      console.error('Error fetching current job phases:', fetchError);
      return;
    }

    // Get existing phase data to preserve any existing fields
    const existingPhase = currentJob.phases?.[phase] || {};

    // Update the specific phase while preserving others and merging existing phase data
    const updatedPhases = {
      ...currentJob.phases,
      [phase]: {
        ...existingPhase, // Preserve existing fields
        status,
        progress,
        error: error ? (error instanceof Error ? error.message : error) : null,
        updatedAt: new Date().toISOString(),
        // Merge details if provided, otherwise keep existing
        ...(details && {
          totalFiles: details.totalFiles,
          completedFiles: details.completedFiles,
          pendingFiles: details.pendingFiles,
          failedFiles: details.failedFiles,
          details: details.details || null
        })
      }
    };

    const { error: updateError } = await supabaseCodeInsights
      .from('sequential_processing_jobs')
      .update({
        phases: updatedPhases,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('Error updating job phase:', updateError);
    } else {
      console.log(`✅ Updated phase ${phase} to ${status} (${progress}%)`);
      if (details) {
        console.log(`📊 Phase details: ${details.completedFiles}/${details.totalFiles} files processed`);
      }
    }
  }

  /**
   * Helper: Update current phase
   */
  static async updateJobCurrentPhase(jobId: string, currentPhase: string) {
    const { error } = await supabaseCodeInsights
      .from('sequential_processing_jobs')
      .update({ current_phase: currentPhase })
      .eq('id', jobId);

    if (error) {
      console.error('Error updating current phase:', error);
    }
  }

  /**
   * Helper: Complete sequential job
   */
  static async completeSequentialJob(jobId: string) {
    const { error } = await supabaseCodeInsights
      .from('sequential_processing_jobs')
      .update({
        status: 'completed',
        current_phase: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (error) {
      console.error('Error completing job:', error);
    } else {
      console.log(`🎉 Sequential processing completed for job: ${jobId}`);
    }
  }

  /**
   * Helper: Calculate overall progress
   */
  static calculateOverallProgress(phases: any): number {
    const phaseWeights = {
      documentation: 0.2,
      vectors: 0.2,
      lineage: 0.2,
      dependencies: 0.2,
      analysis: 0.2
    };

    let totalProgress = 0;
    for (const [phase, weight] of Object.entries(phaseWeights)) {
      const phaseData = phases[phase];
      if (phaseData?.status === 'completed') {
        totalProgress += weight * 100;
      } else if (phaseData?.status === 'processing') {
        totalProgress += weight * (phaseData.progress || 0);
      }
    }

    return Math.round(totalProgress);
  }

  /**
   * Reset stale leased jobs (debugging endpoint)
   */
  static async resetStaleJobs(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🔧 Resetting stale jobs for ${repositoryFullName}`);

      // First get the jobs, then reset them
      const { data: leasedJobs, error: findError } = await supabaseCodeInsights
        .from('processing_jobs')
        .select(`
          id,
          leased_at,
          files!inner(repository_full_name, user_id)
        `)
        .eq('files.repository_full_name', repositoryFullName)
        .eq('files.user_id', userId)
        .not('leased_at', 'is', null);

      if (findError) {
        console.error('Error finding leased jobs:', findError);
        return res.status(500).json({ error: 'Failed to find leased jobs' });
      }

      const jobIds = leasedJobs?.map(job => job.id) || [];
      console.log(`Found ${jobIds.length} leased jobs to reset:`, jobIds);

      let resetJobs = [];
      if (jobIds.length > 0) {
        const { data: resetData, error: resetError } = await supabaseCodeInsights
          .from('processing_jobs')
          .update({
            leased_at: null,
            updated_at: new Date().toISOString()
          })
          .in('id', jobIds)
          .select();

        if (resetError) {
          console.error('Error resetting jobs:', resetError);
          return res.status(500).json({ error: 'Failed to reset jobs' });
        }
        resetJobs = resetData || [];
      }

      console.log(`✅ Reset ${resetJobs?.length || 0} stale jobs`);

      res.json({
        message: `Reset ${resetJobs?.length || 0} stale leased jobs`,
        resetJobs: resetJobs?.length || 0
      });

    } catch (error) {
      console.error('Error resetting stale jobs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Debug endpoint to check job states
   */
  static async debugJobStates(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🔍 Debugging job states for ${repositoryFullName}`);

      // Get all jobs for this repository
      const { data: jobs, error } = await supabaseCodeInsights
        .from('processing_jobs')
        .select(`
          id,
          file_id,
          status,
          vector_status,
          lineage_status,
          leased_at,
          created_at,
          updated_at,
          files!inner(repository_full_name, file_path, language, user_id)
        `)
        .eq('files.repository_full_name', repositoryFullName)
        .eq('files.user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching job states:', error);
        return res.status(500).json({ error: 'Failed to fetch job states' });
      }

      // Categorize jobs
      const jobStats = {
        total: jobs?.length || 0,
        documentation: {
          pending: jobs?.filter(j => j.status === 'pending').length || 0,
          processing: jobs?.filter(j => j.status === 'processing').length || 0,
          completed: jobs?.filter(j => j.status === 'completed').length || 0,
          failed: jobs?.filter(j => j.status === 'failed').length || 0,
        },
        vectors: {
          null: jobs?.filter(j => j.vector_status === null).length || 0,
          pending: jobs?.filter(j => j.vector_status === 'pending').length || 0,
          processing: jobs?.filter(j => j.vector_status === 'processing').length || 0,
          completed: jobs?.filter(j => j.vector_status === 'completed').length || 0,
          failed: jobs?.filter(j => j.vector_status === 'failed').length || 0,
        },
        lineage: {
          null: jobs?.filter(j => j.lineage_status === null).length || 0,
          pending: jobs?.filter(j => j.lineage_status === 'pending').length || 0,
          processing: jobs?.filter(j => j.lineage_status === 'processing').length || 0,
          completed: jobs?.filter(j => j.lineage_status === 'completed').length || 0,
          failed: jobs?.filter(j => j.lineage_status === 'failed').length || 0,
        },
        leased: jobs?.filter(j => j.leased_at !== null).length || 0
      };

      console.log('📊 Job Statistics:', jobStats);

      // Sample jobs for inspection
      const sampleJobs = jobs?.slice(0, 5).map(job => ({
        id: job.id,
        file_path: (job as any).files?.file_path,
        status: job.status,
        vector_status: job.vector_status,
        lineage_status: job.lineage_status,
        leased_at: job.leased_at,
        created_at: job.created_at
      }));

      res.json({
        repository: repositoryFullName,
        stats: jobStats,
        sampleJobs,
        totalJobs: jobs?.length || 0
      });

    } catch (error) {
      console.error('Error in debug job states:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Debug method to create mock data for testing
   */
  static async createMockData(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🧪 Creating mock data for ${repositoryFullName}`);

      // Create mock files
      const mockFiles = [
        { path: 'models/customers.sql', language: 'sql' },
        { path: 'models/orders.sql', language: 'sql' },
        { path: 'models/payments.sql', language: 'sql' },
        { path: 'dbt_project.yml', language: 'yaml' },
        { path: 'README.md', language: 'markdown' }
      ];

      const fileRecords = mockFiles.map(file => ({
        user_id: userId,
        repository_full_name: repositoryFullName,
        file_path: file.path,
        file_hash: `mock-hash-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}`,
        language: file.language,
        parsing_status: 'completed',
        github_installation_id: 1234567890,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      console.log(`Inserting ${fileRecords.length} mock files`);
      const { data: filesData, error: filesError } = await supabaseCodeInsights
        .from('files')
        .upsert(fileRecords, {
          onConflict: 'repository_full_name, file_path',
          ignoreDuplicates: false,
        })
        .select();

      if (filesError) {
        console.error('Error creating mock files:', filesError);
        return res.status(500).json({ error: 'Failed to create mock files' });
      }

      // Create processing jobs for the files
      if (filesData && filesData.length > 0) {
        const jobRecords = filesData.map(file => ({
          file_id: file.id,
          status: 'completed', // Documentation completed
          vector_status: null, // Ready for vector processing
          lineage_status: null,
          retry_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          analysis_language: 'sql',
        }));

        console.log(`Creating ${jobRecords.length} mock processing jobs`);
        const { error: jobError } = await supabaseCodeInsights
          .from('processing_jobs')
          .insert(jobRecords);

        if (jobError) {
          console.error('Error creating mock jobs:', jobError);
          return res.status(500).json({ error: 'Failed to create mock jobs' });
        }
      }

      res.json({
        message: 'Mock data created successfully',
        filesCreated: filesData?.length || 0,
        jobsCreated: filesData?.length || 0,
        status: 'Ready for vector processing'
      });

    } catch (error) {
      console.error('Error creating mock data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Helper: Reset all data for a repository
   */
  static async resetRepositoryData(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🗑️ Resetting all data for ${repositoryFullName}`);

      // Delete sequential processing jobs
      await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .delete()
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId);

      // Delete processing jobs (get file IDs first)
      const { data: files } = await supabaseCodeInsights
        .from('files')
        .select('id')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId);

      if (files && files.length > 0) {
        const fileIds = files.map(f => f.id);
        await supabaseCodeInsights
          .from('processing_jobs')
          .delete()
          .in('file_id', fileIds);
      }

      // Delete files
      await supabaseCodeInsights
        .from('files')
        .delete()
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId);

      res.json({ message: 'Repository data reset successfully' });

    } catch (error) {
      console.error('Error resetting repository data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Debug method to manually advance sequential processing to next phase
   */
  static async advanceToNextPhase(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.params;
      const { targetPhase } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🔄 Manually advancing ${repositoryFullName} to phase: ${targetPhase}`);

      // Find the sequential processing job
      const { data: jobData, error: jobError } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .select('*')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId)
        .single();

      if (jobError || !jobData) {
        return res.status(404).json({ error: 'Sequential processing job not found' });
      }

      const jwtToken = req.headers.authorization?.split(' ')[1] || 'dummy-token-for-debugging';

      // Advance to the target phase
      switch (targetPhase) {
        case 'vectors':
          // Mark documentation as completed and trigger vector processing
          await SequentialProcessingController.updateJobPhase(jobData.id, 'documentation', 'completed', 100);
          await SequentialProcessingController.updateJobCurrentPhase(jobData.id, '2');
          await SequentialProcessingController.triggerVectorProcessing(repositoryFullName, jwtToken, jobData.id, userId);
          break;

        case 'lineage':
          // Mark vectors as completed and trigger lineage processing
          await SequentialProcessingController.updateJobPhase(jobData.id, 'vectors', 'completed', 100);
          await SequentialProcessingController.updateJobCurrentPhase(jobData.id, '3');
          await SequentialProcessingController.triggerLineageProcessing(repositoryFullName, jwtToken, jobData.id, userId);
          break;

        case 'dependencies':
          // Mark lineage as completed and trigger dependency processing
          await SequentialProcessingController.updateJobPhase(jobData.id, 'lineage', 'completed', 100);
          await SequentialProcessingController.updateJobCurrentPhase(jobData.id, '4');
          await SequentialProcessingController.triggerDependenciesProcessing(repositoryFullName, jwtToken, jobData.id, userId);
          break;

        case 'analysis':
          // Mark dependencies as completed and trigger analysis processing
          await SequentialProcessingController.updateJobPhase(jobData.id, 'dependencies', 'completed', 100);
          await SequentialProcessingController.updateJobCurrentPhase(jobData.id, '5');
          await SequentialProcessingController.triggerAnalysisProcessing(repositoryFullName, jwtToken, jobData.id, userId);
          break;

        default:
          return res.status(400).json({ error: 'Invalid target phase' });
      }

      res.json({
        message: `Successfully advanced to ${targetPhase} phase`,
        jobId: jobData.id,
        currentPhase: targetPhase
      });

    } catch (error) {
      console.error('Error advancing to next phase:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Debug method to sync existing processing jobs with sequential processing
   */
  static async syncExistingJobs(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🔄 Syncing existing jobs for ${repositoryFullName} with sequential processing`);

      // Check if there are existing processing jobs that aren't connected to sequential processing
      const { data: existingJobs, error: jobsError } = await supabaseCodeInsights
        .from('processing_jobs')
        .select(`
          id,
          file_id,
          status,
          vector_status,
          lineage_status,
          files!inner(repository_full_name, file_path, language, user_id)
        `)
        .eq('files.repository_full_name', repositoryFullName)
        .eq('files.user_id', userId);

      if (jobsError) {
        console.error('Error fetching existing jobs:', jobsError);
        return res.status(500).json({ error: 'Failed to fetch existing jobs' });
      }

      if (!existingJobs || existingJobs.length === 0) {
        return res.status(404).json({ error: 'No existing processing jobs found' });
      }

      console.log(`Found ${existingJobs.length} existing processing jobs`);

      // Analyze the current state
      const stats = {
        total: existingJobs.length,
        docCompleted: existingJobs.filter(j => j.status === 'completed').length,
        docFailed: existingJobs.filter(j => j.status === 'failed').length,
        docPending: existingJobs.filter(j => j.status === 'pending').length,
        vectorCompleted: existingJobs.filter(j => j.vector_status === 'completed').length,
        vectorFailed: existingJobs.filter(j => j.vector_status === 'failed').length,
        vectorPending: existingJobs.filter(j => j.vector_status === 'pending').length,
        vectorNull: existingJobs.filter(j => j.vector_status === null).length,
        lineageCompleted: existingJobs.filter(j => j.lineage_status === 'completed').length,
        lineageFailed: existingJobs.filter(j => j.lineage_status === 'failed').length,
        lineagePending: existingJobs.filter(j => j.lineage_status === 'pending').length,
        lineageNull: existingJobs.filter(j => j.lineage_status === null).length,
      };

      console.log('Job statistics:', stats);

      // Find or create sequential processing job
      let sequentialJob;
      const { data: existingSeqJob, error: seqJobError } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .select('*')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId)
        .single();

      if (seqJobError && seqJobError.code !== 'PGRST116') {
        console.error('Error fetching sequential job:', seqJobError);
        return res.status(500).json({ error: 'Failed to fetch sequential job' });
      }

      if (existingSeqJob) {
        sequentialJob = existingSeqJob;
        console.log('Using existing sequential job:', sequentialJob.id);
      } else {
        // Create new sequential processing job
        const processingJob = {
          repository_full_name: repositoryFullName,
          user_id: userId,
          job_type: 'sequential_metadata',
          status: 'processing',
          current_phase: 'documentation',
          phases: {
            documentation: { status: 'pending', progress: 0 },
            vectors: { status: 'pending', progress: 0 },
            lineage: { status: 'pending', progress: 0 },
            dependencies: { status: 'pending', progress: 0 },
            analysis: { status: 'pending', progress: 0 }
          },
          started_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: newSeqJob, error: createError } = await supabaseCodeInsights
          .from('sequential_processing_jobs')
          .insert(processingJob)
          .select()
          .single();

        if (createError) {
          console.error('Error creating sequential job:', createError);
          return res.status(500).json({ error: 'Failed to create sequential job' });
        }

        sequentialJob = newSeqJob;
        console.log('Created new sequential job:', sequentialJob.id);
      }

      // Update sequential job based on existing processing state
      let currentPhase = 'documentation';
      let phaseUpdates: any = {};

      // Check documentation phase
      if (stats.docCompleted > 0 || stats.docFailed > 0) {
        const docProgress = Math.round((stats.docCompleted / stats.total) * 100);
        phaseUpdates.documentation = {
          status: stats.docCompleted === stats.total ? 'completed' : 'processing',
          progress: docProgress
        };
        
        if (stats.docCompleted === stats.total) {
          currentPhase = 'vectors';
        }
      }

      // Check vector phase
      if (stats.vectorCompleted > 0 || stats.vectorFailed > 0) {
        const vectorProgress = Math.round((stats.vectorCompleted / stats.total) * 100);
        phaseUpdates.vectors = {
          status: stats.vectorCompleted === stats.total ? 'completed' : 'processing',
          progress: vectorProgress
        };
        
        if (stats.vectorCompleted === stats.total) {
          currentPhase = 'lineage';
        }
      }

      // Check lineage phase
      if (stats.lineageCompleted > 0 || stats.lineageFailed > 0) {
        const lineageProgress = Math.round((stats.lineageCompleted / stats.total) * 100);
        phaseUpdates.lineage = {
          status: stats.lineageCompleted === stats.total ? 'completed' : 'processing',
          progress: lineageProgress
        };
        
        if (stats.lineageCompleted === stats.total) {
          currentPhase = 'dependencies';
        }
      }

      // Update sequential job
      const updatedPhases = { ...sequentialJob.phases, ...phaseUpdates };
      
      const { error: updateError } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .update({
          current_phase: currentPhase,
          phases: updatedPhases,
          updated_at: new Date().toISOString()
        })
        .eq('id', sequentialJob.id);

      if (updateError) {
        console.error('Error updating sequential job:', updateError);
        return res.status(500).json({ error: 'Failed to update sequential job' });
      }

      // If vectors are completed but lineage_status is null, set them to pending
      if (stats.vectorCompleted > 0 && stats.lineageNull > 0) {
        const jobsToUpdate = existingJobs.filter(j => 
          j.vector_status === 'completed' && 
          j.lineage_status === null
        );
        
        if (jobsToUpdate.length > 0) {
          const jobIds = jobsToUpdate.map(j => j.id);
          console.log(`Setting lineage_status to 'pending' for ${jobIds.length} jobs`);
          
          const { error: lineageUpdateError } = await supabaseCodeInsights
            .from('processing_jobs')
            .update({ lineage_status: 'pending' })
            .in('id', jobIds);

          if (lineageUpdateError) {
            console.error('Error updating lineage status:', lineageUpdateError);
          } else {
            console.log('✅ Successfully set lineage_status to pending for completed vector jobs');
          }
        }
      }

      res.json({
        message: 'Successfully synced existing jobs with sequential processing',
        sequentialJobId: sequentialJob.id,
        currentPhase,
        stats,
        phaseUpdates
      });

    } catch (error) {
      console.error('Error syncing existing jobs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Debug method to check all processing jobs regardless of user
   */
  static async debugAllJobs(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.params;
      
      console.log(`🔍 Checking ALL processing jobs for ${repositoryFullName} (ignoring user)`);

      // Get all jobs for this repository regardless of user
      const { data: allJobs, error } = await supabaseCodeInsights
        .from('processing_jobs')
        .select(`
          id,
          file_id,
          status,
          vector_status,
          lineage_status,
          leased_at,
          created_at,
          updated_at,
          files!inner(repository_full_name, file_path, language, user_id)
        `)
        .eq('files.repository_full_name', repositoryFullName)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching all jobs:', error);
        return res.status(500).json({ error: 'Failed to fetch jobs' });
      }

      // Get unique user IDs
      const userIds = [...new Set(allJobs?.map(job => (job as any).files?.user_id).filter(Boolean))];
      
      // Categorize jobs by user
      const jobsByUser = userIds.reduce((acc: any, userId: string) => {
        const userJobs = allJobs?.filter(job => (job as any).files?.user_id === userId) || [];
        acc[userId] = {
          total: userJobs.length,
          docCompleted: userJobs.filter(j => j.status === 'completed').length,
          docFailed: userJobs.filter(j => j.status === 'failed').length,
          docPending: userJobs.filter(j => j.status === 'pending').length,
          vectorCompleted: userJobs.filter(j => j.vector_status === 'completed').length,
          vectorFailed: userJobs.filter(j => j.vector_status === 'failed').length,
          vectorPending: userJobs.filter(j => j.vector_status === 'pending').length,
          vectorNull: userJobs.filter(j => j.vector_status === null).length,
          lineageCompleted: userJobs.filter(j => j.lineage_status === 'completed').length,
          lineageFailed: userJobs.filter(j => j.lineage_status === 'failed').length,
          lineagePending: userJobs.filter(j => j.lineage_status === 'pending').length,
          lineageNull: userJobs.filter(j => j.lineage_status === null).length,
          leased: userJobs.filter(j => j.leased_at !== null).length,
          sampleJobs: userJobs.slice(0, 3).map(job => ({
            id: job.id,
            file_path: (job as any).files?.file_path,
            status: job.status,
            vector_status: job.vector_status,
            lineage_status: job.lineage_status,
            leased_at: job.leased_at,
            created_at: job.created_at
          }))
        };
        return acc;
      }, {});

      res.json({
        repository: repositoryFullName,
        totalJobs: allJobs?.length || 0,
        userIds,
        jobsByUser,
        allJobs: allJobs?.slice(0, 5).map(job => ({
          id: job.id,
          file_path: (job as any).files?.file_path,
          user_id: (job as any).files?.user_id,
          status: job.status,
          vector_status: job.vector_status,
          lineage_status: job.lineage_status,
          leased_at: job.leased_at,
          created_at: job.created_at
        }))
      });

    } catch (error) {
      console.error('Error in debug all jobs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Debug method to manually start monitoring for a specific phase
   */
  static async startMonitoring(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.params;
      const { phase } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Find the sequential processing job
      const { data: jobData, error: jobError } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .select('*')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId)
        .single();

      if (jobError || !jobData) {
        return res.status(404).json({ error: 'Sequential processing job not found' });
      }

      const jwtToken = req.headers.authorization?.split(' ')[1] || 'dummy-token-for-debugging';

      console.log(`🔄 Starting monitoring for ${phase} phase of ${repositoryFullName}`);

      // Start monitoring for the specified phase
      switch (phase) {
        case 'lineage':
          SequentialProcessingController.monitorLineageProgress(repositoryFullName, jwtToken, jobData.id, userId);
          break;

        case 'dependencies':
          SequentialProcessingController.monitorDependenciesProgress(repositoryFullName, jwtToken, jobData.id, userId);
          break;

        case 'analysis':
          SequentialProcessingController.monitorAnalysisProgress(repositoryFullName, jwtToken, jobData.id, userId);
          break;

        default:
          return res.status(400).json({ error: 'Invalid phase. Use: lineage, dependencies, or analysis' });
      }

      res.json({
        message: `Started monitoring for ${phase} phase`,
        jobId: jobData.id,
        phase
      });

    } catch (error) {
      console.error('Error starting monitoring:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Debug method to release leased jobs for a specific phase
   */
  static async releaseJobs(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.params;
      const { phase } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🔓 Releasing leased jobs for ${phase} processing in ${repositoryFullName}`);

      // Get jobs that should be released for the specified phase
      let whereConditions: any = {
        'files.repository_full_name': repositoryFullName,
        'files.user_id': userId
      };

      // Add phase-specific conditions
      switch (phase) {
        case 'lineage':
          // Release jobs that have completed vectors and pending lineage
          whereConditions.vector_status = 'completed';
          whereConditions.lineage_status = 'pending';
          break;
        case 'dependencies':
          // Release jobs that have completed lineage
          whereConditions.lineage_status = 'completed';
          break;
        case 'analysis':
          // Release jobs that have completed all previous phases
          whereConditions.lineage_status = 'completed';
          break;
        default:
          return res.status(400).json({ error: 'Invalid phase. Use: lineage, dependencies, or analysis' });
      }

      // Find jobs to release
      const { data: jobsToRelease, error: findError } = await supabaseCodeInsights
        .from('processing_jobs')
        .select(`
          id,
          file_id,
          status,
          vector_status,
          lineage_status,
          leased_at,
          created_at,
          updated_at,
          files!inner(repository_full_name, file_path, language, user_id)
        `)
        .match(whereConditions)
        .not('leased_at', 'is', null); // Only leased jobs

      if (findError) {
        console.error('Error finding jobs to release:', findError);
        return res.status(500).json({ error: 'Failed to find jobs to release' });
      }

      if (!jobsToRelease || jobsToRelease.length === 0) {
        return res.status(200).json({ 
          message: `No leased jobs found for ${phase} processing`,
          jobsReleased: 0 
        });
      }

      console.log(`Found ${jobsToRelease.length} leased jobs to release for ${phase} processing`);

      // Release the jobs by setting leased_at to null
      const jobIds = jobsToRelease.map(job => job.id);
      const { error: releaseError } = await supabaseCodeInsights
        .from('processing_jobs')
        .update({ 
          leased_at: null,
          updated_at: new Date().toISOString()
        })
        .in('id', jobIds);

      if (releaseError) {
        console.error('Error releasing jobs:', releaseError);
        return res.status(500).json({ error: 'Failed to release jobs' });
      }

      console.log(`✅ Successfully released ${jobsToRelease.length} jobs for ${phase} processing`);

      res.json({
        message: `Successfully released ${jobsToRelease.length} jobs for ${phase} processing`,
        jobsReleased: jobsToRelease.length,
        phase,
        releasedJobs: jobsToRelease.map(job => ({
          id: job.id,
          file_path: (job as any).files?.file_path,
          status: job.status,
          vector_status: job.vector_status,
          lineage_status: job.lineage_status
        }))
      });

    } catch (error) {
      console.error('Error releasing jobs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Manual fix for stuck documentation phase
   * This handles cases where documentation completed but status shows error due to 202 status code
   */
  static async fixStuckDocumentationPhase(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🔧 Attempting to fix stuck documentation phase for ${repositoryFullName}`);

      // Get the sequential job
      const { data: jobData, error: jobError } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .select('*')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (jobError || !jobData) {
        return res.status(404).json({ error: 'No sequential processing job found' });
      }

      // Check actual documentation status
      const { data: statusData, error: statusError } = await supabaseCodeInsights
        .rpc('get_repository_processing_status', {
          repo_full_name: repositoryFullName,
          user_id_param: userId
        });

      if (statusError || !statusData || statusData.length === 0) {
        return res.status(500).json({ error: 'Could not get processing status' });
      }

      const status = statusData[0];
      const totalFiles = Number(status.total_files || 0);
      const docCompleted = Number(status.documentation_completed || 0);
      const vectorCompleted = Number(status.vector_completed || 0);

      console.log(`📊 Current status: ${docCompleted}/${totalFiles} docs, ${vectorCompleted}/${totalFiles} vectors`);

      // Check if documentation is actually complete
      if (docCompleted >= totalFiles && totalFiles > 0) {
        console.log(`✅ Documentation is actually complete, fixing job status...`);
        
        // Update documentation phase to completed
        await this.updateJobPhase(jobData.id, 'documentation', 'completed', 100);
        
        // Check if vectors are also complete
        if (vectorCompleted >= totalFiles) {
          console.log(`✅ Vectors are also complete, advancing to lineage...`);
          await this.updateJobPhase(jobData.id, 'vectors', 'completed', 100);
          await this.updateJobCurrentPhase(jobData.id, 'lineage');
          
          // Trigger lineage processing
          const jwtToken = req.headers.authorization?.replace('Bearer ', '') || '';
          await SequentialProcessingController.triggerLineageProcessing(repositoryFullName, jwtToken, jobData.id, userId);
        } else {
          console.log(`🔄 Advancing to vector processing...`);
          await this.updateJobCurrentPhase(jobData.id, 'vectors');
          
          // Trigger vector processing
          const jwtToken = req.headers.authorization?.replace('Bearer ', '') || '';
          await SequentialProcessingController.triggerVectorProcessing(repositoryFullName, jwtToken, jobData.id, userId);
        }

        return res.json({
          success: true,
          message: 'Documentation phase fixed and processing advanced',
          currentPhase: vectorCompleted >= totalFiles ? 'lineage' : 'vectors',
          progress: {
            documentation: { completed: docCompleted, total: totalFiles },
            vectors: { completed: vectorCompleted, total: totalFiles }
          }
        });
      } else {
        return res.json({
          success: false,
          message: 'Documentation is not actually complete yet',
          progress: {
            documentation: { completed: docCompleted, total: totalFiles },
            vectors: { completed: vectorCompleted, total: totalFiles }
          }
        });
      }

    } catch (error: any) {
      console.error('Error fixing stuck documentation phase:', error);
      return res.status(500).json({ 
        error: 'Failed to fix stuck phase',
        details: error.message 
      });
    }
  }

  /**
   * Create sequential processing job from existing processing jobs
   * This handles cases where processing jobs exist but no sequential job was created
   */
  static async createSequentialFromExisting(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🔧 Creating sequential job from existing processing jobs for ${repositoryFullName}`);

      // Check if sequential job already exists
      const { data: existingJob, error: existingError } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .select('*')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!existingError && existingJob) {
        return res.json({
          success: false,
          message: 'Sequential processing job already exists',
          jobId: existingJob.id
        });
      }

      // Get actual processing status
      const { data: statusData, error: statusError } = await supabaseCodeInsights
        .rpc('get_repository_processing_status', {
          repo_full_name: repositoryFullName,
          user_id_param: userId
        });

      if (statusError || !statusData || statusData.length === 0) {
        return res.status(500).json({ error: 'Could not get processing status' });
      }

      const status = statusData[0];
      const totalFiles = Number(status.total_files || 0);
      const docCompleted = Number(status.documentation_completed || 0);
      const vectorCompleted = Number(status.vector_completed || 0);

      if (totalFiles === 0) {
        return res.status(400).json({ error: 'No processing jobs found' });
      }

      console.log(`📊 Found ${totalFiles} files: ${docCompleted} docs, ${vectorCompleted} vectors`);

      // Determine current phase and status
      let currentPhase = 'documentation';
      let phases = {
        documentation: { status: 'pending', progress: 0 },
        vectors: { status: 'pending', progress: 0 },
        lineage: { status: 'pending', progress: 0 },
        dependencies: { status: 'pending', progress: 0 },
        analysis: { status: 'pending', progress: 0 }
      };

      // Set documentation status
      if (docCompleted >= totalFiles) {
        phases.documentation = { status: 'completed', progress: 100 };
        currentPhase = 'vectors';
      } else {
        phases.documentation = { 
          status: 'processing', 
          progress: Math.round((docCompleted / totalFiles) * 100) 
        };
      }

      // Set vectors status
      if (vectorCompleted >= totalFiles) {
        phases.vectors = { status: 'completed', progress: 100 };
        currentPhase = 'lineage';
      } else if (docCompleted >= totalFiles) {
        phases.vectors = { status: 'processing', progress: Math.round((vectorCompleted / totalFiles) * 100) };
      }

      // Create sequential processing job
      const processingJob = {
        repository_full_name: repositoryFullName,
        user_id: userId,
        job_type: 'sequential_metadata',
        status: currentPhase === 'lineage' ? 'processing' : 'processing',
        current_phase: currentPhase,
        phases,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: jobData, error: jobError } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .insert(processingJob)
        .select()
        .single();

      if (jobError) {
        console.error('❌ Error creating sequential processing job:', jobError);
        return res.status(500).json({ error: 'Failed to create processing job', details: jobError.message });
      }

      console.log(`✅ Sequential processing job created with ID: ${jobData.id}`);

      // If documentation is complete but vectors are not, trigger vector processing
      if (docCompleted >= totalFiles && vectorCompleted < totalFiles) {
        console.log('🔄 Triggering vector processing...');
        const jwtToken = req.headers.authorization?.replace('Bearer ', '') || '';
        try {
          await SequentialProcessingController.triggerVectorProcessing(repositoryFullName, jwtToken, jobData.id, userId);
        } catch (error) {
          console.error('❌ Error triggering vector processing:', error);
        }
      }

      return res.json({
        success: true,
        message: 'Sequential processing job created from existing jobs',
        jobId: jobData.id,
        currentPhase,
        progress: {
          documentation: { completed: docCompleted, total: totalFiles },
          vectors: { completed: vectorCompleted, total: totalFiles }
        }
      });

    } catch (error: any) {
      console.error('Error creating sequential job from existing:', error);
      return res.status(500).json({ 
        error: 'Failed to create sequential job',
        details: error.message 
      });
    }
  }

  /**
   * Debug method to diagnose phase transition issues
   */
  static async diagnosePhaseTransition(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🔍 Diagnosing phase transition for ${repositoryFullName}`);

      // Get processing status
      const { data: statusData, error: statusError } = await supabaseCodeInsights
        .rpc('get_repository_processing_status', {
          repo_full_name: repositoryFullName,
          user_id_param: userId
        });

      // Get sequential job
      const { data: jobData, error: jobError } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .select('*')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get sample processing jobs
      const { data: sampleJobs, error: jobsError } = await supabaseCodeInsights
        .from('processing_jobs')
        .select(`
          id,
          file_id,
          status,
          vector_status,
          lineage_status,
          files!inner(repository_full_name, file_path, language, user_id)
        `)
        .eq('files.repository_full_name', repositoryFullName)
        .eq('files.user_id', userId)
        .limit(5);

      // Count SQL files specifically
      const sqlJobs = sampleJobs?.filter(job => {
        const filePath = (job as any).files?.file_path?.toLowerCase() || '';
        const language = (job as any).files?.language?.toLowerCase() || '';
        
        // Check if it's a SQL file by extension or language
        return filePath.endsWith('.sql') || 
               language.includes('sql') || 
               language.includes('postgres') || 
               language.includes('mysql') || 
               language.includes('snowflake') || 
               language.includes('bigquery') || 
               language.includes('redshift');
             }) || [];

      const diagnosis = {
        repository: repositoryFullName,
        hasSequentialJob: !jobError && !!jobData,
        sequentialJobId: jobData?.id,
        currentPhase: jobData?.current_phase,
        statusRpc: statusError ? null : statusData?.[0],
        totalFiles: statusData?.[0]?.total_files || 0,
        docCompleted: statusData?.[0]?.documentation_completed || 0,
        vectorCompleted: statusData?.[0]?.vector_completed || 0,
        sqlFilesFound: sqlJobs.length,
        sampleSqlFiles: sqlJobs.map(job => ({
          id: job.id,
          file_path: (job as any).files?.file_path,
          language: (job as any).files?.language,
          status: job.status,
          vector_status: job.vector_status,
          lineage_status: job.lineage_status
        })),
        readyForLineage: sampleJobs?.filter(job => 
          job.status === 'completed' && 
          job.lineage_status === null
        ).length || 0,
        errors: {
          statusError: statusError?.message,
          jobError: jobError?.message,
          jobsError: jobsError?.message
        }
      };

      console.log('📊 Phase Transition Diagnosis:', JSON.stringify(diagnosis, null, 2));

      res.json(diagnosis);

    } catch (error: any) {
      console.error('Error diagnosing phase transition:', error);
      res.status(500).json({ 
        error: 'Failed to diagnose phase transition',
        details: error.message 
      });
    }
  }

  /**
   * Debug method to manually fix and restart lineage processing
   */
  static async fixLineagePhase(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🔧 Fixing lineage phase for ${repositoryFullName}`);

      // Get the sequential job
      const { data: jobData, error: jobError } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .select('*')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (jobError || !jobData) {
        return res.status(404).json({ error: 'No sequential processing job found' });
      }

      // Reset lineage phase status
      const updatedPhases = {
        ...jobData.phases,
        lineage: {
          status: 'pending',
          progress: 0,
          error: null,
          updatedAt: new Date().toISOString()
        }
      };

      await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .update({
          phases: updatedPhases,
          current_phase: 'lineage',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobData.id);

      // Reset any lineage_status that might be stuck
      const { data: jobsToReset } = await supabaseCodeInsights
        .from('processing_jobs')
        .select(`
          id,
          files!inner(repository_full_name, user_id)
        `)
        .eq('files.repository_full_name', repositoryFullName)
        .eq('files.user_id', userId)
        .eq('lineage_status', 'processing');

      if (jobsToReset && jobsToReset.length > 0) {
        const jobIds = jobsToReset.map(job => job.id);
        await supabaseCodeInsights
          .from('processing_jobs')
          .update({
            lineage_status: null,
            leased_at: null,
            updated_at: new Date().toISOString()
          })
          .in('id', jobIds);

        console.log(`Reset ${jobIds.length} stuck lineage processing jobs`);
      }

      // Trigger lineage processing
      const jwtToken = req.headers.authorization?.replace('Bearer ', '') || '';
      await SequentialProcessingController.triggerLineageProcessing(repositoryFullName, jwtToken, jobData.id, userId);

      return res.json({
        success: true,
        message: 'Lineage phase fixed and restarted',
        jobId: jobData.id,
        currentPhase: 'lineage'
      });

    } catch (error: any) {
      console.error('Error fixing lineage phase:', error);
      return res.status(500).json({ 
        error: 'Failed to fix lineage phase',
        details: error.message 
      });
    }
  }

  /**
   * Manually complete all remaining phases for demo purposes
   */
  static async completeAllPhases(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🎯 Manually completing all phases for ${repositoryFullName}`);

      // Get the sequential job
      const { data: jobData, error: jobError } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .select('*')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (jobError || !jobData) {
        return res.status(404).json({ error: 'No sequential processing job found' });
      }

      // Update all phases to completed
      const completedPhases = {
        documentation: { 
          status: 'completed', 
          progress: 100, 
          error: null,
          updatedAt: new Date().toISOString()
        },
        vectors: { 
          status: 'completed', 
          progress: 100, 
          error: null,
          updatedAt: new Date().toISOString()
        },
        lineage: { 
          status: 'completed', 
          progress: 100, 
          error: null,
          updatedAt: new Date().toISOString()
        },
        dependencies: { 
          status: 'completed', 
          progress: 100, 
          error: null,
          updatedAt: new Date().toISOString()
        },
        analysis: { 
          status: 'completed', 
          progress: 100, 
          error: null,
          updatedAt: new Date().toISOString()
        }
      };

      // Update the job
      const { error: updateError } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .update({
          status: 'completed',
          current_phase: 'completed',
          phases: completedPhases,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', jobData.id);

      if (updateError) {
        console.error('Error updating job:', updateError);
        return res.status(500).json({ error: 'Failed to update job', details: updateError.message });
      }

      console.log(`✅ All phases marked as completed for ${repositoryFullName}`);

      return res.json({
        success: true,
        message: 'All phases completed successfully',
        jobId: jobData.id,
        status: 'completed'
      });

    } catch (error: any) {
      console.error('Error completing all phases:', error);
      return res.status(500).json({ 
        error: 'Failed to complete phases',
        details: error.message 
      });
    }
  }
}