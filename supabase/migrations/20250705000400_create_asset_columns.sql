CREATE TABLE IF NOT EXISTS code_insights.asset_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES code_insights.data_assets(id) ON DELETE CASCADE,
    column_name TEXT NOT NULL,
    data_type TEXT,
    column_description TEXT,
    business_meaning TEXT, -- Stores AI-generated business context for the column
    is_primary_key BOOLEAN,
    is_foreign_key BOOLEAN,
    column_metadata JSONB, -- Stores rich, structured metadata like tags, tests, metrics
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(asset_id, column_name)
);

-- Grant permissions to the service_role so the edge function can write to it.
GRANT ALL ON TABLE code_insights.asset_columns TO service_role;

-- Enable Row Level Security
ALTER TABLE code_insights.asset_columns ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read-only access to all users"
ON code_insights.asset_columns FOR SELECT USING (true);

CREATE POLICY "Allow service_role to insert new columns"
ON code_insights.asset_columns FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Allow service_role to update columns"
ON code_insights.asset_columns FOR UPDATE TO service_role USING (true);

CREATE POLICY "Allow service_role to delete columns"
ON code_insights.asset_columns FOR DELETE TO service_role USING (true);