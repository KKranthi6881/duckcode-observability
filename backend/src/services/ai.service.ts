import OpenAI from 'openai';
import dotenv from 'dotenv';
import { getSystemPrompt } from '../prompts/promptManager';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CodeSummary {
  summary: string;
  dependencies: string[];
  description: string;
  functions?: string[];
  classes?: string[];
  keyInsights?: string[];
  
  // Rich structured fields for detailed documentation
  business_logic?: {
    main_objectives?: string[];
    data_transformation?: string;
    stakeholder_impact?: string;
    kpis_affected?: string[];
  };
  
  technical_details?: {
    materialization?: string;
    source_tables?: string[];
    sql_operations?: string[];
    jinja_macros?: string[];
    incremental_strategy?: string;
    performance_optimizations?: string[];
  };
  
  code_blocks?: Array<{
    section: string;
    code: string;
    explanation: string;
    business_context: string;
  }>;
  
  dbt_project_context?: {
    dependencies?: string[];
    lineage?: string[];
    project_structure?: string;
    testing_strategy?: string;
  };
  
  // Generic structured fields for other languages
  best_practices?: string[];
  program_flow?: string[];
  error_handling?: string[];
  security_considerations?: string[];
}

/**
 * Generates an AI-powered summary of code content using language-specific prompts
 * @param fileContent The content of the code file
 * @param filePath The path of the file for context
 * @param language The programming language of the file
 * @param selectedLanguage Optional: User-selected language for specialized analysis
 * @returns Promise<CodeSummary> The generated summary
 */
export const generateCodeSummary = async (
  fileContent: string,
  filePath: string,
  language: string,
  selectedLanguage?: string
): Promise<CodeSummary> => {
  try {
    console.log(`[AIService] Generating summary for ${filePath} (file language: ${language})`);
    if (selectedLanguage) {
      console.log(`[AIService] User selected analysis type: ${selectedLanguage}`);
    }
    
    // Use selected language if provided, otherwise use detected language
    const analysisLanguage = selectedLanguage || language;
    console.log(`[AIService] Using specialized prompt for language: ${analysisLanguage}`);
    
    // Get the specialized system prompt for this language
    const systemPrompt = getSystemPrompt(analysisLanguage);
    
    // Log prompt details to verify correct one is being used
    const promptPreview = systemPrompt.substring(0, 150) + '...';
    console.log(`[AIService] Prompt preview: ${promptPreview}`);
    
    // Create the user prompt with file context
    const userPrompt = `File: ${filePath}
Language: ${language}
${selectedLanguage ? `User Selected Analysis Type: ${selectedLanguage}` : ''}

Code to analyze:
\`\`\`${language}
${fileContent}
\`\`\`

Please provide a comprehensive analysis following the JSON structure specified in your system prompt.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_tokens: 2000, // Increased for more detailed analysis
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    // Parse the JSON response
    let parsedSummary: CodeSummary;
    try {
      parsedSummary = JSON.parse(content);
      console.log(`[AIService] Successfully generated ${analysisLanguage}-specific summary for ${filePath}`);
      console.log(`[AIService] Summary structure keys:`, Object.keys(parsedSummary));
      
      // Log if we have rich dbt structure
      if (selectedLanguage === 'dbt' && parsedSummary) {
        console.log(`[AIService] dbt-specific fields present:`, {
          hasCodeBlocks: !!parsedSummary.code_blocks,
          hasBusinessLogic: !!parsedSummary.business_logic,
          hasTechnicalDetails: !!parsedSummary.technical_details,
          hasDbtProjectContext: !!parsedSummary.dbt_project_context
        });
      }
      console.log(`[AIService] Full AI response structure:`, parsedSummary);
    } catch (parseError) {
      console.error(`[AIService] Failed to parse OpenAI response as JSON:`, content);
      // Fallback summary if JSON parsing fails
      parsedSummary = {
        summary: `${analysisLanguage} code analysis for ${filePath}`,
        dependencies: [],
        description: content.substring(0, 500) + '...',
      };
    }

    return parsedSummary;

  } catch (error: any) {
    console.error(`[AIService] Error generating summary for ${filePath}:`, error);
    
    // Return a fallback summary instead of throwing
    return {
      summary: `Unable to analyze ${filePath} - ${error.message}`,
      dependencies: [],
      description: `Error occurred while analyzing this ${language} file: ${error.message}`,
    };
  }
};

/**
 * Checks if OpenAI API is properly configured
 * @returns boolean indicating if the service is ready
 */
export const isAIServiceReady = (): boolean => {
  return !!process.env.OPENAI_API_KEY;
};

/**
 * Gets the file content from GitHub using Octokit
 * @param octokit Authenticated Octokit instance
 * @param owner Repository owner
 * @param repo Repository name
 * @param filePath Path to the file
 * @returns Promise<string> The decoded file content
 */
export const getFileContentFromGitHub = async (
  octokit: any,
  owner: string,
  repo: string,
  filePath: string
): Promise<string> => {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
    });

    // Handle if it's an array (directory) - shouldn't happen for files
    if (Array.isArray(data)) {
      throw new Error(`Path ${filePath} is a directory, not a file`);
    }

    // Decode base64 content
    if (data.encoding === 'base64' && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    throw new Error(`Unsupported encoding: ${data.encoding}`);
  } catch (error: any) {
    console.error(`[AIService] Error fetching file content for ${filePath}:`, error);
    throw error;
  }
};
