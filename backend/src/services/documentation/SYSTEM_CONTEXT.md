# AI Documentation Generation System - Complete Context

## 🎯 System Purpose

Generate comprehensive, multi-layered business documentation for data models (SQL tables, views, dbt models, Python dataframes) using GPT-4o. The goal is to transform technical code into business-friendly narratives that non-technical stakeholders can understand.

---

## 🏗️ Architecture Overview

### Three-Tier System

```
┌─────────────────────────────────────────────────────────┐
│ PHASE 1: Database Foundation (✅ COMPLETE)              │
├─────────────────────────────────────────────────────────┤
│ - metadata.object_documentation (stores all layers)     │
│ - metadata.documentation_jobs (batch job tracking)      │
│ - metadata.documentation_generation_logs (detailed logs)│
│ - Helper functions for job management                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ PHASE 2: Service Layer (✅ COMPLETE)                    │
├─────────────────────────────────────────────────────────┤
│ DocumentationGenerationService                          │
│ - Generates 6 layers for a single object               │
│ - Uses OpenAI GPT-4o-latest                            │
│ - Fetches encrypted API keys per organization          │
│ - Stores documentation with versioning                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ PHASE 3: Job Orchestrator (🚧 TO BUILD)                │
├─────────────────────────────────────────────────────────┤
│ DocumentationJobOrchestrator                            │
│ - Creates jobs for multiple objects                    │
│ - Processes objects sequentially (or parallel)         │
│ - Tracks progress in real-time                         │
│ - Handles errors, retries, rate limits                 │
│ - Updates job status continuously                      │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Data Model

### Core Tables (Phase 1)

#### `metadata.object_documentation`
Stores generated documentation for each object.

**Key Columns:**
- `object_id` - FK to metadata.objects
- `organization_id` - FK to enterprise.organizations
- `executive_summary` - TEXT (Layer 1)
- `business_narrative` - JSONB (Layer 2)
- `transformation_cards` - JSONB array (Layer 3)
- `code_explanations` - JSONB array (Layer 4)
- `business_rules` - JSONB array (Layer 5)
- `impact_analysis` - JSONB (Layer 6)
- `complexity_score` - INTEGER (1-5)
- `version` - INTEGER (supports regeneration)
- `is_current` - BOOLEAN (latest version flag)
- `generation_status` - VARCHAR (pending, processing, completed, failed)
- `generated_by_model` - VARCHAR (e.g., 'gpt-4o-latest')
- `generation_metadata` - JSONB (tokens, cost, duration)

#### `metadata.documentation_jobs`
Manages batch documentation generation.

**Key Columns:**
- `id` - UUID
- `organization_id` - FK
- `connection_id` - Optional FK to github_connections
- `object_ids` - UUID[] (array of objects to document)
- `total_objects` - INTEGER
- `processed_objects` - INTEGER (auto-incremented)
- `failed_objects` - INTEGER
- `status` - VARCHAR (queued, processing, completed, failed, cancelled, paused)
- `current_object_id` - UUID (currently processing)
- `progress_percentage` - DECIMAL (0-100)
- `estimated_completion_time` - TIMESTAMPTZ
- `api_provider` - VARCHAR (openai)
- `model_name` - VARCHAR (gpt-4o-latest)
- `total_tokens_used` - BIGINT
- `estimated_cost` - DECIMAL (USD)
- `layers_completed` - JSONB (per-layer counts)
- `layers_failed` - JSONB (per-layer failure counts)
- `triggered_by_user_id` - UUID

#### `metadata.documentation_generation_logs`
Granular logs for each layer generation.

**Key Columns:**
- `job_id` - FK to documentation_jobs
- `object_id` - FK to objects
- `layer` - VARCHAR (executive_summary, business_narrative, etc.)
- `status` - VARCHAR (started, completed, failed)
- `tokens_used` - INTEGER
- `processing_time_ms` - INTEGER
- `error_message` - TEXT
- `model_used` - VARCHAR
- `finish_reason` - VARCHAR (stop, length, content_filter)

### Helper Functions (Phase 1)

```sql
-- Atomically increment processed count and update progress
metadata.increment_processed_objects(job_id UUID)

