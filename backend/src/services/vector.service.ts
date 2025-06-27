import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

interface VectorSearchResult {
  id: string;
  file_id: string;
  chunk_id: string;
  chunk_type: string;
  content: string;
  metadata: any;
  similarity: number;
  file_path: string;
  repository_full_name: string;
}

interface VectorChunk {
  chunk_id: string;
  chunk_type: 'summary' | 'business_logic' | 'code_block' | 'technical_details' | 'full_content';
  content: string;
  metadata: {
    section_name?: string;
    line_start?: number;
    line_end?: number;
    function_names?: string[];
    table_names?: string[];
    column_names?: string[];
    [key: string]: any;
  };
}

export class VectorService {
  private openai: OpenAI;
  private supabase: any;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Generate embedding for a given text using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      console.log(`Generating embedding for text (${text.length} chars)`);
      
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data received from OpenAI');
      }

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process and chunk content from file summary for vector storage
   */
  extractChunksFromSummary(summaryJson: any): VectorChunk[] {
    const chunks: VectorChunk[] = [];

    try {
      // Extract summary
      if (summaryJson.summary) {
        chunks.push({
          chunk_id: 'summary',
          chunk_type: 'summary',
          content: typeof summaryJson.summary === 'string' 
            ? summaryJson.summary 
            : JSON.stringify(summaryJson.summary),
          metadata: { section_name: 'File Summary' }
        });
      }

      // Extract business logic
      if (summaryJson.business_logic) {
        const businessLogicContent = this.extractBusinessLogicContent(summaryJson.business_logic);
        if (businessLogicContent) {
          chunks.push({
            chunk_id: 'business_logic',
            chunk_type: 'business_logic',
            content: businessLogicContent,
            metadata: { 
              section_name: 'Business Logic',
              extracted_entities: this.extractBusinessEntities(summaryJson.business_logic)
            }
          });
        }
      }

      // Extract code blocks
      if (summaryJson.code_blocks && Array.isArray(summaryJson.code_blocks)) {
        summaryJson.code_blocks.forEach((block: any, index: number) => {
          if (block.code || block.explanation || block.business_context) {
            const content = [
              block.code && `Code:\n${block.code}`,
              block.explanation && `Explanation:\n${block.explanation}`,
              block.business_context && `Business Context:\n${block.business_context}`
            ].filter(Boolean).join('\n\n');

            chunks.push({
              chunk_id: `code_block_${index}`,
              chunk_type: 'code_block',
              content,
              metadata: {
                section_name: block.section || `Code Block ${index + 1}`,
                block_index: index,
                has_code: !!block.code,
                has_explanation: !!block.explanation,
                has_business_context: !!block.business_context,
                function_names: this.extractFunctionNames(block.code),
                table_names: this.extractTableNames(block.code)
              }
            });
          }
        });
      }

      // Extract technical details
      if (summaryJson.technical_details) {
        chunks.push({
          chunk_id: 'technical_details',
          chunk_type: 'technical_details',
          content: typeof summaryJson.technical_details === 'string'
            ? summaryJson.technical_details
            : JSON.stringify(summaryJson.technical_details),
          metadata: {
            section_name: 'Technical Details',
            technical_entities: this.extractTechnicalEntities(summaryJson.technical_details)
          }
        });
      }

      // Extract other sections
      const otherSections = ['execution_flow', 'performance_considerations', 'best_practices', 'dependencies'];
      otherSections.forEach(section => {
        if (summaryJson[section]) {
          const content = Array.isArray(summaryJson[section])
            ? summaryJson[section].join('\n')
            : typeof summaryJson[section] === 'string'
            ? summaryJson[section]
            : JSON.stringify(summaryJson[section]);

          chunks.push({
            chunk_id: section,
            chunk_type: 'technical_details',
            content,
            metadata: { 
              section_name: this.formatSectionName(section),
              original_section: section
            }
          });
        }
      });

    } catch (error) {
      console.error('Error extracting chunks from summary:', error);
    }

    return chunks;
  }

  /**
   * Store vector embeddings for a file
   */
  async storeFileVectors(fileId: string, chunks: VectorChunk[]): Promise<void> {
    try {
      console.log(`Storing ${chunks.length} vector chunks for file ${fileId}`);

      for (const chunk of chunks) {
        if (!chunk.content || chunk.content.trim().length === 0) {
          console.log(`Skipping empty chunk: ${chunk.chunk_id}`);
          continue;
        }

        // Generate embedding
        const embedding = await this.generateEmbedding(chunk.content);

        // Count tokens (approximate)
        const tokenCount = this.estimateTokenCount(chunk.content);

        // Store in database
        const { error } = await this.supabase
          .from('code_insights.document_vectors')
          .upsert({
            file_id: fileId,
            chunk_id: chunk.chunk_id,
            chunk_type: chunk.chunk_type,
            content: chunk.content,
            metadata: chunk.metadata,
            embedding: JSON.stringify(embedding),
            token_count: tokenCount
          }, {
            onConflict: 'file_id,chunk_id'
          });

        if (error) {
          console.error(`Error storing vector for chunk ${chunk.chunk_id}:`, error);
          throw error;
        }
      }

      console.log(`Successfully stored vectors for file ${fileId}`);
    } catch (error) {
      console.error('Error storing file vectors:', error);
      throw error;
    }
  }

  /**
   * Perform semantic search
   */
  async semanticSearch(
    query: string,
    options: {
      matchThreshold?: number;
      matchCount?: number;
      filterFileIds?: string[];
      filterChunkTypes?: string[];
      userId?: string;
    } = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const startTime = Date.now();
      
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);

      // Perform vector search
      const { data, error } = await this.supabase
        .rpc('code_insights.search_similar_content', {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: options.matchThreshold || 0.7,
          match_count: options.matchCount || 10,
          filter_file_ids: options.filterFileIds || null,
          filter_chunk_types: options.filterChunkTypes || null
        });

      if (error) {
        throw error;
      }

      const executionTime = Date.now() - startTime;

      // Log search query for analytics
      if (options.userId) {
        await this.logSearchQuery(
          options.userId,
          query,
          'semantic',
          { 
            matchThreshold: options.matchThreshold,
            filterFileIds: options.filterFileIds,
            filterChunkTypes: options.filterChunkTypes 
          },
          data?.length || 0,
          executionTime
        );
      }

      return data || [];
    } catch (error) {
      console.error('Error performing semantic search:', error);
      throw error;
    }
  }

  /**
   * Hybrid search combining semantic and keyword search
   */
  async hybridSearch(
    query: string,
    options: {
      semanticWeight?: number;
      keywordWeight?: number;
      matchCount?: number;
      filterFileIds?: string[];
      userId?: string;
    } = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const semanticWeight = options.semanticWeight || 0.7;
      const keywordWeight = options.keywordWeight || 0.3;

      // Perform semantic search
      const semanticResults = await this.semanticSearch(query, {
        matchCount: options.matchCount,
        filterFileIds: options.filterFileIds,
        matchThreshold: 0.6 // Lower threshold for hybrid
      });

      // Perform keyword search
      const keywordResults = await this.keywordSearch(query, {
        matchCount: options.matchCount,
        filterFileIds: options.filterFileIds
      });

      // Combine and rank results
      const combinedResults = this.combineSearchResults(
        semanticResults,
        keywordResults,
        semanticWeight,
        keywordWeight
      );

      return combinedResults.slice(0, options.matchCount || 10);
    } catch (error) {
      console.error('Error performing hybrid search:', error);
      throw error;
    }
  }

  /**
   * Keyword-based search
   */
  private async keywordSearch(
    query: string,
    options: {
      matchCount?: number;
      filterFileIds?: string[];
    } = {}
  ): Promise<VectorSearchResult[]> {
    try {
      let queryBuilder = this.supabase
        .from('code_insights.document_vectors')
        .select(`
          id,
          file_id,
          chunk_id,
          chunk_type,
          content,
          metadata,
          files!inner(file_path, repository_full_name)
        `)
        .textSearch('content', query, { type: 'websearch' });

      if (options.filterFileIds && options.filterFileIds.length > 0) {
        queryBuilder = queryBuilder.in('file_id', options.filterFileIds);
      }

      const { data, error } = await queryBuilder
        .limit(options.matchCount || 10);

      if (error) {
        throw error;
      }

      return (data || []).map((item: any) => ({
        ...item,
        similarity: 0.5, // Default similarity for keyword matches
        file_path: item.files.file_path,
        repository_full_name: item.files.repository_full_name
      }));
    } catch (error) {
      console.error('Error performing keyword search:', error);
      return [];
    }
  }

  /**
   * Helper functions
   */
  private extractBusinessLogicContent(businessLogic: any): string {
    if (typeof businessLogic === 'string') {
      return businessLogic;
    }

    const parts = [];
    if (businessLogic.main_objectives) {
      parts.push(`Main Objectives:\n${Array.isArray(businessLogic.main_objectives) 
        ? businessLogic.main_objectives.join('\n') 
        : businessLogic.main_objectives}`);
    }
    if (businessLogic.data_transformation) {
      parts.push(`Data Transformation:\n${businessLogic.data_transformation}`);
    }
    if (businessLogic.stakeholder_impact) {
      parts.push(`Stakeholder Impact:\n${businessLogic.stakeholder_impact}`);
    }

    return parts.join('\n\n');
  }

  private extractBusinessEntities(businessLogic: any): string[] {
    const entities = [];
    try {
      const content = JSON.stringify(businessLogic).toLowerCase();
      // Extract potential business terms
      const businessTerms = content.match(/\b(revenue|profit|customer|user|business|metric|kpi|target|goal)\b/g);
      if (businessTerms) {
        entities.push(...businessTerms);
      }
    } catch (error) {
      console.error('Error extracting business entities:', error);
    }
    return [...new Set(entities)];
  }

  private extractTechnicalEntities(technicalDetails: any): any {
    const entities: any = {};
    try {
      if (typeof technicalDetails === 'object') {
        entities.source_tables = technicalDetails.source_tables || [];
        entities.materialization = technicalDetails.materialization;
        entities.sql_operations = technicalDetails.sql_operations || [];
      }
    } catch (error) {
      console.error('Error extracting technical entities:', error);
    }
    return entities;
  }

  private extractFunctionNames(code: string): string[] {
    if (!code) return [];
    
    const functionPatterns = [
      /def\s+(\w+)\s*\(/g, // Python functions
      /function\s+(\w+)\s*\(/g, // JavaScript functions
      /(\w+)\s*\(/g // General function calls
    ];

    const functions = new Set<string>();
    functionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        functions.add(match[1]);
      }
    });

    return Array.from(functions);
  }

  private extractTableNames(code: string): string[] {
    if (!code) return [];
    
    const tablePatterns = [
      /FROM\s+([`"']?)(\w+)\1/gi, // SQL FROM clauses
      /JOIN\s+([`"']?)(\w+)\1/gi, // SQL JOIN clauses
      /UPDATE\s+([`"']?)(\w+)\1/gi, // SQL UPDATE
      /INSERT\s+INTO\s+([`"']?)(\w+)\1/gi // SQL INSERT
    ];

    const tables = new Set<string>();
    tablePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        tables.add(match[2]);
      }
    });

    return Array.from(tables);
  }

  private formatSectionName(section: string): string {
    return section
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  private combineSearchResults(
    semanticResults: VectorSearchResult[],
    keywordResults: VectorSearchResult[],
    semanticWeight: number,
    keywordWeight: number
  ): VectorSearchResult[] {
    const combinedMap = new Map<string, VectorSearchResult>();

    // Add semantic results
    semanticResults.forEach(result => {
      const key = `${result.file_id}_${result.chunk_id}`;
      combinedMap.set(key, {
        ...result,
        similarity: result.similarity * semanticWeight
      });
    });

    // Add/merge keyword results
    keywordResults.forEach(result => {
      const key = `${result.file_id}_${result.chunk_id}`;
      const existing = combinedMap.get(key);
      
      if (existing) {
        // Combine scores
        existing.similarity += result.similarity * keywordWeight;
      } else {
        combinedMap.set(key, {
          ...result,
          similarity: result.similarity * keywordWeight
        });
      }
    });

    // Sort by combined similarity score
    return Array.from(combinedMap.values())
      .sort((a, b) => b.similarity - a.similarity);
  }

  private async logSearchQuery(
    userId: string,
    queryText: string,
    searchType: string,
    filters: any,
    resultsCount: number,
    executionTime: number
  ): Promise<void> {
    try {
      await this.supabase
        .from('code_insights.search_queries')
        .insert({
          user_id: userId,
          query_text: queryText,
          search_type: searchType,
          filters,
          results_count: resultsCount,
          execution_time_ms: executionTime
        });
    } catch (error) {
      console.error('Error logging search query:', error);
      // Don't throw error for logging failures
    }
  }
}

export const vectorService = new VectorService(); 