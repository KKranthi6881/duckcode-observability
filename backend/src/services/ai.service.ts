import OpenAI from 'openai';
import dotenv from 'dotenv';

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
}

/**
 * Generates an AI-powered summary of code content
 * @param fileContent The content of the code file
 * @param filePath The path of the file for context
 * @param language The programming language of the file
 * @returns Promise<CodeSummary> The generated summary
 */
export const generateCodeSummary = async (
  fileContent: string,
  filePath: string,
  language: string
): Promise<CodeSummary> => {
  try {
    console.log(`[AIService] Generating summary for ${filePath} (${language})`);

    const prompt = `Analyze the following ${language} code file and provide a comprehensive summary in JSON format.

File: ${filePath}
Language: ${language}

Code:
\`\`\`${language}
${fileContent}
\`\`\`

Please provide a JSON response with the following structure:
{
  "summary": "Brief one-sentence description of what this code does",
  "dependencies": ["list", "of", "dependencies", "or", "imports"],
  "description": "Detailed explanation of the code's purpose, functionality, and key components",
  "functions": ["list", "of", "main", "functions"],
  "classes": ["list", "of", "classes"],
  "keyInsights": ["important", "patterns", "or", "insights"]
}

Focus on:
- What the code does and its purpose
- Key functions, classes, and methods
- Dependencies and imports
- Important patterns or architectural decisions
- Any notable features or complexity`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a senior software engineer analyzing code. Provide accurate, concise summaries in valid JSON format only. Do not include any text outside the JSON response.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    // Parse the JSON response
    let parsedSummary: CodeSummary;
    try {
      parsedSummary = JSON.parse(content);
    } catch (parseError) {
      console.error(`[AIService] Failed to parse OpenAI response as JSON:`, content);
      // Fallback summary if JSON parsing fails
      parsedSummary = {
        summary: `Code analysis for ${filePath}`,
        dependencies: [],
        description: content.substring(0, 500) + '...',
      };
    }

    console.log(`[AIService] Successfully generated summary for ${filePath}`);
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