-- Increment failure count
metadata.increment_failed_objects(job_id UUID)

-- Update job status with automatic timestamps
metadata.update_job_status(job_id UUID, status VARCHAR, error_details JSONB)

-- Calculate average processing time from logs
metadata.update_average_processing_time(job_id UUID)

-- Estimate completion time based on average
metadata.update_estimated_completion(job_id UUID)

-- Get quick documentation summary for an object
metadata.get_documentation_summary(object_id UUID)
```

---

## 🔧 Phase 2: Service Layer (Complete)

### DocumentationGenerationService

**Location:** `backend/src/services/documentation/DocumentationGenerationService.ts`

**Responsibility:** Generate documentation for a SINGLE object.

**Key Methods:**

```typescript
class DocumentationGenerationService {
  constructor(organizationId: string)
  
  // Initialize OpenAI client with org's encrypted API key
  async initialize(): Promise<void>
  
  // Fetch object metadata from database
  async fetchObjectMetadata(objectId: string): Promise<ObjectMetadata>
  
  // Main method: Generate all 6 layers
  async generateDocumentationForObject(objectId: string): Promise<DocumentationLayers>
  
  // Layer generation methods (called sequentially)
  private async generateExecutiveSummary(objectData): Promise<string>
  private async generateBusinessNarrative(objectData): Promise<BusinessNarrative>
  private async generateTransformationCards(objectData): Promise<TransformationCard[]>
  private async generateCodeExplanations(objectData): Promise<CodeExplanation[]>
  private async extractBusinessRules(objectData): Promise<BusinessRule[]>
  private async generateImpactAnalysis(objectData): Promise<ImpactAnalysis>
  
  // Heuristic complexity calculation (no API call)
  private calculateComplexityScore(objectData): number
  
  // Store documentation in database
  async storeDocumentation(objectId, layers, tokensUsed, processingTimeMs): Promise<string>
}
```

**Usage Pattern:**
```typescript
// Single object generation
const service = new DocumentationGenerationService(organizationId);
await service.initialize();
const docs = await service.generateDocumentationForObject(objectId);
await service.storeDocumentation(objectId, docs, tokens, duration);
```

---

## 🎨 Documentation Layers

### Layer 1: Executive Summary
- **Format:** Plain text (2-3 sentences)
- **Purpose:** 10-second scan for executives
- **Content:** What it calculates + why it matters + who uses it
- **Token Budget:** ~600 total (~100 completion)

### Layer 2: Business Narrative
- **Format:** JSON object
- **Structure:**
  ```json
  {
    "whatItDoes": "2-3 sentence explanation",
    "dataJourney": ["Step 1", "Step 2", "Step 3"],
    "businessImpact": "How it affects decisions"
  }
  ```
- **Purpose:** Story format for business analysts
- **Token Budget:** ~1,100 total (~300 completion)

### Layer 3: Transformation Cards
- **Format:** JSON array
- **Structure:**
  ```json
  [
    {
      "stepNumber": 1,
      "title": "Filter Active Customers",
      "input": "2.5M customers",
      "logic": "WHERE last_order > 90 days",
      "output": "450K customers (18%)",
      "whyItMatters": "Focus on engaged users"
    }
  ]
  ```
- **Purpose:** Visual step-by-step transformation
- **Count:** 3-7 cards
- **Token Budget:** ~1,500 total (~500 completion)

### Layer 4: Code Explanations
- **Format:** JSON array
- **Structure:**
  ```json
  [
    {
      "codeBlock": "WHERE status = 'completed'",
      "plainEnglish": "Only completed orders",
      "businessContext": "Ensures accurate revenue"
    }
  ]
  ```
- **Purpose:** Code + plain English side-by-side
- **Count:** 3-6 explanations
- **Token Budget:** ~1,800 total (~600 completion)

### Layer 5: Business Rules
- **Format:** JSON array
- **Structure:**
  ```json
  [
    {
      "rule": "Only count paid orders",
      "codeReference": "WHERE status = 'completed' AND refund = 0",
      "impact": "Ensures revenue accuracy"
    }
  ]
  ```
- **Purpose:** Extract business logic from code
- **Count:** 2-5 rules
- **Token Budget:** ~800 total (~200 completion)

### Layer 6: Impact Analysis
- **Format:** JSON object
- **Structure:**
  ```json
  {
    "usedBy": [
      {"team": "Marketing", "frequency": "daily", "purpose": "Campaign targeting"}
    ],
    "questionsAnswered": [
      "Which customers to target?",
      "What's predicted revenue?"
    ],
    "downstreamImpact": "If breaks, $500K/month impact"
  }
  ```
- **Purpose:** Who uses it, why it matters
- **Token Budget:** ~700 total (~250 completion)

**Total per object: ~6,500 tokens ≈ $0.05**

---

## 🎯 Design Patterns & Conventions

### 1. Sequential Layer Generation
Generate layers one-by-one (not parallel):
- **Reason:** Easier debugging, early failure detection
- **Future:** Could parallelize for speed

### 2. JSON Response Format
Use `response_format: { type: 'json_object' }` for structured data:
- **Reason:** More reliable than parsing markdown
- **Exception:** Executive summary uses plain text

### 3. Graceful Degradation
- **Critical layers:** Executive summary, business narrative (throw on error)
- **Nice-to-have layers:** Business rules, impact analysis (return empty on error)
- **Reason:** Better UX than all-or-nothing

### 4. Versioning
- Mark old docs as `is_current: false`
- Keep history for comparison
- Allows "regenerate" feature

### 5. Prompt Engineering
- **Business-first:** No technical jargon
- **Clear constraints:** "2-3 sentences", "3-7 cards"
- **Examples:** "Use as reference only" (no copying)
- **Negative instructions:** "No markdown code blocks"
- **Focus on WHY:** Not just what code does

### 6. Error Handling
```typescript
// Custom error types
class APIKeyNotFoundError extends Error
class RateLimitError extends Error
class DocumentationGenerationError extends Error

