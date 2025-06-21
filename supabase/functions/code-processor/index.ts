// supabase/functions/code-processor/index.ts

import { serve } from 'std/http/server.ts';
import { createClient } from 'supabase-js';
import { App } from 'octokit-app';
import { Octokit } from 'octokit';

// --- Interfaces (ensure these match your actual table structures) ---
interface ProcessingJob {
    job_id: string; // uuid
    file_id: string; // uuid
    prompt_template_id: string; // uuid
    status: 'pending' | 'processing' | 'completed' | 'failed';
    retry_count: number;
    // Add other relevant fields from your processing_jobs table
    // e.g., created_at, updated_at, leased_at, error_message
}

interface FileRecord {
    id: string; // uuid
    repository_full_name: string;
    file_path: string;
    language: string; // Add language field
    github_installation_id: number; // Ensure this exists and is populated
    // Add other relevant fields from your files table
    // e.g., parsing_status, last_processed_at
}

interface PromptTemplate {
    id: string; // uuid
    system_prompt: string; // Correct field name
    user_prompt: string;   // Correct field name
    llm_provider: 'openai' | 'google' | 'anthropic' | string | null;
    llm_model_name: string | null;
    llm_parameters?: Record<string, any>;
    // --- Deprecated fields for fallback support ---
    model_provider?: string;
    model_name?: string;
}

// --- GitHub App Authentication ---
async function getGitHubInstallationToken(installationId: number): Promise<string> {
    // Critical: Log all available environment variables for debugging
    console.log("Deno environment variables:", Deno.env.toObject());

    const appIdString = Deno.env.get('GITHUB_APP_ID');
    const privateKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY');

    if (!appIdString || !privateKey) {
        console.error('Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY');
        throw new Error('GitHub App ID or Private Key not configured in environment variables.');
    }
    const appId = parseInt(appIdString, 10);
    if (isNaN(appId)) {
        throw new Error('GITHUB_APP_ID is not a valid number.');
    }
    
    console.log(`Attempting to get token for installation ID: ${installationId} using App ID: ${appId}`);

    try {
        const app = new App({
            appId: appId,
            privateKey: privateKey.replace(/\\n/g, '\n'), // Ensure newlines are correct if escaped in env
        });

        const octokit = await app.getInstallationOctokit(installationId);
        // The auth method for installation token might vary slightly based on Octokit version or specific needs
        // This is a common way to get the token string.
        const authResponse = await octokit.auth({ type: "installation" }) as { token: string };
        if (!authResponse || !authResponse.token) {
            throw new Error('Failed to retrieve installation token from Octokit auth response.');
        }
        console.log(`Successfully obtained GitHub installation token for installation ID: ${installationId}`);
        return authResponse.token;
    } catch (error) {
        console.error(`Error getting GitHub installation token for installation ID ${installationId}:`, error);
        throw error; // Re-throw to be caught by the main handler
    }
}

async function fetchGitHubFileContent(
    installationToken: string,
    repoFullName: string,
    filePath: string
): Promise<string> {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
        throw new Error(`Invalid repository_full_name: ${repoFullName}`);
    }
    const octokit = new Octokit({ auth: installationToken });
    console.log(`Fetching file: ${filePath} from ${repoFullName}`);

    try {
        const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
            owner,
            repo,
            path: filePath,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28',
                'Accept': 'application/vnd.github.raw+json' // Request raw content
            }
        });
        
        // For 'application/vnd.github.raw+json', the content is directly in response.data
        if (typeof response.data === 'string') {
            console.log(`Successfully fetched content for ${filePath}`);
            return response.data;
        } else {
            // This case should ideally not be hit if the Accept header is correctly processed by GitHub
            console.error("Unexpected response data type for raw file content:", typeof response.data, response.data);
            throw new Error('Failed to fetch file content in expected string format.');
        }
    } catch (error) {
        console.error(`Error fetching GitHub file ${filePath} from ${repoFullName}. Status: ${error.status}. Message: ${error.message}`);
        // Log more details if available, e.g., error.response.data
        if (error.response && error.response.data) {
            console.error("GitHub API error response:", error.response.data);
        }
        throw new Error(`Failed to fetch file content from GitHub: ${error.message}`);
    }
}


