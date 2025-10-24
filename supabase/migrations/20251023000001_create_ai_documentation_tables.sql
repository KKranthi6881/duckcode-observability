-- =====================================================
-- AI DOCUMENTATION GENERATION SYSTEM
-- GPT-powered business documentation for data models
-- =====================================================

-- =====================================================
-- MAIN DOCUMENTATION STORAGE TABLE
-- =====================================================

-- Stores AI-generated documentation for each metadata object
CREATE TABLE IF NOT EXISTS metadata.object_documentation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    object_id UUID NOT NULL REFERENCES metadata.objects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    
    -- ===============================
    -- LAYER 1: Executive Summary
    -- ===============================
    executive_summary TEXT,  -- 2-3 sentence business-focused summary
    
    -- ===============================
    -- LAYER 2: Business Narrative
    -- ===============================
    business_narrative JSONB,  -- {whatItDoes, dataJourney[], businessImpact}
    
    -- ===============================
    -- LAYER 3: Transformation Cards
    -- ===============================
    transformation_cards JSONB,  -- Array of visual step cards
    -- [{stepNumber, title, input, logic, output, whyItMatters}]
    
    -- ===============================
    -- LAYER 4: Code Explanations
    -- ===============================
    code_explanations JSONB,  -- Array of code + plain English
    -- [{codeBlock, plainEnglish, businessContext}]
    
    -- ===============================
    -- ADDITIONAL ANALYSIS LAYERS
    -- ===============================
    business_rules JSONB,  -- Extracted business rules from code
    -- [{rule, codeReference, impact}]
    
    impact_analysis JSONB,  -- Who uses this and why it matters
    -- {usedBy: [{team, frequency, purpose}], questionsAnswered: [], downstreamImpact}
    
    sample_data_journey JSONB,  -- Example data transformations
    -- {input: {}, transformations: [], output: {}}
    
    decision_context JSONB,  -- Business questions this answers
    -- {questions: [], decisions: [], teams: []}
    
    complexity_score INTEGER CHECK (complexity_score BETWEEN 1 AND 5),  -- 1-5 rating
    
    -- ===============================
    -- GENERATION METADATA
    -- ===============================
    generated_by_model VARCHAR(100) DEFAULT 'gpt-4o-latest',
    generation_status VARCHAR(50) DEFAULT 'pending',  -- pending, processing, completed, failed
    generation_metadata JSONB,  -- {tokensUsed, estimatedCost, duration, layers: {}}
    error_details JSONB,  -- {layer, error, timestamp} if failed
    
    -- ===============================
    -- VERSIONING
    -- ===============================
    version INTEGER DEFAULT 1,
    is_current BOOLEAN DEFAULT true,
    previous_version_id UUID REFERENCES metadata.object_documentation(id),
    
    -- ===============================
    -- TIMESTAMPS
    -- ===============================
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_at TIMESTAMPTZ,
    
    -- ===============================
    -- CONSTRAINTS
    -- ===============================
    UNIQUE(object_id, version),
    CHECK (generation_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

-- Indexes for performance
CREATE INDEX idx_doc_object_id ON metadata.object_documentation(object_id);
CREATE INDEX idx_doc_organization_id ON metadata.object_documentation(organization_id);
CREATE INDEX idx_doc_generation_status ON metadata.object_documentation(generation_status);
CREATE INDEX idx_doc_current_version ON metadata.object_documentation(is_current) WHERE is_current = true;
CREATE INDEX idx_doc_generated_at ON metadata.object_documentation(generated_at DESC);

-- Comment for documentation
COMMENT ON TABLE metadata.object_documentation IS 'AI-generated multi-layer documentation for data objects';
COMMENT ON COLUMN metadata.object_documentation.executive_summary IS 'Layer 1: Brief business summary for executives';
COMMENT ON COLUMN metadata.object_documentation.business_narrative IS 'Layer 2: Detailed business story and data journey';
COMMENT ON COLUMN metadata.object_documentation.transformation_cards IS 'Layer 3: Visual transformation step cards';
COMMENT ON COLUMN metadata.object_documentation.code_explanations IS 'Layer 4: Code with plain English explanations';


-- =====================================================
-- DOCUMENTATION GENERATION JOBS
-- =====================================================

-- Tracks documentation generation jobs for batch processing
CREATE TABLE IF NOT EXISTS metadata.documentation_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES enterprise.github_connections(id) ON DELETE CASCADE,
    
    -- ===============================
    -- JOB CONFIGURATION
    -- ===============================
    object_ids UUID[],  -- Array of object IDs to document
    total_objects INTEGER NOT NULL,
    processed_objects INTEGER DEFAULT 0,
    failed_objects INTEGER DEFAULT 0,
    skipped_objects INTEGER DEFAULT 0,
    
    -- ===============================
    -- JOB STATUS
    -- ===============================
    status VARCHAR(50) DEFAULT 'queued',  -- queued, processing, completed, failed, cancelled, paused
    current_object_id UUID,  -- Currently processing object
    current_object_name TEXT,  -- Name for UI display
    
    -- ===============================
    -- PROGRESS TRACKING
    -- ===============================
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    estimated_completion_time TIMESTAMPTZ,
    actual_completion_time TIMESTAMPTZ,
    
    -- ===============================
    -- API CONFIGURATION
    -- ===============================
    api_provider VARCHAR(50) DEFAULT 'openai',  -- openai, anthropic, etc.
    model_name VARCHAR(100) DEFAULT 'gpt-4o-latest',
    api_key_id UUID,  -- Reference to stored API key
    
    -- ===============================
    -- COST & PERFORMANCE METRICS
    -- ===============================
    total_tokens_used BIGINT DEFAULT 0,
    prompt_tokens BIGINT DEFAULT 0,
    completion_tokens BIGINT DEFAULT 0,
    estimated_cost DECIMAL(10,4) DEFAULT 0,  -- In USD
    actual_cost DECIMAL(10,4) DEFAULT 0,  -- If available from API
    average_time_per_object INTERVAL,
    total_processing_time INTERVAL,
    
    -- ===============================
    -- LAYER COMPLETION TRACKING
    -- ===============================
    layers_completed JSONB DEFAULT '{}',  -- {layer1: 45, layer2: 42, ...}
    layers_failed JSONB DEFAULT '{}',  -- {layer1: 3, layer2: 5, ...}
    
    -- ===============================
    -- ERROR TRACKING
    -- ===============================
    error_log JSONB,  -- Array of error objects
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- ===============================
    -- ADMIN INFO
    -- ===============================
    triggered_by_user_id UUID REFERENCES auth.users(id),
    triggered_by_user_email TEXT,
    
    -- ===============================
    -- CONFIGURATION OPTIONS
    -- ===============================
    options JSONB,  -- {skipExisting: boolean, regenerateAll: boolean, etc.}
    
    -- ===============================
    -- TIMESTAMPS
    -- ===============================
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    
    -- ===============================
    -- CONSTRAINTS
    -- ===============================
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled', 'paused')),
    CHECK (progress_percentage BETWEEN 0 AND 100),
    CHECK (processed_objects <= total_objects)
);

