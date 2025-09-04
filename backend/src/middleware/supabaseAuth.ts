import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const supabaseAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Try to get token from Authorization header first (for API calls)
    let token = req.header('Authorization')?.replace('Bearer ', '');
    
    // If no Authorization header, try to get from cookies (for web sessions)
    if (!token) {
      token = req.cookies?.['sb-access-token'];
    }

    // Check if no token
    if (!token) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    // Set user data for the request
    req.user = {
      id: user.id,
      email: user.email || ''
    };

    next();
  } catch (err) {
    console.error('Supabase auth error:', err);
    res.status(401).json({ msg: 'Authentication failed' });
  }
};
