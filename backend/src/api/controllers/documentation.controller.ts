import { Request, Response } from 'express';
import { supabaseCodeInsights } from '../../config/supabaseClient';
import supabaseAdmin from '../../config/supabaseClient'; // For accessing user profiles
import { 
  getFileSummary as getFileSummaryService, 
  updateFileSummary as updateFileSummaryService, 
  saveAnalysisSettings as saveAnalysisSettingsService 
} from '../../services/documentation.service';

export const updateDocumentation = async (req: Request, res: Response) => {
  const { owner, repo, filePath, section, content } = req.body;
  const authHeader = req.headers.authorization;

  try {
    const updatedDoc = await updateFileSummaryService(authHeader, owner, repo, filePath, section, content);
    res.status(200).json(updatedDoc);
  } catch (error: any) {
    console.error(`Error in updateDocumentation controller: ${error.message}`);
    res.status(500).json({ error: 'Failed to update documentation.' });
  }
};

// Helper function to get repository ID from full name
async function getRepositoryId(supabase: any, owner: string, repo: string): Promise<number> {
    const { data: repoData, error: repoError } = await supabase
        .from('github_repositories')
        .select('id')
        .eq('owner', owner)
        .eq('name', repo)
        .single();

    if (repoError || !repoData) {
        throw new Error('Repository not found');
    }
    return repoData.id;
}

export const saveAnalysisSettings = async (req: Request, res: Response) => {
    try {
        const { repoFullName, businessOverview, namingStandards, language } = req.body;
        const userId = req.user?.id; // Get user ID from auth middleware
        
        console.log('Controller: Saving analysis settings', { repoFullName, userId: !!userId });
        
        await saveAnalysisSettingsService(req.headers.authorization, repoFullName, businessOverview, namingStandards, language, userId);
        res.status(200).json({ message: 'Settings saved successfully.' });
    } catch (error: any) {
        console.error('Error in saveAnalysisSettings controller:', error);
        res.status(500).json({ error: 'Failed to save analysis settings.', details: error.message });
    }
};

export const getDocumentation = async (req: Request, res: Response) => {
    const { owner, repo, path } = req.query;

    if (typeof owner !== 'string' || typeof repo !== 'string' || typeof path !== 'string') {
        return res.status(400).json({ error: 'owner, repo, and path are required query parameters.' });
    }

    try {
        const summary = await getFileSummaryService(owner, repo, path);
        if (summary) {
            res.status(200).json(summary);
        } else {
            res.status(404).json({ message: 'Documentation not found.' });
        }
    } catch (error: any) {
        console.error(`Error in getDocumentation controller: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch documentation.' });
    }
}; 