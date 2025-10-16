import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import supabaseAdmin from '../../config/supabaseClient';
import { supabaseDuckCode } from '../../config/supabase';
import { IdeSession } from '../../models/IdeSession';

// Extend the Express Request type to include our custom 'user' property
declare global {
  namespace Express {
    export interface Request {
      user?: any; // You can define a more specific type for the user object
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('Auth header received:', authHeader ? 'Bearer token present' : 'No auth header');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Missing or invalid Authorization header format');
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header.' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('Extracted token length:', token.length);

    let user = null;

    // Try custom JWT validation first (for backend-issued tokens)
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret) {
      try {
        const decoded: any = jwt.verify(token, jwtSecret);
        if (decoded && decoded.user && decoded.user.id) {
          // Get user from database using the ID from JWT
          const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(decoded.user.id);
          if (!userError && userData.user) {
            user = userData.user;
            console.log('Custom JWT validation successful for user:', user.id);
          } else {
            console.log('Custom JWT valid but user not found:', userError?.message);
          }
        }
      } catch (jwtError: any) {
        console.log('Custom JWT validation failed:', jwtError.message);
      }
    }

    // Try Supabase JWT validation if custom JWT failed
    if (!user) {
      try {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (!error && data.user) {
          user = data.user;
          console.log('Supabase JWT validation successful for user:', user.id);
        } else {
          console.log('Supabase JWT validation failed:', error?.message);
        }
      } catch (supabaseError) {
        console.log('Supabase JWT validation error:', supabaseError);
      }
    }

    // If Supabase validation failed, try IDE session token validation
    if (!user) {
      try {
        const { data: sessionData, error: sessionError } = await supabaseDuckCode
          .from('ide_sessions')
          .select('user_id, expires_at')
          .eq('session_token', token)
          .single();

        if (!sessionError && sessionData) {
          const expiresAt = new Date(sessionData.expires_at);
          if (expiresAt > new Date()) {
            // Get user details
            const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(sessionData.user_id);
            if (!userError && userData.user) {
              user = userData.user;
              console.log('IDE session validation successful for user:', user.id);
            }
          } else {
            console.log('IDE session token expired');
          }
        } else {
          console.log('IDE session validation failed:', sessionError?.message);
        }
      } catch (ideError) {
        console.log('IDE session validation error:', ideError);
      }
    }

    if (!user) {
      console.log('All authentication methods failed');
      return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};
