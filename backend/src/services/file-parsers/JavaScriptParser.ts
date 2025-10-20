import { BaseFileParser, ParsedFile } from './FileParserService';

export class JavaScriptParser extends BaseFileParser {
  canParse(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    return lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.jsx') || lower.endsWith('.tsx');
  }
  
  getLanguage(): string {
    const ext = this.getFileExtension('');
    return ext === 'ts' || ext === 'tsx' ? 'typescript' : 'javascript';
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
      parsedFile.documentation = this.extractJSDoc(content);
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
    const singleLineRegex = /\/\/\s*(.+)/g;
    let match;
    while ((match = singleLineRegex.exec(content)) !== null) {
      comments.push(match[1].trim());
    }
    const multiLineRegex = /\/\*(?!\*)[\s\S]*?\*\//g;
    while ((match = multiLineRegex.exec(content)) !== null) {
      const comment = match[0].replace(/\/\*|\*\//g, '').trim().replace(/\n/g, ' ');
      comments.push(comment);
    }
    return comments.join(' ');
  }
  
  private extractJSDoc(content: string): string {
    const jsdocs: string[] = [];
    const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;
    let match;
    while ((match = jsdocRegex.exec(content)) !== null) {
      const jsdoc = match[0].replace(/\/\*\*|\*\//g, '').replace(/\n\s*\*\s?/g, ' ').trim();
      jsdocs.push(jsdoc);
    }
    return jsdocs.join(' ');
  }
  
  private extractFunctions(content: string): string {
    const functions = new Set<string>();
    const functionRegex = /function\s+([a-z_$][a-z0-9_$]*)\s*\(/gi;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      functions.add(match[1]);
    }
    const constFunctionRegex = /const\s+([a-z_$][a-z0-9_$]*)\s*=\s*function/gi;
    while ((match = constFunctionRegex.exec(content)) !== null) {
      functions.add(match[1]);
    }
    const arrowFunctionRegex = /const\s+([a-z_$][a-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/gi;
    while ((match = arrowFunctionRegex.exec(content)) !== null) {
      functions.add(match[1]);
    }
    const asyncFunctionRegex = /async\s+function\s+([a-z_$][a-z0-9_$]*)\s*\(/gi;
    while ((match = asyncFunctionRegex.exec(content)) !== null) {
      functions.add(match[1]);
    }
    const methodRegex = /([a-z_$][a-z0-9_$]*)\s*\([^)]*\)\s*{/gi;
    while ((match = methodRegex.exec(content)) !== null) {
      const methodName = match[1];
      if (!['if', 'for', 'while', 'switch', 'catch'].includes(methodName.toLowerCase())) {
        functions.add(methodName);
      }
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
    const interfaceRegex = /interface\s+([A-Z][a-zA-Z0-9_]*)/g;
    while ((match = interfaceRegex.exec(content)) !== null) {
      classes.add(match[1]);
    }
    const typeRegex = /type\s+([A-Z][a-zA-Z0-9_]*)\s*=/g;
    while ((match = typeRegex.exec(content)) !== null) {
      classes.add(match[1]);
    }
    const enumRegex = /enum\s+([A-Z][a-zA-Z0-9_]*)/g;
    while ((match = enumRegex.exec(content)) !== null) {
      classes.add(match[1]);
    }
    return Array.from(classes).join(' ');
  }
  
  private extractImports(content: string): string {
    const imports = new Set<string>();
    const importFromRegex = /import\s+(?:{[^}]+}|[^;]+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importFromRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }
    const importRegex = /import\s+['"]([^'"]+)['"]/g;
    while ((match = importRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }
    return Array.from(imports).join(' ');
  }
  
  private extractVariables(content: string): string {
    const variables = new Set<string>();
    const variableRegex = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;
    let match;
    while ((match = variableRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }
    const constantRegex = /(?:const|let|var)\s+([A-Z_$][A-Z0-9_$]*)\s*=/g;
    while ((match = constantRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }
    return Array.from(variables).join(' ');
  }
}
