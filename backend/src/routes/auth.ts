import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { SupabaseUser } from '../models/SupabaseUser';
import { SupabaseBilling } from '../models/SupabaseBilling';
import { IdeAuthCode } from '../models/IdeAuthCode';
import { IdeSession } from '../models/IdeSession';
import { auth } from '../middleware/auth';
import { supabaseAuth, AuthenticatedRequest } from '../middleware/supabaseAuth';
import crypto from 'crypto';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', [
  body('email', 'Please include a valid email').isEmail(),
  body('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
  body('fullName', 'Full name is required').not().isEmpty()
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, fullName } = req.body;

  try {
    // Check if user already exists
    const existingUser = await SupabaseUser.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Create new user
    const user = await SupabaseUser.create({
      email,
      password,
      fullName,
      avatarUrl: ''
    });

    // Initialize billing info
    await SupabaseBilling.createOrUpdateBillingInfo(user.id, 'free');

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
    console.error('Registration error:', err instanceof Error ? err.message : err);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', [
  body('email', 'Please include a valid email').isEmail(),
  body('password', 'Password is required').exists()
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Verify user credentials
    const user = await SupabaseUser.verifyPassword(email, password);
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

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
    res.status(500).send('Server error');
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    const user = await SupabaseUser.findById(req.user.id);
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err instanceof Error ? err.message : err);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/auth/ide/decode-oauth
// @desc    Decode OAuth JWT token to get state and redirect_uri
// @access  Public
router.post('/ide/decode-oauth', async (req: Request, res: Response) => {
  try {
    const { oauth_token } = req.body;

    if (!oauth_token) {
      return res.status(400).json({ error: 'Missing oauth_token' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';
    const decoded = jwt.verify(oauth_token, jwtSecret) as any;

    if (decoded.type !== 'oauth_flow') {
      return res.status(400).json({ error: 'Invalid token type' });
    }

    res.json({
      state: decoded.state,
      redirect_uri: decoded.redirect_uri
    });
  } catch (error) {
    console.error('OAuth token decode error:', error);
    res.status(400).json({ error: 'Invalid or expired oauth_token' });
  }
});

// @route   GET /api/auth/ide/authorize
// @desc    Initiate IDE authorization (OAuth-style flow with JWT support)
// IDE Authorization endpoint - creates auth code and returns redirect URL
router.get('/ide/authorize', async (req: Request, res: Response) => {
  try {
    // Authenticate user via session token or Supabase auth
    let user: any = null;
    
    // Check for session token in query params (from frontend redirect)
    const sessionToken = req.query.session_token as string;
    if (sessionToken) {
      // Verify Supabase session token
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_ANON_KEY!
        );
        const { data: { user: authUser }, error } = await supabase.auth.getUser(sessionToken);
        if (error || !authUser) {
          return res.status(401).json({ error: 'Invalid session token' });
        }
        user = authUser;
      } catch (authError) {
        return res.status(401).json({ error: 'Authentication failed' });
      }
    } else {
      // Fallback to middleware auth (if available)
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      user = authReq.user;
    }

    let state: string;
    let redirect_uri: string;

    // Check if we have direct parameters or need to decode from oauth_token
    if (req.query.oauth_token) {
      try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';
        const decoded = jwt.verify(req.query.oauth_token as string, jwtSecret) as any;
        
        if (decoded.type !== 'oauth_flow') {
          return res.status(400).json({ error: 'Invalid token type' });
        }
        
        state = decoded.state;
        redirect_uri = decoded.redirect_uri;
      } catch (jwtError) {
        return res.status(400).json({ error: 'Invalid or expired oauth_token' });
      }
    } else {
      // Direct parameters (for IDE-initiated flows)
      state = req.query.state as string;
      redirect_uri = req.query.redirect_uri as string;
    }

    if (!state || !redirect_uri) {
      return res.status(400).json({ error: 'Missing state or redirect_uri parameter' });
    }

    console.log('Creating authorization code for user:', user.id, 'with state:', state);

    // Create authorization code
    const authCode = await IdeAuthCode.create(
      user.id,
      state,
      redirect_uri
    );

    // Build redirect URL with authorization code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', authCode.code);
    redirectUrl.searchParams.set('state', state);

    console.log('Authorization successful, returning redirect URL:', redirectUrl.toString());

    // For IDE flows, redirect directly instead of returning JSON
    if (redirect_uri.startsWith('vscode://')) {
      res.redirect(redirectUrl.toString());
    } else {
      // Return JSON for web flows
      res.json({ 
        redirect_url: redirectUrl.toString(),
        code: authCode.code,
        state: state
      });
    }
  } catch (error) {
    console.error('IDE authorization error:', error);
    res.status(500).json({ error: 'Failed to create authorization code' });
  }
});