// Handle OpenAI errors
if (error.status === 429) throw new RateLimitError(...)
if (error.status === 401) throw new APIKeyNotFoundError(...)
```

### 7. Security
- API keys encrypted with AES-256-GCM
- Decrypted only when needed
- Per-organization isolation
- No cross-org key access

---

## 💰 Cost Model

### GPT-4o Pricing
- Input: $5.00 / 1M tokens
- Output: $15.00 / 1M tokens

### Per Object Cost
- **Average:** ~$0.05 per object (6,500 tokens)
- **Simple objects:** ~$0.03 (fewer transformations)
- **Complex objects:** ~$0.10 (more code, more steps)

### Batch Estimates
- 10 objects: ~$0.50
- 100 objects: ~$5.00
- 1,000 objects: ~$50.00

### Cost Tracking
Store in:
- `generation_metadata` JSONB in object_documentation
- `total_tokens_used` and `estimated_cost` in documentation_jobs
- Per-layer `tokens_used` in documentation_generation_logs

---

## 🚀 Phase 3 Requirements (To Build)

### DocumentationJobOrchestrator

**Location:** `backend/src/services/documentation/DocumentationJobOrchestrator.ts`

**Responsibility:** Manage batch processing of multiple objects.

**Core Requirements:**

1. **Job Creation**
   - Accept array of object IDs
   - Create job record in `documentation_jobs` table
   - Set status to 'queued'
   - Store triggering user info

2. **Job Processing**
   - Process objects one-by-one (sequential)
   - For each object:
     - Update `current_object_id` in job
     - Call `DocumentationGenerationService.generateDocumentationForObject()`
     - Store documentation
     - Log each layer in `documentation_generation_logs`
     - Call `metadata.increment_processed_objects(job_id)`
     - Update estimated completion time
   - Handle errors gracefully (retry, skip, or fail)

3. **Progress Tracking**
   - Calculate `progress_percentage` = (processed / total) * 100
   - Update `estimated_completion_time` based on average time
   - Track token usage across all objects
   - Calculate cumulative cost

4. **Error Handling**
   - **Rate Limits:** Implement exponential backoff retry
   - **API Key Issues:** Fail fast with clear error
   - **Individual Object Failures:** Log error, increment failed_objects, continue
   - **Critical Failures:** Pause job, mark as failed

5. **Status Management**
   - Update job status: queued → processing → completed/failed
   - Set timestamps: started_at, completed_at
   - Store error logs in `error_log` JSONB

6. **Layer Tracking**
   - Count completed layers per type in `layers_completed`
   - Count failed layers per type in `layers_failed`
   - Provides insight into which layers fail most

### Key Methods to Implement

```typescript
class DocumentationJobOrchestrator {
  constructor(organizationId: string)
  
