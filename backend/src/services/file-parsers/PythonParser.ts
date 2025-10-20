import { BaseFileParser, ParsedFile } from './FileParserService';

export class PythonParser extends BaseFileParser {
  canParse(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.py');
  }
  
  getLanguage(): string {
    return 'python';
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
      parsedFile.documentation = this.extractDocstrings(content);
    }
    
    if (this.options.extractFunctions) {
      parsedFile.functions = this.extractFunctions(content);
    }
    
    if (this.options.extractClasses) {
      parsedFile.classes = this.extractClasses(content);
    }
    
    if (this.options.extractImports) {
      parsedFile.imports = this.extractImports(content);
    }
    
    if (this.options.extractSymbols) {
      parsedFile.symbols = this.extractVariables(content);
    }
    
    return parsedFile;
  }
  
  private extractComments(content: string): string {
    const comments: string[] = [];
    const commentRegex = /#\s*(.+)/g;
    let match;
    while ((match = commentRegex.exec(content)) !== null) {
      comments.push(match[1].trim());
    }
    return comments.join(' ');
  }
  
  private extractDocstrings(content: string): string {
    const docstrings: string[] = [];
    const docstringRegex = /(?:"""|''')[\s\S]*?(?:"""|''')/g;
    let match;
    while ((match = docstringRegex.exec(content)) !== null) {
      const docstring = match[0].replace(/"""|'''/g, '').trim().replace(/\n/g, ' ');
      docstrings.push(docstring);
    }
    return docstrings.join(' ');
  }
  
  private extractFunctions(content: string): string {
    const functions = new Set<string>();
    const functionRegex = /def\s+([a-z_][a-z0-9_]*)\s*\(/gi;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      functions.add(match[1]);
    }
    const asyncFunctionRegex = /async\s+def\s+([a-z_][a-z0-9_]*)\s*\(/gi;
    while ((match = asyncFunctionRegex.exec(content)) !== null) {
      functions.add(match[1]);
    }
    return Array.from(functions).join(' ');
  }
  
  private extractClasses(content: string): string {
    const classes = new Set<string>();
    const classRegex = /class\s+([A-Z][a-zA-Z0-9_]*)/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.add(match[1]);
    }
    return Array.from(classes).join(' ');
  }
  
  private extractImports(content: string): string {
    const imports = new Set<string>();
    const importRegex = /import\s+([a-z_][a-z0-9_.]*)/gi;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }
    const fromImportRegex = /from\s+([a-z_][a-z0-9_.]*)\s+import/gi;
    while ((match = fromImportRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }
    return Array.from(imports).join(' ');
  }
  
  private extractVariables(content: string): string {
    const variables = new Set<string>();
    const variableRegex = /^([a-z_][a-z0-9_]*)\s*=/gmi;
    let match;
    while ((match = variableRegex.exec(content)) !== null) {
      const varName = match[1];
      if (!['if', 'for', 'while', 'def', 'class', 'return'].includes(varName.toLowerCase())) {
        variables.add(varName);
      }
    }
    const constantRegex = /^([A-Z_][A-Z0-9_]*)\s*=/gm;
    while ((match = constantRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }
    return Array.from(variables).join(' ');
  }
}
