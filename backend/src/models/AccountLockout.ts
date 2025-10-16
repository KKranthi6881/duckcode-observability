import { supabaseDuckCode } from '../config/supabaseClient';

/**
 * Enterprise account lockout mechanism
 * Prevents brute force attacks by locking accounts after failed attempts
 */

export interface LockoutConfig {
  maxAttempts: number;
  lockoutDurationMinutes: number;
  trackingWindowMinutes: number;
}

export interface LockoutStatus {
  isLocked: boolean;
  attemptsRemaining: number;
  lockedUntil?: Date;
  totalAttempts: number;
}

// Default enterprise lockout policy
export const DEFAULT_LOCKOUT_CONFIG: LockoutConfig = {
  maxAttempts: 5,
  lockoutDurationMinutes: 30,
  trackingWindowMinutes: 15
};

export class AccountLockout {
  /**
   * Record a failed login attempt
   */
  static async recordFailedAttempt(
    identifier: string, // email or user_id
    ipAddress: string,
    config: LockoutConfig = DEFAULT_LOCKOUT_CONFIG
  ): Promise<LockoutStatus> {
    const now = new Date();
    const trackingWindow = new Date(now.getTime() - config.trackingWindowMinutes * 60 * 1000);

    // Get recent failed attempts within tracking window
    const { data: recentAttempts, error: fetchError } = await supabaseDuckCode
      .from('failed_login_attempts')
      .select('*')
      .eq('identifier', identifier)
      .gte('attempted_at', trackingWindow.toISOString())
      .order('attempted_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching failed attempts:', fetchError);
      throw new Error('Failed to check login attempts');
    }

    const totalAttempts = (recentAttempts?.length || 0) + 1;

    // Record this failed attempt
    const { error: insertError } = await supabaseDuckCode
      .from('failed_login_attempts')
      .insert({
        identifier,
        ip_address: ipAddress,
        attempted_at: now.toISOString()
      });

    if (insertError) {
      console.error('Error recording failed attempt:', insertError);
    }

    // Check if account should be locked
    if (totalAttempts >= config.maxAttempts) {
      const lockedUntil = new Date(now.getTime() + config.lockoutDurationMinutes * 60 * 1000);
      
      // Create or update lockout record
      const { error: lockError } = await supabaseDuckCode
        .from('account_lockouts')
        .upsert({
          identifier,
          locked_at: now.toISOString(),
          locked_until: lockedUntil.toISOString(),
          reason: 'too_many_failed_attempts',
          attempt_count: totalAttempts
        }, {
          onConflict: 'identifier'
        });

      if (lockError) {
        console.error('Error creating lockout:', lockError);
      }

      return {
        isLocked: true,
        attemptsRemaining: 0,
        lockedUntil,
        totalAttempts
      };
    }

    return {
      isLocked: false,
      attemptsRemaining: config.maxAttempts - totalAttempts,
      totalAttempts
    };
  }

  /**
   * Check if account is currently locked
   */
  static async checkLockoutStatus(
    identifier: string,
    config: LockoutConfig = DEFAULT_LOCKOUT_CONFIG
  ): Promise<LockoutStatus> {
    const now = new Date();

    // Check for active lockout
    const { data: lockout, error } = await supabaseDuckCode
      .from('account_lockouts')
      .select('*')
      .eq('identifier', identifier)
      .gte('locked_until', now.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking lockout status:', error);
    }

    if (lockout) {
      return {
        isLocked: true,
        attemptsRemaining: 0,
        lockedUntil: new Date(lockout.locked_until),
        totalAttempts: lockout.attempt_count || 0
      };
    }

    // Check recent failed attempts
    const trackingWindow = new Date(now.getTime() - config.trackingWindowMinutes * 60 * 1000);
    const { data: recentAttempts } = await supabaseDuckCode
      .from('failed_login_attempts')
      .select('*')
      .eq('identifier', identifier)
      .gte('attempted_at', trackingWindow.toISOString());

    const totalAttempts = recentAttempts?.length || 0;

    return {
      isLocked: false,
      attemptsRemaining: Math.max(0, config.maxAttempts - totalAttempts),
      totalAttempts
    };
  }

  /**
   * Clear failed attempts after successful login
   */
  static async clearFailedAttempts(identifier: string): Promise<void> {
    // Delete failed attempts
    const { error: deleteError } = await supabaseDuckCode
      .from('failed_login_attempts')
      .delete()
      .eq('identifier', identifier);

    if (deleteError) {
      console.error('Error clearing failed attempts:', deleteError);
    }

    // Delete lockout record
    const { error: lockoutError } = await supabaseDuckCode
      .from('account_lockouts')
      .delete()
      .eq('identifier', identifier);

    if (lockoutError && lockoutError.code !== 'PGRST116') {
      console.error('Error clearing lockout:', lockoutError);
    }
  }

  /**
   * Manually unlock an account (admin function)
   */
  static async unlockAccount(identifier: string): Promise<void> {
    await this.clearFailedAttempts(identifier);
  }

  /**
   * Cleanup expired lockouts and old failed attempts
   */
  static async cleanupExpired(): Promise<void> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Delete expired lockouts
    await supabaseDuckCode
      .from('account_lockouts')
      .delete()
      .lt('locked_until', now.toISOString());

    // Delete old failed attempts (older than 1 week)
    await supabaseDuckCode
      .from('failed_login_attempts')
      .delete()
      .lt('attempted_at', oneWeekAgo.toISOString());
  }

  /**
   * Get lockout statistics for monitoring
   */
  static async getLockoutStats(timeRangeHours: number = 24): Promise<{
    totalLockouts: number;
    activeLockouts: number;
    topLockedIdentifiers: Array<{ identifier: string; count: number }>;
  }> {
    const now = new Date();
    const timeRange = new Date(now.getTime() - timeRangeHours * 60 * 60 * 1000);

    // Get total lockouts in time range
    const { data: lockouts, error } = await supabaseDuckCode
      .from('account_lockouts')
      .select('*')
      .gte('locked_at', timeRange.toISOString());

    if (error) {
      console.error('Error fetching lockout stats:', error);
      return { totalLockouts: 0, activeLockouts: 0, topLockedIdentifiers: [] };
    }

    const activeLockouts = lockouts?.filter(l => new Date(l.locked_until) > now).length || 0;

    // Count lockouts by identifier
    const identifierCounts = new Map<string, number>();
    lockouts?.forEach(l => {
      identifierCounts.set(l.identifier, (identifierCounts.get(l.identifier) || 0) + 1);
    });

    const topLockedIdentifiers = Array.from(identifierCounts.entries())
      .map(([identifier, count]) => ({ identifier, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalLockouts: lockouts?.length || 0,
      activeLockouts,
      topLockedIdentifiers
    };
  }
}

export default AccountLockout;