  // Create a new job
  async createJob(objectIds: string[], options?: JobOptions): Promise<string>
  
  // Process an entire job
  async processJob(jobId: string): Promise<void>
  
  // Process single object within a job
  private async processObject(jobId: string, objectId: string): Promise<void>
  
  // Handle errors and retries
  private async handleError(jobId: string, objectId: string, error: Error): Promise<void>
  
  // Update job progress
  private async updateProgress(jobId: string): Promise<void>
  
  // Calculate cost estimation
  private calculateEstimatedCost(totalObjects: number): number
  
  // Get job status
  async getJobStatus(jobId: string): Promise<DocumentationJob>
  
  // Cancel a running job
  async cancelJob(jobId: string): Promise<void>
  
  // Pause a running job
  async pauseJob(jobId: string): Promise<void>
  
  // Resume a paused job
  async resumeJob(jobId: string): Promise<void>
}
```

### Expected Flow

```typescript
// Admin triggers documentation generation
const orchestrator = new DocumentationJobOrchestrator(organizationId);

// Create job
const jobId = await orchestrator.createJob(objectIds, {
  skipExisting: false,
  regenerateAll: true,
  maxRetries: 3
});

// Process job (async)
await orchestrator.processJob(jobId);

// Job updates happen automatically:
// - progress_percentage increases
// - current_object_id changes
// - estimated_completion_time updates
// - token_usage accumulates
// - errors logged
```

---

## 🔄 Error Scenarios & Handling

### Scenario 1: Rate Limit Hit
```typescript
// OpenAI returns 429
catch (error) {
  if (error instanceof RateLimitError) {
    const retryAfter = error.retryAfterSeconds || 60;
    await sleep(retryAfter * 1000);
    // Retry same object
  }
}
```

### Scenario 2: API Key Not Found
```typescript
// No API key configured
catch (error) {
  if (error instanceof APIKeyNotFoundError) {
    await updateJobStatus(jobId, 'failed', {
      error: 'No OpenAI API key configured for organization'
    });
    throw error; // Fail job immediately
  }
}
```

### Scenario 3: Single Object Fails
```typescript
// Object generation fails
catch (error) {
  await incrementFailedObjects(jobId);
  await logError(jobId, objectId, error);
  // Continue to next object (don't fail entire job)
}
```

### Scenario 4: Partial Layer Generation
```typescript
// Some layers succeed, some fail
// Service already handles this with graceful degradation
// Non-critical layers return empty on error
// Documentation is stored with partial layers
```

---

## 📝 Code Style & Conventions

### TypeScript Standards
- Use interfaces over types for object shapes
- Explicit return types on public methods
- Use async/await (no raw promises)
- Proper error handling with try-catch
- Use const for immutable values

### Naming Conventions
- **Classes:** PascalCase (DocumentationJobOrchestrator)
- **Methods:** camelCase (processJob, updateProgress)
- **Variables:** camelCase (jobId, objectIds)
- **Constants:** UPPER_SNAKE_CASE (MAX_RETRIES, DEFAULT_TIMEOUT)
- **Database functions:** snake_case (increment_processed_objects)

### Logging Standards
```typescript
// Use prefix for identification
console.log('[DocOrchestrator] Starting job:', jobId);
console.error('[DocOrchestrator] Error processing object:', error);

// Include context in logs
console.log(`[DocOrchestrator] Processed ${processed}/${total} objects (${progress}%)`);
```

### Database Interaction
```typescript
// Use supabaseAdmin (service_role)
const { data, error } = await supabaseAdmin
  .schema('metadata')
  .from('documentation_jobs')
  .select('*')
  .eq('id', jobId)
  .single();

