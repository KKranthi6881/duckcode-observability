// supabase/functions/code-processor/index.ts

import { serve } from 'std/http/server.ts';
import { createClient } from 'supabase-js';
import { App } from 'octokit-app';
import { Octokit } from 'octokit';

// --- Interfaces (ensure these match your actual table structures) ---
interface ProcessingJob {
    job_id: string; // uuid - matches the database function return
    file_id: string; // uuid
    prompt_template_id?: string; // uuid - optional since not returned by lease function
    status: 'pending' | 'processing' | 'completed' | 'failed';
    vector_status: 'pending' | 'processing' | 'completed' | 'failed';
    lineage_status: 'pending' | 'processing' | 'completed' | 'failed';
    retry_count: number;
    lineage_retry_count?: number;
    created_at: string;
    updated_at: string;
    leased_at: string;
    error_details?: string;
    analysis_language: string;
    file_path: string;
    language: string;
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


// --- LLM API Dispatcher (Legacy - unused) ---
// This function is kept for potential future use but is currently unused
// The main processing uses callOpenAIWithSystemPrompt directly
async function callLlmApi(
    provider: string | null,
    model: string | null,
    systemPrompt: string,
    userPrompt: string,
    params?: Record<string, any>
): Promise<any> {
    console.log(`Calling LLM API. Provider: ${provider}, Model: ${model}`);

    if (!provider || !model) {
        throw new Error(`LLM provider or model is null. Provider: ${provider}, Model: ${model}`);
    }

    switch (provider.toLowerCase()) {
        case 'openai':
            return await callOpenAIWithSystemPrompt(systemPrompt, userPrompt);
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

// Function to fetch custom analysis settings
async function getCustomAnalysisSettings(supabaseClient: any, repoFullName: string): Promise<{ business_overview?: string; naming_standards?: string; language?: string } | null> {
    try {
        // First get the repository ID from github_repositories
        const { data: repoData, error: repoError } = await supabaseClient
            .from('github_repositories') 
            .select('id')
            .eq('full_name', repoFullName)
            .single();

        if (repoError || !repoData) {
            console.log(`Repository not found in github_repositories: ${repoFullName}`);
            return null;
        }

        // Then get the settings using repository_id
        const { data, error } = await supabaseClient
            .from('repository_analysis_settings')
            .select('business_overview, naming_standards, language')
            .eq('repository_id', repoData.id)
            .single();

        if (error && error.code !== 'PGRST116') { // Ignore 'range not found'
            console.error(`Error fetching custom settings for ${repoFullName}:`, error);
            return null;
        }
        
        console.log(`Custom settings found for ${repoFullName}:`, data);
        return data;
    } catch (error) {
        console.error(`Error in getCustomAnalysisSettings for ${repoFullName}:`, error);
        return null;
    }
}

// --- Vector Storage Functions ---
async function generateAndStoreVectors(fileId: string, summaryJson: any, fileRecord?: any): Promise<number> {
    console.log(`Starting vector generation for file ${fileId}`);
    
    // Parse the summary content from the API response
    let actualSummary = summaryJson;
    
    // Handle OpenAI API response format
    if (summaryJson.choices && Array.isArray(summaryJson.choices) && summaryJson.choices[0]?.message?.content) {
        try {
            const contentString = summaryJson.choices[0].message.content;
            actualSummary = JSON.parse(contentString);
            console.log(`Parsed summary from OpenAI API response format`);
        } catch (parseError) {
            console.error(`Failed to parse OpenAI response content:`, parseError);
            console.log(`Raw content:`, summaryJson.choices[0].message.content.substring(0, 200) + '...');
            return 0;
        }
    }
    // Handle direct summary format (if already parsed)
    else if (summaryJson.summary || summaryJson.business_logic || summaryJson.technical_details) {
        console.log(`Using direct summary format`);
        actualSummary = summaryJson;
    } else {
        console.error(`Unrecognized summary format for file ${fileId}`);
        console.log(`Summary keys:`, Object.keys(summaryJson));
        return 0;
    }
    
    const chunks = extractChunksFromSummary(actualSummary, fileRecord);
    console.log(`Extracted ${chunks.length} chunks for vectorization`);
    
    if (chunks.length === 0) {
        console.log(`Warning: No chunks extracted from summary for file ${fileId}`);
        console.log(`Actual summary structure keys:`, Object.keys(actualSummary));
        console.log(`Sample summary content:`, JSON.stringify(actualSummary, null, 2).substring(0, 300) + '...');
        return 0;
    }
    
    // Get Supabase client for vector operations with fallback
    const supabaseUrl = Deno.env.get('EDGE_FUNCTION_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || 'http://127.0.0.1:54321';
    const supabaseKey = Deno.env.get('EDGE_FUNCTION_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabaseAdmin = createClient(
        supabaseUrl,
        supabaseKey,
        {
            db: { schema: 'code_insights' },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        }
    );

    for (const chunk of chunks) {
        if (!chunk.content || chunk.content.trim().length === 0) {
            console.log(`Skipping empty chunk: ${chunk.chunk_id}`);
            continue;
        }

        try {
            // Generate embedding using OpenAI
            const embedding = await generateEmbedding(chunk.content);
            const tokenCount = estimateTokenCount(chunk.content);

            // Store in database with enhanced metadata
            const { error } = await supabaseAdmin
                .from('document_vectors')
                .upsert({
                    file_id: fileId,
                    chunk_id: chunk.chunk_id,
                    chunk_type: chunk.chunk_type,
                    content: chunk.content,
                    metadata: chunk.metadata,
                    embedding: JSON.stringify(embedding),
                    token_count: tokenCount,
                    
                    // Enhanced metadata fields
                    section_type: chunk.metadata.section_type || chunk.chunk_type,
                    search_priority: chunk.metadata.search_priority || 'medium',
                    llm_context: chunk.metadata.llm_context || 'general_context',
                    estimated_line_start: chunk.metadata.estimated_line_range?.start || null,
                    estimated_line_end: chunk.metadata.estimated_line_range?.end || null,
                    complexity_score: chunk.metadata.complexity_indicators?.score || 0,
                    repository_name: chunk.metadata.repository_name || '',
                    language: chunk.metadata.language || ''
                }, {
                    onConflict: 'file_id,chunk_id'
                });

            if (error) {
                console.error(`Error storing vector for chunk ${chunk.chunk_id}:`, error);
                throw error;
            }

            console.log(`Stored vector for chunk: ${chunk.chunk_id}`);
        } catch (error) {
            console.error(`Failed to process chunk ${chunk.chunk_id}:`, error);
            throw error;
        }
    }
    
    return chunks.length;
}

async function generateEmbedding(text: string): Promise<number[]> {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'text-embedding-ada-002',
            input: text,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI embedding API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.data || data.data.length === 0) {
        throw new Error('No embedding data received from OpenAI');
    }

    return data.data[0].embedding;
}

function extractChunksFromSummary(summaryJson: any, fileRecord?: any): Array<{
    chunk_id: string;
    chunk_type: string;
    content: string;
    metadata: any;
}> {
    const chunks = [];

    try {
        // Base metadata that applies to all chunks from this file
        const baseMetadata = {
            file_path: fileRecord?.file_path || '',
            repository_name: fileRecord?.repository_full_name || '',
            language: fileRecord?.language || '',
            file_id: fileRecord?.id || '',
            processing_timestamp: new Date().toISOString()
        };

        // Extract summary with enhanced metadata
        if (summaryJson.summary) {
            chunks.push({
                chunk_id: 'summary',
                chunk_type: 'summary',
                content: typeof summaryJson.summary === 'string' 
                    ? summaryJson.summary 
                    : JSON.stringify(summaryJson.summary),
                metadata: { 
                    ...baseMetadata,
                    section_name: 'File Summary',
                    section_type: 'overview',
                    search_priority: 'high',
                    llm_context: 'file_overview'
                }
            });
        }

        // Extract business logic with enhanced dependency tracking
        if (summaryJson.business_logic) {
            const businessLogicContent = extractBusinessLogicContent(summaryJson.business_logic);
            if (businessLogicContent) {
                chunks.push({
                    chunk_id: 'business_logic',
                    chunk_type: 'business_logic',
                    content: businessLogicContent,
                    metadata: { 
                        ...baseMetadata,
                        section_name: 'Business Logic',
                        section_type: 'business_rules',
                        search_priority: 'high',
                        llm_context: 'business_intelligence',
                        extracted_entities: extractBusinessEntities(summaryJson.business_logic),
                        business_impact: summaryJson.business_logic.stakeholder_impact || '',
                        main_objectives: summaryJson.business_logic.main_objectives || []
                    }
                });
            }
        }

        // Extract code blocks with detailed location and dependency tracking
        if (summaryJson.code_blocks && Array.isArray(summaryJson.code_blocks)) {
            summaryJson.code_blocks.forEach((block: any, index: number) => {
                if (block.code || block.explanation || block.business_context) {
                    const content = [
                        block.code && `Code:\n${block.code}`,
                        block.explanation && `Explanation:\n${block.explanation}`,
                        block.business_context && `Business Context:\n${block.business_context}`
                    ].filter(Boolean).join('\n\n');

                    // Enhanced code block metadata with dependency tracking
                    const codeMetadata = {
                        ...baseMetadata,
                        section_name: block.section || `Code Block ${index + 1}`,
                        section_type: 'code_implementation',
                        search_priority: 'very_high',
                        llm_context: 'code_analysis',
                        block_index: index,
                        
                        // Code structure analysis
                        function_names: extractFunctionNames(Array.isArray(block.code) ? block.code.join('\n') : block.code),
                        table_names: extractTableNames(Array.isArray(block.code) ? block.code.join('\n') : block.code),
                        column_names: extractColumnNames(Array.isArray(block.code) ? block.code.join('\n') : block.code),
                        
                        // Dependency tracking
                        dependencies: {
                            tables: extractTableDependencies(Array.isArray(block.code) ? block.code.join('\n') : block.code),
                            functions: extractFunctionDependencies(Array.isArray(block.code) ? block.code.join('\n') : block.code), 
                            imports: extractImportDependencies(Array.isArray(block.code) ? block.code.join('\n') : block.code),
                            variables: extractVariableDependencies(Array.isArray(block.code) ? block.code.join('\n') : block.code)
                        },
                        
                        // Code characteristics for LLM understanding
                        code_patterns: extractCodePatterns(Array.isArray(block.code) ? block.code.join('\n') : block.code),
                        complexity_indicators: analyzeCodeComplexity(Array.isArray(block.code) ? block.code.join('\n') : block.code),
                        
                        // Line tracking (estimated from code blocks)
                        estimated_line_range: estimateLineRange(Array.isArray(block.code) ? block.code.join('\n') : block.code, index),
                        
                        // Context for LLM
                        code_purpose: block.explanation || '',
                        business_value: block.business_context || '',
                        technical_notes: block.complexity_breakdown || {}
                    };

                    chunks.push({
                        chunk_id: `code_block_${index}`,
                        chunk_type: 'code_block',
                        content,
                        metadata: codeMetadata
                    });
                }
            });
        }

        // Extract technical details with system architecture insights
        if (summaryJson.technical_details) {
            chunks.push({
                chunk_id: 'technical_details',
                chunk_type: 'technical_details',
                content: typeof summaryJson.technical_details === 'string'
                    ? summaryJson.technical_details
                    : JSON.stringify(summaryJson.technical_details),
                metadata: {
                    ...baseMetadata,
                    section_name: 'Technical Details',
                    section_type: 'architecture',
                    search_priority: 'high',
                    llm_context: 'technical_architecture',
                    technical_entities: extractTechnicalEntities(summaryJson.technical_details),
                    system_components: extractSystemComponents(summaryJson.technical_details),
                    data_flow: extractDataFlow(summaryJson.technical_details)
                }
            });
        }

        // Extract other sections with enhanced categorization
        const otherSections = ['execution_flow', 'performance_considerations', 'best_practices', 'dependencies'];
        otherSections.forEach(section => {
            if (summaryJson[section]) {
                const content = Array.isArray(summaryJson[section])
                    ? summaryJson[section].join('\n')
                    : typeof summaryJson[section] === 'string'
                    ? summaryJson[section]
                    : JSON.stringify(summaryJson[section]);

                const sectionMetadata = {
                    ...baseMetadata,
                    section_name: formatSectionName(section),
                    section_type: getSectionType(section),
                    search_priority: getSectionPriority(section),
                    llm_context: getLLMContext(section),
                    original_section: section
                };

                // Add section-specific metadata
                if (section === 'dependencies') {
                    sectionMetadata.dependency_analysis = analyzeDependencies(summaryJson[section]);
                } else if (section === 'performance_considerations') {
                    sectionMetadata.performance_metrics = extractPerformanceMetrics(summaryJson[section]);
                }

                chunks.push({
                    chunk_id: section,
                    chunk_type: 'technical_details',
                    content,
                    metadata: sectionMetadata
                });
            }
        });

    } catch (error) {
        console.error('Error extracting chunks from summary:', error);
    }

    return chunks;
}

// Helper functions for vector processing
function extractBusinessLogicContent(businessLogic: any): string {
    if (typeof businessLogic === 'string') {
        return businessLogic;
    }

    const parts = [];
    if (businessLogic.main_objectives) {
        parts.push(`Main Objectives:\n${Array.isArray(businessLogic.main_objectives) 
            ? businessLogic.main_objectives.join('\n') 
            : businessLogic.main_objectives}`);
    }
    if (businessLogic.data_transformation) {
        parts.push(`Data Transformation:\n${businessLogic.data_transformation}`);
    }
    if (businessLogic.stakeholder_impact) {
        parts.push(`Stakeholder Impact:\n${businessLogic.stakeholder_impact}`);
    }

    return parts.join('\n\n');
}

function extractBusinessEntities(businessLogic: any): string[] {
    const entities = [];
    try {
        const content = JSON.stringify(businessLogic).toLowerCase();
        const businessTerms = content.match(/\b(revenue|profit|customer|user|business|metric|kpi|target|goal)\b/g);
        if (businessTerms) {
            entities.push(...businessTerms);
        }
    } catch (error) {
        console.error('Error extracting business entities:', error);
    }
    return [...new Set(entities)];
}

function extractTechnicalEntities(technicalDetails: any): any {
    const entities: any = {};
    try {
        if (typeof technicalDetails === 'object') {
            entities.source_tables = technicalDetails.source_tables || [];
            entities.materialization = technicalDetails.materialization;
            entities.sql_operations = technicalDetails.sql_operations || [];
        }
    } catch (error) {
        console.error('Error extracting technical entities:', error);
    }
    return entities;
}

function extractFunctionNames(code: string): string[] {
    if (!code) return [];
    
    const functionPatterns = [
        /def\s+(\w+)\s*\(/g, // Python functions
        /function\s+(\w+)\s*\(/g, // JavaScript functions
        /(\w+)\s*\(/g // General function calls
    ];

    const functions = new Set<string>();
    functionPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            functions.add(match[1]);
        }
    });

    return Array.from(functions);
}

function extractTableNames(code: string): string[] {
    if (!code) return [];
    
    const tablePatterns = [
        /FROM\s+([`"']?)(\w+)\1/gi, // SQL FROM clauses
        /JOIN\s+([`"']?)(\w+)\1/gi, // SQL JOIN clauses
        /UPDATE\s+([`"']?)(\w+)\1/gi, // SQL UPDATE
        /INSERT\s+INTO\s+([`"']?)(\w+)\1/gi // SQL INSERT
    ];

    const tables = new Set<string>();
    tablePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            tables.add(match[2]);
        }
    });

    return Array.from(tables);
}

function formatSectionName(section: string): string {
    return section
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
}

// --- OpenAI API with System Prompt ---
async function callOpenAIWithSystemPrompt(systemPrompt: string, userMessage: string): Promise<any> {
    let apiKey: string | undefined;
    let apiUrl: string;
    let requestBody: any;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    console.log(`Calling OpenAI API with system prompt`);

    apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OpenAI API key not configured.');
    apiUrl = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${apiKey}`;
    requestBody = {
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
        ],
        response_format: { type: "json_object" },
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
        
        // Extract the actual content from the OpenAI response structure
        if (jsonData.choices && jsonData.choices[0] && jsonData.choices[0].message) {
            const content = jsonData.choices[0].message.content;
            console.log(`Extracted content length: ${content?.length || 0} characters`);
            
            // If the response format is JSON, parse the content as JSON
            if (requestBody.response_format?.type === "json_object") {
                try {
                    return JSON.parse(content);
                } catch (contentParseError) {
                    console.error('Failed to parse JSON content from OpenAI response:', contentParseError);
                    console.error('Content:', content);
                    throw new Error(`Invalid JSON in OpenAI response content: ${contentParseError.message}`);
                }
            }
            
            return content;
        } else {
            console.error('Unexpected OpenAI response structure:', jsonData);
            throw new Error('Unexpected response structure from OpenAI API');
        }
    } catch (parseError) {
        console.error(`Failed to parse JSON response from OpenAI:`, parseError, `Response text: ${responseBodyText}`);
        throw new Error(`Failed to parse JSON response from OpenAI. Raw response: ${responseBodyText}`);
    }
}

// Enhanced specialized prompts with detailed code_blocks analysis for complex code structures
const specializedPrompts: Record<string, string> = {
    postgres: `You are a senior database engineer specializing in PostgreSQL and data architecture.
  
  Analyze the provided PostgreSQL code and provide a comprehensive summary in JSON format with the following structure:
  
  {
    "summary": {
      "title": "Brief descriptive title of what this code does",
      "purpose": "High-level business purpose and objective",
      "complexity": "Simple|Moderate|Complex|Advanced",
      "code_type": "query|procedure|function|trigger|view|table_creation"
    },
    "business_logic": {
      "main_objectives": ["List of primary business goals"],
      "data_transformation": "Description of how data is transformed or retrieved",
      "business_rules": ["Key business rules implemented"],
      "stakeholder_impact": "Who uses this code and how",
      "kpis_metrics": ["Key performance indicators or metrics involved"]
    },
    "technical_details": {
      "postgres_features": ["PostgreSQL-specific features used"],
      "query_type": "SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP and complexity",
      "tables_involved": ["Database tables accessed or modified"],
      "joins_operations": ["Types of joins and complex operations"],
      "indexes_constraints": ["Indexes, constraints, or performance considerations"],
      "storage_engines": ["PostgreSQL storage considerations"]
    },
    "code_blocks": [
      {
        "section": "Section name (e.g., 'Main Query', 'Complex JOIN Logic', 'Subquery Analysis', 'Window Functions', 'CASE Statements', 'CTE Logic', 'Aggregation Logic')",
        "code": "Actual code snippet", 
        "explanation": "Comprehensive technical explanation including: 1) What this code block accomplishes, 2) How it processes the data step-by-step, 3) Complex logic or algorithms used, 4) Performance implications and optimization opportunities",
        "business_context": "Why this operation matters for business operations, decision-making, reporting, or data insights",
        "complexity_breakdown": {
          "joins_analysis": "For complex joins: explain join types (INNER, LEFT, RIGHT, FULL OUTER), join conditions, table relationships, potential cartesian products, join order optimization, and performance impact on large datasets. Include details about which tables are driving vs driven, cardinality estimates, and join selectivity",
          "case_statements": "For CASE/WHEN statements: break down each condition branch, explain the conditional logic flow, default/ELSE values, nested CASE scenarios, and business rules implemented. Include data type handling and NULL value considerations",
          "subqueries": "For subqueries: explain correlated vs non-correlated subqueries, execution order, EXISTS/NOT EXISTS logic, IN/NOT IN operations, and how they relate to the main query performance. Include subquery materialization strategies",
          "window_functions": "For window functions (ROW_NUMBER, RANK, LAG, LEAD, SUM OVER, etc.): explain partitioning logic, ordering specifications, frame specifications (ROWS/RANGE BETWEEN), and analytical calculations performed. Include performance considerations for large partitions",
          "cte_analysis": "For Common Table Expressions: explain recursive vs non-recursive CTEs, dependency chain, reusability, and how they improve query readability. Include materialization vs inline execution",
          "aggregations": "For GROUP BY/aggregations: explain grouping logic, aggregate functions (SUM, COUNT, AVG, MAX, MIN, STRING_AGG), HAVING conditions, ROLLUP/CUBE operations, and data summarization approach. Include partial aggregation strategies",
          "data_filtering": "For complex WHERE clauses: break down each filter condition, explain AND/OR logic combinations, NULL handling, date range filtering, pattern matching (LIKE, REGEX), and data selection criteria. Include index usage analysis",
          "data_transformations": "For data manipulation: explain column calculations, data type conversions (CAST/CONVERT), string operations (SUBSTRING, CONCAT, REGEXP_REPLACE), date/time functions (DATE_TRUNC, EXTRACT), mathematical operations, and JSON/JSONB processing",
          "postgresql_specific": "PostgreSQL-specific features: JSONB operations, array functions, full-text search (tsvector, tsquery), custom data types, extensions used (like PostGIS, pg_stat_statements), lateral joins, and advanced indexing (GIN, GiST, BRIN)",
          "performance_notes": "Explain indexes utilized, query hints, expected execution plan, query cost estimation, parallel execution possibilities, work_mem requirements, and scalability considerations for large datasets. Include EXPLAIN ANALYZE insights"
        },
        "column_details": [
          {
            "column_name": "Name of column being processed, created, or transformed",
            "data_type": "PostgreSQL data type, constraints, and nullability",
            "source": "Source table, calculation, or transformation origin",
            "transformation": "Detailed explanation of how this column is calculated, aggregated, or transformed",
            "business_meaning": "What this column represents in business terms and how it's used by stakeholders",
            "sample_values": "Example values or value ranges to illustrate the data",
            "performance_impact": "How this column affects query performance (indexing, sorting, filtering)"
          }
        ],
        "execution_order": "Detailed step-by-step execution order within this code block, especially for complex multi-step operations, subquery execution, join processing order, and materialization points"
      }
    ],
    "execution_flow": ["Step-by-step breakdown of complete query execution from data retrieval to final result set"],
    "performance_considerations": {
      "optimization_opportunities": ["Potential performance improvements"],
      "resource_usage": ["Expected CPU, memory, I/O impact"],
      "scalability_notes": ["How this performs with large datasets"]
    },
    "dependencies": ["External tables, functions, or systems this code depends on"],
    "best_practices": {
      "followed": ["PostgreSQL best practices observed"],
      "improvements": ["Suggested improvements for maintainability"]
    }
  }
  
  Focus on PostgreSQL best practices, performance optimization, and business impact. Pay special attention to complex queries with multiple joins, large CASE statements, window functions, and CTEs.`,

    dbt: `You are a senior analytics engineer specializing in dbt and modern data stack architecture.
  
  Analyze the provided dbt model and provide a comprehensive summary in JSON format with the following structure:
  
  {
    "summary": {
      "title": "Brief descriptive title of what this model does",
      "purpose": "High-level business purpose and objective",
      "complexity": "Simple|Moderate|Complex|Advanced",
      "model_type": "staging|intermediate|mart|snapshot|seed"
    },
    "business_logic": {
      "main_objectives": ["List of primary business goals"],
      "data_transformation": "Description of how raw data is transformed",
      "business_rules": ["Key business rules implemented"],
      "stakeholder_impact": "Who uses this model and how",
      "kpis_metrics": ["Key performance indicators or metrics calculated"]
    },
    "technical_details": {
      "dbt_features": ["dbt-specific features used (macros, tests, documentation, etc.)"],
      "materialization": "table|view|incremental|ephemeral and reasoning",
      "source_tables": ["Upstream data sources and their roles"],
      "sql_operations": ["Main SQL transformations performed"],
      "jinja_logic": ["Jinja templating and macros used"],
      "incremental_strategy": "If incremental, what strategy is used"
    },
    "code_blocks": [
      {
        "section": "Section name (e.g., 'Source Selection', 'Business Logic', 'Final Transformation', 'Complex Joins', 'Window Functions', 'Macro Usage', 'Data Quality Checks')",
        "code": "Actual code snippet",
        "explanation": "Comprehensive technical explanation including: 1) What this transformation accomplishes, 2) How it processes the data step-by-step, 3) Complex SQL logic or dbt features used, 4) Performance and materialization implications",
        "business_context": "Why this transformation matters for business analytics, reporting, or decision-making",
        "complexity_breakdown": {
          "sql_analysis": "For complex SQL: explain joins, subqueries, window functions, CTEs, aggregations, and advanced SQL patterns used",
          "dbt_features": "For dbt-specific features: explain macros, tests, documentation, snapshots, seeds, and dbt project structure integration",
          "jinja_logic": "For Jinja templating: explain variables, loops, conditionals, macro calls, and dynamic SQL generation",
          "data_modeling": "For data modeling: explain dimensional modeling concepts, fact/dimension tables, slowly changing dimensions, and data warehouse patterns",
          "incremental_strategy": "For incremental models: explain merge strategies, unique keys, partition strategies, and data freshness handling",
          "testing_strategy": "For data quality: explain dbt tests (unique, not_null, accepted_values, relationships), custom tests, and data validation approaches",
          "performance_optimization": "For performance: explain materialization choices, partitioning, indexing considerations, and query optimization techniques",
          "data_lineage": "For data lineage: explain upstream dependencies, downstream impacts, and data flow through the pipeline"
        },
        "column_details": [
          {
            "column_name": "Name of column being created or transformed",
            "data_type": "Expected data type and constraints",
            "source": "Source table/column or calculation origin",
            "transformation": "Detailed explanation of how this column is calculated or derived",
            "business_meaning": "What this column represents in business terms and how it's used",
            "data_quality_rules": "Tests, validations, or quality checks applied to this column"
          }
        ],
        "execution_order": "Detailed step-by-step execution order within this dbt model, including dependency resolution and materialization sequence"
      }
    ],
    "dbt_project_context": {
      "dependencies": ["Other dbt models this depends on"],
      "downstream_models": ["Models that depend on this one"],
      "data_lineage": "Position in the overall data pipeline",
      "project_structure": "How this fits into dbt project organization"
    },
    "data_quality": {
      "tests_applied": ["dbt tests configured for this model"],
      "data_validation": ["Business logic validation rules"],
      "freshness_requirements": ["Data freshness expectations"]
    },
    "performance_considerations": {
      "query_optimization": ["SQL performance optimizations"],
      "materialization_rationale": "Why this materialization strategy was chosen",
      "resource_usage": ["Compute and storage considerations"]
    },
    "documentation": {
      "model_description": "Documented purpose and usage",
      "column_descriptions": ["Key column definitions and business meaning"],
      "usage_examples": ["How downstream users should consume this model"]
    },
    "execution_flow": ["Step-by-step breakdown of data transformation"],
    "best_practices": {
      "followed": ["dbt best practices observed"],
      "improvements": ["Suggested improvements for maintainability"],
      "naming_conventions": ["Adherence to naming standards"]
    },
    "maintenance_notes": ["Important considerations for future development"]
  }
  
  Focus on dbt best practices, data modeling principles, and how this model fits into the broader analytics engineering workflow.`,

    mysql: `You are a senior database engineer specializing in MySQL and data architecture.
  
  Analyze the provided MySQL code and provide a comprehensive summary in JSON format with the following structure:
  
  {
    "summary": {
      "title": "Brief descriptive title of what this code does",
      "purpose": "High-level business purpose and objective", 
      "complexity": "Simple|Moderate|Complex|Advanced",
      "code_type": "query|procedure|function|trigger|view|table_creation"
    },
    "business_logic": {
      "main_objectives": ["List of primary business goals"],
      "data_transformation": "Description of how data is transformed or retrieved",
      "business_rules": ["Key business rules implemented"],
      "stakeholder_impact": "Who uses this code and how",
      "kpis_metrics": ["Key performance indicators or metrics involved"]
    },
    "technical_details": {
      "mysql_features": ["MySQL-specific features used"],
      "query_type": "SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP and complexity",
      "tables_involved": ["Database tables accessed or modified"],
      "joins_operations": ["Types of joins and complex operations"],
      "indexes_constraints": ["Indexes, constraints, or performance considerations"],
      "storage_engines": ["InnoDB, MyISAM, or other storage engine specifics"]
    },
    "code_blocks": [
      {
        "section": "Section name (e.g., 'Main Query', 'Complex JOIN Logic', 'Subquery Analysis', 'CASE Statements', 'Stored Procedure Logic', 'Trigger Logic')",
        "code": "Actual code snippet", 
        "explanation": "Comprehensive technical explanation including: 1) What this code block accomplishes, 2) How it processes the data step-by-step, 3) Complex logic or algorithms used, 4) Performance implications and MySQL-specific optimizations",
        "business_context": "Why this operation matters for business operations, decision-making, reporting, or data insights",
        "complexity_breakdown": {
          "joins_analysis": "For complex joins: explain join types (INNER, LEFT, RIGHT, CROSS), join conditions, table relationships, potential cartesian products, join order optimization, and performance impact on large datasets. Include MySQL join buffer usage and nested loop vs hash join considerations",
          "case_statements": "For CASE/WHEN statements: break down each condition branch, explain the conditional logic flow, default/ELSE values, nested CASE scenarios, and business rules implemented. Include MySQL-specific data type handling",
          "subqueries": "For subqueries: explain correlated vs non-correlated subqueries, execution order, EXISTS/NOT EXISTS logic, IN/NOT IN operations, and how they relate to the main query performance. Include MySQL subquery optimization strategies",
          "stored_procedures": "For stored procedures: explain parameter handling, local variables, control flow statements (IF, LOOP, WHILE), cursor usage, exception handling, and transaction management",
          "aggregations": "For GROUP BY/aggregations: explain grouping logic, aggregate functions (SUM, COUNT, AVG, MAX, MIN, GROUP_CONCAT), HAVING conditions, WITH ROLLUP operations, and data summarization approach. Include loose index scan optimizations",
          "data_filtering": "For complex WHERE clauses: break down each filter condition, explain AND/OR logic combinations, NULL handling, date range filtering, pattern matching (LIKE, REGEXP), and data selection criteria. Include index usage with EXPLAIN",
          "data_transformations": "For data manipulation: explain column calculations, data type conversions (CAST/CONVERT), string functions (SUBSTRING, CONCAT, REPLACE), date/time functions (DATE_FORMAT, TIMESTAMPDIFF), mathematical operations, and JSON processing",
          "mysql_specific": "MySQL-specific features: JSON functions, full-text search (MATCH AGAINST), partitioning, generated columns, common table expressions (MySQL 8.0+), window functions, and storage engine optimizations",
          "performance_notes": "Explain indexes utilized, execution plan analysis, query hints (NOLOCK, FORCESEEK, etc.), parameter sniffing considerations, and scalability considerations for large datasets. Include SET STATISTICS IO/TIME insights"
        },
        "column_details": [
          {
            "column_name": "Name of column being processed, created, or transformed",
            "data_type": "MySQL data type, constraints, and nullability",
            "source": "Source table, calculation, or transformation origin",
            "transformation": "Detailed explanation of how this column is calculated, aggregated, or transformed",
            "business_meaning": "What this column represents in business terms and how it's used by stakeholders",
            "sample_values": "Example values or value ranges to illustrate the data",
            "performance_impact": "How this column affects query performance (indexing, sorting, filtering, storage engine considerations)"
          }
        ],
        "execution_order": "Detailed step-by-step execution order within this code block, especially for complex multi-step operations, subquery execution, join processing order, and temporary table usage"
      }
    ],
    "execution_flow": ["Step-by-step breakdown of complete query execution from data retrieval to final result set"],
    "performance_considerations": {
      "optimization_opportunities": ["Potential performance improvements"],
      "resource_usage": ["Expected CPU, memory, I/O impact"],
      "scalability_notes": ["How this performs with large datasets"]
    },
    "dependencies": ["External tables, functions, or systems this code depends on"],
    "best_practices": {
      "followed": ["MySQL best practices observed"],
      "improvements": ["Suggested improvements for maintainability"]
    }
  }
  
  Focus on MySQL best practices, performance optimization, and business impact. Pay special attention to complex queries with multiple joins, large CASE statements, stored procedures, and MySQL-specific features.`,

    tsql: `You are a Microsoft SQL Server expert with extensive experience in T-SQL development, performance tuning, and enterprise database solutions.
  
  Analyze the provided T-SQL script and provide a comprehensive summary in JSON format with the following structure:
  
  {
    "summary": {
      "title": "Brief descriptive title of what this script does",
      "purpose": "High-level business purpose and objective",
      "complexity": "Simple|Moderate|Complex|Advanced"
    },
    "business_logic": {
      "main_objectives": ["List of primary business goals"],
      "data_processing": "Description of how data is processed or manipulated",
      "business_rules": ["Key business rules implemented"],
      "stakeholder_impact": "Who benefits from this code"
    },
    "technical_details": {
      "tsql_features": ["T-SQL specific features used (CTEs, window functions, cursors, etc.)"],
      "sql_server_features": ["SQL Server specific functionality"],
      "tables_involved": ["Database tables accessed or modified"],
      "procedures_functions": ["Stored procedures or functions referenced"],
      "performance_optimization": ["Indexing, query hints, execution plan considerations"]
    },
    "code_blocks": [
      {
        "section": "Section name (e.g., 'Main Query', 'Complex JOIN Logic', 'CTE Analysis', 'Window Functions', 'CASE Statements', 'Stored Procedure Logic', 'Cursor Operations')",
        "code": "Actual code snippet",
        "explanation": "Comprehensive technical explanation including: 1) What this code block accomplishes, 2) How it processes the data step-by-step, 3) Complex T-SQL logic or algorithms used, 4) Performance implications and SQL Server-specific optimizations",
        "business_context": "Why this code matters for business operations, decision-making, reporting, or data insights",
        "complexity_breakdown": {
          "joins_analysis": "For complex joins: explain join types (INNER, LEFT, RIGHT, FULL OUTER, CROSS APPLY, OUTER APPLY), join conditions, table relationships, potential cartesian products, join order optimization, and performance impact on large datasets. Include SQL Server join algorithms (nested loops, merge, hash)",
          "case_statements": "For CASE/WHEN statements: break down each condition branch, explain the conditional logic flow, default/ELSE values, nested CASE scenarios, and business rules implemented. Include T-SQL specific data type handling and implicit conversions",
          "cte_analysis": "For Common Table Expressions: explain recursive vs non-recursive CTEs, dependency chain, anchor and recursive members, termination conditions, and how they improve query readability vs performance",
          "window_functions": "For window functions (ROW_NUMBER, RANK, DENSE_RANK, NTILE, LAG, LEAD, SUM OVER, etc.): explain partitioning logic, ordering specifications, frame specifications (ROWS/RANGE), and analytical calculations performed",
          "stored_procedures": "For stored procedures: explain parameter handling (@variables), local variables, control flow statements (IF/ELSE, WHILE, TRY/CATCH), dynamic SQL, transaction management (BEGIN TRAN, COMMIT, ROLLBACK), and error handling",
          "cursor_operations": "For cursors: explain cursor types (FORWARD_ONLY, STATIC, DYNAMIC, KEYSET), fetch operations, performance implications, and alternatives like set-based operations",
          "aggregations": "For GROUP BY/aggregations: explain grouping logic, aggregate functions (SUM, COUNT, AVG, MAX, MIN, STRING_AGG), HAVING conditions, ROLLUP/CUBE/GROUPING SETS operations, and data summarization approach",
          "data_filtering": "For complex WHERE clauses: break down each filter condition, explain AND/OR logic combinations, NULL handling, date range filtering, pattern matching (LIKE, PATINDEX), and data selection criteria. Include index seek vs scan analysis",
          "data_transformations": "For data manipulation: explain column calculations, data type conversions (CAST/CONVERT/TRY_CONVERT), string functions (SUBSTRING, CONCAT, REPLACE, STRING_SPLIT), date/time functions (DATEPART, DATEDIFF, FORMAT), mathematical operations, and JSON processing (FOR JSON, OPENJSON)",
          "tsql_specific": "T-SQL specific features: table-valued functions, MERGE statements, OUTPUT clauses, PIVOT/UNPIVOT operations, temporal tables, columnstore indexes, and memory-optimized tables",
          "performance_notes": "Explain indexes utilized, execution plan analysis, query hints (NOLOCK, FORCESEEK, etc.), parameter sniffing considerations, and scalability considerations for large datasets. Include SET STATISTICS IO/TIME insights"
        },
        "column_details": [
          {
            "column_name": "Name of column being processed, created, or transformed",
            "data_type": "SQL Server data type, constraints, and nullability",
            "source": "Source table, calculation, or transformation origin",
            "transformation": "Detailed explanation of how this column is calculated, aggregated, or transformed",
            "business_meaning": "What this column represents in business terms and how it's used by stakeholders",
            "sample_values": "Example values or value ranges to illustrate the data",
            "performance_impact": "How this column affects query performance (indexing, sorting, filtering, columnstore considerations)"
          }
        ],
        "execution_order": "Detailed step-by-step execution order within this code block, especially for complex multi-step operations, CTE execution, join processing order, and tempdb usage"
      }
    ],
    "error_handling": {
      "try_catch_blocks": ["Error handling mechanisms implemented"],
      "error_logging": ["How errors are logged and reported"],
      "rollback_strategies": ["Data integrity protection measures"]
    },
    "dependencies": {
      "database_objects": ["Tables, views, functions, procedures referenced"],
      "external_systems": ["Any external data sources or systems"],
      "prerequisites": ["What needs to exist before running this script"]
    },
    "execution_flow": ["Step-by-step breakdown of execution order"],
    "best_practices": {
      "followed": ["T-SQL best practices observed"],
      "improvements": ["Suggested improvements for performance/maintainability"],
      "sql_server_optimizations": ["SQL Server specific optimization recommendations"]
    },
    "maintenance_notes": ["Important considerations for future maintenance"]
  }
  
  Focus on T-SQL best practices, SQL Server optimization, and enterprise-grade database development patterns.`,

    plsql: `You are an Oracle Database developer with deep expertise in PL/SQL programming, performance tuning, and enterprise Oracle solutions.
  
  Analyze the provided PL/SQL code and provide a comprehensive summary in JSON format with the following structure:
  
  {
    "summary": {
      "title": "Brief descriptive title of what this code does",
      "purpose": "High-level business purpose and objective",
      "complexity": "Simple|Moderate|Complex|Advanced"
    },
    "business_logic": {
      "main_objectives": ["List of primary business goals"],
      "data_processing": "Description of how data is processed or manipulated",
      "business_rules": ["Key business rules implemented"],
      "stakeholder_impact": "Who benefits from this code"
    },
    "technical_details": {
      "plsql_features": ["PL/SQL specific features used (cursors, collections, exceptions, etc.)"],
      "oracle_features": ["Oracle-specific functionality leveraged"],
      "database_objects": ["Tables, views, packages, procedures involved"],
      "performance_features": ["Bulk operations, parallel processing, optimization techniques"],
      "transaction_control": ["Transaction management and concurrency handling"]
    },
    "code_blocks": [
      {
        "section": "Section name",
        "code": "Actual code snippet",
        "explanation": "Detailed explanation of what this code does",
        "business_context": "Why this functionality matters for business"
      }
    ],
    "exception_handling": {
      "predefined_exceptions": ["Built-in exceptions handled"],
      "user_defined_exceptions": ["Custom exceptions defined and used"],
      "error_propagation": ["How errors are handled and propagated"]
    },
    "dependencies": {
      "database_objects": ["Objects this code depends on"],
      "packages_procedures": ["Other PL/SQL units referenced"],
      "system_privileges": ["Required Oracle privileges or roles"]
    },
    "execution_flow": ["Step-by-step breakdown of execution logic"],
    "oracle_best_practices": {
      "followed": ["Oracle and PL/SQL best practices observed"],
      "improvements": ["Suggested improvements for performance/maintainability"],
      "optimization_opportunities": ["Oracle-specific optimization recommendations"]
    },
    "maintenance_notes": ["Important considerations for future maintenance"]
  }
  
  Focus on Oracle best practices, PL/SQL optimization, and enterprise database development patterns.`,

    pyspark: `You are a big data engineer specializing in Apache Spark, PySpark, and distributed data processing at scale.
  
  Analyze the provided PySpark code and provide a comprehensive summary in JSON format with the following structure:
  
  {
    "summary": {
      "title": "Brief descriptive title of what this PySpark job does",
      "purpose": "High-level business purpose and objective",
      "complexity": "Simple|Moderate|Complex|Advanced"
    },
    "business_logic": {
      "main_objectives": ["List of primary business goals"],
      "data_pipeline_role": "Role in the overall data pipeline",
      "business_rules": ["Key business rules implemented"],
      "stakeholder_impact": "Who benefits from this data processing"
    },
    "technical_details": {
      "spark_features": ["Spark/PySpark features used (DataFrames, RDDs, SQL, MLlib, etc.)"],
      "data_sources": ["Input data sources and formats"],
      "data_sinks": ["Output destinations and formats"],
      "transformations": ["Key data transformations applied"],
      "performance_optimizations": ["Caching, partitioning, broadcast variables used"]
    },
    "code_blocks": [
      {
        "section": "Section name",
        "code": "Actual code snippet",
        "explanation": "Detailed explanation of what this code does",
        "business_context": "Why this transformation matters for business"
      }
    ],
    "data_processing": {
      "input_schema": ["Expected input data structure"],
      "output_schema": ["Resulting data structure"],
      "data_quality": ["Data validation and cleaning operations"],
      "aggregations": ["Grouping, aggregation, and analytical operations"]
    },
    "spark_optimization": {
      "partitioning_strategy": ["How data is partitioned for performance"],
      "caching_strategy": ["DataFrames cached for reuse"],
      "resource_usage": ["Expected cluster resource requirements"],
      "scalability_considerations": ["How this scales with data volume"]
    },
    "dependencies": {
      "external_systems": ["Databases, file systems, APIs accessed"],
      "spark_libraries": ["Additional Spark libraries used"],
      "configuration": ["Important Spark configuration requirements"]
    },
    "execution_flow": ["Step-by-step breakdown of data processing pipeline"],
    "best_practices": {
      "followed": ["Spark and big data best practices observed"],
      "improvements": ["Suggested improvements for performance/reliability"],
      "optimization_opportunities": ["Specific Spark optimization recommendations"]
    },
    "monitoring_considerations": ["Key metrics and monitoring points for production"],
    "maintenance_notes": ["Important considerations for future maintenance"]
  }
  
  Focus on Spark best practices, distributed computing efficiency, and scalable data processing patterns.`,

    python: `You are a senior Python developer with expertise in software engineering best practices, Python ecosystems, and application architecture.
  
  Analyze the provided Python code and provide a comprehensive summary in JSON format with the following structure:
  
  {
    "summary": {
      "title": "Brief descriptive title of what this Python code does",
      "purpose": "High-level business purpose and objective",
      "complexity": "Simple|Moderate|Complex|Advanced"
    },
    "business_logic": {
      "main_objectives": ["List of primary business goals"],
      "problem_solved": "What business problem this code addresses",
      "business_rules": ["Key business rules implemented"],
      "stakeholder_impact": "Who benefits from this functionality"
    },
    "technical_details": {
      "python_features": ["Python-specific features and idioms used"],
      "libraries_frameworks": ["External packages and frameworks utilized"],
      "design_patterns": ["Software design patterns implemented"],
      "data_structures": ["Key data structures and algorithms"],
      "async_concurrency": ["Asynchronous or concurrent programming approaches"]
    },
    "code_blocks": [
      {
        "section": "Section name (e.g., 'Data Processing Pipeline', 'Class Definition', 'Complex Algorithm', 'API Integration', 'Database Operations', 'Error Handling Block')",
        "code": "Actual code snippet",
        "explanation": "Comprehensive technical explanation including: 1) What this code block accomplishes, 2) How it processes the data/logic step-by-step, 3) Complex algorithms or design patterns used, 4) Performance implications and optimization opportunities",
        "business_context": "Why this functionality matters for business operations, decision-making, or user experience",
        "complexity_breakdown": {
          "algorithm_analysis": "For complex algorithms: explain time/space complexity, algorithm choice rationale, edge cases handled, and optimization techniques used",
          "data_processing": "For data processing: explain data flow, transformation steps, validation logic, error handling, and performance considerations for large datasets",
          "class_design": "For classes: explain inheritance hierarchy, composition relationships, method responsibilities, encapsulation principles, and SOLID principles adherence",
          "function_analysis": "For functions: explain parameters, return values, side effects, pure vs impure functions, and functional programming concepts",
          "control_flow": "For complex control structures: explain conditional logic, loop structures, exception handling flow, and early returns/breaks",
          "async_operations": "For async code: explain coroutines, event loops, concurrency patterns, await/async usage, and performance benefits",
          "data_structures": "For data structures: explain choice rationale (list vs tuple vs set vs dict), memory efficiency, access patterns, and algorithmic complexity",
          "library_integration": "For external libraries: explain library choice, configuration, error handling, version compatibility, and integration patterns",
          "database_operations": "For database code: explain ORM usage, query optimization, connection management, transaction handling, and data validation",
          "api_interactions": "For API code: explain request/response handling, authentication, rate limiting, error handling, and data serialization",
          "performance_notes": "Explain bottlenecks, profiling considerations, memory usage patterns, and scalability implications"
        },
        "column_details": [
          {
            "variable_name": "Name of key variable, parameter, or data field",
            "data_type": "Python type hints or inferred type",
            "source": "Where this data comes from (user input, database, API, etc.)",
            "transformation": "How this data is processed, validated, or transformed",
            "business_meaning": "What this data represents in business terms",
            "validation_rules": "Data validation, constraints, or business rules applied"
          }
        ],
        "execution_order": "Detailed step-by-step execution order within this code block, especially for complex multi-step operations, async operations, and error handling paths"
      }
    ],
    "architecture": {
      "code_organization": ["How the code is structured and organized"],
      "interfaces_apis": ["Public interfaces, APIs, or entry points"],
      "error_handling": ["Exception handling and error management"],
      "testing_approach": ["Testing strategy and test coverage"]
    },
    "dependencies": {
      "external_packages": ["Third-party libraries and their purposes"],
      "system_requirements": ["System or environment dependencies"],
      "configuration": ["Configuration files or environment variables needed"]
    },
    "performance_considerations": {
      "optimization_techniques": ["Performance optimization approaches used"],
      "memory_usage": ["Memory management and efficiency considerations"],
      "scalability": ["How the code scales with input size"]
    },
    "code_quality": {
      "pep8_compliance": ["Adherence to PEP 8 style guidelines"],
      "documentation": ["Docstrings and code documentation quality"],
      "type_hints": ["Use of type annotations"],
      "maintainability": ["Code maintainability assessment"]
    },
    "execution_flow": ["Step-by-step breakdown of execution logic"],
    "best_practices": {
      "followed": ["Python best practices observed"],
      "improvements": ["Suggested improvements for code quality"],
      "pythonic_patterns": ["Pythonic idioms and patterns used"]
    },
    "security_considerations": ["Security implications and recommendations"],
    "deployment_notes": ["Deployment, packaging, and distribution considerations"],
    "maintenance_notes": ["Important considerations for future maintenance"]
  }
  
  Focus on Python best practices, software engineering principles, and clean code architecture. Pay special attention to complex data processing pipelines, class hierarchies, async operations, and algorithm implementations.`,

    default: `You are a senior software engineer with expertise across multiple programming languages and technologies.
  
  Analyze the provided code and provide a comprehensive summary in JSON format with the following structure:
  
  {
    "summary": {
      "title": "Brief descriptive title of what this code does",
      "purpose": "High-level business purpose and objective",
      "complexity": "Simple|Moderate|Complex|Advanced",
      "code_type": "function|class|module|script|configuration"
    },
    "business_logic": {
      "main_objectives": ["List of primary business goals"],
      "data_transformation": "Description of how data or state is transformed",
      "business_rules": ["Key business rules implemented"],
      "stakeholder_impact": "Who uses this code and how",
      "kpis_metrics": ["Key performance indicators or metrics involved"]
    },
    "technical_details": {
      "language_features": ["Language-specific features used"],
      "design_patterns": ["Design patterns and architectural approaches"],
      "data_structures": ["Key data structures and algorithms"],
      "external_dependencies": ["Libraries, APIs, or services used"],
      "error_handling": ["Error handling and validation approaches"]
    },
    "code_blocks": [
      {
        "section": "Section name (e.g., 'Input Validation', 'Core Logic', 'Output Processing', 'Complex Algorithms', 'Data Transformations', 'Control Flow Logic')",
        "code": "Actual code snippet",
        "explanation": "Comprehensive technical explanation including: 1) What this code block accomplishes, 2) How it processes the data/logic step-by-step, 3) Complex algorithms, patterns, or logic used, 4) Performance implications and optimization opportunities", 
        "business_context": "Why this functionality matters for business operations, decision-making, or user experience",
        "complexity_breakdown": {
          "algorithm_analysis": "For complex algorithms: explain algorithmic approach, time/space complexity, edge cases handled, and optimization techniques used",
          "data_processing": "For data processing: explain data flow, transformation steps, validation logic, error handling, and performance considerations",
          "control_structures": "For complex control flow: explain conditional logic, loop structures, recursion, exception handling, and branching logic",
          "data_structures": "For data structures: explain choice rationale, memory efficiency, access patterns, and performance characteristics",
          "function_design": "For functions/methods: explain parameters, return values, side effects, reusability, and design principles",
          "integration_patterns": "For external integrations: explain API calls, database operations, file I/O, network operations, and error handling",
          "concurrency_patterns": "For concurrent/parallel code: explain threading, async operations, synchronization, and performance benefits",
          "design_patterns": "For design patterns: explain pattern implementation, benefits, trade-offs, and architectural decisions",
          "language_specific": "For language-specific features: explain unique language constructs, idioms, optimization techniques, and best practices",
          "performance_notes": "Explain bottlenecks, optimization opportunities, memory usage patterns, and scalability considerations"
        },
        "variable_details": [
          {
            "variable_name": "Name of key variable, parameter, or data field",
            "data_type": "Variable type and constraints",
            "source": "Where this data comes from (input, calculation, external source, etc.)",
            "transformation": "How this data is processed, validated, or transformed",
            "business_meaning": "What this data represents in business terms",
            "scope_lifetime": "Variable scope, lifetime, and memory considerations"
          }
        ],
        "execution_order": "Detailed step-by-step execution order within this code block, especially for complex multi-step operations, recursive calls, and error handling paths"
      }
    ],
    "execution_flow": ["Step-by-step breakdown of code execution"],
    "performance_considerations": {
      "optimization_opportunities": ["Potential performance improvements"],
      "resource_usage": ["Expected CPU, memory, network impact"],
      "scalability_notes": ["How this performs under load"]
    },
    "dependencies": ["External systems, databases, or services this code depends on"],
    "best_practices": {
      "followed": ["Programming best practices observed"],
      "improvements": ["Suggested improvements for maintainability"]
    }
  }
  
  Focus on code quality, maintainability, and business impact.`,

};

// Enhanced unified language mapping and prompt selection system
function mapLanguageToSpecializedPrompt(detectedLanguage: string, filePath: string, customLanguage?: string): string {
    // Use custom language if provided (user selection), otherwise detected language
    const targetLanguage = customLanguage || detectedLanguage;
    const lowerLang = targetLanguage.toLowerCase();
    const lowerPath = filePath.toLowerCase();
    
    console.log(`Language mapping: detected="${detectedLanguage}", custom="${customLanguage}", target="${targetLanguage}", file="${filePath}"`);
    
    // Direct specialized language matches (user selections)
    if (lowerLang === 'postgres' || lowerLang === 'postgresql') return 'postgres';
    if (lowerLang === 'dbt') return 'dbt';
    if (lowerLang === 'mysql') return 'mysql';
    if (lowerLang === 'tsql' || lowerLang === 't-sql' || lowerLang === 'sqlserver') return 'tsql';
    if (lowerLang === 'plsql' || lowerLang === 'pl/sql' || lowerLang === 'oracle') return 'plsql';
    if (lowerLang === 'sparksql' || lowerLang === 'spark-sql' || lowerLang === 'spark_sql') return 'sparksql';
    if (lowerLang === 'pyspark' || lowerLang === 'spark-python') return 'pyspark';
    if (lowerLang === 'python' || lowerLang === 'py') return 'python';
    
    // SQL dialect detection based on file path and content patterns
    if (lowerLang.includes('sql') || lowerPath.endsWith('.sql')) {
        // SparkSQL detection patterns
        if (lowerPath.includes('spark') || lowerPath.includes('databricks') || 
            lowerPath.includes('delta') || lowerPath.includes('lakehouse')) {
            return 'sparksql';
        }
        
        // Enhanced dbt detection patterns
        if (lowerPath.includes('dbt') || lowerPath.includes('models/') || 
            lowerPath.includes('staging/') || lowerPath.includes('marts/') ||
            lowerPath.includes('intermediate/') || lowerPath.includes('macros/') ||
            lowerPath.includes('snapshots/') || lowerPath.includes('analyses/') ||
            lowerPath.includes('seeds/') || lowerPath.includes('/dbt_') ||
            lowerPath.includes('_housekeeping') || lowerPath.includes('dbt_project.yml')) {
            return 'dbt';
        }
        
        // Database-specific path patterns
        if (lowerPath.includes('postgres') || lowerPath.includes('postgresql')) return 'postgres';
        if (lowerPath.includes('mysql')) return 'mysql';
        if (lowerPath.includes('oracle') || lowerPath.includes('plsql')) return 'plsql';
        if (lowerPath.includes('sqlserver') || lowerPath.includes('tsql')) return 'tsql';
        if (lowerPath.includes('snowflake')) return 'postgres'; // Use postgres for snowflake (similar syntax)
        if (lowerPath.includes('bigquery')) return 'postgres'; // Use postgres for bigquery
        if (lowerPath.includes('redshift')) return 'postgres'; // Use postgres for redshift
        
        // Default SQL fallback - use postgres as it's most comprehensive
        return 'postgres';
    }
    
    // Python variants
    if (lowerLang.includes('python') || lowerPath.endsWith('.py')) {
        if (lowerPath.includes('pyspark') || lowerPath.includes('spark')) return 'pyspark';
        return 'python';
    }
    
    // Other language patterns based on file extension and path
    if (lowerPath.endsWith('.r') || lowerLang === 'r') return 'default'; // No specialized R prompt yet
    if (lowerPath.endsWith('.scala') || lowerLang.includes('scala')) return 'default'; // No specialized Scala prompt yet
    if (lowerPath.endsWith('.yml') || lowerPath.endsWith('.yaml')) {
        if (lowerPath.includes('dbt') || lowerPath.includes('models/')) return 'dbt';
        return 'default';
    }
    
    // Fallback to default for unrecognized languages
    console.log(`Using default prompt for language: ${targetLanguage}`);
    return 'default';
}

function mapLanguageToLineagePrompt(detectedLanguage: string, filePath: string): string {
    const lowerLang = detectedLanguage.toLowerCase();
    const lowerPath = filePath.toLowerCase();
    
    // SparkSQL specific detection
    if (lowerLang.includes('sparksql') || lowerLang.includes('spark-sql') || lowerLang.includes('spark_sql') ||
        (lowerLang.includes('sql') && (lowerPath.includes('spark') || lowerPath.includes('databricks') || 
         lowerPath.includes('delta') || lowerPath.includes('lakehouse')))) {
        return 'sparksql';
    }
    
    // SQL variants (including all SQL dialects)
    if (lowerLang.includes('sql') || lowerPath.endsWith('.sql') ||
        lowerLang.includes('postgres') || lowerLang.includes('mysql') || 
        lowerLang.includes('oracle') || lowerLang.includes('tsql') ||
        lowerLang.includes('snowflake') || lowerLang.includes('bigquery') ||
        lowerLang.includes('redshift') || lowerLang === 'dbt') {
        return 'sql';
    }
    
    // Python variants
    if (lowerLang.includes('python') || lowerLang.includes('pyspark') || 
        lowerPath.endsWith('.py') || lowerLang === 'py') {
        return 'python';
    }
    
    // Scala/Spark
    if (lowerLang.includes('scala') || lowerPath.endsWith('.scala')) {
        return 'scala';
    }
    
    // R
    if (lowerLang === 'r' || lowerPath.endsWith('.r')) {
        return 'r';
    }
    
    // Default to generic for unrecognized languages
    return 'generic';
}

function getSystemPrompt(selectedLanguage: string, customSettings: { business_overview?: string; naming_standards?: string; language?: string } | null, filePath?: string): string {
    // Map the language to the appropriate specialized prompt
    const promptKey = mapLanguageToSpecializedPrompt(selectedLanguage, filePath || '', customSettings?.language);
    
    // Use specialized prompt for the mapped language, fallback to default
    let basePrompt = specializedPrompts[promptKey] || specializedPrompts.default;
    
    console.log(`Selected prompt: ${promptKey} for language: ${selectedLanguage} (custom: ${customSettings?.language})`);

    if (customSettings && (customSettings.business_overview || customSettings.naming_standards)) {
        let customInstructions = "--- CUSTOM INSTRUCTIONS ---\n";
        customInstructions += "The user has provided specific context for this project. Adhere to these instructions closely.\n\n";

        if (customSettings.business_overview) {
            customInstructions += "## Business Overview & Context\n";
            customInstructions += `${customSettings.business_overview}\n\n`;
        }

        if (customSettings.naming_standards) {
            customInstructions += "## Naming Standards & Conventions\n";
            customInstructions += `${customSettings.naming_standards}\n\n`;
        }
        
        customInstructions += "--- END CUSTOM INSTRUCTIONS ---\n\n";
        
        basePrompt = customInstructions + basePrompt;
    }

    return basePrompt;
}

// Enhanced helper functions for code intelligence and dependency tracking

function extractColumnNames(code: string): string[] {
    if (!code) return [];
    
    const columnPatterns = [
        /SELECT\s+(.+?)\s+FROM/gis, // SQL SELECT columns
        /INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/gis, // SQL INSERT columns  
        /UPDATE\s+\w+\s+SET\s+(.+?)\s+WHERE/gis, // SQL UPDATE columns
        /\b(\w+)\s*=\s*[\w\d'"]/g // Assignment patterns
    ];

    const columns = new Set<string>();
    columnPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            if (match[1]) {
                // Split by comma and clean column names
                const columnList = match[1].split(',').map(col => 
                    col.trim().replace(/[`"'\[\]]/g, '').split(/\s+/)[0]
                ).filter(col => col && !col.match(/^(AS|as|AS|FROM|from|WHERE|where)$/));
                
                columnList.forEach(col => {
                    if (col.length > 0 && col.length < 50) { // Reasonable column name length
                        columns.add(col);
                    }
                });
            }
        }
    });

    return Array.from(columns);
}

