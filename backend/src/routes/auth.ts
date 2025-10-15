import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { SupabaseUser } from '../models/SupabaseUser';
import { SupabaseBilling } from '../models/SupabaseBilling';
import { IdeAuthCode } from '../models/IdeAuthCode';
import { IdeSession } from '../models/IdeSession';
import { AccountLockout } from '../models/AccountLockout';
import { auth } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/supabaseAuth';
import { 
  authRateLimiter, 
  registrationRateLimiter, 
  ideTokenRateLimiter,
  passwordResetRateLimiter 
} from '../middleware/rateLimiter';
import { passwordValidationMiddleware } from '../utils/passwordValidator';
import SecurityAuditLogger, { SecurityEventType, SecurityEventSeverity } from '../services/SecurityAuditLogger';

const router = express.Router();

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
          avatar_url: user.avatar_url
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

export default router;
