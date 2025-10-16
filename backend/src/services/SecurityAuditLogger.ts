import { supabaseDuckCode } from '../config/supabaseClient';

/**
 * Enterprise security audit logging service
 * Tracks all security-related events for compliance and monitoring
 */

export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  REGISTRATION = 'registration',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_COMPLETE = 'password_reset_complete',
  
  // Account security events
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  EMAIL_VERIFIED = 'email_verified',
  EMAIL_CHANGE = 'email_change',
  
  // Session events
  SESSION_CREATED = 'session_created',
  SESSION_REVOKED = 'session_revoked',
  SESSION_EXPIRED = 'session_expired',
  TOKEN_REFRESHED = 'token_refreshed',
  
  // Authorization events
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',
  ROLE_CHANGED = 'role_changed',
  ACCESS_DENIED = 'access_denied',
  
  // Security events
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_TOKEN = 'invalid_token',
  CSRF_DETECTED = 'csrf_detected',
  
  // API key events (for IDE)
  API_KEY_CREATED = 'api_key_created',
  API_KEY_ROTATED = 'api_key_rotated',
  API_KEY_REVOKED = 'api_key_revoked',
  
  // Admin events
  ADMIN_ACTION = 'admin_action',
  SECURITY_SETTINGS_CHANGED = 'security_settings_changed',
  USER_IMPERSONATION = 'user_impersonation'
}

export enum SecurityEventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface SecurityEventMetadata {
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  deviceId?: string;
  sessionId?: string;
  resource?: string;
  action?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  additionalInfo?: Record<string, any>;
}

