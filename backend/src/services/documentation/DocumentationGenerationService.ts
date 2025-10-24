/**
 * AI Documentation Generation Service
 * Generates multi-layer business documentation using GPT-4o
 */

import OpenAI from 'openai';
import { supabaseAdmin } from '../../config/supabase';
import { decryptAPIKey } from '../../utils/encryption';
import {
  DocumentationLayers,
  ObjectMetadata,
  APIKeyConfig,
  BusinessNarrative,
  TransformationCard,
  CodeExplanation,
  BusinessRule,
  ImpactAnalysis,
  DocumentationGenerationError,
  APIKeyNotFoundError,
  RateLimitError,
  LayerName,
} from './types';

export class DocumentationGenerationService {
  private openai: OpenAI | null = null;
  private organizationId: string;
  private modelName: string = 'gpt-5-chat-latest'; // Latest model used in duck-code IDE

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  /**
   * Initialize OpenAI client with organization's API key
   */
  async initialize(): Promise<void> {
    try {
      const apiKey = await this.getOrganizationAPIKey('openai');
      
      this.openai = new OpenAI({
        apiKey: apiKey,
      });

      console.log(`[DocGen] Initialized OpenAI client for org: ${this.organizationId}`);
    } catch (error) {
      console.error('[DocGen] Failed to initialize OpenAI client:', error);
      throw error;
    }
  }

  /**
   * Fetch and decrypt organization's API key
   */
  private async getOrganizationAPIKey(provider: string): Promise<string> {
    const { data, error } = await supabaseAdmin
      .schema('enterprise')
      .from('organization_api_keys')
      .select('encrypted_key, encryption_iv, encryption_auth_tag, is_default, status')
      .eq('organization_id', this.organizationId)
      .eq('provider', provider)
      .eq('status', 'active')
      .eq('is_default', true)
      .single();

    if (error || !data) {
      throw new APIKeyNotFoundError(this.organizationId, provider);
    }

    // Decrypt the API key
    const decryptedKey = decryptAPIKey(
      data.encrypted_key,
      data.encryption_iv,
      data.encryption_auth_tag
    );

    return decryptedKey;
  }

  /**
   * Fetch object metadata from database
   */
  async fetchObjectMetadata(objectId: string): Promise<ObjectMetadata> {
    // Fetch basic object data
    const { data, error } = await supabaseAdmin
      .schema('metadata')
      .from('objects')
      .select('*')
      .eq('id', objectId)
      .single();

    if (error || !data) {
      throw new Error(`Failed to fetch object metadata: ${error?.message}`);
    }

    // Fetch columns separately
    const { data: columns } = await supabaseAdmin
      .schema('metadata')
      .from('columns')
      .select('*')
      .eq('object_id', objectId);

    // Fetch dependencies separately
    const { data: dependencies } = await supabaseAdmin
      .schema('metadata')
      .from('dependencies')
      .select('*, depends_on:objects!depends_on_id(name, full_name)')
      .eq('object_id', objectId);

    // Fetch file info separately
    const { data: file } = await supabaseAdmin
      .schema('metadata')
      .from('files')
      .select('relative_path, file_type, dialect')
      .eq('id', data.file_id)
      .single();

    // Combine all data
    const objectData: any = {
      ...data,
      columns: columns || [],
      dependencies: dependencies || [],
      file: file,
    };

    return objectData as any;
  }

  /**
   * Generate complete documentation for an object
   */
  async generateDocumentationForObject(objectId: string): Promise<DocumentationLayers> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    console.log(`[DocGen] Generating documentation for object: ${objectId}`);

    // Fetch object metadata
    const objectData = await this.fetchObjectMetadata(objectId);
    console.log(`[DocGen] Fetched metadata for: ${objectData.name}`);

    // Generate each layer
    const layers: Partial<DocumentationLayers> = {};

