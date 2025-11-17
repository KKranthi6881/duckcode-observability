import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { supabaseDuckCode } from '../config/supabaseClient';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    organization_id?: string;
  };
}

export const auth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Get token from header
  const token = req.header('Authorization')?.replace('Bearer ', '');

  // Check if no token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // First try to validate as Supabase JWT
    const { data: { user }, error } = await supabaseDuckCode.auth.getUser(token);
    
    if (user && !error) {
      // Valid Supabase token - fetch organization_id from profile
      const { data: profile } = await supabaseDuckCode
        .from('user_profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();
      
      req.user = {
        id: user.id,
        email: user.email || '',
        organization_id: profile?.organization_id
      };
      return next();
    }

    // Fallback to custom JWT validation (for IDE tokens)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ msg: 'JWT secret not configured' });
    }
    
    const decoded = jwt.verify(token, jwtSecret) as any;
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
}