function extractTableDependencies(code: string): Array<{table: string, operation: string, relationship: string}> {
    if (!code) return [];
    
    const dependencies = [];
    const tablePatterns = [
        { pattern: /FROM\s+([`"']?)(\w+)\1/gi, operation: 'read', relationship: 'source' },
        { pattern: /JOIN\s+([`"']?)(\w+)\1/gi, operation: 'read', relationship: 'join' },
        { pattern: /UPDATE\s+([`"']?)(\w+)\1/gi, operation: 'write', relationship: 'target' },
        { pattern: /INSERT\s+INTO\s+([`"']?)(\w+)\1/gi, operation: 'write', relationship: 'target' },
        { pattern: /DELETE\s+FROM\s+([`"']?)(\w+)\1/gi, operation: 'write', relationship: 'target' }
    ];

    tablePatterns.forEach(({ pattern, operation, relationship }) => {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            dependencies.push({
                table: match[2],
                operation,
                relationship
            });
        }
    });

    return dependencies;
}

function extractFunctionDependencies(code: string): Array<{function: string, type: string, context: string}> {
    if (!code) return [];
    
    const dependencies = [];
    const functionPatterns = [
        { pattern: /def\s+(\w+)\s*\(/g, type: 'definition', context: 'python' },
        { pattern: /function\s+(\w+)\s*\(/g, type: 'definition', context: 'javascript' },
        { pattern: /(\w+)\s*\(/g, type: 'call', context: 'general' },
        { pattern: /CALL\s+(\w+)\s*\(/gi, type: 'procedure_call', context: 'sql' },
        { pattern: /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+(\w+)/gi, type: 'sql_function', context: 'sql' }
    ];

    functionPatterns.forEach(({ pattern, type, context }) => {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            const functionName = match[1] || match[2];
            if (functionName && functionName.length < 50) {
                dependencies.push({
                    function: functionName,
                    type,
                    context
                });
            }
        }
    });

    return dependencies;
}

function extractImportDependencies(code: string): Array<{module: string, type: string, alias?: string}> {
    if (!code) return [];
    
    const dependencies = [];
    const importPatterns = [
        { pattern: /import\s+(\w+)/g, type: 'python_import' },
        { pattern: /from\s+(\w+)\s+import/g, type: 'python_from' },
        { pattern: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, type: 'node_require' },
        { pattern: /import\s+.*\s+from\s+['"]([^'"]+)['"]/g, type: 'es6_import' },
        { pattern: /#include\s*[<"]([^>"]+)[>"]/g, type: 'c_include' }
    ];

    importPatterns.forEach(({ pattern, type }) => {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            dependencies.push({
                module: match[1],
                type
            });
        }
    });

    return dependencies;
}

function extractVariableDependencies(code: string): Array<{variable: string, type: string, scope: string}> {
    if (!code) return [];
    
    const dependencies = [];
    const variablePatterns = [
        { pattern: /DECLARE\s+@(\w+)/gi, type: 'sql_variable', scope: 'local' },
        { pattern: /SET\s+@(\w+)/gi, type: 'sql_assignment', scope: 'local' },
        { pattern: /var\s+(\w+)/g, type: 'javascript_var', scope: 'function' },
        { pattern: /let\s+(\w+)/g, type: 'javascript_let', scope: 'block' },
        { pattern: /const\s+(\w+)/g, type: 'javascript_const', scope: 'block' },
        { pattern: /(\w+)\s*=/g, type: 'assignment', scope: 'unknown' }
    ];

    variablePatterns.forEach(({ pattern, type, scope }) => {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            const variable = match[1];
            if (variable && variable.length < 50) {
                dependencies.push({
                    variable,
                    type,
                    scope
                });
            }
        }
    });

    return dependencies;
}

function extractCodePatterns(code: string): string[] {
    if (!code) return [];
    
    const patterns = [];
    
    // SQL patterns
    if (/SELECT.*FROM.*WHERE/i.test(code)) patterns.push('sql_select_query');
    if (/WITH\s+\w+\s+AS/i.test(code)) patterns.push('sql_cte');
    if (/CASE\s+WHEN/i.test(code)) patterns.push('sql_case_statement');
    if (/ROW_NUMBER\(\)|RANK\(\)/i.test(code)) patterns.push('sql_window_function');
    if (/GROUP\s+BY/i.test(code)) patterns.push('sql_aggregation');
    if (/UNION|INTERSECT|EXCEPT/i.test(code)) patterns.push('sql_set_operation');
    
    // Programming patterns
    if (/for\s*\(|for\s+\w+\s+in/i.test(code)) patterns.push('loop');
    if (/if\s*\(|if\s+\w+/i.test(code)) patterns.push('conditional');
    if (/try\s*{|try:/i.test(code)) patterns.push('error_handling');
    if (/async\s+|await\s+/i.test(code)) patterns.push('async_operation');
    if (/class\s+\w+/i.test(code)) patterns.push('class_definition');
    
    return patterns;
}

function analyzeCodeComplexity(code: string): {score: number, factors: string[]} {
    if (!code) return { score: 0, factors: [] };
    
    let score = 0;
    const factors = [];
    
    // Count complexity factors
    const nestedQueries = (code.match(/SELECT.*\(.*SELECT/gi) || []).length;
    const joins = (code.match(/JOIN/gi) || []).length;
    const caseStatements = (code.match(/CASE\s+WHEN/gi) || []).length;
    const subqueries = (code.match(/\(.*SELECT/gi) || []).length;
    const ctes = (code.match(/WITH\s+\w+\s+AS/gi) || []).length;
    
    score += nestedQueries * 3;
    score += joins * 1;
    score += caseStatements * 2;
    score += subqueries * 2;
    score += ctes * 1;
    
    if (nestedQueries > 0) factors.push('nested_queries');
    if (joins > 3) factors.push('multiple_joins');
    if (caseStatements > 2) factors.push('complex_logic');
    if (subqueries > 2) factors.push('multiple_subqueries');
    if (ctes > 0) factors.push('cte_usage');
    
    return { score, factors };
}

function estimateLineRange(code: string, blockIndex: number): {start: number, end: number, confidence: string} {
    if (!code) return { start: 0, end: 0, confidence: 'none' };
    
    const lineCount = code.split('\n').length;
    
    // Rough estimation based on block index and content
    const estimatedStart = (blockIndex * 20) + 1; // Assume ~20 lines per block on average
    const estimatedEnd = estimatedStart + lineCount - 1;
    
    return {
        start: estimatedStart,
        end: estimatedEnd,
        confidence: 'estimated' // Could be 'exact', 'estimated', 'none'
    };
}

function extractSystemComponents(technicalDetails: any): string[] {
    const components = [];
    
    if (typeof technicalDetails === 'object') {
        if (technicalDetails.materialization) components.push(`materialization:${technicalDetails.materialization}`);
        if (technicalDetails.dbt_features) components.push(...technicalDetails.dbt_features.map((f: string) => `dbt:${f}`));
        if (technicalDetails.sql_operations) components.push(...technicalDetails.sql_operations.map((op: string) => `sql:${op}`));
    }
    
    return components;
}

function extractDataFlow(technicalDetails: any): Array<{from: string, to: string, operation: string}> {
    const dataFlow = [];
    
    if (typeof technicalDetails === 'object') {
        if (technicalDetails.source_tables && technicalDetails.materialization) {
            technicalDetails.source_tables.forEach((table: string) => {
                dataFlow.push({
                    from: table,
                    to: 'current_model',
                    operation: technicalDetails.materialization || 'transform'
                });
            });
        }
    }
    
    return dataFlow;
}

function getSectionType(section: string): string {
    const sectionTypes: Record<string, string> = {
        'execution_flow': 'process',
        'performance_considerations': 'optimization',
        'best_practices': 'guidelines',
        'dependencies': 'relationships'
    };
    return sectionTypes[section] || 'general';
}

function getSectionPriority(section: string): string {
    const priorities: Record<string, string> = {
        'execution_flow': 'high',
        'performance_considerations': 'medium',
        'best_practices': 'medium',
        'dependencies': 'very_high'
    };
    return priorities[section] || 'medium';
}

function getLLMContext(section: string): string {
    const contexts: Record<string, string> = {
        'execution_flow': 'process_understanding',
        'performance_considerations': 'optimization_analysis',
        'best_practices': 'code_quality',
        'dependencies': 'dependency_analysis'
    };
    return contexts[section] || 'general_context';
}

function analyzeDependencies(dependencies: any): {direct: string[], indirect: string[], types: string[]} {
    const analysis = { direct: [], indirect: [], types: [] };
    
    if (Array.isArray(dependencies)) {
        analysis.direct = dependencies.slice(0, 10); // Limit to first 10
        analysis.types.push('explicit');
    } else if (typeof dependencies === 'object') {
        if (dependencies.external_packages) {
            analysis.direct.push(...dependencies.external_packages);
            analysis.types.push('external');
        }
        if (dependencies.system_requirements) {
            analysis.indirect.push(...dependencies.system_requirements);
            analysis.types.push('system');
        }
    }
    
    return analysis;
}

function extractPerformanceMetrics(performance: any): {metrics: string[], optimizations: string[], concerns: string[]} {
    const metrics = { metrics: [], optimizations: [], concerns: [] };
    
    if (Array.isArray(performance)) {
        metrics.concerns = performance.slice(0, 5);
    } else if (typeof performance === 'object') {
        if (performance.optimization_opportunities) {
            metrics.optimizations.push(...performance.optimization_opportunities);
        }
        if (performance.resource_usage) {
            metrics.metrics.push(...performance.resource_usage);
        }
        if (performance.scalability_notes) {
            metrics.concerns.push(...performance.scalability_notes);
        }
    }
    
    return metrics;
}

// --- Lineage Processing Functions ---

interface LineageExtractionResult {
    assets: Array<{
        name: string;
        type: string;
        schema?: string;
        database?: string;
        description?: string;
        columns?: Array<{
            name: string;
            type?: string;
            description?: string;
        }>;
        metadata: Record<string, any>;
    }>;
    relationships: Array<{
        sourceAsset: string;
        targetAsset: string;
        relationshipType: string;
        operationType?: string;
        transformationLogic?: string;
        businessContext?: string;
        confidenceScore: number;
        discoveredAtLine?: number;
    }>;
    fileDependencies: Array<{
        importPath: string;
        importType: string;
        importStatement: string;
        aliasUsed?: string;
        specificItems?: string[];
        confidenceScore: number;
    }>;
    functions: Array<{
        name: string;
        type: string;
        signature?: string;
        returnType?: string;
        parameters?: Array<{
            name: string;
            type?: string;
            description?: string;
        }>;
        description?: string;
        businessLogic?: string;
        lineStart?: number;
        lineEnd?: number;
        complexityScore: number;
    }>;
    businessContext: {
        mainPurpose: string;
        businessImpact: string;
        stakeholders?: string[];
        dataDomain?: string;
        businessCriticality: string;
        dataFreshness?: string;
        executionFrequency?: string;
    };
}

const SQL_LINEAGE_PROMPT = `You are an expert SQL data lineage analyst. Your task is to extract comprehensive data lineage information from SQL code, including dbt macros, stored procedures, functions, and data transformations.

**Code to analyze:**
\`\`\`sql
{{code}}
\`\`\`

**File path:** {{filePath}}

**IMPORTANT: Even if this appears to be a utility or housekeeping script, extract ANY data-related operations, table references, or business logic you can identify.**

**Extract and return as JSON:**

{
  "assets": [
    {
      "name": "table_or_object_name",
      "type": "table|view|function|procedure|macro|materialization",
      "schema": "schema_name_if_identifiable",
      "database": "database_name_if_identifiable", 
      "description": "What this asset does or represents",
      "columns": [
        {
          "name": "column_name",
          "type": "data_type_if_known",
          "description": "Purpose or meaning of this column"
        }
      ],
      "metadata": {
        "materialization": "table|view|incremental|ephemeral",
        "tags": ["macro", "utility", "cleanup", "maintenance"]
      }
    }
  ],
  "relationships": [
    {
      "sourceAsset": "source_table_or_function",
      "targetAsset": "target_table_or_operation", 
      "relationshipType": "reads_from|writes_to|transforms|calls|references|creates|drops",
      "operationType": "select|insert|update|delete|merge|create|drop|call|execute",
      "transformationLogic": "Specific description of what operation is performed",
      "businessContext": "Why this operation exists (cleanup, maintenance, transformation, etc.)",
      "confidenceScore": 0.8,
      "discoveredAtLine": 1
    }
  ],
  "fileDependencies": [
    {
      "importPath": "schema.table_or_function",
      "importType": "table_reference|function_call|schema_reference",
      "importStatement": "Actual SQL statement making the reference",
      "confidenceScore": 0.9
    }
  ],
  "functions": [
    {
      "name": "function_or_macro_name",
      "type": "macro|function|procedure|utility",
      "signature": "function_name(parameter_list)",
      "returnType": "return_type_if_applicable",
      "parameters": [
        {"name": "param_name", "type": "param_type", "description": "What this parameter does"}
      ],
      "description": "What this function/macro accomplishes",
      "businessLogic": "Business purpose (data cleanup, validation, transformation, etc.)",
      "lineStart": 1,
      "lineEnd": 50,
      "complexityScore": 0.4
    }
  ],
  "businessContext": {
    "mainPurpose": "Data maintenance|Utility operation|Business transformation|Cleanup|Validation",
    "businessImpact": "How this affects data quality, business operations, or system maintenance",
    "stakeholders": ["Data Engineering", "Analytics", "DBA"],
    "dataDomain": "system_maintenance|data_quality|business_operations",
    "businessCriticality": "medium|high for data quality",
    "dataFreshness": "As needed for maintenance",
            "executionFrequency": "realtime|hourly|daily|weekly|monthly|adhoc|on_demand"
  }
}

**Critical Instructions:**
1. **Don't return empty results** - Even utility scripts have purposes and operations
2. **Look for ANY database objects** - Tables, views, functions, even if just referenced
3. **Extract macro/function definitions** - These are important assets
4. **Identify operations** - CREATE, DROP, INSERT, UPDATE, CALL, EXECUTE
5. **Consider business context** - Cleanup scripts serve business purposes too
6. **Use confidence scores** - 0.7+ for clear operations, 0.5+ for inferred purposes
7. **Include utility operations** - Maintenance and cleanup are valid business operations

**For dbt macros specifically:**
- Macro definitions are assets with type "macro"
- Macro calls create relationships
- Consider the macro's business purpose (cleanup, validation, etc.)
- Extract any table operations within the macro

**CRITICAL: Return ONLY valid JSON. No markdown, no explanations, no code blocks. Just the JSON object.**

If you cannot extract meaningful information, return this minimal valid structure:
{
  "assets": [],
  "relationships": [],
  "fileDependencies": [],
  "functions": [{"name": "unknown_operation", "type": "utility", "description": "File contains operations that require manual analysis", "businessLogic": "Utility or maintenance script", "complexityScore": 0.3}],
  "businessContext": {"mainPurpose": "Utility operation", "businessImpact": "System maintenance", "businessCriticality": "medium"}
}

Return valid JSON only.`;

const PYTHON_LINEAGE_PROMPT = `You are an expert Python/PySpark analyst. Analyze the provided Python code and extract comprehensive data lineage information.

**Code to analyze:**
\`\`\`python
{{code}}
\`\`\`

**File path:** {{filePath}}

Return JSON with assets, relationships, fileDependencies, functions, and businessContext following the same structure as the SQL prompt.

**Guidelines:**
- Identify DataFrame operations (read, write, transform, join, filter, aggregate)
- Track data flow through variable assignments
- Recognize Spark SQL operations and table references
- Focus on business-relevant transformations

**CRITICAL: Return ONLY valid JSON. No markdown, no explanations, no code blocks.**`;

const SCALA_LINEAGE_PROMPT = `You are an expert Scala/Spark analyst. Analyze the provided Scala code and extract comprehensive data lineage information.

**Code to analyze:**
\`\`\`scala
{{code}}
\`\`\`

**File path:** {{filePath}}

Return JSON with the same structure as other prompts, focusing on Spark DataFrames, RDDs, and Scala data transformations.

**CRITICAL: Return ONLY valid JSON. No markdown, no explanations, no code blocks.**`;

const R_LINEAGE_PROMPT = `You are an expert R data analyst. Analyze the provided R code and extract data lineage information.

**Code to analyze:**
\`\`\`r
{{code}}
\`\`\`

**File path:** {{filePath}}

Return JSON with the same structure as other prompts, focusing on data.frame operations, package functions, and R data transformations.

**CRITICAL: Return ONLY valid JSON. No markdown, no explanations, no code blocks.**`;

const GENERIC_LINEAGE_PROMPT = `You are an expert data analyst. Analyze the provided code/documentation and extract any data lineage information possible.

**Content to analyze:**
\`\`\`
{{code}}
\`\`\`

**File path:** {{filePath}}

Even for documentation files, look for:
- References to data sources, tables, databases
- Descriptions of data flows or transformations
- Business processes involving data
- System architecture involving data movement

Return JSON with assets, relationships, fileDependencies, functions, and businessContext. If no data-related content is found, return minimal valid structure.

**CRITICAL: Return ONLY valid JSON. No markdown, no explanations, no code blocks.**

Minimal structure if no data found:
{
  "assets": [],
  "relationships": [],
  "fileDependencies": [],
  "functions": [],
  "businessContext": {
    "mainPurpose": "Documentation/Non-data file",
    "businessImpact": "Informational",
    "businessCriticality": "low"
  }
}`;



function getLineagePromptForLanguage(language: string, filePath: string): string {
    // Use the unified language mapping for lineage prompts
    const lineagePromptType = mapLanguageToLineagePrompt(language, filePath);
    
    console.log(`Lineage prompt selection: language="${language}", path="${filePath}", type="${lineagePromptType}"`);
    
    switch (lineagePromptType) {
        case 'sql':
            return SQL_LINEAGE_PROMPT;
        case 'python':
            return PYTHON_LINEAGE_PROMPT;
        case 'scala':
            return SCALA_LINEAGE_PROMPT;
        case 'r':
            return R_LINEAGE_PROMPT;
        case 'generic':
        default:
            return GENERIC_LINEAGE_PROMPT;
    }
}

function interpolatePrompt(template: string, variables: { code: string; filePath: string; language?: string }): string {
    let prompt = template;
    
    prompt = prompt.replace(/\{\{code\}\}/g, variables.code);
    prompt = prompt.replace(/\{\{filePath\}\}/g, variables.filePath);
    prompt = prompt.replace(/\{\{language\}\}/g, variables.language || 'unknown');
    
    return prompt;
}

/**
 * Create a lineage-specific prompt from existing documentation analysis
 * This avoids duplicate LLM calls by reusing the code summary
 */
function createLineagePromptFromDocumentation(documentation: any, fileRecord: FileRecord): string {
    // Extract key information from the existing documentation
    const summary = documentation.summary || {};
    const businessLogic = documentation.business_logic || {};
    const technicalDetails = documentation.technical_details || {};
    
    // Get code content from code blocks if available
    let codeSnippets = '';
    if (documentation.code_blocks && Array.isArray(documentation.code_blocks)) {
        codeSnippets = documentation.code_blocks
            .map((block: any) => `### ${block.section || 'Code'}\n${block.code}`)
            .join('\n\n');
    }
    
    return `Based on the following code analysis, extract ONLY the data lineage information in the specified JSON format.

**File**: ${fileRecord.file_path}
**Language**: ${fileRecord.language}

**Code Summary**:
- **Purpose**: ${summary.purpose || 'Unknown'}
- **Model Type**: ${summary.model_type || 'Unknown'}
- **Complexity**: ${summary.complexity || 'Unknown'}

**Business Context**:
- **Main Objectives**: ${JSON.stringify(businessLogic.main_objectives || [])}
- **Stakeholder Impact**: ${businessLogic.stakeholder_impact || 'Unknown'}
- **Business Rules**: ${JSON.stringify(businessLogic.business_rules || [])}

**Technical Details**:
- **Source Tables**: ${JSON.stringify(technicalDetails.source_tables || [])}
- **Dependencies**: ${JSON.stringify(technicalDetails.dependencies || [])}
- **SQL Operations**: ${JSON.stringify(technicalDetails.sql_operations || [])}
- **Materialization**: ${technicalDetails.materialization || 'Unknown'}

**Code Blocks**:
${codeSnippets}

**TASK**: Extract ONLY lineage information from this analysis. Return a JSON object with this exact structure:

\`\`\`json
{
  "assets": [
    {
      "name": "asset_name",
      "type": "table|view|model|function",
      "schema": "schema_name",
      "database": "database_name", 
      "description": "description",
      "columns": [
        {"name": "column_name", "type": "data_type", "description": "description"}
      ],
      "metadata": {"materialization": "table|view", "tags": []}
    }
  ],
  "relationships": [
    {
      "sourceAsset": "source_asset_name",
      "targetAsset": "target_asset_name", 
      "relationshipType": "reads_from|writes_to|transforms",
      "operationType": "SELECT|INSERT|UPDATE|DELETE",
      "transformationLogic": "SQL logic",
      "businessContext": "business explanation",
      "confidenceScore": 0.95,
      "discoveredAtLine": 1
    }
  ],
  "fileDependencies": [
    {
      "importPath": "path/to/file",
      "importType": "ref|source|import",
      "importStatement": "{{ ref('model') }}",
      "confidenceScore": 0.95
    }
  ],
  "functions": [
    {
      "name": "function_name",
      "type": "macro|function|procedure", 
      "signature": "function signature",
      "description": "description",
      "complexityScore": 0.5
    }
  ],
  "businessContext": {
    "mainPurpose": "${businessLogic.main_objectives?.[0] || 'Data processing'}",
    "businessImpact": "${businessLogic.stakeholder_impact || 'Unknown'}",
    "businessCriticality": "high|medium|low"
  }
}
\`\`\`

Focus on extracting:
1. **Data assets** (tables, views, models) mentioned in the code
2. **Relationships** between assets (reads from, writes to, transforms)
3. **File dependencies** (imports, references to other files/models)
4. **Functions** defined in the file
5. **Business context** for the lineage

Return ONLY the JSON object, no additional text.`;
}

async function processFileLineage(fileId: string, fileRecord: FileRecord, existingDocumentation: any): Promise<LineageExtractionResult> {
    try {
        console.log(`Starting lineage extraction for ${fileRecord.file_path}`);
        
        // Use existing documentation if available (EFFICIENCY IMPROVEMENT)
        if (existingDocumentation && typeof existingDocumentation === 'object') {
            console.log(`✅ Using existing documentation for lineage extraction - no duplicate LLM call needed`);
            
            // Create lineage-specific prompt that uses the existing analysis
            const lineagePrompt = createLineagePromptFromDocumentation(existingDocumentation, fileRecord);
            
            console.log(`Extracting lineage from existing analysis for ${fileRecord.file_path}`);
            console.log(`Lineage prompt length: ${lineagePrompt.length} characters`);
            
            // Call OpenAI API for targeted lineage extraction (much smaller prompt)
            const response = await callOpenAIWithSystemPrompt(
                'You are an expert data lineage analyst. Extract ONLY lineage information from the provided analysis. Always return valid JSON that matches the requested schema exactly.',
                lineagePrompt
            );
            
            console.log(`Lineage extraction response type: ${typeof response}`);
            console.log(`Lineage extraction response: ${JSON.stringify(response).substring(0, 500)}...`);
            
            // Parse and validate the result
            let lineageResult: LineageExtractionResult;
            try {
                lineageResult = response;
                
                console.log(`Parsed result - Assets: ${lineageResult.assets?.length || 0}, Relationships: ${lineageResult.relationships?.length || 0}, Functions: ${lineageResult.functions?.length || 0}`);
                
                // Validate required structure
                if (!lineageResult.assets) lineageResult.assets = [];
                if (!lineageResult.relationships) lineageResult.relationships = [];
                if (!lineageResult.fileDependencies) lineageResult.fileDependencies = [];
                if (!lineageResult.functions) lineageResult.functions = [];
                if (!lineageResult.businessContext) {
                    lineageResult.businessContext = {
                        mainPurpose: existingDocumentation.business_logic?.main_objectives?.[0] || 'Data processing',
                        businessImpact: existingDocumentation.business_logic?.stakeholder_impact || 'Unknown',
                        businessCriticality: 'medium'
                    };
                }
                
            } catch (parseError) {
                console.error('Failed to validate lineage extraction response:', parseError);
                throw new Error(`Invalid lineage response structure: ${parseError.message}`);
            }
            
            // Validate and enhance the result
            const enhancedResult = validateAndEnhanceLineageResult(lineageResult, fileRecord.file_path, fileRecord.language);
            
            // Store lineage data in database
            await storeLineageData(fileId, enhancedResult);
            
            return enhancedResult;
        }
        
        // FALLBACK: If no existing documentation, use the old method (fetch from GitHub)
        console.log(`⚠️ No existing documentation found, falling back to GitHub fetch (less efficient)`);
        
        let fileContent = '';
        
        // For eligible files only, fetch from GitHub as fallback
        if (isFileEligibleForLineage(fileRecord.file_path, fileRecord.language)) {
            const installationToken = await getGitHubInstallationToken(fileRecord.github_installation_id);
            fileContent = await fetchGitHubFileContent(
                installationToken,
                fileRecord.repository_full_name,
                fileRecord.file_path
            );
        }
        
        if (!fileContent) {
            throw new Error('Could not retrieve file content for lineage processing');
        }
        
        // Get appropriate prompt for the language
        const promptTemplate = getLineagePromptForLanguage(fileRecord.language, fileRecord.file_path);
        
        // Interpolate variables into the prompt
        const prompt = interpolatePrompt(promptTemplate, {
            code: fileContent,
            filePath: fileRecord.file_path,
            language: fileRecord.language
        });
        
        console.log(`Extracting lineage for ${fileRecord.file_path} using ${fileRecord.language} prompt (FALLBACK)`);
        console.log(`File content length: ${fileContent.length} characters`);
        console.log(`Prompt length: ${prompt.length} characters`);
        
        // Call OpenAI API for lineage extraction
        const response = await callOpenAIWithSystemPrompt(
            'You are an expert data lineage analyst. Always return valid JSON that matches the requested schema exactly.',
            prompt
        );
        
        console.log(`Raw LLM response type: ${typeof response}`);
        console.log(`Raw LLM response: ${JSON.stringify(response).substring(0, 500)}...`);
        
        // Parse and validate the result
        let lineageResult: LineageExtractionResult;
        try {
            // The response should already be parsed JSON from callOpenAIWithSystemPrompt
            lineageResult = response;
            
            console.log(`Parsed result - Assets: ${lineageResult.assets?.length || 0}, Relationships: ${lineageResult.relationships?.length || 0}, Functions: ${lineageResult.functions?.length || 0}`);
            
            // Validate required structure
            if (!lineageResult.assets) lineageResult.assets = [];
            if (!lineageResult.relationships) lineageResult.relationships = [];
            if (!lineageResult.fileDependencies) lineageResult.fileDependencies = [];
            if (!lineageResult.functions) lineageResult.functions = [];
            if (!lineageResult.businessContext) {
                lineageResult.businessContext = {
                    mainPurpose: 'Unknown',
                    businessImpact: 'Unknown',
                    businessCriticality: 'medium'
                };
            }
            
        } catch (parseError) {
            console.error('Failed to validate LLM response structure:', parseError);
            console.error('Response content:', response);
            throw new Error(`Invalid response structure from LLM: ${parseError.message}`);
        }
        
        // Validate and enhance the result
        const enhancedResult = validateAndEnhanceLineageResult(lineageResult, fileRecord.file_path, fileRecord.language);
        
        // Store lineage data in database
        await storeLineageData(fileId, enhancedResult);
        
        return enhancedResult;
        
    } catch (error) {
        console.error('Error extracting lineage with LLM:', error);
        
        // Return minimal result on error
        return {
            assets: [],
            relationships: [],
            fileDependencies: [],
            functions: [],
            businessContext: {
                mainPurpose: 'Analysis failed - manual review needed',
                businessImpact: 'Unknown',
                businessCriticality: 'medium'
            }
        };
    }
}

function validateAndEnhanceLineageResult(
    result: LineageExtractionResult,
    filePath: string,
    language: string
): LineageExtractionResult {
    // Ensure all required fields exist
    result.assets = result.assets || [];
    result.relationships = result.relationships || [];
    result.fileDependencies = result.fileDependencies || [];
    result.functions = result.functions || [];
    result.businessContext = result.businessContext || {
        mainPurpose: 'Data processing',
        businessImpact: 'Unknown',
        businessCriticality: 'medium'
    };
    
    // Enhance assets with file context
    result.assets.forEach(asset => {
        asset.metadata = asset.metadata || {};
        asset.metadata.sourceFile = filePath;
        asset.metadata.sourceLanguage = language;
        asset.metadata.extractedAt = new Date().toISOString();
    });
    
    // Validate confidence scores
    result.relationships.forEach(rel => {
        if (rel.confidenceScore < 0 || rel.confidenceScore > 1) {
            rel.confidenceScore = 0.5; // Default to medium confidence
        }
    });
    
    result.fileDependencies.forEach(dep => {
        if (dep.confidenceScore < 0 || dep.confidenceScore > 1) {
            dep.confidenceScore = 0.5;
        }
    });
    
    // Enhance functions with complexity scoring
    result.functions.forEach(func => {
        if (!func.complexityScore || func.complexityScore < 0 || func.complexityScore > 1) {
            // Simple heuristic based on parameters and description length
            const paramCount = func.parameters?.length || 0;
            const descLength = (func.description || '').length;
            func.complexityScore = Math.min(1, (paramCount * 0.1) + (descLength / 1000));
        }
    });
    
    return result;
}

async function storeLineageData(fileId: string, lineageResult: LineageExtractionResult): Promise<void> {
    console.log(`📊 Storing comprehensive lineage data: ${lineageResult.assets.length} assets, ${lineageResult.relationships.length} relationships, ${lineageResult.functions.length} functions, ${lineageResult.fileDependencies.length} dependencies`);
    
    // Use local development URLs if edge function URLs are not available
    const supabaseUrl = Deno.env.get('EDGE_FUNCTION_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || 'http://127.0.0.1:54321';
    const supabaseKey = Deno.env.get('EDGE_FUNCTION_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabaseLineage = createClient(
        supabaseUrl,
        supabaseKey,
        {
            db: { schema: 'code_insights' },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        }
    );

    try {
        // === 1. CORE GRAPH STRUCTURE - Foundation for all relationships ===
        
        // Build comprehensive node mapping
        const allNodes = [];
        const assetNodeMap = new Map();
        const functionNodeMap = new Map();
        
        console.log('🔄 Creating graph nodes...');
        
        // Create nodes for data assets (tables, views, models, etc.) with deterministic UUIDs
        for (const asset of lineageResult.assets) {
            // Use deterministic UUID based on file_id + asset_name to ensure consistency across upserts
            const nodeId = crypto.randomUUID(); // We'll let the database handle uniqueness
            const nodeData = {
                id: nodeId,
                file_id: fileId,
                node_type: asset.type,
                node_name: asset.name,
                fully_qualified_name: `${asset.database || 'unknown'}.${asset.schema || 'unknown'}.${asset.name}`,
                description: asset.description,
                business_meaning: lineageResult.businessContext?.mainPurpose || 'Data processing asset',
                data_lineage_metadata: {
                    ...asset.metadata,
                    columns: asset.columns,
                    businessContext: lineageResult.businessContext,
                    extractedAt: new Date().toISOString()
                }
            };
            allNodes.push(nodeData);
            // Store the temporary mapping - we'll update this with actual IDs after insert
            assetNodeMap.set(asset.name, nodeId);
        }
        
        // Create nodes for functions (procedures, macros, methods) with deterministic UUIDs
        for (const func of lineageResult.functions) {
            // Use deterministic UUID based on file_id + function_name to ensure consistency
            const nodeId = crypto.randomUUID(); // We'll let the database handle uniqueness
            const nodeData = {
                id: nodeId,
                file_id: fileId,
                node_type: 'function',
                node_name: func.name,
                fully_qualified_name: `${func.namespace || 'global'}.${func.name}`,
                description: func.description,
                business_meaning: func.businessLogic || 'Code function',
                data_lineage_metadata: {
                    signature: func.signature,
                    returnType: func.returnType,
                    parameters: func.parameters,
                    businessLogic: func.businessLogic,
                    lineStart: func.lineStart,
                    lineEnd: func.lineEnd,
                    complexityScore: func.complexityScore,
                    extractedAt: new Date().toISOString()
                }
            };
            allNodes.push(nodeData);
            // Store the temporary mapping - we'll update this with actual IDs after insert
            functionNodeMap.set(func.name, nodeId);
        }

        // Insert all graph nodes FIRST (they are referenced by other tables)
        if (allNodes.length > 0) {
            console.log(`🔄 Inserting ${allNodes.length} graph nodes with IDs:`, allNodes.map(n => `${n.node_name} (${n.id})`));
            
            // First, try to delete existing nodes for this file to avoid conflicts
            const { error: deleteError } = await supabaseLineage
                .from('graph_nodes')
                .delete()
                .eq('file_id', fileId);
                
            if (deleteError) {
                console.log(`⚠️ Could not delete existing nodes (may not exist): ${deleteError.message}`);
            }

            // Now insert fresh nodes
            const { data: insertedNodes, error: nodesError } = await supabaseLineage
                .from('graph_nodes')
                .insert(allNodes)
                .select('id, node_name, node_type');

            if (nodesError) {
                console.error('❌ Error storing graph nodes:', nodesError);
                console.error('❌ Failed nodes data:', JSON.stringify(allNodes.slice(0, 2), null, 2)); // Only show first 2 for brevity
                throw new Error(`Failed to store graph nodes: ${nodesError.message}`);
            } else {
                console.log(`✅ Stored ${insertedNodes?.length || 0} graph nodes successfully`);
                
                // Clear and rebuild node mappings with actual inserted IDs
                assetNodeMap.clear();
                functionNodeMap.clear();
                
                insertedNodes?.forEach(node => {
                    // Find original asset/function by node_name and update mapping
                    const matchingAsset = lineageResult.assets.find(a => a.name === node.node_name);
                    const matchingFunction = lineageResult.functions.find(f => f.name === node.node_name);
                    
                    if (matchingAsset) {
                        assetNodeMap.set(node.node_name, node.id);
                    }
                    if (matchingFunction) {
                        functionNodeMap.set(node.node_name, node.id);
                    }
                });
                
                console.log(`🔗 Updated node mappings: Assets=${assetNodeMap.size}, Functions=${functionNodeMap.size}`);
            }
        }

        // === 2. DATA ASSETS - Extended asset information ===
        
        console.log('🗄️ Storing data assets...');
        const assetIdMap = new Map();
        
        if (lineageResult.assets && lineageResult.assets.length > 0) {
            console.log(`🗄️ Preparing ${lineageResult.assets.length} data assets with node mappings...`);
            
            // Delete existing data assets for this file first
            const { error: deleteAssetsError } = await supabaseLineage
                .from('data_assets')
                .delete()
                .eq('file_id', fileId);
                
            if (deleteAssetsError) {
                console.log(`⚠️ Could not delete existing assets: ${deleteAssetsError.message}`);
            }
            
            const assetsToInsert = lineageResult.assets.map(asset => {
                const nodeId = assetNodeMap.get(asset.name);
                if (!nodeId) {
                    console.warn(`⚠️ No node ID found for asset: ${asset.name}`);
                }
                return {
                    node_id: nodeId,
                    file_id: fileId,
                    asset_name: asset.name,
                    asset_type: asset.type,
                    schema_name: asset.schema || null,
                    database_name: asset.database || null,
                    asset_metadata: {
                        description: asset.description,
                        sourceFile: asset.metadata?.sourceFile,
                        sourceLanguage: asset.metadata?.sourceLanguage,
                        extractedAt: asset.metadata?.extractedAt,
                        businessContext: lineageResult.businessContext,
                        ...asset.metadata
                    }
                };
            });

            console.log(`🗄️ Inserting assets with node IDs:`, assetsToInsert.map(a => `${a.asset_name} → ${a.node_id}`));

            const { data: insertedAssets, error: assetsError } = await supabaseLineage
                .from('data_assets')
                .insert(assetsToInsert)
                .select('id, asset_name');

            if (assetsError) {
                console.error('❌ Error storing data assets:', assetsError);
                // Continue with best effort
            } else {
                console.log(`✅ Stored ${insertedAssets?.length || 0} data assets`);

                // Build asset ID mapping for relationships
                insertedAssets?.forEach(asset => {
                    assetIdMap.set(asset.asset_name, asset.id);
                });

                // === 3. DATA COLUMNS - Detailed column information ===
                
                console.log('📋 Storing column metadata...');
                let totalColumns = 0;
                
                // Delete existing columns for assets from this file
                const { error: deleteColumnsError } = await supabaseLineage
                    .from('data_columns')
                    .delete()
                    .in('asset_id', Array.from(assetIdMap.values()));
                    
                if (deleteColumnsError) {
                    console.log(`⚠️ Could not delete existing columns: ${deleteColumnsError.message}`);
                }
                
                for (const asset of lineageResult.assets) {
                    if (asset.columns && asset.columns.length > 0) {
                        const assetId = assetIdMap.get(asset.name);
                        if (!assetId) {
                            console.warn(`⚠️ No asset ID found for columns of ${asset.name}`);
                            continue;
                        }

                        const columnsToInsert = asset.columns.map((column, index) => ({
                            asset_id: assetId,
                            column_name: column.name,
                            column_type: column.type || 'unknown',
                            column_description: column.description,
                            ordinal_position: index + 1,
                            business_meaning: `Column in ${asset.name} table`,
                            pii_classification: 'none', // Default classification
                            column_metadata: {
                                extractedAt: new Date().toISOString(),
                                sourceAsset: asset.name,
                                assetType: asset.type
                            }
                        }));

                        const { error: columnsError } = await supabaseLineage
                            .from('data_columns')
                            .insert(columnsToInsert);

                        if (columnsError) {
                            console.error(`❌ Error storing columns for asset ${asset.name}:`, columnsError);
                        } else {
                            totalColumns += columnsToInsert.length;
                        }
                    }
                }
                
                if (totalColumns > 0) {
                    console.log(`✅ Stored ${totalColumns} column definitions`);
                }
            }
        }

        // === 4. CODE FUNCTIONS - Enhanced function storage ===
        
        console.log('⚙️ Storing code functions...');
        
        if (lineageResult.functions && lineageResult.functions.length > 0) {
            console.log(`⚙️ Preparing ${lineageResult.functions.length} code functions with node mappings...`);
            
            // Delete existing code functions for this file first
            const { error: deleteFunctionsError } = await supabaseLineage
                .from('code_functions')
                .delete()
                .eq('file_id', fileId);
                
            if (deleteFunctionsError) {
                console.log(`⚠️ Could not delete existing functions: ${deleteFunctionsError.message}`);
            }
            
            const functionsToInsert = lineageResult.functions.map(func => {
                const nodeId = functionNodeMap.get(func.name);
                if (!nodeId) {
                    console.warn(`⚠️ No node ID found for function: ${func.name}`);
                }
                return {
                    node_id: nodeId,
                    function_name: func.name,
                    function_type: func.type,
                    language: lineageResult.businessContext?.dataDomain || 'sql',
                    signature: func.signature,
                    return_type: func.returnType,
                    parameters: func.parameters || [],
                    description: func.description,
                    namespace: func.namespace || 'global',
                    file_id: fileId,
                    line_start: func.lineStart,
                    line_end: func.lineEnd,
                    complexity_score: func.complexityScore || 0,
                    business_logic: func.businessLogic
                };
            });

            console.log(`⚙️ Inserting functions with node IDs:`, functionsToInsert.map(f => `${f.function_name} → ${f.node_id}`));

            const { error: functionsError } = await supabaseLineage
                .from('code_functions')
                .insert(functionsToInsert);

            if (functionsError) {
                console.error('❌ Error storing code functions:', functionsError);
            } else {
                console.log(`✅ Stored ${functionsToInsert.length} code functions`);
            }
        }

        // === 5. GRAPH EDGES - Relationship network ===
        
        console.log('🔗 Creating relationship edges...');
        
        if (lineageResult.relationships && lineageResult.relationships.length > 0) {
            const edges = [];
            
            for (const rel of lineageResult.relationships) {
                const sourceNodeId = assetNodeMap.get(rel.sourceAsset) || functionNodeMap.get(rel.sourceAsset);
                const targetNodeId = assetNodeMap.get(rel.targetAsset) || functionNodeMap.get(rel.targetAsset);
                
                if (sourceNodeId && targetNodeId) {
                    edges.push({
                        source_node_id: sourceNodeId,
                        target_node_id: targetNodeId,
                        relationship_type: rel.relationshipType,
                        confidence_score: rel.confidenceScore || 0.8,
                        transformation_logic: rel.transformationLogic,
                        business_context: rel.businessContext,
                        discovered_at_line: rel.discoveredAtLine,
                        properties: {
                            operationType: rel.operationType,
                            extractedAt: new Date().toISOString(),
                            sourceAsset: rel.sourceAsset,
                            targetAsset: rel.targetAsset
                        }
                    });
                }
            }

            if (edges.length > 0) {
                console.log(`🔗 Attempting to store ${edges.length} edges:`, edges.map(e => `${e.source_node_id} → ${e.target_node_id} (${e.relationship_type})`));
                
                // Delete existing edges for this file first (they will be recreated)
                const allNodeIds = [...assetNodeMap.values(), ...functionNodeMap.values()];
                const { error: deleteEdgesError } = await supabaseLineage
                    .from('graph_edges')
                    .delete()
                    .or(`source_node_id.in.(${allNodeIds.join(',')}),target_node_id.in.(${allNodeIds.join(',')})`);
                    
                if (deleteEdgesError) {
                    console.log(`⚠️ Could not delete existing edges: ${deleteEdgesError.message}`);
                }
                
                const { error: edgesError } = await supabaseLineage
                    .from('graph_edges')
                    .insert(edges);

                if (edgesError) {
                    console.error('❌ Error storing graph edges:', edgesError);
                    console.error('❌ Failed edges data:', JSON.stringify(edges.slice(0, 2), null, 2)); // Only show first 2 for brevity
                } else {
                    console.log(`✅ Stored ${edges.length} relationship edges`);
                }
            } else {
                console.log('⚠️ No relationship edges created - node mapping may have failed');
            }
        }

        // === 6. DATA LINEAGE - Enhanced relationship details ===
        
        console.log('🏗️ Storing detailed lineage relationships...');
        
        if (lineageResult.relationships && lineageResult.relationships.length > 0 && assetIdMap.size > 0) {
            const lineageRelationships = [];
            
            for (const rel of lineageResult.relationships) {
                const sourceAssetId = assetIdMap.get(rel.sourceAsset);
                const targetAssetId = assetIdMap.get(rel.targetAsset);
                
                if (sourceAssetId && targetAssetId) {
                    lineageRelationships.push({
                        source_asset_id: sourceAssetId,
                        target_asset_id: targetAssetId,
                        relationship_type: rel.relationshipType,
                        operation_type: (rel.operationType || 'select').toLowerCase(),
                        confidence_score: rel.confidenceScore || 0.8,
                        transformation_logic: rel.transformationLogic,
                        business_context: rel.businessContext,
                        discovered_in_file_id: fileId,
                        discovered_at_line: rel.discoveredAtLine,
                        execution_frequency: validateExecutionFrequency(lineageResult.businessContext?.executionFrequency) || 'adhoc',
                        data_freshness_requirement: lineageResult.businessContext?.dataFreshness
                    });
                }
            }

            if (lineageRelationships.length > 0) {
                // Delete existing lineage relationships for this file first
                const { error: deleteLineageError } = await supabaseLineage
                    .from('data_lineage')
                    .delete()
                    .eq('discovered_in_file_id', fileId);
                    
                if (deleteLineageError) {
                    console.log(`⚠️ Could not delete existing lineage: ${deleteLineageError.message}`);
                }
                
                const { error: lineageError } = await supabaseLineage
                    .from('data_lineage')
                    .insert(lineageRelationships);

                if (lineageError) {
                    console.error('❌ Error storing data lineage:', lineageError);
                } else {
                    console.log(`✅ Stored ${lineageRelationships.length} detailed lineage relationships`);
                }
            }
        }

        // === 7. FILE DEPENDENCIES - NOW ENABLED ===
        
        console.log('📁 Storing file dependencies...');
        
        if (lineageResult.fileDependencies && lineageResult.fileDependencies.length > 0) {
            // Store file dependencies as graph node metadata for now
            // TODO: Implement full target_file_id resolution when we have comprehensive file registry
            
            const fileDependencyNode = {
                id: crypto.randomUUID(),
                file_id: fileId,
                node_type: 'file_metadata',
                node_name: 'file_dependencies',
                description: `File-level dependencies discovered: ${lineageResult.fileDependencies.length} imports`,
                business_meaning: 'Import and dependency structure for this file',
                data_lineage_metadata: {
                    dependencies: lineageResult.fileDependencies,
                    extractedAt: new Date().toISOString(),
                    dependencyCount: lineageResult.fileDependencies.length,
                    importTypes: [...new Set(lineageResult.fileDependencies.map(d => d.importType))]
                }
            };

            const { error: depError } = await supabaseLineage
                .from('graph_nodes')
                .upsert([fileDependencyNode], { onConflict: 'file_id,node_type,node_name' });

            if (depError) {
                console.error('❌ Error storing file dependencies:', depError);
            } else {
                console.log(`✅ Stored ${lineageResult.fileDependencies.length} file dependencies as metadata`);
            }
        }

        // === 8. ENHANCED DOCUMENTATION VECTORS ===
        
        console.log('🔍 Preparing enhanced search vectors...');
        
        // Update the existing document vectors with enhanced metadata
        const vectorUpdates = [];
        
        if (lineageResult.businessContext) {
            vectorUpdates.push({
                file_id: fileId,
                section_type: 'business_context',
                search_priority: 9,
                llm_context: `Business context: ${lineageResult.businessContext.mainPurpose}. Impact: ${lineageResult.businessContext.businessImpact}. Criticality: ${lineageResult.businessContext.businessCriticality}`,
                complexity_score: calculateOverallConfidence(lineageResult)
            });
        }

        // Add lineage-specific metadata to vectors for better search
        const { error: vectorError } = await supabaseLineage
            .from('document_vectors')
            .update({ 
                section_type: 'lineage_analysis',
                search_priority: 8,
                llm_context: `Data lineage: ${lineageResult.assets.length} assets, ${lineageResult.relationships.length} relationships`,
                complexity_score: calculateOverallConfidence(lineageResult)
            })
            .eq('file_id', fileId);

        if (vectorError) {
            console.log('⚠️ Could not update vector metadata (non-critical)');
        }

        // === 9. FINAL SUCCESS SUMMARY ===
        
        console.log('🎉 Successfully stored comprehensive lineage data:');
        console.log(`   📊 ${allNodes.length} graph nodes (foundation)`);
        console.log(`   🗄️ ${lineageResult.assets.length} data assets`);
        console.log(`   📋 ${lineageResult.assets.reduce((sum, a) => sum + (a.columns?.length || 0), 0)} column definitions`);
        console.log(`   ⚙️ ${lineageResult.functions.length} code functions`);
        console.log(`   🔗 ${lineageResult.relationships.length} relationship edges`);
        console.log(`   📁 ${lineageResult.fileDependencies.length} file dependencies`);
        console.log(`   🎯 Business context: ${lineageResult.businessContext?.mainPurpose || 'Unknown'}`);

    } catch (error) {
        console.error('💥 Critical error in comprehensive storeLineageData:', error);
        throw error;
    }
}

function calculateOverallConfidence(lineageResult: LineageExtractionResult): number {
    const allScores = [
        ...lineageResult.relationships.map(r => r.confidenceScore),
        ...lineageResult.fileDependencies.map(d => d.confidenceScore)
    ];
    
    if (allScores.length === 0) return 0.5;
    
    return allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
}

function isFileEligibleForLineage(filePath: string, language: string): boolean {
    const lowerPath = filePath.toLowerCase();
    const lowerLang = language.toLowerCase();
    
    // SQL files are primary targets for lineage
    if (lowerLang.includes('sql') || 
        lowerLang.includes('postgres') || 
        lowerLang.includes('mysql') || 
        lowerLang.includes('snowflake') || 
        lowerLang.includes('bigquery') || 
        lowerLang.includes('redshift') ||
        lowerPath.endsWith('.sql')) {
        return true;
    }
    
    // Python files (especially with data processing)
    if (lowerLang.includes('python') || lowerPath.endsWith('.py')) {
        return true;
    }
    
    // R files for data analysis
    if (lowerLang.includes('r') || lowerPath.endsWith('.r')) {
        return true;
    }
    
    // dbt models and configuration
    if (lowerPath.includes('dbt') || 
        lowerPath.includes('models/') ||
        lowerPath.endsWith('.yml') || 
        lowerPath.endsWith('.yaml')) {
        return true;
    }
    
    // Airflow DAGs
    if (lowerPath.includes('dag') || lowerPath.includes('airflow')) {
        return true;
    }
    
    // Configuration files with potential data connections
    if (lowerPath.endsWith('.json') || 
        lowerPath.endsWith('.toml') ||
        lowerPath.endsWith('.ini')) {
        return true;
    }
    
    // Exclude common non-lineage files
    const excludePatterns = [
        'readme', 'license', 'gitignore', 'gitattributes',
        'changelog', 'contributing', 'code_of_conduct',
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
        '.css', '.scss', '.sass', '.less',
        '.html', '.htm', '.xml',
        '.md', '.txt', '.doc', '.docx', '.pdf'
    ];
    
    for (const pattern of excludePatterns) {
        if (lowerPath.includes(pattern)) {
            return false;
        }
    }
    
    // Default to true for other code files (JavaScript, etc. might have some data processing)
    return true;
}

/**
 * Validate and map execution frequency to allowed database values
 */
function validateExecutionFrequency(frequency: string | undefined): string {
    if (!frequency) return 'adhoc';
    
    // Valid values: 'realtime', 'hourly', 'daily', 'weekly', 'monthly', 'adhoc', 'on_demand'
    const validValues = ['realtime', 'hourly', 'daily', 'weekly', 'monthly', 'adhoc', 'on_demand'];
    
    // If already valid, return as-is
    if (validValues.includes(frequency.toLowerCase())) {
        return frequency.toLowerCase();
    }
    
    // Map common variations to valid values
    const mappings: { [key: string]: string } = {
        'as_needed': 'on_demand',
        'as-needed': 'on_demand',
        'on-demand': 'on_demand',
        'real-time': 'realtime',
        'real_time': 'realtime',
        'ad-hoc': 'adhoc',
        'ad_hoc': 'adhoc',
        'batch': 'daily',
        'scheduled': 'daily',
        'manual': 'on_demand',
        'triggered': 'on_demand'
    };
    
    const mapped = mappings[frequency.toLowerCase()];
    if (mapped) {
        console.log(`📝 Mapped execution_frequency: "${frequency}" → "${mapped}"`);
        return mapped;
    }
    
    // Default fallback
    console.log(`⚠️ Unknown execution_frequency "${frequency}", using "adhoc" as fallback`);
    return 'adhoc';
}

// --- Main Handler ---
serve(async (req) => {
    console.log("Code processor function invoked.");
    let jobId: string | null = null;

    // Define the Supabase client outside the try block to make it available in the catch block
    // Use local development URLs if edge function URLs are not available
    const supabaseUrl = Deno.env.get('EDGE_FUNCTION_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || 'http://127.0.0.1:54321';
    const supabaseKey = Deno.env.get('EDGE_FUNCTION_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    console.log(`Using Supabase URL: ${supabaseUrl}`);
    
    const supabaseAdmin = createClient(
        supabaseUrl,
        supabaseKey,
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
        const { data: leasedJobs, error: leaseError } = await supabaseAdmin.rpc('lease_processing_job', {
            job_types: ['documentation', 'vector', 'lineage'],
            lease_duration_minutes: 30
        });

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
        jobId = job.job_id; // Correctly get job ID from the first element of the array

        console.log(`Leased job ID: ${job.job_id} for file ID: ${job.file_id}`);
        
        // Determine the job type based on status
        const isVectorOnlyJob = job.status === 'completed' && job.vector_status === 'processing';
        console.log(`Job type: ${isVectorOnlyJob ? 'Vector-only processing' : 'Documentation processing'}`);

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
        
        // For vector-only jobs, we don't need GitHub access
        if (!isVectorOnlyJob) {
            if (fileRecord.github_installation_id == null) { // Check for null or undefined
                throw new Error(`Missing github_installation_id for file_id ${job.file_id}. Cannot authenticate with GitHub.`);
            }
            console.log(`File record fetched. Installation ID: ${fileRecord.github_installation_id}`);
        } else {
            console.log(`File record fetched for vector processing.`);
        }

        let llmResponse: any;
        
        if (isVectorOnlyJob) {
            // For vector-only jobs, fetch existing summary from database
            console.log(`Fetching existing summary for vector processing: ${job.file_id}`);
            const { data: existingSummary, error: summaryError } = await supabaseAdmin
                .from('code_summaries')
                .select('summary_json')
                .eq('file_id', job.file_id)
                .single();

            if (summaryError || !existingSummary) {
                throw new Error(`Failed to fetch existing summary for vector processing: ${summaryError?.message || 'Not found'}`);
            }
            
            llmResponse = existingSummary.summary_json;
            console.log('Existing summary fetched for vector processing');
        } else {
            // For documentation jobs, perform full LLM analysis
            // 3. Fetch GitHub File Content
            const installationToken = await getGitHubInstallationToken(fileRecord.github_installation_id);
            const fileContent = await fetchGitHubFileContent(
                installationToken,
                fileRecord.repository_full_name,
                fileRecord.file_path
            );

            // 4. Fetch custom analysis settings for this repository
            console.log(`Fetching custom analysis settings for repository: ${fileRecord.repository_full_name}`);
            const customSettings = await getCustomAnalysisSettings(supabaseAdmin, fileRecord.repository_full_name);
            
            // Use custom language if available, otherwise use file language
            const analysisLanguage = customSettings?.language || fileRecord.language;
            
            // 5. Get System Prompt based on language and custom settings
            console.log(`Getting system prompt for language: ${analysisLanguage} with custom settings:`, customSettings);
            const systemPrompt = getSystemPrompt(analysisLanguage, customSettings, fileRecord.file_path);
            
            // 6. Construct user message with file details
            const userMessage = `Please analyze the following code file:

File Path: ${fileRecord.file_path}
Language: ${analysisLanguage}

\`\`\`${analysisLanguage}
${fileContent}
\`\`\`

Provide a comprehensive analysis in the requested JSON format.`;

            // 7. Call OpenAI with system and user messages
            console.log(`Sending request to OpenAI GPT-4.1-mini`);
            llmResponse = await callOpenAIWithSystemPrompt(systemPrompt, userMessage);
            console.log("OpenAI API call successful.");

            // 8. Store Results
            console.log(`Storing LLM summary for file_id: ${job.file_id}`);
            const { data: summaryData, error: summaryError } = await supabaseAdmin
                .from('code_summaries') // Will use 'code_insights.code_summaries'
                .upsert({
                    job_id: job.job_id, // Add the job_id here
                    file_id: job.file_id,
                    summary_json: llmResponse,
                    llm_provider: 'openai',
                    llm_model_name: 'gpt-4.1-mini' // Use correct OpenAI model name
                }, {
                    onConflict: 'job_id' // Specify the conflict column explicitly
                })
                .select()
                .single();

            if (summaryError) {
                throw new Error(`Failed to store LLM summary: ${summaryError.message}`);
            }
            console.log('LLM summary stored:', summaryData);
        }

        // 8.5. Generate and Store Vector Embeddings (ONLY if vector processing is explicitly requested)
        const shouldProcessVectors = (job.vector_status === 'processing' || job.vector_status === 'pending') || isVectorOnlyJob;
        
        if (shouldProcessVectors) {
            console.log(`Generating vector embeddings for file_id: ${job.file_id}`);
            
            // Update vector status to processing (if not already)
            if (job.vector_status !== 'processing') {
                await supabaseAdmin.rpc('update_vector_processing_status', {
                    job_id_param: job.job_id,
                    new_status: 'processing'
                });
            }

            try {
                const chunksCount = await generateAndStoreVectors(job.file_id, llmResponse, fileRecord);
                console.log(`Vector embeddings stored successfully: ${chunksCount} chunks`);
                
                // Update vector status to completed
                await supabaseAdmin.rpc('update_vector_processing_status', {
                    job_id_param: job.job_id,
                    new_status: 'completed',
                    chunks_count: chunksCount
                });
            } catch (vectorError) {
                console.error('Error storing vector embeddings:', vectorError);
                
                // Update vector status to failed
                await supabaseAdmin.rpc('update_vector_processing_status', {
                    job_id_param: job.job_id,
                    new_status: 'failed',
                    error_details: vectorError.message || 'Unknown vector processing error'
                });
                
                // Don't fail the entire job for vector storage issues
                console.log('Continuing without vector storage - vector processing can be retried later');
            }
        } else {
            console.log(`⏭️  Skipping vector processing for file_id: ${job.file_id} (vector_status: ${job.vector_status})`);
        }

        // 8.6. Process Lineage Extraction (ONLY if lineage processing is explicitly requested)
        const isLineageEligible = isFileEligibleForLineage(fileRecord.file_path, fileRecord.language);
        const shouldProcessLineage = isLineageEligible && (job.lineage_status === 'processing' || job.lineage_status === 'pending');
        
        console.log(`Lineage eligibility check: ${fileRecord.file_path} (${fileRecord.language}) -> ${isLineageEligible ? 'ELIGIBLE' : 'SKIPPED'}`);
        console.log(`Lineage processing check: lineage_status=${job.lineage_status}, shouldProcess=${shouldProcessLineage}`);
        
        if (shouldProcessLineage) {
            console.log(`Starting lineage processing for file_id: ${job.file_id} (${fileRecord.file_path}, ${fileRecord.language})`);
            
            // Update lineage status to processing
            await supabaseAdmin.rpc('update_lineage_processing_status', {
                job_id_param: job.job_id,
                new_status: 'processing'
            });

            try {
                const lineageResult = await processFileLineage(job.file_id, fileRecord, llmResponse);
                console.log(`Lineage processing completed: ${lineageResult.assets.length} assets, ${lineageResult.relationships.length} relationships`);
                
                // Update lineage status to completed
                await supabaseAdmin.rpc('update_lineage_processing_status', {
                    job_id_param: job.job_id,
                    new_status: 'completed',
                    dependencies_extracted: {
                        fileDependencies: lineageResult.fileDependencies,
                        extractedAt: new Date().toISOString()
                    },
                    assets_discovered: {
                        assets: lineageResult.assets,
                        functions: lineageResult.functions,
                        businessContext: lineageResult.businessContext,
                        extractedAt: new Date().toISOString()
                    },
                    confidence_score: calculateOverallConfidence(lineageResult)
                });
            } catch (lineageError) {
                console.error('Error processing lineage:', lineageError);
                
                // Update lineage status to failed
                await supabaseAdmin.rpc('update_lineage_processing_status', {
                    job_id_param: job.job_id,
                    new_status: 'failed',
                    error_details: lineageError.message || 'Unknown lineage processing error'
                });
                
                // Don't fail the entire job for lineage processing issues
                console.log('Continuing without lineage processing - can be retried later');
            }
        } else if (!isLineageEligible) {
            // Mark non-eligible files as completed with a note
            console.log(`Skipping lineage processing for non-eligible file: ${fileRecord.file_path} (${fileRecord.language})`);
            
            await supabaseAdmin.rpc('update_lineage_processing_status', {
                job_id_param: job.job_id,
                new_status: 'completed',
                error_details: 'File not eligible for lineage processing (not a data processing file)'
            });
        } else {
            console.log(`⏭️  Skipping lineage processing for file_id: ${job.file_id} (lineage_status: ${job.lineage_status})`);
        }

        // 9. Update Job and File Status
        if (isVectorOnlyJob) {
            // For vector-only jobs, we don't update the main status since it's already completed
            console.log(`Vector processing completed for job ${job.job_id}`);
        } else {
            // For documentation jobs, update status to completed
            console.log(`Updating job ${job.job_id} and file ${job.file_id} status to completed.`);
            
            const updatePayload: { status: string; lineage_status?: string; updated_at: string } = {
                status: 'completed',
                updated_at: new Date().toISOString(),
            };

            // If lineage was eligible and processed, ensure its status is marked as completed here.
            const wasLineageProcessed = shouldProcessLineage && isLineageEligible;
            if (wasLineageProcessed) {
                updatePayload.lineage_status = 'completed';
            }

            const { error: updateJobError } = await supabaseAdmin
                .from('processing_jobs')
                .update(updatePayload)
                .eq('id', job.job_id);

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
        }

        console.log(`[Info] Job ${job.job_id} processed successfully.`);

        const jobType = isVectorOnlyJob ? 'Vector-only job' : 'Documentation job';
        return new Response(JSON.stringify({ success: true, jobId: job.job_id, message: `${jobType} processed successfully` }), {
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