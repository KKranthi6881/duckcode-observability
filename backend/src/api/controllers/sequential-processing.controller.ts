import { Request, Response } from 'express';
import { supabaseCodeInsights } from '../../config/supabaseClient';
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
        console.error('❌ Error creating sequential processing job:', {
          error: jobError,
          processingJob,
          supabaseCodeInsightsError: jobError.message,
          details: jobError.details,
          hint: jobError.hint
        });
        return res.status(500).json({ error: 'Failed to create processing job', details: jobError.message });
      }

      // Start Phase 1: Documentation Analysis
      await SequentialProcessingController.triggerDocumentationProcessing(repositoryFullName, jwtToken, jobData.id, userId, selectedLanguage);

      res.json({
        message: 'Sequential processing started with Documentation Analysis',
        jobId: jobData.id,
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
      console.log(`📄 Phase 1: Starting Documentation Analysis for ${repositoryFullName}`);
      
      // Update job status
      await SequentialProcessingController.updateJobPhase(jobId, 'documentation', 'processing', 0);

      // Call NEW documentation-only endpoint (not the old parallel one)
      const response = await axios.post(`http://localhost:3001/api/insights/process-documentation-only`, {
        repositoryFullName,
        selectedLanguage
      }, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 202) {
        console.log(`✅ Documentation-only processing initiated for ${repositoryFullName}`);
        
        // Start monitoring documentation progress
        SequentialProcessingController.monitorDocumentationProgress(repositoryFullName, jwtToken, jobId, userId);
      } else {
        throw new Error(`Documentation processing failed with status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error in documentation processing:', error);
      await SequentialProcessingController.updateJobPhase(jobId, 'documentation', 'error', 0, error);
    }
  }

  /**
   * Monitor documentation progress by checking database directly
   */
  static async monitorDocumentationProgress(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    const checkProgress = async () => {
      try {
        // Check documentation completion status from DATABASE directly (not API)
        const { data: statusData, error } = await supabaseCodeInsights
          .rpc('get_repository_processing_status', {
            repo_full_name: repositoryFullName,
            user_id_param: userId
          });

        if (error) {
          console.error('Error checking documentation status:', error);
          setTimeout(checkProgress, 10000);
          return;
        }

        const status = statusData[0];
        const docProgress = status?.documentation_completed ? 100 : 
                           status?.documentation_pending > 0 ? 50 : 0;
        
        console.log(`📄 Documentation progress for ${repositoryFullName}: ${docProgress}%`);
        
        // Update progress
        await SequentialProcessingController.updateJobPhase(jobId, 'documentation', 'processing', docProgress);

        // Check if documentation is complete (all files processed)
        const totalFiles = status?.total_files || 0;
        const completedFiles = status?.documentation_completed || 0;
        
        if (totalFiles > 0 && completedFiles >= totalFiles) {
          console.log(`✅ Documentation Analysis completed for ${repositoryFullName} (${completedFiles}/${totalFiles} files)`);
          await SequentialProcessingController.updateJobPhase(jobId, 'documentation', 'completed', 100);
          
          // Auto-trigger Phase 2: Vector Generation
          await SequentialProcessingController.triggerVectorProcessing(repositoryFullName, jwtToken, jobId, userId);
        } else {
          // Continue monitoring
          setTimeout(checkProgress, 10000); // Check every 10 seconds
        }

      } catch (error) {
        console.error('Error monitoring documentation progress:', error);
        await SequentialProcessingController.updateJobPhase(jobId, 'documentation', 'error', 0, error);
      }
    };

    checkProgress();
  }

  /**
   * Phase 2: Vector Generation
   */
  static async triggerVectorProcessing(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    try {
      console.log(`🔍 Phase 2: Starting Vector Generation for ${repositoryFullName}`);
      
      await SequentialProcessingController.updateJobPhase(jobId, 'vectors', 'processing', 0);

      // Call NEW vectors-only endpoint
      const response = await axios.post(`http://localhost:3001/api/insights/process-vectors-only`, {
        repositoryFullName
      }, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 202) {
        console.log(`✅ Vector-only processing initiated for ${repositoryFullName}`);
        
        // Start monitoring vector progress
        SequentialProcessingController.monitorVectorProgress(repositoryFullName, jwtToken, jobId, userId);
      } else {
        throw new Error(`Vector processing failed with status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error in vector processing:', error);
      await SequentialProcessingController.updateJobPhase(jobId, 'vectors', 'error', 0, error);
    }
  }

  /**
   * Monitor vector progress by checking database directly
   */
  static async monitorVectorProgress(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    const checkProgress = async () => {
      try {
        // Check vector completion status from DATABASE directly (not API)
        const { data: statusData, error } = await supabaseCodeInsights
          .rpc('get_repository_processing_status', {
            repo_full_name: repositoryFullName,
            user_id_param: userId
          });

        if (error) {
          console.error('Error checking vector status:', error);
          setTimeout(checkProgress, 10000);
          return;
        }

        const status = statusData[0];
        const totalFiles = status?.total_files || 0;
        const completedVectors = status?.vector_completed || 0;
        const vectorProgress = totalFiles > 0 ? Math.round((completedVectors / totalFiles) * 100) : 0;
        
        console.log(`🔍 Vector progress for ${repositoryFullName}: ${vectorProgress}% (${completedVectors}/${totalFiles})`);
        
        // Update progress
        await SequentialProcessingController.updateJobPhase(jobId, 'vectors', 'processing', vectorProgress);

        // Check if vectors are complete (all files processed)
        if (totalFiles > 0 && completedVectors >= totalFiles) {
          console.log(`✅ Vector Generation completed for ${repositoryFullName} (${completedVectors}/${totalFiles} files)`);
          await SequentialProcessingController.updateJobPhase(jobId, 'vectors', 'completed', 100);
          
          // Auto-trigger Phase 3: Lineage Extraction
          await SequentialProcessingController.triggerLineageProcessing(repositoryFullName, jwtToken, jobId, userId);
        } else {
          // Continue monitoring
          setTimeout(checkProgress, 10000); // Check every 10 seconds
        }

      } catch (error) {
        console.error('Error monitoring vector progress:', error);
        await SequentialProcessingController.updateJobPhase(jobId, 'vectors', 'error', 0, error);
      }
    };

    checkProgress();
  }

  /**
   * Phase 3: Lineage Extraction
   */
  static async triggerLineageProcessing(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    try {
      console.log(`🔗 Phase 3: Starting Lineage Extraction for ${repositoryFullName}`);
      
      await SequentialProcessingController.updateJobPhase(jobId, 'lineage', 'processing', 0);

      // Call NEW lineage-only endpoint
      const response = await axios.post(`http://localhost:3001/api/insights/process-lineage-only`, {
        repositoryFullName
      }, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 202) {
        console.log(`✅ Lineage-only processing initiated for ${repositoryFullName}`);
        
        // Start monitoring lineage progress
        SequentialProcessingController.monitorLineageProgress(repositoryFullName, jwtToken, jobId, userId);
      } else {
        throw new Error(`Lineage processing failed with status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error in lineage processing:', error);
      await SequentialProcessingController.updateJobPhase(jobId, 'lineage', 'error', 0, error);
    }
  }

  /**
   * Monitor lineage progress by checking database directly
   */
  static async monitorLineageProgress(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    const checkProgress = async () => {
      try {
        // Check lineage completion status from DATABASE directly (not API)
        const { data: statusData, error } = await supabaseCodeInsights
          .rpc('get_repository_processing_status', {
            repo_full_name: repositoryFullName,
            user_id_param: userId
          });

        if (error) {
          console.error('Error checking lineage status:', error);
          setTimeout(checkProgress, 15000);
          return;
        }

        const status = statusData[0];
        const totalSqlFiles = status?.total_sql_files || 0; // SQL files eligible for lineage
        const completedLineage = status?.lineage_completed || 0;
        const lineageProgress = totalSqlFiles > 0 ? Math.round((completedLineage / totalSqlFiles) * 100) : 100; // 100% if no SQL files
        
        console.log(`🔗 Lineage progress for ${repositoryFullName}: ${lineageProgress}% (${completedLineage}/${totalSqlFiles} SQL files)`);
        
        // Update progress
        await SequentialProcessingController.updateJobPhase(jobId, 'lineage', 'processing', lineageProgress);

        // Check if lineage is complete (all SQL files processed or no SQL files)
        if (lineageProgress >= 100) {
          console.log(`✅ Lineage Extraction completed for ${repositoryFullName} (${completedLineage}/${totalSqlFiles} SQL files)`);
          await SequentialProcessingController.updateJobPhase(jobId, 'lineage', 'completed', 100);
          
          // Auto-trigger Phase 4: Dependency Resolution
          await SequentialProcessingController.triggerDependencyProcessing(repositoryFullName, jwtToken, jobId, userId);
        } else {
          // Continue monitoring
          setTimeout(checkProgress, 15000); // Check every 15 seconds (lineage takes longer)
        }

      } catch (error) {
        console.error('Error monitoring lineage progress:', error);
        await SequentialProcessingController.updateJobPhase(jobId, 'lineage', 'error', 0, error);
      }
    };

    checkProgress();
  }

  /**
   * Phase 4: Dependency Resolution
   */
  static async triggerDependencyProcessing(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    try {
      console.log(`🌐 Phase 4: Starting Dependency Resolution for ${repositoryFullName}`);
      
      await SequentialProcessingController.updateJobPhase(jobId, 'dependencies', 'processing', 0);

      // Call NEW dependencies-only endpoint
      const response = await axios.post(`http://localhost:3001/api/insights/process-dependencies-only`, {
        repositoryFullName
      }, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 202) {
        console.log(`✅ Dependencies-only processing initiated for ${repositoryFullName}`);
        
        // For now, mark as completed immediately since it's a placeholder
        await SequentialProcessingController.updateJobPhase(jobId, 'dependencies', 'completed', 100);
        
        // Auto-trigger Phase 5: Analysis Processing
        await SequentialProcessingController.triggerAnalysisProcessing(repositoryFullName, jwtToken, jobId, userId);
      } else {
        throw new Error(`Dependencies processing failed with status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error in dependencies processing:', error);
      await SequentialProcessingController.updateJobPhase(jobId, 'dependencies', 'error', 0, error);
    }
  }

  /**
   * Phase 5: Impact Analysis
   */
  static async triggerAnalysisProcessing(repositoryFullName: string, jwtToken: string, jobId: string, userId: string) {
    try {
      console.log(`📊 Phase 5: Starting Impact Analysis for ${repositoryFullName}`);
      
      await SequentialProcessingController.updateJobPhase(jobId, 'analysis', 'processing', 0);

      // Call NEW analysis-only endpoint
      const response = await axios.post(`http://localhost:3001/api/insights/process-analysis-only`, {
        repositoryFullName
      }, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 202) {
        console.log(`✅ Analysis-only processing initiated for ${repositoryFullName}`);
        
        // For now, mark as completed immediately since it's a placeholder
        await SequentialProcessingController.updateJobPhase(jobId, 'analysis', 'completed', 100);
        
        // Complete the entire sequential job
        await SequentialProcessingController.completeSequentialJob(jobId);
        console.log(`🎉 All 5 phases completed for ${repositoryFullName}!`);
      } else {
        throw new Error(`Analysis processing failed with status: ${response.status}`);
      }

    } catch (error) {
      console.error('Error in analysis processing:', error);
      await SequentialProcessingController.updateJobPhase(jobId, 'analysis', 'error', 0, error);
    }
  }

  /**
   * Get sequential processing status with file counts
   */
  static async getSequentialStatus(req: Request, res: Response) {
    try {
      const { repositoryFullName } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get the sequential job
      const { data: jobData, error } = await supabaseCodeInsights
        .from('sequential_processing_jobs')
        .select('*')
        .eq('repository_full_name', repositoryFullName)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !jobData) {
        return res.status(404).json({ message: 'No sequential processing job found' });
      }

      // Get actual file counts and processing status
      const { data: fileCounts, error: fileError } = await supabaseCodeInsights
        .rpc('get_repository_processing_status', {
          repo_full_name: repositoryFullName,
          user_id_param: userId
        });

      let actualCounts = {
        totalFiles: 0,
        docCompleted: 0,
        docFailed: 0,
        docPending: 0,
        vectorCompleted: 0,
        vectorFailed: 0,
        vectorPending: 0
      };

      if (!fileError && fileCounts && fileCounts.length > 0) {
        const counts = fileCounts[0];
        actualCounts = {
          totalFiles: Number(counts.total_files || 0),
          docCompleted: Number(counts.documentation_completed || 0),
          docFailed: Number(counts.documentation_failed || 0),
          docPending: Number(counts.documentation_pending || 0),
          vectorCompleted: Number(counts.vector_completed || 0),
          vectorFailed: Number(counts.vector_failed || 0),
          vectorPending: Number(counts.vector_pending || 0)
        };
      }

      // Enhance phases with actual file counts
      const enhancedPhases = {
        documentation: {
          ...jobData.phases.documentation,
          completed: actualCounts.docCompleted,
          failed: actualCounts.docFailed,
          pending: actualCounts.docPending,
          total: actualCounts.totalFiles
        },
        vectors: {
          ...jobData.phases.vectors,
          completed: actualCounts.vectorCompleted,
          failed: actualCounts.vectorFailed,
          pending: actualCounts.vectorPending,
          total: actualCounts.totalFiles
        },
        lineage: {
          ...jobData.phases.lineage,
          total: actualCounts.totalFiles
        },
        dependencies: {
          ...jobData.phases.dependencies,
          total: actualCounts.totalFiles
        },
        analysis: {
          ...jobData.phases.analysis,
          total: actualCounts.totalFiles
        }
      };

      res.json({
        jobId: jobData.id,
        status: jobData.status,
        currentPhase: jobData.current_phase,
        phases: enhancedPhases,
        startedAt: jobData.started_at,
        completedAt: jobData.completed_at,
        progress: SequentialProcessingController.calculateOverallProgress(jobData.phases),
        totalFiles: actualCounts.totalFiles,
        fileCounts: actualCounts
      });

    } catch (error) {
      console.error('Error getting sequential status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Helper: Update job phase status
   */
  static async updateJobPhase(jobId: string, phase: string, status: string, progress: number, error?: any) {
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

    // Update the specific phase while preserving others
    const updatedPhases = {
      ...currentJob.phases,
      [phase]: {
        status,
        progress,
        error: error ? (error instanceof Error ? error.message : error) : null,
        updatedAt: new Date().toISOString()
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
    const phaseKeys = ['documentation', 'vectors', 'lineage', 'dependencies', 'analysis'];
    const totalProgress = phaseKeys.reduce((sum, key) => {
      return sum + (phases[key]?.progress || 0);
    }, 0);
    return Math.round(totalProgress / phaseKeys.length);
  }
} 