// @route   GET /ide/login
// @desc    Redirect to login page with IDE parameters (stateless)
// @access  Public
router.get('/ide/login', async (req: Request, res: Response) => {
  try {
    const { state, redirect_uri } = req.query;
    
    if (!state || !redirect_uri) {
      return res.status(400).json({ 
        error: 'missing_parameters',
        message: 'state and redirect_uri are required' 
      });
    }

    // Create a stateless JWT token containing the OAuth parameters
    const oauthData = {
      state: state as string,
      redirect_uri: redirect_uri as string,
      timestamp: Date.now(),
      type: 'oauth_flow'
    };

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';
    const oauthToken = jwt.sign(oauthData, jwtSecret, { expiresIn: '1h' });

    // Redirect to frontend login page with the JWT token
    const loginParams = new URLSearchParams({
      oauth_token: oauthToken
    });

    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5175'}/login?${loginParams.toString()}`;
    res.redirect(loginUrl);

  } catch (err) {
    console.error('IDE login redirect error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'server_error', message: 'Failed to redirect to login' });
  }
});

// @route   GET /register
// @desc    Redirect to register page with IDE parameters (stateless)
// @access  Public
router.get('/register', async (req: Request, res: Response) => {
  try {
    const { state, redirect_uri } = req.query;
    
    if (!state || !redirect_uri) {
      return res.status(400).json({ 
        error: 'missing_parameters',
        message: 'state and redirect_uri are required' 
      });
    }

    // Create a stateless JWT token containing the OAuth parameters
    const oauthData = {
      state: state as string,
      redirect_uri: redirect_uri as string,
      timestamp: Date.now(),
      type: 'oauth_flow'
    };

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';
    const oauthToken = jwt.sign(oauthData, jwtSecret, { expiresIn: '1h' });

    // Redirect to frontend register page with the JWT token
    const registerParams = new URLSearchParams({
      oauth_token: oauthToken
    });

    const registerUrl = `${process.env.FRONTEND_URL || 'http://localhost:5175'}/register?${registerParams.toString()}`;
    res.redirect(registerUrl);

  } catch (err) {
    console.error('IDE register redirect error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'server_error', message: 'Failed to redirect to register' });
  }
});

// @route   GET /ide/signup
// @desc    Redirect to signup page with IDE parameters (stateless) - alias for /register
// @access  Public
router.get('/ide/signup', async (req: Request, res: Response) => {
  try {
    const { state, redirect_uri } = req.query;
    
    if (!state || !redirect_uri) {
      return res.status(400).json({ 
        error: 'missing_parameters',
        message: 'state and redirect_uri are required' 
      });
    }

    // Create a stateless JWT token containing the OAuth parameters
    const oauthData = {
      state: state as string,
      redirect_uri: redirect_uri as string,
      timestamp: Date.now(),
      type: 'oauth_flow'
    };

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';
    const oauthToken = jwt.sign(oauthData, jwtSecret, { expiresIn: '1h' });

    // Redirect to frontend signup page with the JWT token
    const signupParams = new URLSearchParams({
      oauth_token: oauthToken
    });

    const signupUrl = `${process.env.FRONTEND_URL || 'http://localhost:5175'}/register?${signupParams.toString()}`;
    res.redirect(signupUrl);

  } catch (err) {
    console.error('IDE signup redirect error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'server_error', message: 'Failed to redirect to signup' });
  }
});

// @route   POST /api/auth/ide/token
// @desc    Exchange authorization code for access token (OAuth-style)
// @access  Public
router.post('/ide/token', [
  body('code', 'Authorization code is required').not().isEmpty(),
  body('state', 'State parameter is required').not().isEmpty(),
  body('redirect_uri', 'Redirect URI is required').not().isEmpty()
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'invalid_request',
      errors: errors.array() 
    });
  }

  const { code, state, redirect_uri } = req.body;

  try {
    // Find and validate authorization code
    const authCode = await IdeAuthCode.findByCode(code);
    
    if (!authCode) {
      return res.status(400).json({ 
        error: 'invalid_grant',
        message: 'Invalid or expired authorization code' 
      });
    }

    // Verify state parameter
    if (authCode.state !== state) {
      return res.status(400).json({ 
        error: 'invalid_request',
        message: 'State parameter mismatch' 
      });
    }

    // Verify redirect_uri parameter
    if (authCode.redirect_uri !== redirect_uri) {
      return res.status(400).json({ 
        error: 'invalid_request',
        message: 'Redirect URI mismatch' 
      });
    }

    // Mark code as used
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
      req.headers['user-agent'],
      req.ip
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
    res.status(500).json({ 
      error: 'server_error',
      message: 'Failed to exchange authorization code' 
    });
  }
});

// @route   POST /api/auth/ide/revoke
// @desc    Revoke IDE session
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
    
    res.json({ message: 'Session revoked successfully' });

  } catch (err) {
    console.error('IDE revoke error:', err instanceof Error ? err.message : err);
    res.status(500).json({ message: 'Failed to revoke session' });
  }
});

export default router;
