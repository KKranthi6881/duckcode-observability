-- Fix execution_frequency constraint to include 'on_demand'
ALTER TABLE code_insights.data_lineage 
DROP CONSTRAINT IF EXISTS data_lineage_execution_frequency_check;

ALTER TABLE code_insights.data_lineage 
ADD CONSTRAINT data_lineage_execution_frequency_check 
CHECK (execution_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'monthly', 'adhoc', 'on_demand')); 