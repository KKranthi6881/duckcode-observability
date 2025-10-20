/**
 * File Parser Service
 * Extracts structured information from code files for Tantivy indexing
 */

export interface ParsedFile {
  file_id: string;
  organization_id: string;
  repository_id: string;
  repository_name: string;
  file_path: string;
  file_name: string;
  file_type: string;
  relative_path: string;
  
  // Content
  content: string;
  functions: string;       // Space-separated function names
  classes: string;          // Space-separated class names
  imports: string;          // Space-separated imports
  symbols: string;          // Variable names, constants
  comments: string;         // Extracted comments
  documentation: string;    // README sections, doc blocks
  
  // Metadata
  language: string;
  size_bytes: number;
  line_count: number;
  last_modified: string;    // ISO 8601 format
  
  // Flags
  is_main_file: boolean;
  is_config: boolean;
  is_test: boolean;
}

export interface ParserOptions {
  extractComments?: boolean;
  extractImports?: boolean;
  extractFunctions?: boolean;
  extractClasses?: boolean;
  extractSymbols?: boolean;
  maxContentSize?: number;   // Max chars to index (default: 100KB)
}

export abstract class BaseFileParser {
  protected options: Required<ParserOptions>;
  
  constructor(options?: ParserOptions) {
    this.options = {
      extractComments: options?.extractComments ?? true,
      extractImports: options?.extractImports ?? true,
      extractFunctions: options?.extractFunctions ?? true,
      extractClasses: options?.extractClasses ?? true,
      extractSymbols: options?.extractSymbols ?? true,
      maxContentSize: options?.maxContentSize ?? 100000, // 100KB
    };
  }
  
  /**
   * Parse a file and extract structured information
   */
  abstract parse(
    content: string,
    filePath: string,
    metadata: {
      repositoryId: string;
      repositoryName: string;
      organizationId: string;
    }
  ): ParsedFile;
  
  /**
   * Check if this parser can handle the given file
   */
  abstract canParse(filePath: string): boolean;
  
  /**
   * Get the language name
   */
  abstract getLanguage(): string;
  
  /**
   * Helper: Truncate content if too large
   */
  protected truncateContent(content: string): string {
    if (content.length > this.options.maxContentSize) {
      return content.substring(0, this.options.maxContentSize) + '\n... (truncated)';
    }
    return content;
  }
  
  /**
   * Helper: Count lines
   */
  protected countLines(content: string): number {
    return content.split('\n').length;
  }
  
  /**
   * Helper: Get file name from path
   */
  protected getFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }
  
  /**
   * Helper: Get file extension
   */
  protected getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }
  
  /**
   * Helper: Check if file is a main file
   */
  protected isMainFile(filePath: string): boolean {
    const fileName = this.getFileName(filePath).toLowerCase();
    return ['main.py', 'main.js', 'main.ts', 'index.js', 'index.ts', 
            'app.py', 'app.js', 'app.ts', '__init__.py'].includes(fileName);
  }
  
  /**
   * Helper: Check if file is a config file
   */
  protected isConfigFile(filePath: string): boolean {
    const fileName = this.getFileName(filePath).toLowerCase();
    return fileName.includes('config') || 
           ['settings.py', 'package.json', 'tsconfig.json', 
            '.env', 'webpack.config.js', 'vite.config.ts'].includes(fileName);
  }
  
  /**
   * Helper: Check if file is a test file
   */
  protected isTestFile(filePath: string): boolean {
    const lowerPath = filePath.toLowerCase();
    return lowerPath.includes('test') || 
           lowerPath.includes('spec') ||
           lowerPath.includes('__tests__');
  }
  
  /**
   * Helper: Create base parsed file object
   */
  protected createBaseParsedFile(
    content: string,
    filePath: string,
    metadata: {
      repositoryId: string;
      repositoryName: string;
      organizationId: string;
    }
  ): ParsedFile {
    const crypto = require('crypto');
    
    return {
      file_id: crypto.randomUUID(),
      organization_id: metadata.organizationId,
      repository_id: metadata.repositoryId,
      repository_name: metadata.repositoryName,
      file_path: filePath,
      file_name: this.getFileName(filePath),
      file_type: this.getFileExtension(filePath),
      relative_path: filePath,
      content: this.truncateContent(content),
      functions: '',
      classes: '',
      imports: '',
      symbols: '',
      comments: '',
      documentation: '',
      language: this.getLanguage(),
      size_bytes: Buffer.byteLength(content, 'utf8'),
      line_count: this.countLines(content),
      last_modified: new Date().toISOString(),
      is_main_file: this.isMainFile(filePath),
      is_config: this.isConfigFile(filePath),
      is_test: this.isTestFile(filePath),
    };
  }
}

/**
 * File Parser Service - Main entry point
 */
export class FileParserService {
  private parsers: BaseFileParser[] = [];
  
  /**
   * Register a parser
   */
  registerParser(parser: BaseFileParser): void {
    this.parsers.push(parser);
  }
  
  /**
   * Parse a file using the appropriate parser
   */
  parseFile(
    content: string,
    filePath: string,
    metadata: {
      repositoryId: string;
      repositoryName: string;
      organizationId: string;
    }
  ): ParsedFile | null {
    // Find appropriate parser
    const parser = this.parsers.find(p => p.canParse(filePath));
    
    if (!parser) {
      console.log(`No parser found for file: ${filePath}`);
      return null;
    }
    
    try {
      return parser.parse(content, filePath, metadata);
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error);
      return null;
    }
  }
  
  /**
   * Parse multiple files
   */
  parseFiles(
    files: Array<{
      content: string;
      filePath: string;
    }>,
    metadata: {
      repositoryId: string;
      repositoryName: string;
      organizationId: string;
    }
  ): ParsedFile[] {
    const results: ParsedFile[] = [];
    
    for (const file of files) {
      const parsed = this.parseFile(file.content, file.filePath, metadata);
      if (parsed) {
        results.push(parsed);
      }
    }
    
    return results;
  }
  
  /**
   * Get supported file types
   */
  getSupportedFileTypes(): string[] {
    const types = new Set<string>();
    
    // Query each parser for supported extensions
    for (const parser of this.parsers) {
      // This is a simple heuristic - in practice you'd query the parser
      if (parser.getLanguage() === 'sql') types.add('.sql');
      if (parser.getLanguage() === 'python') types.add('.py');
      if (parser.getLanguage() === 'javascript') types.add('.js');
      if (parser.getLanguage() === 'typescript') types.add('.ts');
      if (parser.getLanguage() === 'typescript') types.add('.tsx');
      if (parser.getLanguage() === 'javascript') types.add('.jsx');
    }
    
    return Array.from(types);
  }
}
