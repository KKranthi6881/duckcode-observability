/**
 * File Parsers - Export and Factory
 */

export { FileParserService, ParsedFile, ParserOptions, BaseFileParser } from './FileParserService';
export { SQLParser } from './SQLParser';
export { PythonParser } from './PythonParser';
export { JavaScriptParser } from './JavaScriptParser';

import { FileParserService } from './FileParserService';
import { SQLParser } from './SQLParser';
import { PythonParser } from './PythonParser';
import { JavaScriptParser } from './JavaScriptParser';

/**
 * Create a fully configured FileParserService with all parsers registered
 */
export function createFileParserService(): FileParserService {
  const service = new FileParserService();
  
  // Register all parsers
  service.registerParser(new SQLParser());
  service.registerParser(new PythonParser());
  service.registerParser(new JavaScriptParser());
  
  return service;
}

/**
 * Singleton instance
 */
let instance: FileParserService | null = null;

export function getFileParserService(): FileParserService {
  if (!instance) {
    instance = createFileParserService();
  }
  return instance;
}
