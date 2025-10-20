import { BaseFileParser, ParsedFile } from './FileParserService';

export class SQLParser extends BaseFileParser {
  canParse(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.sql');
  }
  
  getLanguage(): string {
    return 'sql';
  }
  
  parse(
    content: string,
    filePath: string,
    metadata: {
      repositoryId: string;
      repositoryName: string;
      organizationId: string;
    }
  ): ParsedFile {
    const parsedFile = this.createBaseParsedFile(content, filePath, metadata);
    
    if (this.options.extractComments) {
      parsedFile.comments = this.extractComments(content);
    }
    
    if (this.options.extractFunctions) {
      parsedFile.functions = this.extractFunctions(content);
    }
    
    if (this.options.extractSymbols) {
      parsedFile.symbols = this.extractTableReferences(content);
    }
    
    parsedFile.classes = this.extractCTEs(content);
    
    return parsedFile;
  }
  
  private extractComments(content: string): string {
    const comments: string[] = [];
    const singleLineRegex = /--\s*(.+)/g;
    let match;
    while ((match = singleLineRegex.exec(content)) !== null) {
      comments.push(match[1].trim());
    }
    const multiLineRegex = /\/\*[\s\S]*?\*\//g;
    while ((match = multiLineRegex.exec(content)) !== null) {
      const comment = match[0].replace(/\/\*|\*\//g, '').trim().replace(/\n/g, ' ');
      comments.push(comment);
    }
    return comments.join(' ');
  }
  
  private extractFunctions(content: string): string {
    const functions = new Set<string>();
    const createFunctionRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-z_][a-z0-9_]*)/gi;
    let match;
    while ((match = createFunctionRegex.exec(content)) !== null) {
      functions.add(match[1].toLowerCase());
    }
    const commonFunctions = /\b(COUNT|SUM|AVG|MIN|MAX|COALESCE|NULLIF|CAST|CONCAT|SUBSTRING|LENGTH|UPPER|LOWER|TRIM|DATE|EXTRACT|NOW|CASE|RANK|ROW_NUMBER|LAG|LEAD|FIRST_VALUE|LAST_VALUE)\s*\(/gi;
    while ((match = commonFunctions.exec(content)) !== null) {
      functions.add(match[1].toLowerCase());
    }
    return Array.from(functions).join(' ');
  }
  
  private extractTableReferences(content: string): string {
    const tables = new Set<string>();
    const fromRegex = /FROM\s+([a-z_][a-z0-9_.]*)/gi;
    let match;
    while ((match = fromRegex.exec(content)) !== null) {
      tables.add(match[1].toLowerCase());
    }
    const joinRegex = /JOIN\s+([a-z_][a-z0-9_.]*)/gi;
    while ((match = joinRegex.exec(content)) !== null) {
      tables.add(match[1].toLowerCase());
    }
    const insertRegex = /INSERT\s+INTO\s+([a-z_][a-z0-9_.]*)/gi;
    while ((match = insertRegex.exec(content)) !== null) {
      tables.add(match[1].toLowerCase());
    }
    const updateRegex = /UPDATE\s+([a-z_][a-z0-9_.]*)/gi;
    while ((match = updateRegex.exec(content)) !== null) {
      tables.add(match[1].toLowerCase());
    }
    const deleteRegex = /DELETE\s+FROM\s+([a-z_][a-z0-9_.]*)/gi;
    while ((match = deleteRegex.exec(content)) !== null) {
      tables.add(match[1].toLowerCase());
    }
    return Array.from(tables).join(' ');
  }
  
  private extractCTEs(content: string): string {
    const ctes = new Set<string>();
    const cteRegex = /WITH\s+([a-z_][a-z0-9_]*)\s+AS/gi;
    let match;
    while ((match = cteRegex.exec(content)) !== null) {
      ctes.add(match[1].toLowerCase());
    }
    const viewRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([a-z_][a-z0-9_.]*)/gi;
    while ((match = viewRegex.exec(content)) !== null) {
      ctes.add(match[1].toLowerCase());
    }
    const tableRegex = /CREATE\s+(?:TEMP\s+|TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_.]*)/gi;
    while ((match = tableRegex.exec(content)) !== null) {
      ctes.add(match[1].toLowerCase());
    }
    return Array.from(ctes).join(' ');
  }
}