export interface SecurityEvent {
  id?: string;
  event_type: SecurityEventType;
  severity: SecurityEventSeverity;
  user_id?: string;
  username?: string;
  email?: string;
  ip_address?: string;
  user_agent?: string;
  location?: string;
  device_id?: string;
  session_id?: string;
  resource?: string;
  action?: string;
  status: 'success' | 'failure' | 'pending';
  message: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export class SecurityAuditLogger {
  /**
   * Log a security event
   */
  static async logEvent(
    eventType: SecurityEventType,
    severity: SecurityEventSeverity,
    message: string,
    userId?: string,
    metadata?: SecurityEventMetadata,
    status: 'success' | 'failure' | 'pending' = 'success'
  ): Promise<void> {
    try {
      const event: Partial<SecurityEvent> = {
        event_type: eventType,
        severity,
        user_id: userId,
        ip_address: metadata?.ipAddress,
        user_agent: metadata?.userAgent,
        location: metadata?.location,
        device_id: metadata?.deviceId,
        session_id: metadata?.sessionId,
        resource: metadata?.resource,
        action: metadata?.action,
        status,
        message,
        metadata: metadata?.additionalInfo || {},
        created_at: new Date().toISOString()
      };

      const { error } = await supabaseDuckCode
        .from('security_audit_log')
        .insert(event);

      if (error) {
        console.error('Failed to log security event:', error);
        // Don't throw error to prevent breaking the main flow
      }

      // For critical events, also log to console
      if (severity === SecurityEventSeverity.CRITICAL) {
        console.error(`[CRITICAL SECURITY EVENT] ${eventType}: ${message}`, metadata);
      }
    } catch (error) {
      console.error('Error in security audit logger:', error);
    }
  }

  /**
   * Log successful login
   */
  static async logLoginSuccess(
    userId: string,
    email: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent(
      SecurityEventType.LOGIN_SUCCESS,
      SecurityEventSeverity.INFO,
      `User logged in successfully: ${email}`,
      userId,
      { ipAddress, userAgent }
    );
  }

  /**
   * Log failed login attempt
   */
  static async logLoginFailure(
    email: string,
    ipAddress: string,
    reason: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent(
      SecurityEventType.LOGIN_FAILED,
      SecurityEventSeverity.WARNING,
      `Failed login attempt for: ${email}. Reason: ${reason}`,
      undefined,
      { ipAddress, userAgent, additionalInfo: { email, reason } },
      'failure'
    );
  }

  /**
   * Log account lockout
   */
  static async logAccountLocked(
    identifier: string,
    ipAddress: string,
    attemptCount: number,
    lockedUntil: Date
  ): Promise<void> {
    await this.logEvent(
      SecurityEventType.ACCOUNT_LOCKED,
      SecurityEventSeverity.ERROR,
      `Account locked due to ${attemptCount} failed login attempts: ${identifier}`,
      undefined,
      { 
        ipAddress, 
        additionalInfo: { 
          identifier, 
          attemptCount, 
          lockedUntil: lockedUntil.toISOString() 
        } 
      },
      'failure'
    );
  }

  /**
   * Log password change
   */
  static async logPasswordChange(
    userId: string,
    email: string,
    ipAddress: string,
    initiatedBy: 'user' | 'admin' | 'reset' = 'user'
  ): Promise<void> {
    await this.logEvent(
      SecurityEventType.PASSWORD_CHANGE,
      SecurityEventSeverity.INFO,
      `Password changed for user: ${email}`,
      userId,
      { ipAddress, additionalInfo: { initiatedBy } }
    );
  }

  /**
   * Log session creation
   */
  static async logSessionCreated(
    userId: string,
    sessionId: string,
    sessionType: 'web' | 'ide',
    ipAddress: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent(
      SecurityEventType.SESSION_CREATED,
      SecurityEventSeverity.INFO,
      `New ${sessionType} session created`,
      userId,
      { ipAddress, userAgent, sessionId, additionalInfo: { sessionType } }
    );
  }

  /**
   * Log session revocation
   */
  static async logSessionRevoked(
    userId: string,
    sessionId: string,
    reason: string,
    revokedBy?: string
  ): Promise<void> {
    await this.logEvent(
      SecurityEventType.SESSION_REVOKED,
      SecurityEventSeverity.WARNING,
      `Session revoked: ${reason}`,
      userId,
      { sessionId, additionalInfo: { reason, revokedBy } }
    );
  }

  /**
   * Log rate limit exceeded
   */
  static async logRateLimitExceeded(
    ipAddress: string,
    endpoint: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent(
      SecurityEventType.RATE_LIMIT_EXCEEDED,
      SecurityEventSeverity.WARNING,
      `Rate limit exceeded for endpoint: ${endpoint}`,
      undefined,
      { ipAddress, userAgent, resource: endpoint },
      'failure'
    );
  }

  /**
   * Log suspicious activity
   */
  static async logSuspiciousActivity(
    description: string,
    userId?: string,
    ipAddress?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent(
      SecurityEventType.SUSPICIOUS_ACTIVITY,
      SecurityEventSeverity.CRITICAL,
      description,
      userId,
      { ipAddress, additionalInfo: metadata },
      'failure'
    );
  }

  /**
   * Get security events for a user
   */
  static async getUserEvents(
    userId: string,
    limit: number = 50,
    eventTypes?: SecurityEventType[]
  ): Promise<SecurityEvent[]> {
    let query = supabaseDuckCode
      .from('security_audit_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventTypes && eventTypes.length > 0) {
      query = query.in('event_type', eventTypes);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user security events:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get recent security events (admin function)
   */
  static async getRecentEvents(
    limit: number = 100,
    severity?: SecurityEventSeverity
  ): Promise<SecurityEvent[]> {
    let query = supabaseDuckCode
      .from('security_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching recent security events:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get security statistics
   */
  static async getSecurityStats(timeRangeHours: number = 24): Promise<{
    totalEvents: number;
    eventsBySeverity: Record<SecurityEventSeverity, number>;
    eventsByType: Record<string, number>;
    failedLogins: number;
    accountLockouts: number;
    suspiciousActivities: number;
  }> {
    const timeRange = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);

    const { data: events, error } = await supabaseDuckCode
      .from('security_audit_log')
      .select('*')
      .gte('created_at', timeRange.toISOString());

    if (error || !events) {
      return {
        totalEvents: 0,
        eventsBySeverity: {
          [SecurityEventSeverity.INFO]: 0,
          [SecurityEventSeverity.WARNING]: 0,
          [SecurityEventSeverity.ERROR]: 0,
          [SecurityEventSeverity.CRITICAL]: 0
        },
        eventsByType: {},
        failedLogins: 0,
        accountLockouts: 0,
        suspiciousActivities: 0
      };
    }

    const eventsBySeverity = events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<SecurityEventSeverity, number>);

    const eventsByType = events.reduce((acc, event) => {
      acc[event.event_type] = (acc[event.event_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEvents: events.length,
      eventsBySeverity,
      eventsByType,
      failedLogins: eventsByType[SecurityEventType.LOGIN_FAILED] || 0,
      accountLockouts: eventsByType[SecurityEventType.ACCOUNT_LOCKED] || 0,
      suspiciousActivities: eventsByType[SecurityEventType.SUSPICIOUS_ACTIVITY] || 0
    };
  }

  /**
   * Cleanup old audit logs (retention policy)
   */
  static async cleanupOldLogs(retentionDays: number = 90): Promise<void> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const { error } = await supabaseDuckCode
      .from('security_audit_log')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      console.error('Error cleaning up old audit logs:', error);
    }
  }
}

export default SecurityAuditLogger;
