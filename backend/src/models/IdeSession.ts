import { supabaseAdmin } from '../config/supabase';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface IdeSessionData {
  id?: string;
  user_id: string;
  session_token: string;
  refresh_token?: string;
  expires_at: string;
  last_used_at?: string;
  user_agent?: string;
  ip_address?: string;
  created_at?: string;
  updated_at?: string;
}

export class IdeSession {
  static async create(userId: string, userAgent?: string, ipAddress?: string): Promise<IdeSessionData> {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT secret not configured');
    }

    // Generate session token (7 days expiry for IDE)
    const sessionToken = jwt.sign(
      { 
        user_id: userId,
        type: 'ide_session',
        iat: Math.floor(Date.now() / 1000)
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Generate refresh token
    const refreshToken = crypto.randomBytes(32).toString('base64url');
    
    // Set expiration to 7 days from now
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabaseAdmin
      .schema('duckcode')
      .from('ide_sessions')
      .insert({
        user_id: userId,
        session_token: sessionToken,
        refresh_token: refreshToken,
        expires_at: expiresAt
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create IDE session: ${error.message}`);
    }

    return data;
  }

  static async findByToken(sessionToken: string): Promise<IdeSessionData | null> {
    const { data, error } = await supabaseAdmin
      .schema('duckcode')
      .from('ide_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No rows returned
      }
      throw new Error(`Failed to find IDE session: ${error.message}`);
    }

    return data;
  }

  static async updateLastUsed(sessionToken: string): Promise<void> {
    const { error } = await supabaseAdmin
      .schema('duckcode')
      .from('ide_sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('session_token', sessionToken);

    if (error) {
      throw new Error(`Failed to update session last used: ${error.message}`);
    }
  }

  static async revoke(sessionToken: string): Promise<void> {
    const { error } = await supabaseAdmin
      .schema('duckcode')
      .from('ide_sessions')
      .delete()
      .eq('session_token', sessionToken);

    if (error) {
      throw new Error(`Failed to revoke IDE session: ${error.message}`);
    }
  }

  static async revokeAllForUser(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .schema('duckcode')
      .from('ide_sessions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to revoke all IDE sessions: ${error.message}`);
    }
  }

  static async cleanupExpired(): Promise<void> {
    const { error } = await supabaseAdmin
      .schema('duckcode')
      .from('ide_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      throw new Error(`Failed to cleanup expired sessions: ${error.message}`);
    }
  }

  static verifyToken(token: string): { user_id: string; type: string } | null {
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT secret not configured');
      }

      const decoded = jwt.verify(token, jwtSecret) as any;
      
      if (decoded.type !== 'ide_session') {
        return null;
      }

      return {
        user_id: decoded.user_id,
        type: decoded.type
      };
    } catch (error) {
      return null;
    }
  }
}
