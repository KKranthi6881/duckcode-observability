-- =====================================================
-- ENTERPRISE METADATA SCHEMA
-- Foundation for Data Catalog, Lineage, Quality, AI Chat
-- =====================================================

-- Create metadata schema
CREATE SCHEMA IF NOT EXISTS metadata;

-- =====================================================
-- CORE METADATA TABLES
-- =====================================================

-- GitHub Repository Connections
CREATE TABLE IF NOT EXISTS enterprise.github_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    repository_url TEXT NOT NULL,
    repository_name TEXT NOT NULL,
    repository_owner TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT 'main',
    access_token_encrypted TEXT NOT NULL, -- TODO: Use Supabase Vault
    status TEXT NOT NULL DEFAULT 'connected', -- connected, extracting, completed, error
    current_job_id UUID,
    last_extraction_at TIMESTAMPTZ,
    extraction_quality_score DECIMAL(5,2),
    total_files INTEGER DEFAULT 0,
    total_objects INTEGER DEFAULT 0,
    total_columns INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, repository_url)
);

-- Repository metadata
CREATE TABLE IF NOT EXISTS metadata.repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES enterprise.github_connections(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'git_repo', -- workspace, git_repo, monorepo
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, path)
);

-- File metadata
CREATE TABLE IF NOT EXISTS metadata.files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID NOT NULL REFERENCES metadata.repositories(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES enterprise.github_connections(id) ON DELETE CASCADE,
    relative_path TEXT NOT NULL,
    absolute_path TEXT NOT NULL,
    file_type TEXT NOT NULL, -- sql, python, pyspark, dbt, yaml
    dialect TEXT, -- postgresql, mysql, snowflake, spark, etc.
    size_bytes BIGINT,
    file_hash TEXT, -- SHA-256 for change detection
    parsed_at TIMESTAMPTZ,
    parser_used TEXT, -- rust, python-sqlglot, python-ast, dbt-manifest
    parse_confidence DECIMAL(3,2) DEFAULT 0.90,
    llm_validated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, absolute_path)
);

-- Database objects (tables, views, functions, CTEs, models)
CREATE TABLE IF NOT EXISTS metadata.objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES metadata.files(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES metadata.repositories(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES enterprise.github_connections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    schema_name TEXT,
    database_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN database_name IS NOT NULL AND schema_name IS NOT NULL 
            THEN database_name || '.' || schema_name || '.' || name
            WHEN schema_name IS NOT NULL 
            THEN schema_name || '.' || name
            ELSE name
        END
    ) STORED,
    object_type TEXT NOT NULL, -- table, view, function, procedure, cte, dbt_model, dataframe
    definition TEXT, -- SQL/Python code
    description TEXT, -- LLM-generated or user-provided
    metadata JSONB, -- Flexible storage (tags, properties, etc.)
    line_start INTEGER,
    line_end INTEGER,
    confidence DECIMAL(3,2) DEFAULT 0.90,
    llm_validated BOOLEAN DEFAULT FALSE,
    llm_validation_result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column metadata
CREATE TABLE IF NOT EXISTS metadata.columns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    object_id UUID NOT NULL REFERENCES metadata.objects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data_type TEXT,
    is_nullable BOOLEAN DEFAULT TRUE,
    is_primary_key BOOLEAN DEFAULT FALSE,
    is_foreign_key BOOLEAN DEFAULT FALSE,
    default_value TEXT,
    description TEXT,
    position INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(object_id, name)
);

-- Dependencies between objects
CREATE TABLE IF NOT EXISTS metadata.dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    source_object_id UUID NOT NULL REFERENCES metadata.objects(id) ON DELETE CASCADE,
    target_object_id UUID NOT NULL REFERENCES metadata.objects(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL, -- select, insert, update, delete, reference, import, dbt_ref
    column_level BOOLEAN DEFAULT FALSE,
    source_column TEXT,
    target_column TEXT,
    expression TEXT, -- SQL expression or code
    confidence DECIMAL(3,2) DEFAULT 0.90,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_object_id, target_object_id, dependency_type, source_column, target_column)
);

