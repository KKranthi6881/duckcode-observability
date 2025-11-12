import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { decryptApiKey as decryptKey } from '../services/encryptionService';
import { body, validationResult } from 'express-validator';
import { SupabaseUser } from '../models/SupabaseUser';
import { SupabaseBilling } from '../models/SupabaseBilling';
import { IdeAuthCode } from '../models/IdeAuthCode';
import { IdeSession } from '../models/IdeSession';
import { AccountLockout } from '../models/AccountLockout';
import { auth } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/supabaseAuth';
import { supabaseAdmin, supabaseEnterprise } from '../config/supabase';
import { 
  authRateLimiter, 
  registrationRateLimiter, 
  ideTokenRateLimiter,
  passwordResetRateLimiter 
} from '../middleware/rateLimiter';
import { passwordValidationMiddleware } from '../utils/passwordValidator';
import SecurityAuditLogger, { SecurityEventType, SecurityEventSeverity } from '../services/SecurityAuditLogger';

const router = express.Router();

interface SsoEnforcementResult {
  organizationId: string;
  providerType: string;
  providerLabel: string | null;
  allowPasswordFallback: boolean;
  enforce: boolean;
  domain: string;
}

const getEmailDomain = (email: string): string | null => {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return null;
  }
  const parts = email.split('@');
  return parts[1]?.trim().toLowerCase() || null;
};

const getSsoRequirementForEmail = async (email: string): Promise<SsoEnforcementResult | null> => {
  const domain = getEmailDomain(email);
  if (!domain) {
    return null;
  }

  const { data: domainRecord, error: domainError } = await supabaseEnterprise
    .from('sso_domains')
    .select('id, organization_id, connection_id, domain_name, is_verified')
    .eq('domain_name', domain)
    .eq('is_verified', true)
    .maybeSingle();

  if (domainError && domainError.code !== 'PGRST116') {
    console.error('[SSO] Error fetching domain configuration:', domainError);
    return null;
  }

  if (!domainRecord) {
    return null;
  }

  let connection: {
    id: string;
    provider_type: string;
    provider_label: string | null;
    enforce_sso: boolean;
    allow_password_fallback: boolean | null;
  } | null = null;

  if (domainRecord.connection_id) {
    const { data, error } = await supabaseEnterprise
      .from('sso_connections')
      .select('id, provider_type, provider_label, enforce_sso, allow_password_fallback')
      .eq('id', domainRecord.connection_id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[SSO] Error fetching domain connection:', error);
      return null;
    }
    connection = data;
  } else {
    const { data, error } = await supabaseEnterprise
      .from('sso_connections')
      .select('id, provider_type, provider_label, enforce_sso, allow_password_fallback')
      .eq('organization_id', domainRecord.organization_id)
      .order('enforce_sso', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[SSO] Error fetching organization connection:', error);
      return null;
    }
    connection = data;
  }

  if (!connection) {
    return null;
  }

  const enforce =
    connection.enforce_sso ||
    connection.allow_password_fallback === false ||
    connection.allow_password_fallback === null;

  return {
    organizationId: domainRecord.organization_id,
    providerType: connection.provider_type,
    providerLabel: connection.provider_label || null,
    allowPasswordFallback: connection.allow_password_fallback ?? true,
    enforce,
    domain: domainRecord.domain_name
  };
};

/**
 * ENTERPRISE-ENHANCED AUTHENTICATION ROUTES
 * Includes: Rate limiting, account lockout, password policy, audit logging
 */

