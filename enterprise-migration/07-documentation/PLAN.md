# Phase 7: Auto-Documentation & AI Verification

## 🎯 Objective
Implement automated documentation generation with AI-powered metadata verification and quality scoring - ensuring metadata accuracy and completeness.

## 🏗️ Architecture

### Auto-Documentation Flow
```
Metadata Extraction → AI Enhancement → Quality Scoring → Documentation Generation
                            ↓
                    Verification Loop
                            ↓
                  Suggest Corrections
```

## 📊 Components

### 1. Documentation Generator

#### Table/Column Descriptions
```typescript
class DocumentationGenerator {
  async generateTableDescription(
    tableName: string,
    columns: Column[],
    sampleData?: any[]
  ): Promise<string> {
    const prompt = `
      Analyze this database table and generate a concise description:
      
      Table: ${tableName}
      Columns: ${columns.map(c => `${c.name} (${c.dataType})`).join(', ')}
      Sample Data: ${JSON.stringify(sampleData?.slice(0, 3))}
      
      Generate a 1-2 sentence description of what this table stores.
    `;
    
    const description = await aiService.complete(prompt);
    return description;
  }
  
  async generateColumnDescription(
    tableName: string,
    columnName: string,
    dataType: string,
    sampleValues: any[]
  ): Promise<string> {
    const prompt = `
      Generate a description for this database column:
      
      Table: ${tableName}
      Column: ${columnName}
      Type: ${dataType}
      Sample Values: ${sampleValues.join(', ')}
      
      Provide a brief description of what this column represents.
    `;
    
    const description = await aiService.complete(prompt);
    return description;
  }
}
```

#### SQL Query Documentation
```typescript
async function documentSQLQuery(query: string): Promise<QueryDocumentation> {
  const prompt = `
    Analyze this SQL query and provide documentation:
    
    ${query}
    
    Generate:
    1. Purpose: What does this query do?
    2. Input tables: Which tables are being read?
    3. Output: What does the result contain?
    4. Business logic: Any transformations or calculations?
    5. Performance notes: Any performance considerations?
  `;
  
  const docs = await aiService.complete(prompt);
  return parseDocumentation(docs);
}
```

### 2. AI Metadata Verification

#### Verification Service
```typescript
class MetadataVerificationService {
  async verifyTableMetadata(table: ParsedObject): Promise<VerificationResult> {
    // Step 1: Verify table definition is valid SQL
    const syntaxCheck = await this.verifySyntax(table.definition);
    
    // Step 2: Check column consistency
    const columnCheck = await this.verifyColumns(table);
    
    // Step 3: Verify dependencies are correct
    const dependencyCheck = await this.verifyDependencies(table);
    
    // Step 4: AI-powered semantic verification
    const semanticCheck = await this.verifySemantics(table);
    
    return {
      isValid: syntaxCheck.valid && columnCheck.valid && dependencyCheck.valid,
      confidence: semanticCheck.confidence,
      issues: [
        ...syntaxCheck.issues,
        ...columnCheck.issues,
        ...dependencyCheck.issues,
        ...semanticCheck.issues,
      ],
      suggestions: semanticCheck.suggestions,
    };
  }
  
  private async verifySemantics(table: ParsedObject): Promise<SemanticCheck> {
    const prompt = `
      Verify this SQL object definition for correctness:
      
      Name: ${table.name}
      Type: ${table.objectType}
      Definition:
      ${table.definition}
      
      Columns: ${table.columns?.map(c => c.name).join(', ')}
      
      Check for:
      1. Naming conventions (snake_case, meaningful names)
      2. Data type appropriateness
      3. Missing indexes or constraints
      4. Potential performance issues
      5. Business logic correctness
      
      Provide:
      - Confidence score (0-1)
      - List of issues found
      - Suggestions for improvement
    `;
    
    const result = await aiService.complete(prompt);
    return parseSemanticCheck(result);
  }
}
```

### 3. Quality Scoring System

#### Metadata Quality Metrics
```typescript
interface QualityScore {
  overall: number; // 0-100
  completeness: number; // Has all required fields?
  accuracy: number; // AI verification confidence
  consistency: number; // Naming conventions, patterns
  documentation: number; // Has descriptions?
  lineage: number; // Dependencies mapped?
}

class QualityScorer {
  calculateQualityScore(object: ParsedObject): QualityScore {
    const completeness = this.scoreCompleteness(object);
    const accuracy = this.scoreAccuracy(object);
    const consistency = this.scoreConsistency(object);
    const documentation = this.scoreDocumentation(object);
    const lineage = this.scoreLineage(object);
    
    const overall = (
      completeness * 0.2 +
      accuracy * 0.3 +
      consistency * 0.15 +
      documentation * 0.15 +
      lineage * 0.2
    );
    
    return {
      overall: Math.round(overall),
      completeness,
      accuracy,
      consistency,
      documentation,
      lineage,
    };
  }
  
  private scoreCompleteness(object: ParsedObject): number {
    let score = 0;
    const maxScore = 100;
    
    // Has name? +20
    if (object.name) score += 20;
    
    // Has type? +20
    if (object.objectType) score += 20;
    
    // Has definition? +20
    if (object.definition) score += 20;
    
    // Has columns? +20
    if (object.columns && object.columns.length > 0) score += 20;
    
    // Columns have data types? +20
    if (object.columns?.every(c => c.dataType)) score += 20;
    
    return Math.min(score, maxScore);
  }
  
  private scoreDocumentation(object: ParsedObject): number {
    let score = 0;
    
    // Has table description? +50
    if (object.metadata?.description) score += 50;
    
    // Has column descriptions? +50
    const columnsWithDesc = object.columns?.filter(c => c.description).length || 0;
    const totalColumns = object.columns?.length || 1;
    score += (columnsWithDesc / totalColumns) * 50;
    
    return Math.round(score);
  }
}
```

