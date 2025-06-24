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
            return await callOpenAIWithSystemPrompt(getSystemPrompt(prompt), prompt, params);
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
        model: 'gpt-4.1-mini',
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
        return jsonData;
    } catch (parseError) {
        console.error(`Failed to parse JSON response from OpenAI:`, parseError, `Response text: ${responseBodyText}`);
        throw new Error(`Failed to parse JSON response from OpenAI. Raw response: ${responseBodyText}`);
    }
}

// Add the specialized prompts object (matching codeSummary.prompts.ts)
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
      "storage_engines": ["InnoDB, MyISAM, or other storage engine specifics"]
    },
    "code_blocks": [
      {
        "section": "Section name (e.g., 'Main Query', 'Subquery', 'Join Logic')",
        "code": "Actual code snippet", 
        "explanation": "Detailed explanation of what this code does",
        "business_context": "Why this operation matters for business"
      }
    ],
    "execution_flow": ["Step-by-step breakdown of query execution"],
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
  
  Focus on PostgreSQL best practices, performance optimization, and business impact.`,

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
        "section": "Section name (e.g., 'Source Selection', 'Business Logic', 'Final Transformation')",
        "code": "Actual code snippet",
        "explanation": "Detailed explanation of what this code does",
        "business_context": "Why this transformation matters for business"
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
        "section": "Section name (e.g., 'Main Query', 'Subquery', 'Join Logic')",
        "code": "Actual code snippet", 
        "explanation": "Detailed explanation of what this code does",
        "business_context": "Why this operation matters for business"
      }
    ],
    "execution_flow": ["Step-by-step breakdown of query execution"],
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
  
  Focus on MySQL best practices, performance optimization, and business impact.`,

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
      "data_transformation": "Description of how data is transformed or processed",
      "business_rules": ["Key business rules implemented"],
      "stakeholder_impact": "Who uses this code and how"
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
        "section": "Section name",
        "code": "Actual code snippet",
        "explanation": "Detailed explanation of what this code does",
        "business_context": "Why this code matters for business"
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
        "section": "Section name",
        "code": "Actual code snippet",
        "explanation": "Detailed explanation of what this code does",
        "business_context": "Why this functionality matters for business"
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
  
  Focus on Python best practices, software engineering principles, and clean code architecture.`,

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
        "section": "Section name (e.g., 'Input Validation', 'Core Logic', 'Output Processing')",
        "code": "Actual code snippet",
        "explanation": "Detailed explanation of what this code does", 
        "business_context": "Why this functionality matters for business"
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

// Function to get system prompt based on user-selected language
function getSystemPrompt(selectedLanguage: string): string {
    // Use the user's selected language directly (no mapping needed)
    // since job.analysis_language already contains their choice from the dropdown
    const languageKey = selectedLanguage?.toLowerCase();
    return specializedPrompts[languageKey] || specializedPrompts.default;
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

        // 4. Get System Prompt based on file language
        console.log(`Getting system prompt for language: ${fileRecord.language}`);
        const systemPrompt = getSystemPrompt(fileRecord.language);
        
        // 5. Construct user message with file details
        const userMessage = `Please analyze the following code file:

File Path: ${fileRecord.file_path}
Language: ${fileRecord.language}

\`\`\`${fileRecord.language}
${fileContent}
\`\`\`

Provide a comprehensive analysis in the requested JSON format.`;

        // 6. Call OpenAI with system and user messages
        console.log(`Sending request to OpenAI GPT-4.1-mini`);
        const llmResponse = await callOpenAIWithSystemPrompt(systemPrompt, userMessage);
        console.log("OpenAI API call successful.");

        // 7. Store Results
        console.log(`Storing LLM summary for file_id: ${job.file_id}`);
        const { data: summaryData, error: summaryError } = await supabaseAdmin
            .from('code_summaries') // Will use 'code_insights.code_summaries'
            .upsert({
                job_id: job.id, // Add the job_id here
                file_id: job.file_id,
                summary_json: llmResponse,
                llm_provider: 'openai',
                llm_model_name: 'gpt-4.1-mini',
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