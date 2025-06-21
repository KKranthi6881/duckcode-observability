import { NextFunction, Response, Request } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import supabaseInstance, { supabaseCodeInsights } from '@/config/supabaseClient';
import * as githubService from '@/services/github.service';

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

    // Fetch the installation ID for the user from our new table
    const { data: installationData, error: installationError } = await supabase
      .from('github_installations')
      .select('installation_id')
      .eq('user_id', userId)
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
      // 1. Find a default prompt template to use for the jobs.
      const { data: promptTemplate, error: templateError } = await supabase
        .from('prompt_templates')
        .select('id')
        .limit(1)
        .single();

      if (templateError || !promptTemplate) {
        console.error('[InsightsController] CRITICAL: Could not find a default prompt template. Job creation failed.', templateError);
        throw new Error('Database is missing a default prompt template. Cannot create processing jobs.');
      } else {
        const defaultPromptTemplateId = promptTemplate.id;

        // 2. Prepare job records for each successfully upserted file.
        const jobRecords = data.map(file => ({
          file_id: file.id,
          prompt_template_id: defaultPromptTemplateId,
          status: 'pending',
          retry_count: 0,
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