### 4. Documentation Templates

#### Table Documentation Template
```markdown
# ${table.name}

**Type**: ${table.objectType}
**Schema**: ${table.schemaName}
**Quality Score**: ${qualityScore.overall}/100

## Description
${table.description || 'No description available'}

## Columns
| Column | Type | Nullable | Primary Key | Description |
|--------|------|----------|-------------|-------------|
${columns.map(c => `| ${c.name} | ${c.dataType} | ${c.isNullable} | ${c.isPrimaryKey} | ${c.description || '-'} |`).join('\n')}

## Dependencies
### Upstream (Source Tables)
${upstreamDeps.map(d => `- ${d.name}`).join('\n')}

### Downstream (Consuming Tables)
${downstreamDeps.map(d => `- ${d.name}`).join('\n')}

## Sample Data
${sampleData}

## Lineage Diagram
${mermaidDiagram}

## Quality Metrics
- **Completeness**: ${qualityScore.completeness}%
- **Accuracy**: ${qualityScore.accuracy}%
- **Documentation**: ${qualityScore.documentation}%

## Last Updated
${table.updatedAt}
```

### 5. AI-Powered Suggestions

#### Suggestion Engine
```typescript
class SuggestionEngine {
  async generateSuggestions(object: ParsedObject): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    // Missing descriptions
    if (!object.metadata?.description) {
      suggestions.push({
        type: 'missing_description',
        severity: 'medium',
        message: 'Table description is missing',
        action: 'Generate description using AI',
        autoFixAvailable: true,
      });
    }
    
    // Inconsistent naming
    if (!this.followsNamingConvention(object.name)) {
      suggestions.push({
        type: 'naming_convention',
        severity: 'low',
        message: `Table name '${object.name}' doesn't follow snake_case convention`,
        action: `Suggested name: ${this.suggestName(object.name)}`,
        autoFixAvailable: false,
      });
    }
    
    // Missing indexes on foreign keys
    const missingIndexes = this.findMissingIndexes(object);
    if (missingIndexes.length > 0) {
      suggestions.push({
        type: 'performance',
        severity: 'high',
        message: 'Foreign keys without indexes detected',
        action: `Add indexes on: ${missingIndexes.join(', ')}`,
        autoFixAvailable: false,
      });
    }
    
    // AI-powered suggestions
    const aiSuggestions = await this.getAISuggestions(object);
    suggestions.push(...aiSuggestions);
    
    return suggestions;
  }
  
  private async getAISuggestions(object: ParsedObject): Promise<Suggestion[]> {
    const prompt = `
      Review this database object and suggest improvements:
      
      ${JSON.stringify(object, null, 2)}
      
      Suggest improvements for:
      1. Data types (are they appropriate?)
      2. Constraints (missing NOT NULL, CHECK constraints?)
      3. Normalization (any denormalization issues?)
      4. Performance (missing indexes?)
      5. Documentation (what's missing?)
      
      Format as JSON array of suggestions.
    `;
    
    const result = await aiService.complete(prompt);
    return JSON.parse(result);
  }
}
```

### 6. Documentation API

#### Endpoints
```typescript
// Get documentation for an object
GET /api/documentation/objects/:objectId
Response: {
  object: ParsedObject,
  documentation: string, // Markdown
  qualityScore: QualityScore,
  suggestions: Suggestion[],
  lineageDiagram: string, // Mermaid syntax
}

// Generate documentation
POST /api/documentation/objects/:objectId/generate
Request: {
  includeLineage: boolean,
  includeSampleData: boolean,
  aiEnhancement: boolean,
}
Response: {
  documentation: string,
  qualityScore: QualityScore,
}

// Apply AI suggestions
POST /api/documentation/objects/:objectId/apply-suggestions
Request: {
  suggestionIds: string[],
}
Response: {
  applied: number,
  failed: number,
  errors: string[],
}
```

## 🔄 Workflow Integration

### Automatic Documentation on Extraction
```typescript
// After metadata extraction
await metadataExtractor.extractMetadata(connector);

// Trigger documentation generation
await documentationService.generateForNewObjects(organizationId);

// Run quality checks
await qualityService.scoreAllObjects(organizationId);

// Generate suggestions
await suggestionService.analyzeTables(organizationId);

// Notify admins of low-quality objects
await notifyLowQualityObjects(organizationId);
```

### Continuous Improvement Loop
```
Extract Metadata → AI Verification → Quality Score → Suggestions
                                                           ↓
                                                    Admin Reviews
                                                           ↓
                                                  Apply Improvements
                                                           ↓
                                                    Re-score Quality
```

## ✅ Acceptance Criteria

- [ ] AI generates accurate table/column descriptions
- [ ] Quality scoring system rates all metadata
- [ ] Verification service detects incorrect metadata
- [ ] Suggestions provided for improvement
- [ ] Documentation auto-generated in Markdown
- [ ] Lineage diagrams included in docs
- [ ] Documentation accessible via API and UI
- [ ] Low-quality objects flagged for review
- [ ] AI suggestions can be applied automatically

## 🚀 Future Enhancements

### Natural Language Queries
```typescript
// User asks: "Show me tables related to customer orders"
const results = await nlQueryService.search("customer orders");
```

### Automated Data Cataloging
- Auto-tagging with AI (PII detection, domain classification)
- Business glossary mapping
- Data quality rules generation
