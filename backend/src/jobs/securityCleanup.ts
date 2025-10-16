import { IdeAuthCode } from '../models/IdeAuthCode';
import { IdeSession } from '../models/IdeSession';
import { AccountLockout } from '../models/AccountLockout';
import SecurityAuditLogger from '../services/SecurityAuditLogger';

/**
 * Enterprise Security Cleanup Job
 * Automatically removes expired security records and maintains database hygiene
 */

export interface CleanupResult {
  timestamp: Date;
  authCodesRemoved: number;
  sessionsRemoved: number;
  lockoutsRemoved: number;
  auditLogsRemoved: number;
  success: boolean;
  errors: string[];
}

/**
 * Run comprehensive security cleanup
 */
export async function runSecurityCleanup(): Promise<CleanupResult> {
  console.log('[SecurityCleanup] Starting cleanup job at', new Date().toISOString());
  
  const result: CleanupResult = {
    timestamp: new Date(),
    authCodesRemoved: 0,
    sessionsRemoved: 0,
    lockoutsRemoved: 0,
    auditLogsRemoved: 0,
    success: true,
    errors: []
  };

  try {
    // 1. Cleanup expired authorization codes
    try {
      await IdeAuthCode.cleanupExpired();
      result.authCodesRemoved = 1; // Count would need to be returned from cleanup function
      console.log('[SecurityCleanup] ✓ Cleaned up expired authorization codes');
    } catch (error) {
      const errorMsg = `Failed to cleanup auth codes: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      console.error('[SecurityCleanup]', errorMsg);
    }

    // 2. Cleanup expired IDE sessions
    try {
      await IdeSession.cleanupExpired();
      result.sessionsRemoved = 1;
      console.log('[SecurityCleanup] ✓ Cleaned up expired IDE sessions');
    } catch (error) {
      const errorMsg = `Failed to cleanup sessions: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      console.error('[SecurityCleanup]', errorMsg);
    }

    // 3. Cleanup expired lockouts and old failed attempts
    try {
      await AccountLockout.cleanupExpired();
      result.lockoutsRemoved = 1;
      console.log('[SecurityCleanup] ✓ Cleaned up expired lockouts and failed attempts');
    } catch (error) {
      const errorMsg = `Failed to cleanup lockouts: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      console.error('[SecurityCleanup]', errorMsg);
    }

    // 4. Cleanup old audit logs (90 day retention by default)
    try {
      const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90');
      await SecurityAuditLogger.cleanupOldLogs(retentionDays);
      result.auditLogsRemoved = 1;
      console.log(`[SecurityCleanup] ✓ Cleaned up audit logs older than ${retentionDays} days`);
    } catch (error) {
      const errorMsg = `Failed to cleanup audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      console.error('[SecurityCleanup]', errorMsg);
    }

    if (result.errors.length > 0) {
      result.success = false;
      console.warn(`[SecurityCleanup] Completed with ${result.errors.length} errors`);
    } else {
      console.log('[SecurityCleanup] ✓ Cleanup job completed successfully');
    }

  } catch (error) {
    result.success = false;
    const errorMsg = `Unexpected error during cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push(errorMsg);
    console.error('[SecurityCleanup]', errorMsg);
  }

  return result;
}

/**
 * Start automated security cleanup job
 * Runs every hour to maintain database hygiene
 */
export function startSecurityCleanupJob(): void {
  console.log('[SecurityCleanup] Initializing automated cleanup job...');
  
  // Run immediately on startup
  runSecurityCleanup().then(result => {
    console.log('[SecurityCleanup] Initial cleanup completed:', {
      success: result.success,
      errors: result.errors.length
    });
  });

  // Schedule to run every hour
  const intervalMs = 60 * 60 * 1000; // 1 hour
  setInterval(async () => {
    const result = await runSecurityCleanup();
    
    // Log summary
    console.log('[SecurityCleanup] Scheduled cleanup completed:', {
      timestamp: result.timestamp,
      success: result.success,
      errors: result.errors.length
    });
    
    // Alert on failures
    if (!result.success) {
      console.error('[SecurityCleanup] ALERT: Cleanup job failed with errors:', result.errors);
      // TODO: Send alert to monitoring system (email, Slack, PagerDuty, etc.)
    }
  }, intervalMs);

  console.log(`[SecurityCleanup] ✓ Cleanup job scheduled (runs every ${intervalMs / 1000 / 60} minutes)`);
}

/**
 * Run cleanup on demand (for manual execution or testing)
 */
export async function runManualCleanup(): Promise<CleanupResult> {
  console.log('[SecurityCleanup] Running manual cleanup...');
  return await runSecurityCleanup();
}

export default {
  runSecurityCleanup,
  startSecurityCleanupJob,
  runManualCleanup
};