-- Column-level lineage
CREATE TABLE IF NOT EXISTS metadata.columns_lineage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    source_object_id UUID NOT NULL REFERENCES metadata.objects(id) ON DELETE CASCADE,
    source_column TEXT NOT NULL,
    target_object_id UUID NOT NULL REFERENCES metadata.objects(id) ON DELETE CASCADE,
    target_column TEXT NOT NULL,
    expression TEXT,
    transformation_type TEXT, -- direct, calculated, aggregated, joined, filtered
    confidence DECIMAL(3,2) DEFAULT 0.90,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_object_id, source_column, target_object_id, target_column)
);

-- Lineage paths (for quick traversal)
CREATE TABLE IF NOT EXISTS metadata.lineage_paths (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    ancestor_id UUID NOT NULL REFERENCES metadata.objects(id) ON DELETE CASCADE,
    descendant_id UUID NOT NULL REFERENCES metadata.objects(id) ON DELETE CASCADE,
    path_length INTEGER NOT NULL,
    path_objects JSONB, -- Array of object IDs
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ancestor_id, descendant_id)
);

-- Cross-file imports
CREATE TABLE IF NOT EXISTS metadata.imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    source_file_id UUID NOT NULL REFERENCES metadata.files(id) ON DELETE CASCADE,
    target_file_id UUID REFERENCES metadata.files(id) ON DELETE SET NULL,
    import_type TEXT NOT NULL, -- python_import, sql_include, dbt_ref, dbt_source, spark_table
    import_path TEXT NOT NULL,
    alias_name TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    line_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraints (PK, FK, UNIQUE, CHECK)
CREATE TABLE IF NOT EXISTS metadata.constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    object_id UUID NOT NULL REFERENCES metadata.objects(id) ON DELETE CASCADE,
    constraint_name TEXT,
    constraint_type TEXT NOT NULL, -- primary_key, foreign_key, unique, check, index
    columns JSONB, -- Array of column names
    referenced_object_id UUID REFERENCES metadata.objects(id) ON DELETE SET NULL,
    referenced_columns JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- EXTRACTION JOB TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS metadata_extraction_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES enterprise.github_connections(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL, -- full, incremental, revalidation
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    phase TEXT, -- discovery, parsing, validation, dependencies, lineage, quality
    progress INTEGER DEFAULT 0,
    files_total INTEGER DEFAULT 0,
    files_processed INTEGER DEFAULT 0,
    objects_extracted INTEGER DEFAULT 0,
    columns_extracted INTEGER DEFAULT 0,
    quality_score DECIMAL(5,2),
    config JSONB,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TANTIVY SEARCH INDEX METADATA
-- =====================================================

CREATE TABLE IF NOT EXISTS metadata.search_index_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    index_type TEXT NOT NULL, -- objects, columns, files
    last_indexed_at TIMESTAMPTZ,
    total_documents INTEGER DEFAULT 0,
    index_size_bytes BIGINT,
    index_version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending', -- pending, indexing, ready, error
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, index_type)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Files indexes
CREATE INDEX idx_files_repository ON metadata.files(repository_id);
CREATE INDEX idx_files_organization ON metadata.files(organization_id);
CREATE INDEX idx_files_type ON metadata.files(file_type);
CREATE INDEX idx_files_hash ON metadata.files(file_hash);
CREATE INDEX idx_files_connection ON metadata.files(connection_id);

-- Objects indexes
CREATE INDEX idx_objects_file ON metadata.objects(file_id);
CREATE INDEX idx_objects_repository ON metadata.objects(repository_id);
CREATE INDEX idx_objects_organization ON metadata.objects(organization_id);
CREATE INDEX idx_objects_name ON metadata.objects(name);
CREATE INDEX idx_objects_full_name ON metadata.objects(full_name);
CREATE INDEX idx_objects_type ON metadata.objects(object_type);
CREATE INDEX idx_objects_connection ON metadata.objects(connection_id);

