import { NextFunction, Response, Request } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import supabaseInstance, { supabaseCodeInsights } from '@/config/supabaseClient';
import * as githubService from '@/services/github.service';
import * as aiService from '@/services/ai.service';

console.log('[InsightsController] supabaseInstance imported:', typeof supabaseInstance, supabaseInstance !== null, supabaseInstance ? Object.keys(supabaseInstance) : 'null or undefined');

// Correctly type supabase to match the instance from supabaseClient.ts
const supabase: SupabaseClient<any, 'code_insights'> = supabaseCodeInsights;

// A list of file extensions to process. Add or remove as needed.
// An empty list would mean processing all files.
const ALLOWED_EXTENSIONS = [
  '.sql', '.py', '.md', 
  '.java', '.js', '.ts', '.tsx', '.jsx',
  '.yaml', '.yml', '.json',
  '.ipynb' // Jupyter Notebooks
];

// Function to determine the language from a file path
const getLanguageFromFilePath = (filePath: string): string => {
  const extension = filePath.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'sql': return 'generic_sql';
    case 'py': return 'python';
    case 'ipynb': return 'python_notebook';
    case 'md': return 'markdown';
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
    case 'java': return 'java';
    case 'yml':
    case 'yaml': return 'yaml';
    default: return extension || 'unknown';
  }
};

/**
 * @description Initiates the processing of a GitHub repository.
 * It fetches all files from the repo, filters them, and adds them to the
 * `code_insights.files` table to be picked up by processing workers.
 * @route POST /api/insights/process-repository
 */
