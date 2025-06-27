import { supabaseCodeInsights } from '../config/supabaseClient';

export const saveAnalysisSettings = async (authHeader: string | undefined, repoFullName: string, businessOverview: string, namingStandards: string, language: string, userId?: string) => {
    // Validate repository name format
    if (!repoFullName || !repoFullName.includes('/')) {
        throw new Error('Invalid repository name provided. Expected format: owner/repo');
    }

    console.log('Saving analysis settings for repository:', repoFullName);

    // Prepare the upsert data
    const upsertData: any = {
        repository_full_name: repoFullName,
        business_overview: businessOverview,
        naming_standards: namingStandards,
        language: language,
        updated_at: new Date().toISOString()
    };

    // Add created_by only on first insert (not on updates)
    if (userId) {
        upsertData.created_by = userId;
    }

    const { error } = await supabaseCodeInsights
        .from('repository_analysis_settings')
        .upsert(upsertData, { onConflict: 'repository_full_name' });
    
    if (error) {
        console.error('Error saving analysis settings:', error);
        throw error;
    }

    console.log('Analysis settings saved successfully for:', repoFullName);
};

export const getFileSummary = async (owner: string, repo: string, path: string) => {
    const { data, error } = await supabaseCodeInsights
        .from('file_summaries')
        .select('*')
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .eq('file_path', path)
        .single();

    if (error && error.code !== 'PGRST116') { // Ignore 'range not found' errors
        throw error;
    }
    return data;
};

export const updateFileSummary = async (authHeader: string | undefined, owner: string, repo: string, filePath: string, section: string, content: any) => {
    const { data: userData, error: userError } = await supabaseCodeInsights.auth.getUser();
    if (userError || !userData.user) {
        throw new Error('User not authenticated');
    }

    // First, fetch the current summary
    const { data: currentSummary, error: fetchError } = await supabaseCodeInsights
        .from('file_summaries')
        .select('summary, _metadata')
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .eq('file_path', filePath)
        .single();

    if (fetchError) throw new Error(`Failed to fetch current summary: ${fetchError.message}`);

    const newSummary = currentSummary.summary || {};
    const newMetadata = currentSummary._metadata || {};

    // Update the content
    // This is a simplified update, you might need more complex logic here
    // based on the section (e.g., nested objects)
    const sectionParts = section.split('.');
    let currentLevel = newSummary;
    for (let i = 0; i < sectionParts.length - 1; i++) {
        currentLevel = currentLevel[sectionParts[i]];
    }
    currentLevel[sectionParts[sectionParts.length - 1]] = content;

    // Update metadata
    if (!newMetadata.section_updates) {
        newMetadata.section_updates = {};
    }
    newMetadata.section_updates[section] = {
        updated_at: new Date().toISOString(),
        full_name: 'Current User', // Replace with actual user name if available
        id: userData.user.id
    };

    const { data: updatedData, error: updateError } = await supabaseCodeInsights
        .from('file_summaries')
        .update({
            summary: newSummary,
            _metadata: newMetadata,
            last_processed_at: new Date().toISOString()
        })
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .eq('file_path', filePath)
        .select()
        .single();
    
    if (updateError) throw new Error(`Failed to update summary: ${updateError.message}`);

    return updatedData;
}; 