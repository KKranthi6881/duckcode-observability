/**
 * DBT Parser Service
 * Extracts metadata from DBT projects
 */
export class DBTParserService {
  
  async parseDBTProject(filePath: string, content: string): Promise<any> {
    const objects: any[] = [];
    
    if (filePath.includes('dbt_project.yml')) {
      // Parse project configuration
      return this.parseProjectConfig(content);
    }
    
    if (filePath.includes('/models/') && filePath.endsWith('.sql')) {
      // Parse DBT model
      return this.parseDBTModel(filePath, content);
    }
    
    return { objects, parserUsed: 'dbt', confidence: 0.85 };
  }

  private parseProjectConfig(content: string): any {
    return {
      objects: [],
      parserUsed: 'dbt-config',
      confidence: 0.9
    };
  }

  private parseDBTModel(filePath: string, content: string): any {
    const modelName = filePath.split('/').pop()?.replace('.sql', '') || 'unknown';
    
    // Extract ref() calls
    const refs = this.extractRefs(content);
    
    // Extract source() calls  
    const sources = this.extractSources(content);
    
    return {
      objects: [{
        name: modelName,
        object_type: 'dbt_model',
        definition: content,
        dependencies: [...refs, ...sources],
        confidence: 0.85
      }],
      parserUsed: 'dbt-model',
      confidence: 0.85
    };
  }

  private extractRefs(content: string): string[] {
    const refs: string[] = [];
    const refRegex = /\{\{\s*ref\(['"]([\w_]+)['"]\)\s*\}\}/g;
    let match;
    
    while ((match = refRegex.exec(content)) !== null) {
      refs.push(match[1]);
    }
    
    return refs;
  }

  private extractSources(content: string): string[] {
    const sources: string[] = [];
    const sourceRegex = /\{\{\s*source\(['"]([\w_]+)['"]\s*,\s*['"]([\w_]+)['"]\)\s*\}\}/g;
    let match;
    
    while ((match = sourceRegex.exec(content)) !== null) {
      sources.push(`${match[1]}.${match[2]}`);
    }
    
    return sources;
  }
}
