/**
 * Type definitions for AI Documentation Generation System
 */

// =====================================================
// DOCUMENTATION LAYERS
// =====================================================

export interface ExecutiveSummary {
  summary: string;
}

export interface BusinessNarrative {
  whatItDoes: string;
  dataJourney: string[];
  businessImpact: string;
}

export interface TransformationCard {
  stepNumber: number;
  title: string;
  input: string;
  logic: string;
  output: string;
  whyItMatters: string;
}

export interface CodeExplanation {
  codeBlock: string;
  plainEnglish: string;
  businessContext: string;
}

export interface BusinessRule {
  rule: string;
  codeReference: string;
  impact: string;
}

export interface ImpactAnalysis {
  usedBy: Array<{
    team: string;
    frequency: string;
    purpose: string;
  }>;
  questionsAnswered: string[];
  downstreamImpact: string;
}

export interface SampleDataJourney {
  input: Record<string, any>;
  transformations: Array<{
    step: string;
    description: string;
    result: Record<string, any>;
  }>;
  output: Record<string, any>;
}

export interface DecisionContext {
  questions: string[];
  decisions: string[];
  teams: string[];
}

// =====================================================
// FULL DOCUMENTATION STRUCTURE
// =====================================================

export interface DocumentationLayers {
  executiveSummary: string;
  businessNarrative: BusinessNarrative;
  transformationCards: TransformationCard[];
  codeExplanations: CodeExplanation[];
  businessRules: BusinessRule[];
  impactAnalysis: ImpactAnalysis;
  sampleDataJourney?: SampleDataJourney;
  decisionContext?: DecisionContext;
  complexityScore: number;
}

// =====================================================
// OBJECT METADATA (from database)
// =====================================================

export interface ColumnMetadata {
  id: string;
  name: string;
  data_type: string;
  description?: string;
  is_nullable?: boolean;
  is_primary_key?: boolean;
}

export interface DependencyMetadata {
  id: string;
  depends_on_id: string;
  depends_on_name: string;
  dependency_type: string;
}

export interface ObjectMetadata {
  id: string;
  name: string;
  schema_name?: string;
  database_name?: string;
  full_name: string;
  object_type: string;
  definition?: string;
  description?: string;
  metadata?: Record<string, any>;
  columns?: ColumnMetadata[];
  dependencies?: DependencyMetadata[];
  downstreamDependencies?: DependencyMetadata[];
  file_id: string;
  file?: {
    relative_path: string;
    file_type: string;
    dialect?: string;
  };
}

// =====================================================
// JOB MANAGEMENT
// =====================================================

export interface DocumentationJob {
  id: string;
  organizationId: string;
  connectionId?: string;
  objectIds: string[];
  totalObjects: number;
  processedObjects: number;
  failedObjects: number;
  skippedObjects: number;
  status: JobStatus;
  currentObjectId?: string;
  currentObjectName?: string;
  progressPercentage: number;
  estimatedCompletionTime?: Date;
  apiProvider: string;
  modelName: string;
  totalTokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  actualCost: number;
  averageTimePerObject?: string;
  layersCompleted: Record<string, number>;
  layersFailed: Record<string, number>;
  errorLog?: any[];
  retryCount: number;
  maxRetries: number;
  triggeredByUserId?: string;
  triggeredByUserEmail?: string;
  options?: JobOptions;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  pausedAt?: Date;
}

export type JobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface JobOptions {
  skipExisting?: boolean;
  regenerateAll?: boolean;
  layersToGenerate?: LayerName[];
  maxRetries?: number;
  temperatureOverride?: number;
}

export type LayerName =
  | 'executive_summary'
  | 'business_narrative'
  | 'transformation_cards'
  | 'code_explanations'
  | 'business_rules'
  | 'impact_analysis';

// =====================================================
// GENERATION LOGS
// =====================================================

export interface GenerationLog {
  id: string;
  jobId: string;
  objectId: string;
  layer: LayerName;
  layerDisplayName: string;
  status: LogStatus;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  processingTimeMs?: number;
  responseLength?: number;
  confidenceScore?: number;
  errorMessage?: string;
  errorCode?: string;
  retryAttempt: number;
  modelUsed: string;
  finishReason?: string;
  rawResponse?: any;
  createdAt: Date;
}

export type LogStatus =
  | 'started'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'retrying';

// =====================================================
// API KEY MANAGEMENT
// =====================================================

export interface APIKeyConfig {
  id: string;
  provider: string;
  encryptedKey: string;
  encryptionIv: string;
  encryptionAuthTag: string;
  isDefault: boolean;
  status: string;
}

// =====================================================
// OPENAI API TYPES
// =====================================================

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAICompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// =====================================================
// SERVICE CONFIGURATION
// =====================================================

export interface DocumentationServiceConfig {
  model: string;
  temperature: number;
  maxTokensPerLayer: Record<LayerName, number>;
  retryAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
}

// =====================================================
// ERROR TYPES
// =====================================================

export class DocumentationGenerationError extends Error {
  constructor(
    message: string,
    public layer?: LayerName,
    public objectId?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DocumentationGenerationError';
  }
}

export class APIKeyNotFoundError extends Error {
  constructor(public organizationId: string, public provider: string) {
    super(`No API key found for provider ${provider} in organization ${organizationId}`);
    this.name = 'APIKeyNotFoundError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}