export const processRepository = async (req: Request, res: Response, next: NextFunction) => {
  try {
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { repositoryFullName } = req.body;
    if (!repositoryFullName || !repositoryFullName.includes('/')) {
      return res.status(400).json({ message: 'A valid repositoryFullName (e.g., \"owner/repo\") is required.' });
    }

    const [owner, repo] = repositoryFullName.split('/');

    console.log(`[InsightsController] Starting to process repository: ${repositoryFullName} for user ${userId}`);

    // <<< TEST UPSERT START >>>
    try {
      console.log('[InsightsController] Attempting TEST upsert to code_insights.files');
      const testRecord = {
        user_id: userId,
        repository_full_name: repositoryFullName + '_TEST',
        file_path: '/test/file.sql',
        file_hash: 'test_hash_123',
        language: 'generic_sql',
        parsing_status: 'pending',
      };
      const { data: testData, error: testError } = await supabase
        .from('files')
        .upsert([testRecord], {
          onConflict: 'repository_full_name, file_path',
          ignoreDuplicates: false,
        })
        .select();

      if (testError) {
        console.error('[InsightsController] TEST upsert FAILED:', JSON.stringify(testError, null, 2));
        // Do not throw here, let the main logic proceed to see if it also fails
      } else {
        console.log('[InsightsController] TEST upsert SUCCEEDED:', testData);
      }
    } catch (e: any) {
      console.error('[InsightsController] EXCEPTION during TEST upsert:', e.message);
    }
    // <<< TEST UPSERT END >>>

    // 1. Get an authenticated Octokit instance for the user
    const octokit = await githubService.getOctokitForUser(userId);
    if (!octokit) {
      return res.status(404).json({ message: 'GitHub connection not found for this user.' });
    }

    // Fetch the installation ID for the user from the correct table
    const { data: installationData, error: installationError } = await supabaseInstance
      .schema('github_module')
      .from('github_app_installations')
      .select('installation_id')
      .eq('supabase_user_id', userId)
      .single();

    if (installationError || !installationData) {
      console.error(`[InsightsController] GitHub App installation not found for user ${userId}:`, installationError);
      throw new Error('Could not find GitHub App installation for your account. Please install the app on your repository.');
    }
    const githubInstallationId = installationData.installation_id;

    // 2. Recursively list all files in the repository
    const allFiles = await githubService.listAllRepoFiles(octokit, owner, repo);

    // 3. Filter for allowed file types
    const filesToProcess = allFiles.filter(file => {
      if (ALLOWED_EXTENSIONS.length === 0) return true; // Process all if allowlist is empty
      return ALLOWED_EXTENSIONS.some(ext => file.path.endsWith(ext));
    });

    if (filesToProcess.length === 0) {
      return res.status(200).json({ 
        message: 'Repository scanned. No new files matching the criteria to process.',
        totalFilesScanned: allFiles.length,
        totalFilesToProcess: 0
      });
    }

    // 4. Prepare records for Supabase upsert
    const fileRecords = filesToProcess.map(file => ({
      user_id: userId,
      repository_full_name: repositoryFullName,
      file_path: file.path,
      file_hash: file.sha, // Store the git SHA as the hash to detect changes
      language: getLanguageFromFilePath(file.path),
      parsing_status: 'pending', // Set initial status
      github_installation_id: githubInstallationId, // Add the installation ID here
    }));

    console.log(`Attempting to upsert ${fileRecords.length} files into code_insights.files for repo: ${repositoryFullName}`);
    const { data, error } = await supabase
      .from('files')
      .upsert(fileRecords, {
        onConflict: 'repository_full_name, file_path',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('Supabase DB Error during file upsert (raw error object):', error);
      console.error('Supabase DB Error during file upsert (JSON.stringify):', JSON.stringify(error, null, 2));
      let errorMessage = 'Failed to save file data.';
      if (error.message) errorMessage += ` Message: ${error.message}`;
      if (error.details) errorMessage += ` Details: ${error.details}`;
      if (error.hint) errorMessage += ` Hint: ${error.hint}`;
      if (error.code) errorMessage += ` Code: ${error.code}`;
      throw new Error(errorMessage);
    }

    console.log(`[InsightsController] Successfully upserted ${data?.length || 0} files for processing.`);

    // --- START: New logic to create processing jobs ---
    if (data && data.length > 0) {
      // 1. Prepare job records for each successfully upserted file.
      const jobRecords = data.map(file => ({
        file_id: file.id,
        status: 'pending',
        retry_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      console.log(`Attempting to create ${jobRecords.length} processing jobs.`);

      // 3. Insert the jobs.
      const { error: jobError } = await supabase
        .from('processing_jobs')
        .insert(jobRecords);

      if (jobError) {
        console.error('Supabase DB Error during job creation:', jobError);
        throw new Error(`Failed to create processing jobs: ${jobError.message}`);
      }

      console.log(`Successfully created ${jobRecords.length} processing jobs.`);
    }
    // --- END: New logic ---

    res.status(202).json({
      message: 'Repository processing initiated. Files have been queued.',
      totalFilesScanned: allFiles.length,
      filesQueued: data?.length || 0,
    });

  } catch (error: any) {
    console.error(`[InsightsController] Error in processRepository:`, error);
    next(error); // Pass to the global error handler
  }
};

export const getRepositoryProcessingStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { repositoryFullName } = req.params;
    if (!repositoryFullName) {
      return res.status(400).json({ message: 'A valid repositoryFullName is required.' });
    }

    console.log(`[InsightsController] Fetching processing status for repository: ${repositoryFullName}`);

    const { data: files, error: filesError } = await supabase
      .from('files')
      .select(`
        id,
        file_path,
        processing_jobs ( status, error_details )
      `)
      .eq('repository_full_name', repositoryFullName)
      .eq('user_id', userId);

    if (filesError) {
      console.error('Supabase DB Error during status fetch:', filesError);
      throw new Error('Failed to fetch processing status.');
    }

    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'No files found for this repository. Has it been processed?' });
    }

    let completed = 0;
    let failed = 0;
    let pending = 0;

    const detailedStatus = files.map(file => {
      const job = Array.isArray(file.processing_jobs) ? file.processing_jobs[0] : file.processing_jobs;
      const status = job?.status || 'pending';
      if (status === 'completed') completed++;
      else if (status === 'failed') failed++;
      else pending++;

      return {
        filePath: file.file_path,
        status: status,
        errorMessage: job?.error_details || null,
      };
    });

    const totalFiles = files.length;
    const progress = totalFiles > 0 ? Math.round(((completed + failed) / totalFiles) * 100) : 0;

    res.status(200).json({
      totalFiles,
      completed,
      failed,
      pending,
      progress,
      detailedStatus,
    });

  } catch (error) {
    console.error(`[InsightsController] Error in getRepositoryProcessingStatus:`, error);
    next(error);
  }
};

/**
 * @description Fetches the code summary for a specific file from code_insights.code_summaries table
 * @route GET /api/insights/file-summary/:repositoryFullName/:filePath
 */
