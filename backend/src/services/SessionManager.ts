import { IdeSession } from '../models/IdeSession';
import SecurityAuditLogger, { SecurityEventType, SecurityEventSeverity } from './SecurityAuditLogger';
import { supabaseDuckCode } from '../config/supabaseClient';

/**
 * Enterprise session management service
 * Handles session lifecycle, invalidation, and security
 */

export interface SessionInfo {
  sessionId: string;
  userId: string;
  sessionType: 'web' | 'ide';
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

export class SessionManager {
  /**
   * Invalidate all sessions for a user
   * Used when: password change, account compromise, admin action
   */
  static async invalidateAllUserSessions(
    userId: string,
    reason: string,
    initiatedBy?: string
  ): Promise<number> {
    try {
      // Revoke all IDE sessions
      await IdeSession.revokeAllForUser(userId);
      
      // Revoke all Supabase sessions
      await supabaseDuckCode.auth.admin.signOut(userId, 'global');
      
      // Log session invalidation
      await SecurityAuditLogger.logEvent(
        SecurityEventType.SESSION_REVOKED,
        SecurityEventSeverity.WARNING,
        `All sessions invalidated for user. Reason: ${reason}`,
        userId,
        { additionalInfo: { reason, initiatedBy } }
      );
      
      return 1; // Return count of users affected
    } catch (error) {
      console.error('Error invalidating user sessions:', error);
      throw error;
    }
  }

  /**
   * Invalidate a specific session
   */
  static async invalidateSession(
    sessionToken: string,
    reason: string,
    userId?: string
  ): Promise<void> {
    try {
      // Try to revoke as IDE session
      const sessionData = IdeSession.verifyToken(sessionToken);
      if (sessionData) {
        await IdeSession.revoke(sessionToken);
        
        await SecurityAuditLogger.logSessionRevoked(
          sessionData.user_id,
          sessionToken.substring(0, 20) + '...',
          reason,
          userId
        );
      }
    } catch (error) {
      console.error('Error invalidating session:', error);
      throw error;
    }
  }

  /**
   * Get all active sessions for a user
   */
  static async getUserSessions(userId: string): Promise<SessionInfo[]> {
    try {
      const { data: ideSessions, error } = await supabaseDuckCode
        .from('ide_sessions')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user sessions:', error);
        return [];
      }

      return (ideSessions || []).map(session => ({
        sessionId: session.id,
        userId: session.user_id,
        sessionType: 'ide' as const,
        createdAt: new Date(session.created_at),
        expiresAt: new Date(session.expires_at),
        lastUsedAt: session.last_used_at ? new Date(session.last_used_at) : undefined,
        ipAddress: session.ip_address,
        userAgent: session.user_agent
      }));
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Revoke sessions from suspicious IP addresses
   */
  static async revokeSessionsByIP(
    ipAddress: string,
    reason: string
  ): Promise<number> {
    try {
      const { data: sessions, error } = await supabaseDuckCode
        .from('ide_sessions')
        .select('*')
        .eq('ip_address', ipAddress)
        .gt('expires_at', new Date().toISOString());

      if (error || !sessions) {
        return 0;
      }

      let revokedCount = 0;
      for (const session of sessions) {
        await IdeSession.revoke(session.session_token);
        
        await SecurityAuditLogger.logSessionRevoked(
          session.user_id,
          session.session_token.substring(0, 20) + '...',
          reason,
          'system'
        );
        
        revokedCount++;
      }

      return revokedCount;
    } catch (error) {
      console.error('Error revoking sessions by IP:', error);
      return 0;
    }
  }

  /**
   * Detect and handle suspicious session activity
   */
  static async detectSuspiciousActivity(userId: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
  }> {
    try {
      const sessions = await this.getUserSessions(userId);
      const reasons: string[] = [];

      // Check for multiple concurrent sessions from different IPs
      const uniqueIPs = new Set(sessions.map(s => s.ipAddress).filter(Boolean));
      if (uniqueIPs.size >= 5) {
        reasons.push(`Multiple concurrent sessions from ${uniqueIPs.size} different IP addresses`);
      }

      // Check for rapid session creation
      const recentSessions = sessions.filter(s => 
        s.createdAt.getTime() > Date.now() - 15 * 60 * 1000 // Last 15 minutes
      );
      if (recentSessions.length >= 5) {
        reasons.push(`${recentSessions.length} sessions created in the last 15 minutes`);
      }

      // Check for sessions from unusual locations
      // This would require geolocation service integration

      if (reasons.length > 0) {
        await SecurityAuditLogger.logSuspiciousActivity(
          `Suspicious session activity detected: ${reasons.join(', ')}`,
          userId,
          undefined,
          { reasons, sessionCount: sessions.length }
        );
      }

      return {
        isSuspicious: reasons.length > 0,
        reasons
      };
    } catch (error) {
      console.error('Error detecting suspicious activity:', error);
      return { isSuspicious: false, reasons: [] };
    }
  }

  /**
   * Refresh IDE session token (with rotation)
   */
  static async refreshSession(
    refreshToken: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
    try {
      // Find session by refresh token
      const { data: session, error } = await supabaseDuckCode
        .from('ide_sessions')
        .select('*')
        .eq('refresh_token', refreshToken)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !session) {
        return null;
      }

      // Create new session with rotated tokens
      const newSession = await IdeSession.create(
        session.user_id,
        userAgent,
        ipAddress
      );

      // Revoke old session
      await IdeSession.revoke(session.session_token);

      // Log token refresh
      await SecurityAuditLogger.logEvent(
        SecurityEventType.TOKEN_REFRESHED,
        SecurityEventSeverity.INFO,
        'IDE session token refreshed',
        session.user_id,
        { ipAddress, userAgent, sessionId: newSession.id }
      );

      return {
        accessToken: newSession.session_token,
        refreshToken: newSession.refresh_token!,
        expiresIn: 7 * 24 * 60 * 60 // 7 days
      };
    } catch (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
  }

  /**
   * Cleanup expired sessions (scheduled task)
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      await IdeSession.cleanupExpired();
      return 1;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  /**
   * Get session statistics for monitoring
   */
  static async getSessionStats(): Promise<{
    totalActiveSessions: number;
    ideSessionCount: number;
    webSessionCount: number;
    sessionsLast24h: number;
  }> {
    try {
      const { data: ideSessions } = await supabaseDuckCode
        .from('ide_sessions')
        .select('*', { count: 'exact' })
        .gt('expires_at', new Date().toISOString());

      const { data: recentSessions } = await supabaseDuckCode
        .from('ide_sessions')
        .select('*', { count: 'exact' })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      return {
        totalActiveSessions: ideSessions?.length || 0,
        ideSessionCount: ideSessions?.length || 0,
        webSessionCount: 0, // Would need to query Supabase auth sessions
        sessionsLast24h: recentSessions?.length || 0
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      return {
        totalActiveSessions: 0,
        ideSessionCount: 0,
        webSessionCount: 0,
        sessionsLast24h: 0
      };
    }
  }
}

export default SessionManager;
