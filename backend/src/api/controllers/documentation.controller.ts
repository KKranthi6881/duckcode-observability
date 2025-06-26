import { Request, Response } from 'express';
import { supabaseCodeInsights } from '../../config/supabaseClient';
import supabaseAdmin from '../../config/supabaseClient'; // For accessing user profiles

export const updateDocumentation = async (req: Request, res: Response) => {
  try {
    const { owner, repo, filePath, section, content } = req.body;

    // Validate required fields
    if (!owner || !repo || !filePath || !section || content === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: owner, repo, filePath, section, content'
      });
    }

    // Get the user from the request (assuming auth middleware sets this)
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const repositoryFullName = `${owner}/${repo}`;

    // Get user profile information for display
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();

    const userInfo = {
      id: user.id,
      full_name: userProfile?.full_name || user.email || 'Unknown User',
      avatar_url: userProfile?.avatar_url || null,
      updated_at: new Date().toISOString()
    };

    console.log('User info for update:', userInfo);

    // First, find the file record to get the file_id
    const { data: fileRecord, error: fileError } = await supabaseCodeInsights
      .from('files')
      .select('id, file_path, language')
      .eq('repository_full_name', repositoryFullName)
      .eq('file_path', filePath)
      .eq('user_id', user.id)
      .single();

    if (fileError || !fileRecord) {
      console.error('File not found:', { repositoryFullName, filePath, error: fileError });
      return res.status(404).json({ error: 'File not found in database' });
    }

    // Now find or create a code summary for this file
    const { data: existingSummary, error: summaryError } = await supabaseCodeInsights
      .from('code_summaries')
      .select('id, summary_json')
      .eq('file_id', fileRecord.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let updatedSummaryJson: any;
    
    if (existingSummary && !summaryError) {
      // Update existing summary
      updatedSummaryJson = { ...existingSummary.summary_json };
      
      // Extract the actual content from OpenAI response structure if needed
      let actualContent = updatedSummaryJson;
      if (updatedSummaryJson?.choices?.[0]?.message?.content) {
        try {
          actualContent = JSON.parse(updatedSummaryJson.choices[0].message.content);
        } catch {
          actualContent = { summary: updatedSummaryJson.choices[0].message.content };
        }
      }
      
      // Add metadata tracking for the updated section
      if (!actualContent._metadata) {
        actualContent._metadata = {};
      }
      if (!actualContent._metadata.section_updates) {
        actualContent._metadata.section_updates = {};
      }
      
      // Track who updated this section and when
      actualContent._metadata.section_updates[section] = userInfo;
      
      // Parse the content if it's a JSON string (from frontend)
      let parsedContent = content;
      if (typeof content === 'string' && content.trim().startsWith('{')) {
        try {
          parsedContent = JSON.parse(content);
          console.log('Parsed content from JSON string:', parsedContent);
        } catch (error) {
          console.log('Content is not valid JSON, keeping as string:', error);
        }
      }
      
      // Update the specific section
      if (section.includes('.')) {
        // Handle nested properties like 'business_logic.main_objectives'
        const parts = section.split('.');
        if (parts.length === 2) {
          const [parentKey, childKey] = parts;
          if (!actualContent[parentKey]) actualContent[parentKey] = {};
          actualContent[parentKey][childKey] = parsedContent;
        } else if (parts.length === 3 && parts[0] === 'code_blocks') {
          // Handle code blocks like 'code_blocks.0.explanation'
          const [, blockIndex, propertyKey] = parts;
          const idx = parseInt(blockIndex);
          if (!actualContent.code_blocks) actualContent.code_blocks = [];
          if (!actualContent.code_blocks[idx]) actualContent.code_blocks[idx] = {};
          actualContent.code_blocks[idx][propertyKey] = parsedContent;
        }
      } else {
        actualContent[section] = parsedContent;
      }
      
      // Update the summary_json structure properly
      if (updatedSummaryJson?.choices?.[0]?.message?.content) {
        // If it's an OpenAI response structure, update the content within it
        updatedSummaryJson.choices[0].message.content = JSON.stringify(actualContent);
        // Also store the content directly for easier access
        Object.keys(actualContent).forEach(key => {
          updatedSummaryJson[key] = actualContent[key];
        });
      } else {
        // If it's direct content, replace the entire structure
        updatedSummaryJson = actualContent;
      }

      const { error: updateError } = await supabaseCodeInsights
        .from('code_summaries')
        .update({
          summary_json: updatedSummaryJson
        })
        .eq('id', existingSummary.id);

      if (updateError) {
        console.error('Error updating code summary:', updateError);
        return res.status(500).json({ error: 'Failed to update documentation' });
      }
    } else {
      // Create new summary record - we need a processing job first
      // Create a processing job entry
      const { data: jobData, error: jobError } = await supabaseCodeInsights
        .from('processing_jobs')
        .insert({
          file_id: fileRecord.id,
          status: 'completed',
          llm_model_used: 'manual-edit',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (jobError || !jobData) {
        console.error('Error creating processing job:', jobError);
        return res.status(500).json({ error: 'Failed to create processing job' });
      }

      // Create new summary with the updated content and metadata
      updatedSummaryJson = { 
        [section]: content,
        _metadata: {
          section_updates: {
            [section]: userInfo
          }
        }
      };

      const { error: insertError } = await supabaseCodeInsights
        .from('code_summaries')
        .insert({
          job_id: jobData.id,
          file_id: fileRecord.id,
          summary_json: updatedSummaryJson,
          llm_provider: 'manual',
          llm_model_name: 'user-edit',
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error creating code summary:', insertError);
        return res.status(500).json({ error: 'Failed to create documentation' });
      }
    }

    res.json({
      success: true,
      message: 'Documentation updated successfully',
      section,
      updatedContent: content,
      updatedBy: userInfo
    });

  } catch (error) {
    console.error('Error in updateDocumentation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 