export const getFileSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { repositoryFullName } = req.params;
    const filePath = req.params[0]; // Using wildcard parameter to capture full file path with slashes

    console.log(`[InsightsController] === FILE SUMMARY REQUEST DEBUG ===`);
    console.log(`[InsightsController] Raw request params:`, req.params);
    console.log(`[InsightsController] Repository: ${repositoryFullName}`);
    console.log(`[InsightsController] File path: ${filePath}`);
    console.log(`[InsightsController] User ID: ${userId}`);
    console.log(`[InsightsController] Request URL: ${req.originalUrl}`);

    if (!repositoryFullName || !filePath) {
      return res.status(400).json({ message: 'Repository name and file path are required.' });
    }

    // First, let's see what files exist in the database for this repository
    const { data: allRepoFiles, error: allRepoFilesError } = await supabaseCodeInsights
      .from('files')
      .select('id, file_path, language, repository_full_name')
      .eq('repository_full_name', repositoryFullName)
      .eq('user_id', userId);

    console.log(`[InsightsController] All files in repository ${repositoryFullName}:`, 
      allRepoFiles?.map(f => ({ id: f.id, path: f.file_path, lang: f.language })));

    // Check for exact match
    const exactMatches = allRepoFiles?.filter(f => f.file_path === filePath);
    console.log(`[InsightsController] Exact path matches for "${filePath}":`, exactMatches);

    // Check for similar matches (case-insensitive, etc.)
    const similarMatches = allRepoFiles?.filter(f => 
      f.file_path.toLowerCase().includes(filePath.toLowerCase()) ||
      filePath.toLowerCase().includes(f.file_path.toLowerCase())
    );
    console.log(`[InsightsController] Similar path matches:`, similarMatches);

    // First, get the file record to get the file_id
    const { data: fileRecord, error: fileError } = await supabaseCodeInsights
      .from('files')
      .select('id, file_path, language, last_processed_at')
      .eq('repository_full_name', repositoryFullName)
      .eq('file_path', filePath)
      .eq('user_id', userId)
      .single();

    console.log(`[InsightsController] Database query result:`, { fileRecord, fileError });

    if (fileError || !fileRecord) {
      console.log(`[InsightsController] File not found: ${filePath} in ${repositoryFullName}`);
      console.log(`[InsightsController] File error details:`, fileError);
      
      return res.status(404).json({ 
        message: 'File not found or not processed yet.',
        debug: {
          requestedPath: filePath,
          repository: repositoryFullName,
          availableFiles: allRepoFiles?.map(f => f.file_path).slice(0, 10)
        }
      });
    }

    // Now get the code summary for this file
    const { data: summaryRecord, error: summaryError } = await supabaseCodeInsights
      .from('code_summaries')
      .select('summary_json, created_at')
      .eq('file_id', fileRecord.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log(`[InsightsController] Summary query result:`, { summaryRecord, summaryError });

    if (summaryError || !summaryRecord) {
      console.log(`[InsightsController] No summary found for file_id: ${fileRecord.id}`);
      
      // Let's also check what summaries DO exist for this repository to help debug
      const { data: allSummaries, error: allSummariesError } = await supabaseCodeInsights
        .from('code_summaries')
        .select('file_id, created_at')
        .in('file_id', 
          await supabaseCodeInsights
            .from('files')
            .select('id')
            .eq('repository_full_name', repositoryFullName)
            .eq('user_id', userId)
            .then(result => result.data?.map(f => f.id) || [])
        )
        .limit(10);
      
      console.log(`[InsightsController] Available summaries for repository files:`, allSummaries);
      
      return res.status(404).json({ 
        message: 'Code summary not available for this file.',
        fileInfo: {
          filePath: fileRecord.file_path,
          language: fileRecord.language,
          lastProcessed: fileRecord.last_processed_at
        }
      });
    }

    // Extract the actual summary content from the OpenAI response structure
    let extractedSummary = summaryRecord.summary_json;
    
    console.log(`[InsightsController] Raw summary_json:`, summaryRecord.summary_json);
    
    // Check if this is an OpenAI API response structure
    if (summaryRecord.summary_json?.choices?.[0]?.message?.content) {
      console.log(`[InsightsController] Extracting content from OpenAI response structure`);
      const contentString = summaryRecord.summary_json.choices[0].message.content;
      
      try {
        // Try to parse the content as JSON (in case it's structured)
        extractedSummary = JSON.parse(contentString);
        console.log(`[InsightsController] Parsed content as JSON:`, extractedSummary);
      } catch {
        // If it's not JSON, use the content string directly
        extractedSummary = { summary: contentString };
        console.log(`[InsightsController] Using content as plain text`);
      }
    } else {
      console.log(`[InsightsController] Using summary_json as-is`);
    }

    return res.status(200).json({
      filePath: fileRecord.file_path,
      language: fileRecord.language,
      lastProcessed: fileRecord.last_processed_at,
      summary: extractedSummary,
      summaryCreatedAt: summaryRecord.created_at
    });

  } catch (error) {
    console.error(`[InsightsController] Error in getFileSummary:`, error);
    next(error);
  }
};