-- Indexes for job management
CREATE INDEX idx_doc_jobs_org ON metadata.documentation_jobs(organization_id);
CREATE INDEX idx_doc_jobs_status ON metadata.documentation_jobs(status);
CREATE INDEX idx_doc_jobs_created ON metadata.documentation_jobs(created_at DESC);
CREATE INDEX idx_doc_jobs_connection ON metadata.documentation_jobs(connection_id);
CREATE INDEX idx_doc_jobs_triggered_by ON metadata.documentation_jobs(triggered_by_user_id);

-- Comment for documentation
COMMENT ON TABLE metadata.documentation_jobs IS 'Batch documentation generation jobs with progress tracking';
COMMENT ON COLUMN metadata.documentation_jobs.estimated_cost IS 'Estimated cost in USD based on token usage';


-- =====================================================
-- DETAILED GENERATION LOGS
-- =====================================================

-- Granular logs for each layer generation per object
CREATE TABLE IF NOT EXISTS metadata.documentation_generation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES metadata.documentation_jobs(id) ON DELETE CASCADE,
    object_id UUID REFERENCES metadata.objects(id) ON DELETE CASCADE,
    
    -- ===============================
    -- LAYER INFORMATION
    -- ===============================
    layer VARCHAR(50) NOT NULL,  -- executive_summary, business_narrative, etc.
    layer_display_name TEXT,  -- "Executive Summary", "Business Narrative"
    status VARCHAR(50) NOT NULL,  -- started, completed, failed, skipped
    
    -- ===============================
    -- PERFORMANCE METRICS
    -- ===============================
    tokens_used INTEGER,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    processing_time_ms INTEGER,
    
    -- ===============================
    -- QUALITY METRICS
    -- ===============================
    response_length INTEGER,  -- Characters in response
    confidence_score DECIMAL(3,2),  -- If available
    
    -- ===============================
    -- ERROR HANDLING
    -- ===============================
    error_message TEXT,
    error_code VARCHAR(50),
    retry_attempt INTEGER DEFAULT 0,
    
    -- ===============================
    -- API RESPONSE DATA
    -- ===============================
    model_used VARCHAR(100),
    finish_reason VARCHAR(50),  -- stop, length, content_filter, etc.
    raw_response JSONB,  -- Full API response for debugging
    
    -- ===============================
    -- TIMESTAMPS
    -- ===============================
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- ===============================
    -- CONSTRAINTS
    -- ===============================
    CHECK (status IN ('started', 'completed', 'failed', 'skipped', 'retrying'))
);

