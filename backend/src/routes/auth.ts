import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { SupabaseUser } from '../models/SupabaseUser';
import { SupabaseBilling } from '../models/SupabaseBilling';
import { auth, AuthenticatedRequest } from '../middleware/auth';

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

// @route   POST /api/auth/ide-callback
// @desc    Handle IDE authentication callback
// @access  Public
router.post('/ide-callback', [
  body('token', 'Token is required').not().isEmpty()
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { token } = req.body;

  try {
    // Verify token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ message: 'JWT secret not configured' });
    }
    
    const decoded = jwt.verify(token, jwtSecret) as any;
    const user = await SupabaseUser.findById(decoded.user.id);
    
    if (!user) {
      return res.status(400).json({ msg: 'Invalid token' });
    }

    // Return user data for IDE
    const newToken = jwt.sign(
      { user: { id: user.id } },
      jwtSecret,
      { expiresIn: '7d' }
    );
    res.json({
      success: true,
      authData: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          avatarUrl: user.avatar_url
        },
        session: newToken
      }
    });

  } catch (err) {
    console.error('IDE auth callback error:', err instanceof Error ? err.message : err);
    res.status(400).json({ msg: 'Invalid token' });
  }
});

export default router;
