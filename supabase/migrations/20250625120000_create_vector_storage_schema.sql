-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create vectors table for storing document embeddings
CREATE TABLE code_insights.document_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES code_insights.files(id) ON DELETE CASCADE NOT NULL,
    chunk_id TEXT NOT NULL, -- Unique identifier for the text chunk within the file
    chunk_type TEXT NOT NULL, -- 'summary', 'business_logic', 'code_block', 'technical_details', 'full_content'
    content TEXT NOT NULL, -- The actual text content that was embedded
    metadata JSONB DEFAULT '{}', -- Additional metadata like line numbers, section names, etc.
    embedding vector(1536), -- OpenAI text-embedding-ada-002 produces 1536-dimensional vectors
    token_count INTEGER, -- Number of tokens in the content
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create unique constraint to prevent duplicate embeddings for the same chunk
CREATE UNIQUE INDEX idx_document_vectors_file_chunk ON code_insights.document_vectors(file_id, chunk_id);

-- Create vector similarity search indexes (using cosine distance)
CREATE INDEX idx_document_vectors_embedding_cosine ON code_insights.document_vectors 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create additional indexes for efficient filtering
CREATE INDEX idx_document_vectors_file_id ON code_insights.document_vectors(file_id);
CREATE INDEX idx_document_vectors_chunk_type ON code_insights.document_vectors(chunk_type);
CREATE INDEX idx_document_vectors_created_at ON code_insights.document_vectors(created_at);

-- Create table for storing search queries and their results (for analytics)
CREATE TABLE code_insights.search_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    query_text TEXT NOT NULL,
    search_type TEXT NOT NULL, -- 'semantic', 'keyword', 'hybrid'
    filters JSONB DEFAULT '{}', -- Applied filters like file_types, repositories, etc.
    results_count INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create index for search analytics
CREATE INDEX idx_search_queries_user_id ON code_insights.search_queries(user_id);
CREATE INDEX idx_search_queries_created_at ON code_insights.search_queries(created_at);

-- Grant permissions
GRANT ALL PRIVILEGES ON code_insights.document_vectors TO service_role;
GRANT ALL PRIVILEGES ON code_insights.search_queries TO service_role;

-- Update default privileges for future objects
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA code_insights
    GRANT ALL ON TABLES TO service_role;

-- Add helpful comments
COMMENT ON TABLE code_insights.document_vectors IS 'Stores vector embeddings for semantic search across code files and documentation';
COMMENT ON COLUMN code_insights.document_vectors.chunk_type IS 'Type of content: summary, business_logic, code_block, technical_details, full_content';
COMMENT ON COLUMN code_insights.document_vectors.embedding IS 'Vector embedding using OpenAI text-embedding-ada-002 (1536 dimensions)';
COMMENT ON COLUMN code_insights.document_vectors.metadata IS 'Additional context like line numbers, section names, function names, table names, etc.';

COMMENT ON TABLE code_insights.search_queries IS 'Tracks user search queries for analytics and improving search relevance';

-- Create a function for vector similarity search
CREATE OR REPLACE FUNCTION code_insights.search_similar_content(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.8,
    match_count int DEFAULT 10,
    filter_file_ids UUID[] DEFAULT NULL,
    filter_chunk_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    file_id UUID,
    chunk_id TEXT,
    chunk_type TEXT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT,
    file_path TEXT,
    repository_full_name TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dv.id,
        dv.file_id,
        dv.chunk_id,
        dv.chunk_type,
        dv.content,
        dv.metadata,
        1 - (dv.embedding <=> query_embedding) as similarity,
        f.file_path,
        f.repository_full_name
    FROM code_insights.document_vectors dv
    JOIN code_insights.files f ON dv.file_id = f.id
    WHERE 
        (1 - (dv.embedding <=> query_embedding)) > match_threshold
        AND (filter_file_ids IS NULL OR dv.file_id = ANY(filter_file_ids))
        AND (filter_chunk_types IS NULL OR dv.chunk_type = ANY(filter_chunk_types))
    ORDER BY dv.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant execute permission on the search function
GRANT EXECUTE ON FUNCTION code_insights.search_similar_content TO service_role;

-- Create a function to get embedding for text using OpenAI API (placeholder - will implement in backend)
CREATE OR REPLACE FUNCTION code_insights.get_embedding_placeholder()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    -- This is a placeholder function
    -- The actual embedding generation will be handled in the application layer
    RETURN 'Embedding generation handled in application layer';
END;
$$; 