-- Indexes for log analysis
CREATE INDEX idx_doc_logs_job ON metadata.documentation_generation_logs(job_id);
CREATE INDEX idx_doc_logs_object ON metadata.documentation_generation_logs(object_id);
CREATE INDEX idx_doc_logs_layer ON metadata.documentation_generation_logs(layer);
CREATE INDEX idx_doc_logs_status ON metadata.documentation_generation_logs(status);
CREATE INDEX idx_doc_logs_created ON metadata.documentation_generation_logs(created_at DESC);

-- Comment for documentation
COMMENT ON TABLE metadata.documentation_generation_logs IS 'Detailed logs for each layer generation in documentation jobs';


-- =====================================================
-- DATABASE FUNCTIONS
-- =====================================================

-- Function to increment processed objects count
CREATE OR REPLACE FUNCTION metadata.increment_processed_objects(p_job_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE metadata.documentation_jobs
    SET 
        processed_objects = processed_objects + 1,
        progress_percentage = ROUND(((processed_objects + 1.0) / NULLIF(total_objects, 0)) * 100, 2),
        updated_at = NOW()
    WHERE id = p_job_id;
END;
$$;

-- Function to increment failed objects count
CREATE OR REPLACE FUNCTION metadata.increment_failed_objects(p_job_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE metadata.documentation_jobs
    SET 
        failed_objects = failed_objects + 1,
        updated_at = NOW()
    WHERE id = p_job_id;
END;
$$;

-- Function to update job status
CREATE OR REPLACE FUNCTION metadata.update_job_status(
    p_job_id UUID,
    p_status VARCHAR(50),
    p_error_details JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE metadata.documentation_jobs
    SET 
        status = p_status,
        updated_at = NOW(),
        started_at = CASE WHEN p_status = 'processing' THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
        error_log = CASE WHEN p_error_details IS NOT NULL THEN p_error_details ELSE error_log END
    WHERE id = p_job_id;
END;
$$;

-- Function to calculate average processing time
CREATE OR REPLACE FUNCTION metadata.update_average_processing_time(p_job_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_avg_time INTERVAL;
BEGIN
    -- Calculate average time from logs
    SELECT AVG(processing_time_ms * INTERVAL '1 millisecond')
    INTO v_avg_time
    FROM metadata.documentation_generation_logs
    WHERE job_id = p_job_id
    AND status = 'completed';
    
    -- Update job with average time
    UPDATE metadata.documentation_jobs
    SET 
        average_time_per_object = v_avg_time,
        updated_at = NOW()
    WHERE id = p_job_id;
END;
$$;

-- Function to estimate completion time
CREATE OR REPLACE FUNCTION metadata.update_estimated_completion(p_job_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_avg_time INTERVAL;
    v_remaining INTEGER;
    v_estimated_time TIMESTAMPTZ;
BEGIN
    -- Get average time and remaining objects
    SELECT 
        average_time_per_object,
        (total_objects - processed_objects)
    INTO v_avg_time, v_remaining
    FROM metadata.documentation_jobs
    WHERE id = p_job_id;
    
    -- Calculate estimated completion time
    IF v_avg_time IS NOT NULL AND v_remaining > 0 THEN
        v_estimated_time := NOW() + (v_avg_time * v_remaining);
        
        UPDATE metadata.documentation_jobs
        SET 
            estimated_completion_time = v_estimated_time,
            updated_at = NOW()
        WHERE id = p_job_id;
    END IF;
END;
$$;

-- Function to get documentation summary for an object
CREATE OR REPLACE FUNCTION metadata.get_documentation_summary(p_object_id UUID)
RETURNS TABLE (
    has_documentation BOOLEAN,
    current_version INTEGER,
    generated_at TIMESTAMPTZ,
    complexity_score INTEGER,
    layers_completed TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        true AS has_documentation,
        version,
        object_documentation.generated_at,
        object_documentation.complexity_score,
        ARRAY[
            CASE WHEN executive_summary IS NOT NULL THEN 'executive_summary' END,
            CASE WHEN business_narrative IS NOT NULL THEN 'business_narrative' END,
            CASE WHEN transformation_cards IS NOT NULL THEN 'transformation_cards' END,
            CASE WHEN code_explanations IS NOT NULL THEN 'code_explanations' END,
            CASE WHEN business_rules IS NOT NULL THEN 'business_rules' END,
            CASE WHEN impact_analysis IS NOT NULL THEN 'impact_analysis' END
        ]::TEXT[] AS layers_completed
    FROM metadata.object_documentation
    WHERE object_id = p_object_id
    AND is_current = true
    LIMIT 1;
END;
$$;


-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp for object_documentation
CREATE OR REPLACE FUNCTION metadata.update_documentation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_object_documentation_timestamp
    BEFORE UPDATE ON metadata.object_documentation
    FOR EACH ROW
    EXECUTE FUNCTION metadata.update_documentation_timestamp();

-- Auto-update updated_at timestamp for documentation_jobs
CREATE TRIGGER update_documentation_jobs_timestamp
    BEFORE UPDATE ON metadata.documentation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION metadata.update_documentation_timestamp();


-- =====================================================
-- GRANTS & PERMISSIONS
-- =====================================================

-- Grant permissions to service_role (for backend API)
GRANT ALL ON metadata.object_documentation TO service_role;
GRANT ALL ON metadata.documentation_jobs TO service_role;
GRANT ALL ON metadata.documentation_generation_logs TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION metadata.increment_processed_objects(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION metadata.increment_failed_objects(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION metadata.update_job_status(UUID, VARCHAR, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION metadata.update_average_processing_time(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION metadata.update_estimated_completion(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION metadata.get_documentation_summary(UUID) TO service_role;

-- Grant read access to authenticated users (for viewing documentation)
GRANT SELECT ON metadata.object_documentation TO authenticated;
GRANT SELECT ON metadata.documentation_jobs TO authenticated;
GRANT SELECT ON metadata.documentation_generation_logs TO authenticated;


-- =====================================================
-- SAMPLE DATA / COMMENTS
-- =====================================================

-- Add helpful comments for developers
COMMENT ON FUNCTION metadata.increment_processed_objects IS 'Atomically increment processed objects and recalculate progress';
COMMENT ON FUNCTION metadata.update_job_status IS 'Update job status with automatic timestamp management';
COMMENT ON FUNCTION metadata.get_documentation_summary IS 'Get quick summary of documentation status for an object';

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ AI Documentation Generation Tables Created Successfully!';
    RAISE NOTICE '📊 Tables: object_documentation, documentation_jobs, documentation_generation_logs';
    RAISE NOTICE '🔧 Functions: 6 helper functions for job management';
    RAISE NOTICE '🔐 Permissions: Granted to service_role and authenticated';
    RAISE NOTICE '📚 Ready for Phase 2: Backend Service Layer';
END $$;
