-- supabase/migrations/<timestamp>_initial_rls_setup.sql
-- This migration is for initial RLS setup.
-- Policies for custom tables will be added here in the future.

-- Example: Enable RLS on a hypothetical 'documents' table
-- ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Example: Policy to allow users to see only their own documents
-- CREATE POLICY "Users can view their own documents"
-- ON public.documents FOR SELECT
-- USING (auth.uid() = user_id);