// Always check for errors
if (error) {
  throw new Error(`Database error: ${error.message}`);
}
```

---

## 🎯 Success Criteria for Phase 3

Phase 3 is complete when:

- [ ] DocumentationJobOrchestrator class created
- [ ] Can create jobs for multiple objects
- [ ] Can process jobs sequentially
- [ ] Progress tracking works (0-100%)
- [ ] Token usage accumulates correctly
- [ ] Cost estimation is accurate
- [ ] Error handling covers all scenarios
- [ ] Retry logic for rate limits
- [ ] Failed objects don't stop entire job
- [ ] Job status updates in real-time
- [ ] All helper functions called correctly
- [ ] Logs stored in documentation_generation_logs
- [ ] Can pause/resume/cancel jobs
- [ ] Test script demonstrates full workflow

---

## 📊 Integration Points

### With Phase 1 (Database)
- Insert into `documentation_jobs`
- Update `documentation_jobs` status
- Call `metadata.increment_processed_objects()`
- Call `metadata.increment_failed_objects()`
- Call `metadata.update_job_status()`
- Call `metadata.update_average_processing_time()`
- Insert into `documentation_generation_logs`

### With Phase 2 (Service)
```typescript
// Create service instance
const service = new DocumentationGenerationService(organizationId);
await service.initialize();

// Generate for each object
const docs = await service.generateDocumentationForObject(objectId);
await service.storeDocumentation(objectId, docs, tokens, duration);
```

### With Future Phases
- **Phase 4 (API):** Expose job creation and status endpoints
- **Phase 5 (Admin UI):** Trigger jobs from admin panel
- **Phase 6 (Status Monitor):** Real-time progress display
- **Phase 7 (Viewer):** Display generated documentation

---

## 🛠️ Development Guidelines

### Testing Strategy
1. Unit tests for individual methods
2. Integration test with 5 test objects
3. Load test with 50+ objects
4. Error scenario testing (rate limits, failures)

### Performance Considerations
- Process objects sequentially (for now)
- Future: Parallel processing with concurrency limit
- Rate limit handling to avoid API blocks
- Token usage tracking to prevent cost overruns

### Security Considerations
- Validate organization ID
- Verify user permissions (admin only)
- Don't expose API keys in logs
- Sanitize error messages before storing

---

## 📚 Key Files Reference

```
Phase 1 (Database):
├── supabase/migrations/20251023000001_create_ai_documentation_tables.sql
└── scripts/verify-documentation-schema.sql

Phase 2 (Service):
├── backend/src/services/documentation/types.ts
├── backend/src/services/documentation/DocumentationGenerationService.ts
├── backend/src/services/documentation/test-documentation-service.ts
└── backend/src/services/documentation/PROMPT_GUIDE.md

Phase 3 (Orchestrator) - TO BUILD:
├── backend/src/services/documentation/DocumentationJobOrchestrator.ts
└── backend/src/services/documentation/test-job-orchestrator.ts
```

---

## 🎓 Domain Knowledge

### dbt Models
- Live in `models/` directory
- Use Jinja templates ({{ ref('...') }})
- Have upstream dependencies via ref()
- Generate SQL at compile time

### SQL Dialects
- Snowflake: QUALIFY, ARRAY_AGG
- BigQuery: UNNEST, STRUCT
- PostgreSQL: LATERAL, JSONB operators
- Redshift: LISTAGG, DISTKEY

### Object Types
- `table` - Physical tables
- `view` - Virtual tables
- `dbt_model` - dbt compiled models
- `cte` - Common table expressions
- `dataframe` - Python/Spark DataFrames

---

## ✅ Ready to Build Phase 3

With this context, you understand:
- ✅ Complete system architecture
- ✅ Database schema and helper functions
- ✅ Service layer implementation
- ✅ Documentation layers and formats
- ✅ Prompt engineering patterns
- ✅ Error handling strategies
- ✅ Cost model and tracking
- ✅ Code conventions and patterns
- ✅ Integration points
- ✅ Success criteria

**Now build DocumentationJobOrchestrator following these patterns!**