// --- LLM API Dispatcher ---
async function callLlmApi(
    provider: string | null,
    model: string | null,
    prompt: string,
    params?: Record<string, any>
): Promise<any> {
    console.log(`Calling LLM API. Provider: ${provider}, Model: ${model}`);

    if (!provider || !model) {
        throw new Error(`LLM provider or model is null. Provider: ${provider}, Model: ${model}`);
    }

    switch (provider.toLowerCase()) {
        case 'openai':
            return await callOpenAI(model, prompt, params);
        // TODO: Add cases for 'google', 'anthropic', etc.
        // case 'anthropic':
        //     apiKey = Deno.env.get('ANTHROPIC_CLAUDE_API_KEY');
        //     if (!apiKey) throw new Error('Anthropic API key not configured.');
        //     apiUrl = 'https://api.anthropic.com/v1/messages';
        //     headers['x-api-key'] = apiKey;
        //     headers['anthropic-version'] = '2023-06-01';
        //     requestBody = {
        //         model: modelName,
        //         max_tokens: llmParams?.max_tokens || 4000, // Anthropic often needs max_tokens
        //         messages: [{ role: 'user', content: prompt }],
        //         // For JSON with Claude, you might need to instruct it in the prompt
        //         // and parse the text response, or use specific tooling if available.
        //         ...llmParams,
        //     };
        //     break;
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}

async function callOpenAI(
    model: string,
    prompt: string,
    params?: Record<string, any>
): Promise<any> {
    let apiKey: string | undefined;
    let apiUrl: string;
    let requestBody: any;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    console.log(`Calling OpenAI API. Model: ${model}`);

    apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OpenAI API key not configured.');
    apiUrl = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${apiKey}`;
    requestBody = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" },
        ...params,
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
    });

    const responseBodyText = await response.text(); // Read body once for logging/parsing

    if (!response.ok) {
        console.error(`OpenAI API Error (${response.status}):`, responseBodyText);
        throw new Error(`OpenAI API request failed: ${response.statusText}. Details: ${responseBodyText}`);
    }
    
    try {
        const jsonData = JSON.parse(responseBodyText);
        console.log(`Successfully received response from OpenAI`);
        return jsonData;
    } catch (parseError) {
        console.error(`Failed to parse JSON response from OpenAI:`, parseError, `Response text: ${responseBodyText}`);
        throw new Error(`Failed to parse JSON response from OpenAI. Raw response: ${responseBodyText}`);
    }
}


// --- Main Handler ---
serve(async (req) => {
    console.log("Code processor function invoked.");
    let jobId: string | null = null;

    // Define the Supabase client outside the try block to make it available in the catch block
    const supabaseAdmin = createClient(
        Deno.env.get('EDGE_FUNCTION_SUPABASE_URL') ?? '',
        Deno.env.get('EDGE_FUNCTION_SERVICE_ROLE_KEY') ?? '',
        {
            db: { schema: 'code_insights' },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        }
    );

    try {
        console.log("Attempting to lease a job...");
        const { data: leasedJobs, error: leaseError } = await supabaseAdmin.rpc('lease_processing_job');

        if (leaseError) {
            throw new Error(`Error leasing job: ${leaseError.message}`);
        }

        // The function returns an array, even if it's just one job
        if (!leasedJobs || leasedJobs.length === 0) {
            console.log("No pending jobs available to lease.");
            return new Response(JSON.stringify({ success: true, message: 'No pending jobs available.' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const job = leasedJobs[0] as ProcessingJob;
        jobId = job.id; // Correctly get job ID from the first element of the array

        console.log(`Leased job ID: ${job.id} for file ID: ${job.file_id}`);

        // 2. Fetch the corresponding file record to get repository and installation details
        console.log(`Fetching file record for file_id: ${job.file_id}`);
        const { data: fileRecord, error: fileError } = await supabaseAdmin
            .from('files') // Will use 'code_insights.files' due to client schema option
            .select('*')
            .eq('id', job.file_id)
            .single<FileRecord>();

        if (fileError || !fileRecord) {
            throw new Error(`Failed to fetch file record for file_id ${job.file_id}: ${fileError?.message || 'Not found'}`);
        }
        if (fileRecord.github_installation_id == null) { // Check for null or undefined
            throw new Error(`Missing github_installation_id for file_id ${job.file_id}. Cannot authenticate with GitHub.`);
        }
        console.log(`File record fetched. Installation ID: ${fileRecord.github_installation_id}`);

        // 3. Fetch GitHub File Content
        const installationToken = await getGitHubInstallationToken(fileRecord.github_installation_id);
        const fileContent = await fetchGitHubFileContent(
            installationToken,
            fileRecord.repository_full_name,
            fileRecord.file_path
        );

        // 4. Fetch Prompt Template
        console.log(`Fetching prompt template ID: ${job.prompt_template_id}`);
        const { data: promptRecord, error: promptError } = await supabaseAdmin
            .from('prompt_templates') // Will use 'code_insights.prompt_templates'
            .select('*')
            .eq('id', job.prompt_template_id)
            .single<PromptTemplate>();

        if (promptError || !promptRecord) {
            throw new Error(`Failed to fetch prompt template: ${promptError?.message || 'Not found'}`);
        }
        console.log(`Prompt template fetched: ${promptRecord.id}`);

        const promptTemplate = promptRecord as PromptTemplate;

        // 5. Construct the prompt for the LLM by replacing all placeholders
        if (!promptTemplate.user_prompt) {
            throw new Error(`Prompt template with ID ${promptTemplate.id} has no user_prompt content.`);
        }

        const finalPrompt = promptTemplate.user_prompt
            .replace('{{file_path}}', fileRecord.file_path)
            .replace('{{language}}', fileRecord.language)
            .replace('{{code_snippet}}', fileContent);

        // 6. Call the appropriate LLM API based on the prompt template
        // Fallback logic for provider and model name for schema evolution
        const llmProvider = promptTemplate.llm_provider || promptTemplate.model_provider;
        const llmModelName = promptTemplate.llm_model_name || promptTemplate.model_name;

        if (!llmProvider || !llmModelName) {
            throw new Error(`Could not determine LLM provider or model for prompt template ${promptTemplate.id}`);
        }

        console.log(`Sending request to LLM provider: ${llmProvider}`);
        const llmResponse = await callLlmApi(
            llmProvider,
            llmModelName,
            finalPrompt,
            promptTemplate.llm_parameters
        );
        console.log("LLM API call successful.");

        // 7. Store Results
        console.log(`Storing LLM summary for file_id: ${job.file_id}`);
        const { data: summaryData, error: summaryError } = await supabaseAdmin
            .from('code_summaries') // Will use 'code_insights.code_summaries'
            .upsert({
                job_id: job.id, // Add the job_id here
                file_id: job.file_id,
                summary_json: llmResponse,
                prompt_template_id: job.prompt_template_id,
                llm_provider: llmProvider,
                llm_model_name: llmModelName,
                // last_processed_at: new Date().toISOString() // Consider adding this here
            })
            .select()
            .single(); // Assuming upsert on unique constraint returns the row

        if (summaryError) {
            throw new Error(`Failed to store LLM summary: ${summaryError.message}`);
        }
        console.log('LLM summary stored:', summaryData);

        // 8. Update Job and File Status to 'completed'
        console.log(`Updating job ${job.id} and file ${job.file_id} status to completed.`);
        const { error: updateJobError } = await supabaseAdmin
            .from('processing_jobs') // Will use 'code_insights.processing_jobs'
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', job.id);

        if (updateJobError) {
            throw new Error(`Failed to update job status to completed: ${updateJobError.message}`);
        }

        const { error: updateFileError } = await supabaseAdmin
            .from('files') // Will use 'code_insights.files'
            .update({ parsing_status: 'completed', last_processed_at: new Date().toISOString() })
            .eq('id', job.file_id);

        if (updateFileError) {
            throw new Error(`Failed to update file parsing_status: ${updateFileError.message}`);
        }

        console.log(`[Info] Job ${job.id} processed successfully.`);

        return new Response(JSON.stringify({ success: true, jobId: job.id, message: 'Job processed successfully' }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error(`Error processing job ${jobId || 'unknown'}:`, error.message, error.stack);
        if (jobId) {
            try {
                console.log(`Attempting to mark job ${jobId} as failed.`);
                // If using the increment_job_retry_count function, it also resets status to pending.
                // Decide if you want to call that or just mark as failed.
                // For now, just marking as failed.
                await supabaseAdmin
                    .from('processing_jobs') // Will use 'code_insights.processing_jobs'
                    .update({
                        status: 'failed',
                        error_message: error.message.substring(0, 1000), // Truncate error message
                        updated_at: new Date().toISOString(),
                        // Consider calling: retry_count: supabaseAdmin.rpc('increment_job_retry_count', { job_id_param: jobId })
                    })
                    .eq('id', jobId);
                console.log(`Job ${jobId} marked as failed.`);
            } catch (updateError) {
                console.error(`Failed to update job status to 'failed' for job ${jobId}:`, updateError);
            }
        }
        return new Response(JSON.stringify({ success: false, error: error.message, jobId }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});