    try {
      // Layer 1: Executive Summary
      layers.executiveSummary = await this.generateExecutiveSummary(objectData);
      
      // Layer 2: Business Narrative
      layers.businessNarrative = await this.generateBusinessNarrative(objectData);
      
      // Layer 3: Transformation Cards
      layers.transformationCards = await this.generateTransformationCards(objectData);
      
      // Layer 4: Code Explanations
      layers.codeExplanations = await this.generateCodeExplanations(objectData);
      
      // Additional analyses
      layers.businessRules = await this.extractBusinessRules(objectData);
      layers.impactAnalysis = await this.generateImpactAnalysis(objectData);
      
      // Calculate complexity score
      layers.complexityScore = this.calculateComplexityScore(objectData);

      const duration = Date.now() - startTime;
      console.log(`[DocGen] Completed documentation for ${objectData.name} in ${duration}ms`);

      return layers as DocumentationLayers;
    } catch (error: any) {
      console.error(`[DocGen] Error generating documentation for ${objectData.name}:`, error);
      throw new DocumentationGenerationError(
        `Failed to generate documentation: ${error?.message || 'Unknown error'}`,
        undefined,
        objectId,
        error
      );
    }
  }

  /**
   * Layer 1: Generate Executive Summary
   */
  private async generateExecutiveSummary(objectData: ObjectMetadata): Promise<string> {
    const prompt = `You are a business documentation expert. Generate a concise executive summary for this data model.

OBJECT DETAILS:
- Name: ${objectData.name}
- Type: ${objectData.object_type}
- Description: ${objectData.description || 'No description'}
- Columns: ${objectData.columns?.map(c => `${c.name} (${c.data_type})`).join(', ') || 'No columns'}
- Dependencies: ${objectData.dependencies?.length || 0} upstream sources
- Downstream: ${(objectData as any).downstream?.length || 0} downstream consumers

CODE SAMPLE:
${objectData.definition ? objectData.definition.substring(0, 500) : 'No definition available'}

REQUIREMENTS:
- Write 2-3 sentences maximum
- Focus on WHAT it calculates and WHY it matters
- Use business language, avoid technical jargon
- Include who might use it and for what decisions
- Be specific about the business purpose

FORMAT:
Return ONLY the summary text, no headers, bullet points, or formatting.

EXAMPLE (do not copy, use as reference only):
"Calculates predicted customer lifetime value over 12 months based on purchase history and behavior patterns. Used by Marketing for campaign targeting and Finance for revenue forecasting. Updates daily at 6 AM to support strategic decision-making."`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 250,
      });

      return response.choices[0].message.content?.trim() || '';
    } catch (error) {
      this.handleOpenAIError(error, 'executive_summary');
      throw error;
    }
  }

  /**
   * Layer 2: Generate Business Narrative
   */
  private async generateBusinessNarrative(objectData: ObjectMetadata): Promise<BusinessNarrative> {
    const prompt = `Generate a business narrative that explains this data model's purpose and flow.

OBJECT DETAILS:
Name: ${objectData.name}
Type: ${objectData.object_type}
File: ${objectData.file?.relative_path || 'Unknown'}
Columns: ${objectData.columns?.length || 0} columns
Dependencies: ${objectData.dependencies?.length || 0} upstream sources

CODE:
${objectData.definition || 'No definition'}

REQUIREMENTS:
Return a JSON object with these exact fields:
{
  "whatItDoes": "2-3 sentence explanation of the transformation in business terms",
  "dataJourney": ["Step 1: What happens first", "Step 2: Next step", "Step 3: Final step"],
  "businessImpact": "How this affects business decisions and who uses it"
}

GUIDELINES:
- Use clear, non-technical language suitable for business analysts
- Focus on the "why" not just the "what"
- Describe the data journey as a story
- Explain business value, not technical implementation

Return ONLY valid JSON, no markdown code blocks or explanations.`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 600,
      });

      const content = response.choices[0].message.content || '{}';
      return JSON.parse(content);
    } catch (error) {
      this.handleOpenAIError(error, 'business_narrative');
      throw error;
    }
  }

  /**
   * Layer 3: Generate Transformation Cards
   */
  private async generateTransformationCards(objectData: ObjectMetadata): Promise<TransformationCard[]> {
    const code = objectData.definition || '';
    
    if (!code || code.length < 50) {
      // Not enough code to analyze
      return [];
    }

    const prompt = `Analyze this SQL/code and break it down into visual transformation steps.

OBJECT: ${objectData.name}
TYPE: ${objectData.object_type}

CODE:
${code}

COLUMNS:
${objectData.columns?.map(c => `- ${c.name}: ${c.data_type}${c.description ? ` (${c.description})` : ''}`).join('\n') || 'No columns'}

REQUIREMENTS:
Return a JSON object with a "cards" array. Each card should have:
{
  "cards": [
    {
      "stepNumber": 1,
      "title": "Filter Active Customers",
      "input": "2.5M total customers",
      "logic": "WHERE last_order_date >= CURRENT_DATE - 90 days",
      "output": "450K active customers (18%)",
      "whyItMatters": "Focus on engaged customers for accurate predictions"
    }
  ]
}

GUIDELINES:
- Identify 3-7 key transformation steps that a business user would understand
- Use business language for titles and "whyItMatters"
- Include approximate data volumes where possible (e.g., "1M rows → 500K rows")
- Extract actual logic from the code (WHERE clauses, JOINs, aggregations)
- Focus on steps that transform or filter data significantly

Return ONLY valid JSON, no markdown or explanations.`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1200,
      });

      const content = response.choices[0].message.content || '{}';
      const result = JSON.parse(content);
      return result.cards || [];
    } catch (error) {
      this.handleOpenAIError(error, 'transformation_cards');
      throw error;
    }
  }

  /**
   * Layer 4: Generate Code Explanations
   */
  private async generateCodeExplanations(objectData: ObjectMetadata): Promise<CodeExplanation[]> {
    const code = objectData.definition || '';
    
    if (!code || code.length < 50) {
      return [];
    }

    const prompt = `Create side-by-side code and plain English explanations for key sections of this code.

OBJECT: ${objectData.name}

CODE:
${code}

REQUIREMENTS:
Return a JSON object with an "explanations" array:
{
  "explanations": [
    {
      "codeBlock": "SELECT ... WHERE status = 'completed'",
      "plainEnglish": "We only look at orders that have been completed",
      "businessContext": "This ensures revenue metrics reflect actual paid orders, not pending ones"
    }
  ]
}

GUIDELINES:
- Focus on the most important business logic sections (WHERE, JOIN, aggregations, CASE statements)
- Extract 3-6 key code blocks
- plainEnglish should explain WHAT the code does in simple terms
- businessContext should explain WHY it matters for business decisions
- Use complete code snippets (keep SELECT/FROM/WHERE together)

Return ONLY valid JSON, no markdown.`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1200,
      });

      const content = response.choices[0].message.content || '{}';
      const result = JSON.parse(content);
      return result.explanations || [];
    } catch (error) {
      this.handleOpenAIError(error, 'code_explanations');
      throw error;
    }
  }

  /**
   * Extract Business Rules from Code
   */
  private async extractBusinessRules(objectData: ObjectMetadata): Promise<BusinessRule[]> {
    const code = objectData.definition || '';
    
    if (!code || code.length < 50) {
      return [];
    }

    const prompt = `Extract business rules from this code. Business rules are filters, validations, thresholds, or conditions that enforce business logic.

CODE:
${code}

REQUIREMENTS:
Return a JSON object with a "rules" array:
{
  "rules": [
    {
      "rule": "Only count completed orders with no refunds",
      "codeReference": "WHERE status = 'completed' AND refund_amount = 0",
      "impact": "Ensures revenue metrics reflect actual money received, not pending or refunded transactions"
    }
  ]
}

GUIDELINES:
- Identify WHERE clauses, CASE statements, and conditional logic
- Focus on business conditions, not technical SQL syntax
- Explain the business impact of each rule
- Extract 2-5 most important rules

Return ONLY valid JSON.`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 900,
      });

      const content = response.choices[0].message.content || '{}';
      const result = JSON.parse(content);
      return result.rules || [];
    } catch (error) {
      this.handleOpenAIError(error, 'business_rules');
      return []; // Non-critical, return empty on error
    }
  }

  /**
   * Generate Impact Analysis
   */
  private async generateImpactAnalysis(objectData: ObjectMetadata): Promise<ImpactAnalysis> {
    const downstream = (objectData as any).downstream || [];
    const downstreamCount = downstream.length || 0;
    const downstreamNames = downstream.slice(0, 5).map((d: any) => d.dependent?.name).filter(Boolean) || [];

    const prompt = `Analyze who uses this data and why it matters for business decisions.

OBJECT: ${objectData.name}
TYPE: ${objectData.object_type}
DOWNSTREAM CONSUMERS: ${downstreamCount} models/reports depend on this
EXAMPLES: ${downstreamNames.join(', ') || 'None'}

REQUIREMENTS:
Return JSON:
{
  "usedBy": [
    {"team": "Marketing", "frequency": "daily", "purpose": "Campaign targeting and ROI analysis"}
  ],
  "questionsAnswered": [
    "Which customers should we target for upsell campaigns?",
    "What is our predicted revenue for next quarter?"
  ],
  "downstreamImpact": "If this model breaks, marketing cannot target campaigns and finance loses revenue forecasting capability. Estimated impact: $500K/month in missed opportunities."
}

GUIDELINES:
- Infer teams based on object name and type (e.g., "customer_ltv" → Marketing, Finance)
- List 2-4 business questions this data helps answer
- Explain downstream impact if this breaks
- Be specific about business consequences

Return ONLY valid JSON.`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 700,
      });

      const content = response.choices[0].message.content || '{}';
      return JSON.parse(content);
    } catch (error) {
      this.handleOpenAIError(error, 'impact_analysis');
      // Return default impact analysis on error
      return {
        usedBy: [],
        questionsAnswered: [],
        downstreamImpact: 'Impact analysis unavailable',
      };
    }
  }

  /**
   * Calculate complexity score (1-5) based on code characteristics
   */
  private calculateComplexityScore(objectData: ObjectMetadata): number {
    let score = 1;
    const code = (objectData.definition || '').toLowerCase();
    
    // Check for various complexity indicators
    if (code.includes('join')) score++;
    if (code.includes('window') || code.includes('over(') || code.includes('partition by')) score++;
    if (code.includes('cte') || code.includes('with ')) score++;
    if (code.includes('recursive')) score = 5;
    if (code.includes('case when')) score++;
    
    // Check dependencies
    const depsCount = objectData.dependencies?.length || 0;
    if (depsCount > 5) score++;
    if (depsCount > 10) score++;
    
    // Check column count
    const colsCount = objectData.columns?.length || 0;
    if (colsCount > 20) score++;
    
    return Math.min(Math.max(score, 1), 5);
  }

  /**
   * Store generated documentation in database
   */
  async storeDocumentation(
    objectId: string,
    layers: DocumentationLayers,
    tokensUsed: number,
    processingTimeMs: number
  ): Promise<string> {
    try {
      // Mark previous versions as not current
      await supabaseAdmin
        .schema('metadata')
        .from('object_documentation')
        .update({ is_current: false })
        .eq('object_id', objectId);

      // Insert new documentation
      const { data, error } = await supabaseAdmin
        .schema('metadata')
        .from('object_documentation')
        .insert({
          object_id: objectId,
          organization_id: this.organizationId,
          executive_summary: layers.executiveSummary,
          business_narrative: layers.businessNarrative,
          transformation_cards: layers.transformationCards,
          code_explanations: layers.codeExplanations,
          business_rules: layers.businessRules,
          impact_analysis: layers.impactAnalysis,
          complexity_score: layers.complexityScore,
          generated_by_model: this.modelName,
          generation_status: 'completed',
          generation_metadata: {
            tokensUsed,
            processingTimeMs,
            timestamp: new Date().toISOString(),
          },
          generated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      console.log(`[DocGen] Stored documentation for object ${objectId}: ${data.id}`);
      return data.id;
    } catch (error) {
      console.error('[DocGen] Failed to store documentation:', error);
      throw error;
    }
  }

  /**
   * Handle OpenAI API errors with proper error types
   */
  private handleOpenAIError(error: any, layer: LayerName): void {
    console.error(`[DocGen] OpenAI error in ${layer}:`, error);

    if (error.status === 429) {
      throw new RateLimitError(
        'OpenAI rate limit exceeded',
        error.headers?.['retry-after']
      );
    }

    if (error.status === 401) {
      throw new APIKeyNotFoundError(this.organizationId, 'openai');
    }

    throw new DocumentationGenerationError(
      error.message || 'Unknown OpenAI error',
      layer,
      undefined,
      error
    );
  }
}
