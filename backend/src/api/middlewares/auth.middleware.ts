import { Request, Response, NextFunction } from 'express';
import supabaseAdmin from '../../config/supabaseClient';

// Extend the Express Request type to include our custom 'user' property
declare global {
  namespace Express {
    export interface Request {
      user?: any; // You can define a more specific type for the user object
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      console.error('Auth error:', error?.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }

    // Attach user to the request object
    req.user = data.user;
    next();
  } catch (error) {
    console.error('Unexpected error in auth middleware:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