export const generateRepositorySummaries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { owner, repo } = req.params;
    const { selectedLanguage } = req.body; // Get selected language for specialized analysis
    const repositoryFullName = `${owner}/${repo}`;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    console.log(`[InsightsController] Starting AI summary generation for repository: ${repositoryFullName}`);
    if (selectedLanguage) {
      console.log(`[InsightsController] Using specialized analysis for language: ${selectedLanguage}`);
    }

    // Check if user has access to this repository and get Octokit instance
    const octokit = await githubService.getOctokitForUser(userId);
    if (!octokit) {
      return res.status(404).json({ message: 'GitHub App installation not found for user' });
    }

    // Get files that don't have summaries yet
    const { data: filesWithoutSummaries, error: filesError } = await supabaseCodeInsights
      .from('files')
      .select(`
        id,
        file_path,
        language,
        size_bytes
      `)
      .eq('repository_full_name', repositoryFullName)
      .eq('user_id', userId)
      .not('id', 'in', `(
        SELECT file_id 
        FROM code_summaries 
        WHERE file_id IS NOT NULL
      )`);

    if (filesError) {
      console.error(`[InsightsController] Error fetching files without summaries:`, filesError);
      return res.status(500).json({ message: 'Failed to fetch files for summary generation' });
    }

    if (!filesWithoutSummaries || filesWithoutSummaries.length === 0) {
      return res.status(200).json({ 
        message: 'All files already have summaries',
        processed: 0,
        skipped: 0
      });
    }

    console.log(`[InsightsController] Found ${filesWithoutSummaries.length} files without summaries`);

    // Check if AI service is ready
    if (!aiService.isAIServiceReady()) {
      return res.status(503).json({ 
        message: 'AI service not available. Please ensure OPENAI_API_KEY is configured.' 
      });
    }

    let processed = 0;
    let failed = 0;
    const batchSize = 5; // Process files in small batches to avoid rate limits

    // Process files in batches
    for (let i = 0; i < filesWithoutSummaries.length; i += batchSize) {
      const batch = filesWithoutSummaries.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (file) => {
        try {
          console.log(`[InsightsController] Generating summary for file: ${file.file_path}`);

          // Get file content from GitHub
          const fileContent = await aiService.getFileContentFromGitHub(
            octokit,
            owner,
            repo,
            file.file_path
          );

          if (!fileContent) {
            console.log(`[InsightsController] Skipping file (no content): ${file.file_path}`);
            return;
          }

          // Generate AI summary with selected language for specialized analysis
          const summary = await aiService.generateCodeSummary(
            fileContent, 
            file.file_path, 
            file.language || 'unknown',
            selectedLanguage // Pass selected language for specialized prompts
          );

          // Save summary to database
          const { error: insertError } = await supabaseCodeInsights
            .from('code_summaries')
            .insert({
              file_id: file.id,
              summary_json: summary,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (insertError) {
            console.error(`[InsightsController] Error saving summary for ${file.file_path}:`, insertError);
            failed++;
          } else {
            console.log(`[InsightsController] Successfully generated summary for: ${file.file_path}`);
            processed++;
          }

        } catch (error) {
          console.error(`[InsightsController] Error processing file ${file.file_path}:`, error);
          failed++;
        }
      }));

      // Small delay between batches to respect rate limits
      if (i + batchSize < filesWithoutSummaries.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[InsightsController] Summary generation completed. Processed: ${processed}, Failed: ${failed}`);

    res.status(200).json({
      message: `Summary generation completed`,
      processed,
      failed,
      total: filesWithoutSummaries.length
    });

  } catch (error) {
    console.error(`[InsightsController] Error in generateRepositorySummaries:`, error);
    next(error);
  }
};