-- Columns indexes
CREATE INDEX idx_columns_object ON metadata.columns(object_id);
CREATE INDEX idx_columns_organization ON metadata.columns(organization_id);
CREATE INDEX idx_columns_name ON metadata.columns(name);

-- Dependencies indexes
CREATE INDEX idx_dependencies_source ON metadata.dependencies(source_object_id);
CREATE INDEX idx_dependencies_target ON metadata.dependencies(target_object_id);
CREATE INDEX idx_dependencies_organization ON metadata.dependencies(organization_id);
CREATE INDEX idx_dependencies_type ON metadata.dependencies(dependency_type);

-- Lineage indexes
CREATE INDEX idx_lineage_source ON metadata.columns_lineage(source_object_id);
CREATE INDEX idx_lineage_target ON metadata.columns_lineage(target_object_id);
CREATE INDEX idx_lineage_organization ON metadata.columns_lineage(organization_id);
CREATE INDEX idx_lineage_source_col ON metadata.columns_lineage(source_object_id, source_column);
CREATE INDEX idx_lineage_target_col ON metadata.columns_lineage(target_object_id, target_column);

-- Lineage paths indexes
CREATE INDEX idx_paths_ancestor ON metadata.lineage_paths(ancestor_id);
CREATE INDEX idx_paths_descendant ON metadata.lineage_paths(descendant_id);
CREATE INDEX idx_paths_organization ON metadata.lineage_paths(organization_id);

-- Imports indexes
CREATE INDEX idx_imports_source ON metadata.imports(source_file_id);
CREATE INDEX idx_imports_target ON metadata.imports(target_file_id);
CREATE INDEX idx_imports_organization ON metadata.imports(organization_id);

-- Jobs indexes
CREATE INDEX idx_jobs_connection ON metadata_extraction_jobs(connection_id);
CREATE INDEX idx_jobs_organization ON metadata_extraction_jobs(organization_id);
CREATE INDEX idx_jobs_status ON metadata_extraction_jobs(status);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE enterprise.github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.columns_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.lineage_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata_extraction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.search_index_status ENABLE ROW LEVEL SECURITY;

-- GitHub connections policies
CREATE POLICY github_connections_org_isolation ON enterprise.github_connections
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    ));

-- Metadata policies (organization isolation)
CREATE POLICY metadata_repos_org_isolation ON metadata.repositories
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY metadata_files_org_isolation ON metadata.files
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY metadata_objects_org_isolation ON metadata.objects
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY metadata_columns_org_isolation ON metadata.columns
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY metadata_dependencies_org_isolation ON metadata.dependencies
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY metadata_lineage_org_isolation ON metadata.columns_lineage
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY metadata_paths_org_isolation ON metadata.lineage_paths
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY metadata_imports_org_isolation ON metadata.imports
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY metadata_constraints_org_isolation ON metadata.constraints
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY jobs_org_isolation ON metadata_extraction_jobs
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY search_index_org_isolation ON metadata.search_index_status
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    ));

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_github_connections_updated_at
    BEFORE UPDATE ON enterprise.github_connections
    FOR EACH ROW EXECUTE FUNCTION update_metadata_updated_at();

CREATE TRIGGER update_repositories_updated_at
    BEFORE UPDATE ON metadata.repositories
    FOR EACH ROW EXECUTE FUNCTION update_metadata_updated_at();

CREATE TRIGGER update_files_updated_at
    BEFORE UPDATE ON metadata.files
    FOR EACH ROW EXECUTE FUNCTION update_metadata_updated_at();

CREATE TRIGGER update_objects_updated_at
    BEFORE UPDATE ON metadata.objects
    FOR EACH ROW EXECUTE FUNCTION update_metadata_updated_at();

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA metadata TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA metadata TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA metadata TO authenticated;