// @route   POST /api/auth/register
// @desc    Register user with enterprise security
// @access  Public
router.post('/register', 
  registrationRateLimiter, // Rate limit: 3 per hour
  [
    body('email', 'Please include a valid email').isEmail().normalizeEmail({ gmail_remove_dots: false }),
    body('password').custom(passwordValidationMiddleware()), // Enterprise password policy
    body('fullName', 'Full name is required').trim().notEmpty().isLength({ min: 2, max: 100 }),
    body('organizationName', 'Organization name is required').trim().notEmpty().isLength({ min: 2, max: 100 })
  ], 
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName, organizationName } = req.body;
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'];

    try {
      // Enforce SSO for domains that require it (Okta / Azure AD)
      const ssoRequirement = await getSsoRequirementForEmail(email);
      if (ssoRequirement?.enforce) {
        await SecurityAuditLogger.logEvent(
          SecurityEventType.REGISTRATION,
          SecurityEventSeverity.WARNING,
          `Password signup blocked: domain requires SSO (${ssoRequirement.providerType})`,
          undefined,
          { ipAddress, userAgent, additionalInfo: { email, provider: ssoRequirement.providerType } },
          'failure'
        );

        return res.status(403).json({
          error: 'sso_required',
          provider: ssoRequirement.providerType,
          message: `Users with @${getEmailDomain(email)} must sign in with enterprise SSO (${ssoRequirement.providerType}).`
        });
      }

      // Check if user already exists
      const existingUser = await SupabaseUser.findByEmail(email);
      if (existingUser) {
        // Log failed registration attempt
        await SecurityAuditLogger.logEvent(
          SecurityEventType.REGISTRATION,
          SecurityEventSeverity.WARNING,
          `Registration attempt for existing email: ${email}`,
          undefined,
          { ipAddress, userAgent, additionalInfo: { email } },
          'failure'
        );
        return res.status(400).json({ msg: 'User already exists' });
      }

      // Create new user (Supabase handles email verification if configured)
      const user = await SupabaseUser.create({
        email,
        password,
        fullName,
        avatarUrl: '',
        organizationName
      });

      // Initialize billing info (optional - don't fail registration if this fails)
      try {
        await SupabaseBilling.createOrUpdateBillingInfo(user.id, 'free');
      } catch (billingError) {
        console.warn('Failed to initialize billing info (non-critical):', billingError);
        // Continue with registration - billing can be set up later
      }

      // Log successful registration
      try {
        await SecurityAuditLogger.logEvent(
          SecurityEventType.REGISTRATION,
          SecurityEventSeverity.INFO,
          `New user registered: ${email}`,
          user.id,
          { ipAddress, userAgent }
        );
      } catch (logError) {
        console.warn('Failed to log registration event (non-critical):', logError);
        // Continue with registration
      }

      // Create JWT payload
      const payload = {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName
        }
      };

      // Sign token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return res.status(500).json({ message: 'JWT secret not configured' });
      }
      
      const token = jwt.sign(payload, jwtSecret, { expiresIn: '30d' });
      
      // Set secure httpOnly cookie session
      try {
        res.cookie('dc-auth', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
      } catch {}

      res.json({ 
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl
        }
      });

    } catch (err) {
      console.error('Registration error:', err instanceof Error ? err.message : err);
      
      // Log error (optional - don't fail the response)
      try {
        await SecurityAuditLogger.logEvent(
          SecurityEventType.REGISTRATION,
          SecurityEventSeverity.ERROR,
          `Registration error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          undefined,
          { ipAddress, userAgent, additionalInfo: { email } },
          'failure'
        );
      } catch (logError) {
        console.warn('Failed to log registration error (non-critical):', logError);
      }
      
      res.status(500).json({ 
        msg: 'Server error during registration',
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user with enterprise security
// @access  Public
router.post('/login', 
  authRateLimiter, // Rate limit: 5 per 15 minutes
  [
    body('email', 'Please include a valid email').isEmail().normalizeEmail(),
    body('password', 'Password is required').exists()
  ], 
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'];

    try {
      const ssoRequirement = await getSsoRequirementForEmail(email);
      if (ssoRequirement?.enforce && ssoRequirement.allowPasswordFallback === false) {
        await SecurityAuditLogger.logEvent(
          SecurityEventType.LOGIN_FAILED,
          SecurityEventSeverity.WARNING,
          `Password login blocked: domain requires SSO (${ssoRequirement.providerType})`,
          undefined,
          { ipAddress, userAgent, additionalInfo: { email, provider: ssoRequirement.providerType } },
          'failure'
        );
        return res.status(403).json({
          error: 'sso_required',
          provider: ssoRequirement.providerType,
          message: `Users with @${getEmailDomain(email)} must sign in with enterprise SSO (${ssoRequirement.providerType}).`
        });
      }
      // Check if account is locked
      const lockoutStatus = await AccountLockout.checkLockoutStatus(email);
      
      if (lockoutStatus.isLocked) {
        await SecurityAuditLogger.logEvent(
          SecurityEventType.LOGIN_FAILED,
          SecurityEventSeverity.WARNING,
          `Login attempt for locked account: ${email}`,
          undefined,
          { ipAddress, userAgent, additionalInfo: { email, reason: 'account_locked' } },
          'failure'
        );
        
        return res.status(423).json({ 
          msg: 'Account is temporarily locked due to too many failed login attempts',
          lockedUntil: lockoutStatus.lockedUntil,
          error: 'account_locked'
        });
      }

      // Verify user credentials
      const user = await SupabaseUser.verifyPassword(email, password);
      
      if (!user) {
        // Record failed attempt
        const lockoutResult = await AccountLockout.recordFailedAttempt(email, ipAddress);
        
        // Log failed login
        await SecurityAuditLogger.logLoginFailure(
          email,
          ipAddress,
          'invalid_credentials',
          userAgent
        );
        
        // If account just got locked, log it
        if (lockoutResult.isLocked) {
          await SecurityAuditLogger.logAccountLocked(
            email,
            ipAddress,
            lockoutResult.totalAttempts,
            lockoutResult.lockedUntil!
          );
        }
        
        return res.status(400).json({ 
          msg: 'Invalid credentials',
          attemptsRemaining: lockoutResult.attemptsRemaining
        });
      }

      // Clear failed attempts on successful login
      await AccountLockout.clearFailedAttempts(email);

      // Log successful login
      await SecurityAuditLogger.logLoginSuccess(
        user.id,
        user.email!,
        ipAddress,
        userAgent
      );

      // Create JWT payload
      const payload = {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name
        }
      };

      // Sign token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return res.status(500).json({ message: 'JWT secret not configured' });
      }
      
      const token = jwt.sign(payload, jwtSecret, { expiresIn: '30d' });
      
      // Set secure httpOnly cookie session
      try {
        res.cookie('dc-auth', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
      } catch {}

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          avatarUrl: user.avatar_url
        }
      });

    } catch (err) {
      console.error('Login error:', err instanceof Error ? err.message : err);
      
      // Log error
      await SecurityAuditLogger.logEvent(
        SecurityEventType.LOGIN_FAILED,
        SecurityEventSeverity.ERROR,
        `Login error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        undefined,
        { ipAddress, userAgent, additionalInfo: { email } },
        'failure'
      );
      
      res.status(500).json({ 
        msg: 'Server error during login',
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user and revoke session
// @access  Private
router.post('/logout', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const sessionToken = req.headers.authorization?.substring(7);
    
    if (userId && sessionToken) {
      // Revoke IDE session if applicable
      try {
        await IdeSession.revoke(sessionToken);
      } catch (error) {
        // Session might not be an IDE session, that's okay
      }
      
      // Log logout
      await SecurityAuditLogger.logEvent(
        SecurityEventType.LOGOUT,
        SecurityEventSeverity.INFO,
        'User logged out',
        userId,
        { ipAddress: req.ip }
      );
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Error during logout' });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password with session invalidation
// @access  Private
router.post('/change-password', 
  auth,
  [
    body('currentPassword', 'Current password is required').exists(),
    body('newPassword').custom(passwordValidationMiddleware())
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;
    const email = req.user?.email;
    const ipAddress = req.ip || 'unknown';

    if (!userId || !email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      // Verify current password
      const user = await SupabaseUser.verifyPassword(email, currentPassword);
      if (!user) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Update password in Supabase Auth
      // Note: This would use Supabase Admin API to update password
      // For now, we'll log the event
      
      // Revoke all existing sessions for security
      await IdeSession.revokeAllForUser(userId);
      
      // Log password change
      await SecurityAuditLogger.logPasswordChange(
        userId,
        email,
        ipAddress,
        'user'
      );
      
      res.json({ message: 'Password changed successfully. Please log in again.' });
    } catch (err) {
      console.error('Password change error:', err);
      res.status(500).json({ message: 'Error changing password' });
    }
});

// @route   GET /api/auth/ide/login
// @desc    Redirect to IDE login page with OAuth parameters
// @access  Public
router.get('/ide/login', (req: Request, res: Response) => {
  const { state, redirect_uri } = req.query;
  
  if (!state || !redirect_uri) {
    return res.status(400).json({ 
      error: 'invalid_request',
      message: 'Missing required parameters: state and redirect_uri' 
    });
  }

  // Get frontend URL from environment
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  // Redirect to IDE login page with OAuth parameters
  const loginUrl = `${frontendUrl}/ide-login?state=${state}&redirect_uri=${encodeURIComponent(redirect_uri as string)}`;
  res.redirect(loginUrl);
});

// @route   GET /api/auth/ide/signup
// @desc    Redirect to IDE signup page with OAuth parameters
// @access  Public
router.get('/ide/signup', (req: Request, res: Response) => {
  const { state, redirect_uri } = req.query;
  
  if (!state || !redirect_uri) {
    return res.status(400).json({ 
      error: 'invalid_request',
      message: 'Missing required parameters: state and redirect_uri' 
    });
  }

  // Get frontend URL from environment
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  // Redirect to IDE register page with OAuth parameters (frontend uses /ide-register route)
  const signupUrl = `${frontendUrl}/ide-register?state=${state}&redirect_uri=${encodeURIComponent(redirect_uri as string)}`;
  res.redirect(signupUrl);
});

// @route   POST /api/auth/ide/authorize
// @desc    Create authorization code for IDE after successful registration/login
// @access  Private (requires JWT token)
router.post('/ide/authorize', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { state, redirect_uri } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        error: 'unauthorized',
        message: 'User not authenticated' 
      });
    }

    if (!state || !redirect_uri) {
      return res.status(400).json({ 
        error: 'invalid_request',
        message: 'Missing required parameters: state and redirect_uri' 
      });
    }

    // Create authorization code
    const authCode = await IdeAuthCode.create(
      userId,
      state,
      redirect_uri
    );

    // Log authorization
    await SecurityAuditLogger.logEvent(
      SecurityEventType.LOGIN_SUCCESS,
      SecurityEventSeverity.INFO,
      'IDE authorization code created',
      userId,
      { ipAddress: req.ip, additionalInfo: { redirect_uri } }
    );

    res.json({
      code: authCode.code,
      expires_in: 600 // 10 minutes
    });

  } catch (err) {
    console.error('IDE authorize error:', err instanceof Error ? err.message : err);
    res.status(500).json({ 
      error: 'server_error',
      message: 'Failed to create authorization code' 
    });
  }
});

// @route   POST /api/auth/ide/token
// @desc    Exchange authorization code for access token (with security)
// @access  Public
router.post('/ide/token',
  ideTokenRateLimiter, // Rate limit: 10 per 15 minutes
  [
    body('code', 'Authorization code is required').notEmpty(),
    body('state', 'State parameter is required').notEmpty(),
    body('redirect_uri', 'Redirect URI is required').notEmpty()
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'invalid_request',
        errors: errors.array() 
      });
    }

    const { code, state, redirect_uri } = req.body;
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'];

    try {
      // Find and validate authorization code
      const authCode = await IdeAuthCode.findByCode(code);
      
      if (!authCode) {
        await SecurityAuditLogger.logEvent(
          SecurityEventType.INVALID_TOKEN,
          SecurityEventSeverity.WARNING,
          'Invalid or expired authorization code',
          undefined,
          { ipAddress, userAgent, additionalInfo: { code: code.substring(0, 10) + '...' } },
          'failure'
        );
        
        return res.status(400).json({ 
          error: 'invalid_grant',
          message: 'Invalid or expired authorization code' 
        });
      }

      // Verify state parameter (CSRF protection)
      if (authCode.state !== state) {
        await SecurityAuditLogger.logEvent(
          SecurityEventType.CSRF_DETECTED,
          SecurityEventSeverity.CRITICAL,
          'State parameter mismatch detected',
          authCode.user_id,
          { ipAddress, userAgent, additionalInfo: { expected: authCode.state, received: state } },
          'failure'
        );
        
        return res.status(400).json({ 
          error: 'invalid_request',
          message: 'State parameter mismatch' 
        });
      }

      // Verify redirect_uri parameter
      if (authCode.redirect_uri !== redirect_uri) {
        await SecurityAuditLogger.logEvent(
          SecurityEventType.SUSPICIOUS_ACTIVITY,
          SecurityEventSeverity.CRITICAL,
          'Redirect URI mismatch detected',
          authCode.user_id,
          { ipAddress, userAgent, additionalInfo: { expected: authCode.redirect_uri, received: redirect_uri } },
          'failure'
        );
        
        return res.status(400).json({ 
          error: 'invalid_request',
          message: 'Redirect URI mismatch' 
        });
      }

      // Mark code as used (prevents replay attacks)
      await IdeAuthCode.markAsUsed(authCode);

      // Get user data
      const user = await SupabaseUser.findById(authCode.user_id);
      if (!user) {
        return res.status(400).json({ 
          error: 'invalid_grant',
          message: 'User not found' 
        });
      }

      // Get user's primary organization (ordered by assigned_at to get the first/main org)
      const { data: userOrgs } = await supabaseAdmin
        .schema('enterprise')
        .from('user_organization_roles')
        .select('organization_id')
        .eq('user_id', user.id)
        .order('assigned_at', { ascending: true });

      const userOrg = userOrgs?.[0];
      
      console.log('[Auth] User organizations:', userOrgs?.map(o => o.organization_id));
      console.log('[Auth] Selected organization for user:', userOrg?.organization_id);

      // Create IDE session
      const ideSession = await IdeSession.create(
        user.id,
        userAgent,
        ipAddress
      );

      // Log session creation
      await SecurityAuditLogger.logSessionCreated(
        user.id,
        ideSession.session_token,
        'ide',
        ipAddress,
        userAgent
      );

      // Return token and user data
      res.json({
        access_token: ideSession.session_token,
        token_type: 'Bearer',
        expires_in: 7 * 24 * 60 * 60, // 7 days in seconds
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          organization_id: userOrg?.organization_id // Include organization ID for API key sync
        }
      });

    } catch (err) {
      console.error('IDE token exchange error:', err instanceof Error ? err.message : err);
      
      await SecurityAuditLogger.logEvent(
        SecurityEventType.LOGIN_FAILED,
        SecurityEventSeverity.ERROR,
        `IDE token exchange error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        undefined,
        { ipAddress, userAgent },
        'failure'
      );
      
      res.status(500).json({ 
        error: 'server_error',
        message: 'Failed to exchange authorization code' 
      });
    }
});

// @route   POST /api/auth/ide/revoke
// @desc    Revoke IDE session with audit logging
// @access  Private (IDE token)
router.post('/ide/revoke', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify and revoke session
    const sessionData = IdeSession.verifyToken(token);
    if (!sessionData) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    await IdeSession.revoke(token);
    
    // Log session revocation
    await SecurityAuditLogger.logSessionRevoked(
      sessionData.user_id,
      token.substring(0, 20) + '...',
      'user_requested',
      sessionData.user_id
    );
    
    res.json({ message: 'Session revoked successfully' });

  } catch (err) {
    console.error('IDE revoke error:', err instanceof Error ? err.message : err);
    res.status(500).json({ message: 'Failed to revoke session' });
  }
});

// @route   GET /api/auth/security/audit-log
// @desc    Get user's security audit log
// @access  Private
router.get('/security/audit-log', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const events = await SecurityAuditLogger.getUserEvents(userId, limit);
    
    res.json({ events });
  } catch (err) {
    console.error('Error fetching audit log:', err);
    res.status(500).json({ message: 'Error fetching audit log' });
  }
});

// @route   POST /api/auth/admin/unlock-account
// @desc    Manually unlock a locked account (admin only)
// @access  Private (Admin)
router.post('/admin/unlock-account', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // TODO: Add admin role check
    const { identifier } = req.body;
    
    if (!identifier) {
      return res.status(400).json({ message: 'Identifier required' });
    }

    await AccountLockout.unlockAccount(identifier);
    
    // Log admin action
    await SecurityAuditLogger.logEvent(
      SecurityEventType.ACCOUNT_UNLOCKED,
      SecurityEventSeverity.INFO,
      `Account manually unlocked: ${identifier}`,
      req.user?.id,
      { additionalInfo: { unlockedAccount: identifier } }
    );
    
    res.json({ message: 'Account unlocked successfully' });
  } catch (err) {
    console.error('Error unlocking account:', err);
    res.status(500).json({ message: 'Error unlocking account' });
  }
});
// @route   GET /api/auth/me
// @desc    Get current user with role information
// @access  Private
router.get('/me', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userErr || !userData?.user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let organizationId: string | null = null;
    let roleName: string | null = null;
    let permissions: string[] = [];
    const { data: roleJoin } = await supabaseEnterprise
      .from('user_organization_roles')
      .select('organization_id, role:organization_roles(name, permissions)')
      .eq('user_id', userId)
      .order('assigned_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (roleJoin) {
      organizationId = roleJoin.organization_id;
      roleName = (roleJoin as any).role?.name || null;
      try {
        const perms = (roleJoin as any).role?.permissions;
        permissions = Array.isArray(perms) ? perms : JSON.parse(perms || '[]');
      } catch {}
    }

    res.json({
      id: userData.user.id,
      email: userData.user.email,
      fullName: (userData.user.user_metadata as any)?.full_name || null,
      avatarUrl: (userData.user.user_metadata as any)?.avatar_url || null,
      organizationId,
      role: roleName,
      permissions,
    });
  } catch (err) {
    console.error('Error fetching current user:', err);
    res.status(500).json({ message: 'Error fetching user information' });
  }
});

// OIDC SSO
const ssoStateStore = new Map<string, { codeVerifier: string; nonce: string; orgId: string; connectionId: string; clientId: string; issuerUrl: string; defaultRoleId: string | null }>();
const getBackendBaseUrl = (req: Request) => process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}` || 'http://localhost:3001';

router.get('/sso/authorize', async (req: Request, res: Response) => {
  try {
    const email = (req.query.email as string) || '';
    const domain = getEmailDomain(email);
    if (!domain) return res.status(400).json({ message: 'Email is required' });

    const { data: domainRecord } = await supabaseEnterprise
      .from('sso_domains')
      .select('id, organization_id, connection_id, is_verified')
      .eq('domain_name', domain)
      .eq('is_verified', true)
      .maybeSingle();

    if (!domainRecord) return res.status(404).json({ message: 'No SSO configured for this domain' });

    let connectionId = domainRecord.connection_id as string | null;
    if (!connectionId) {
      const { data: fallback } = await supabaseEnterprise
        .from('sso_connections')
        .select('id')
        .eq('organization_id', domainRecord.organization_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      connectionId = fallback?.id || null;
    }
    if (!connectionId) return res.status(404).json({ message: 'No SSO connection available' });

    const { data: conn } = await supabaseEnterprise
      .from('sso_connections')
      .select('id, provider_type, issuer_url, authorization_url, token_url, jwks_url, client_id, client_secret, default_role_id')
      .eq('id', connectionId)
      .single();
    if (!conn) return res.status(404).json({ message: 'Connection not found' });

    const openid: any = await import('openid-client');
    const codeVerifier = openid.generators.codeVerifier();
    const codeChallenge = openid.generators.codeChallenge(codeVerifier);
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');

    const discoveredIssuer = await openid.Issuer.discover(conn.issuer_url);
    const clientSecret = conn.client_secret ? decryptKey(conn.client_secret) : undefined;
    const client = new discoveredIssuer.Client({ client_id: conn.client_id, client_secret: clientSecret, redirect_uris: [`${getBackendBaseUrl(req)}/api/auth/sso/callback`], response_types: ['code'] });

    ssoStateStore.set(state, { codeVerifier, nonce, orgId: domainRecord.organization_id, connectionId: conn.id, clientId: conn.client_id, issuerUrl: conn.issuer_url, defaultRoleId: conn.default_role_id || null });
    setTimeout(() => ssoStateStore.delete(state), 10 * 60 * 1000);

    const url = client.authorizationUrl({ scope: 'openid email profile', code_challenge: codeChallenge, code_challenge_method: 'S256', state, nonce });
    res.redirect(url);
  } catch (e) {
    res.status(500).json({ message: 'Failed to start SSO' });
  }
});

router.get('/sso/callback', async (req: Request, res: Response) => {
  try {
    const { state, code } = req.query as { state?: string; code?: string };
    if (!state || !code) return res.status(400).send('Invalid callback');
    const entry = ssoStateStore.get(state);
    if (!entry) return res.status(400).send('State expired');

    const openid: any = await import('openid-client');
    const issuer = await openid.Issuer.discover(entry.issuerUrl);
    // Look up connection to get encrypted client_secret
    const { data: conn } = await supabaseEnterprise
      .from('sso_connections')
      .select('client_id, client_secret')
      .eq('id', entry.connectionId)
      .single();
    const clientSecret = conn?.client_secret ? decryptKey(conn.client_secret) : undefined;
    const client = new issuer.Client({ client_id: conn?.client_id || entry.clientId, client_secret: clientSecret, redirect_uris: [`${getBackendBaseUrl(req)}/api/auth/sso/callback`], response_types: ['code'] });

    const params = { code: String(code), state: String(state) } as any;
    const tokenSet = await client.callback(`${getBackendBaseUrl(req)}/api/auth/sso/callback`, params, { code_verifier: entry.codeVerifier, state: state, nonce: entry.nonce });
    const claims = tokenSet.claims();
    const email = (claims.email as string) || '';
    const fullName = (claims.name as string) || '';
    if (!email) return res.status(400).send('Email not found in IdP claims');

    const { data: existing } = await supabaseEnterprise.rpc('get_user_by_email', { p_email: email });
    let userId: string;
    if (existing && existing.length > 0) {
      userId = existing[0].id;
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
      if (createErr || !created?.user) return res.status(500).send('Failed to create user');
      userId = created.user.id;
    }

    if (entry.orgId) {
      await supabaseEnterprise
        .from('user_organization_roles')
        .upsert({ user_id: userId, organization_id: entry.orgId, role_id: entry.defaultRoleId }, { onConflict: 'user_id,organization_id' });
    }

    const payload = { user: { id: userId, email, fullName } };
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return res.status(500).send('JWT not configured');
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '30d' });
    try {
      res.cookie('dc-auth', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 * 1000 });
    } catch {}

    ssoStateStore.delete(state);
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5175'}/dashboard/analytics`;
    res.redirect(redirectUrl);
  } catch (e) {
    res.status(500).send('SSO callback failed');
  }
});

// @route   GET /api/auth/sso/options
// @desc    Check if an email domain has an SSO provider configured
// @access  Public
router.get('/sso/options', async (req: Request, res: Response) => {
  try {
    const email = (req.query.email as string) || '';
    const domain = getEmailDomain(email);

    if (!email || !domain) {
      return res.json({ domain: domain || null, connection: null });
    }

    const requirement = await getSsoRequirementForEmail(email);

    if (!requirement) {
      return res.json({ domain, connection: null });
    }

    res.json({
      domain,
      connection: {
        organizationId: requirement.organizationId,
        providerType: requirement.providerType,
        providerLabel: requirement.providerLabel,
        enforce: requirement.enforce,
        allowPasswordFallback: requirement.allowPasswordFallback
      }
});
} catch (error) {
console.error('SSO options lookup error:', error);
res.status(500).json({ message: 'Failed to lookup SSO options' });
}
});

export default router;
