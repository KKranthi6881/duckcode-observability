/**
 * AI Documentation Generation Controller
 * Handles job creation and management for AI-powered documentation generation
 */

import { Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase';
import { DocumentationJobOrchestrator } from '../../services/documentation/DocumentationJobOrchestrator';

/**
 * Create a new documentation generation job
 * POST /api/ai-documentation/jobs
 */
export async function createDocumentationJob(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const { objectIds, options } = req.body;
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Validate input
    if (!objectIds || !Array.isArray(objectIds) || objectIds.length === 0) {
      return res.status(400).json({ error: 'objectIds array is required and cannot be empty' });
    }

    // Verify user is admin of this organization
    const { data: userRole, error: roleError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('role_id, organization_roles!inner(name)')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (roleError || !userRole) {
      return res.status(403).json({ error: 'Only admins can generate documentation' });
    }

    const roleName = (userRole.organization_roles as any)?.[0]?.name || (userRole.organization_roles as any)?.name;
    if (roleName !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can generate documentation' });
    }

    // Create orchestrator
    const orchestrator = new DocumentationJobOrchestrator(organizationId);

    // Create job
    const jobId = await orchestrator.createJob(
      objectIds,
      options || {},
      userId,
      userEmail
    );

    // Start processing in background (don't await)
    orchestrator.processJob(jobId).catch(error => {
      console.error(`[AI-Doc API] Background job processing failed:`, error);
    });

    return res.status(201).json({
      jobId,
      status: 'queued',
      totalObjects: objectIds.length,
      message: 'Documentation generation job created successfully'
    });

  } catch (error: any) {
    console.error('[AI-Doc API] Error creating job:', error);
    return res.status(500).json({ 
      error: 'Failed to create documentation job',
      details: error.message 
    });
  }
}

/**
 * Get job status
 * GET /api/ai-documentation/jobs/:jobId
 */
export async function getJobStatus(req: Request, res: Response) {
  try {
    const { jobId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fetch job
    const { data: job, error } = await supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify user has access to this organization's jobs
    const { data: userOrg, error: orgError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('organization_id', job.organization_id)
      .single();

    if (orgError || !userOrg) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(job);

  } catch (error: any) {
    console.error('[AI-Doc API] Error fetching job status:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch job status',
      details: error.message 
    });
  }
}

/**
 * List jobs for an organization
 * GET /api/ai-documentation/organizations/:organizationId/jobs
 */
export async function listJobs(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const { status, limit = '20', offset = '0' } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify user has access to this organization
    const { data: userOrg, error: orgError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build query
    let query = supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: jobs, error, count } = await query;

    if (error) {
      throw error;
    }

    return res.json({
      jobs: jobs || [],
      total: count || 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

  } catch (error: any) {
    console.error('[AI-Doc API] Error listing jobs:', error);
    return res.status(500).json({ 
      error: 'Failed to list jobs',
      details: error.message 
    });
  }
}

/**
 * Cancel a running job
 * POST /api/ai-documentation/jobs/:jobId/cancel
 */
export async function cancelJob(req: Request, res: Response) {
  try {
    const { jobId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fetch job
    const { data: job, error } = await supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify user is admin of this organization
    const { data: userRole, error: roleError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('role_id, organization_roles!inner(name)')
      .eq('user_id', userId)
      .eq('organization_id', job.organization_id)
      .single();

    if (roleError || !userRole) {
      return res.status(403).json({ error: 'Only admins can cancel jobs' });
    }

    const roleName = (userRole.organization_roles as any)?.[0]?.name || (userRole.organization_roles as any)?.name;
    if (roleName !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can cancel jobs' });
    }

    // Cancel job
    const orchestrator = new DocumentationJobOrchestrator(job.organization_id);
    await orchestrator.cancelJob(jobId);

    return res.json({
      message: 'Job cancelled successfully',
      jobId
    });

  } catch (error: any) {
    console.error('[AI-Doc API] Error cancelling job:', error);
    return res.status(500).json({ 
      error: 'Failed to cancel job',
      details: error.message 
    });
  }
}

/**
 * Pause a running job
 * POST /api/ai-documentation/jobs/:jobId/pause
 */
export async function pauseJob(req: Request, res: Response) {
  try {
    const { jobId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fetch job
    const { data: job, error } = await supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify user is admin
    const { data: userRole, error: roleError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('role_id, organization_roles!inner(name)')
      .eq('user_id', userId)
      .eq('organization_id', job.organization_id)
      .single();

    if (roleError || !userRole) {
      return res.status(403).json({ error: 'Only admins can pause jobs' });
    }

    const roleName = (userRole.organization_roles as any)?.[0]?.name || (userRole.organization_roles as any)?.name;
    if (roleName !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can pause jobs' });
    }

    // Pause job
    const orchestrator = new DocumentationJobOrchestrator(job.organization_id);
    await orchestrator.pauseJob(jobId);

    return res.json({
      message: 'Job paused successfully',
      jobId
    });

  } catch (error: any) {
    console.error('[AI-Doc API] Error pausing job:', error);
    return res.status(500).json({ 
      error: 'Failed to pause job',
      details: error.message 
    });
  }
}

/**
 * Resume a paused job
 * POST /api/ai-documentation/jobs/:jobId/resume
 */
export async function resumeJob(req: Request, res: Response) {
  try {
    const { jobId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fetch job
    const { data: job, error } = await supabaseAdmin
      .schema('metadata')
      .from('documentation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify user is admin
    const { data: userRole, error: roleError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('role_id, organization_roles!inner(name)')
      .eq('user_id', userId)
      .eq('organization_id', job.organization_id)
      .single();

    if (roleError || !userRole) {
      return res.status(403).json({ error: 'Only admins can resume jobs' });
    }

    const roleName = (userRole.organization_roles as any)?.[0]?.name || (userRole.organization_roles as any)?.name;
    if (roleName !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can resume jobs' });
    }

    // Resume job (in background)
    const orchestrator = new DocumentationJobOrchestrator(job.organization_id);
    orchestrator.resumeJob(jobId).catch(error => {
      console.error(`[AI-Doc API] Background job resume failed:`, error);
    });

    return res.json({
      message: 'Job resumed successfully',
      jobId
    });

  } catch (error: any) {
    console.error('[AI-Doc API] Error resuming job:', error);
    return res.status(500).json({ 
      error: 'Failed to resume job',
      details: error.message 
    });
  }
}

/**
 * Get generated documentation for an object
 * GET /api/ai-documentation/objects/:objectId/documentation
 */
export async function getObjectDocumentation(req: Request, res: Response) {
  try {
    const { objectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fetch documentation
    const { data: doc, error } = await supabaseAdmin
      .schema('metadata')
      .from('object_documentation')
      .select('*')
      .eq('object_id', objectId)
      .eq('is_current', true)
      .single();

    if (error || !doc) {
      return res.status(404).json({ error: 'Documentation not found' });
    }

    // Verify user has access to this organization
    const { data: userOrg, error: orgError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('organization_id', doc.organization_id)
      .single();

    if (orgError || !userOrg) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(doc);

  } catch (error: any) {
    console.error('[AI-Doc API] Error fetching documentation:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch documentation',
      details: error.message 
    });
  }
}
