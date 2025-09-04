import { supabaseAdmin } from '../config/supabase';
import crypto from 'crypto';

export interface IdeAuthCodeData {
  id?: string;
  code: string;
  state: string;
  user_id: string;
  redirect_uri: string;
  expires_at: string;
  used_at?: string;
  created_at?: string;
  updated_at?: string;
}

export class IdeAuthCode {
  static async create(userId: string, state: string, redirectUri: string): Promise<IdeAuthCodeData> {
    // Generate a secure authorization code
    const code = crypto.randomBytes(32).toString('base64url');
    
    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    const { data, error } = await supabaseAdmin
      .schema('duckcode')
      .from('ide_authorization_codes')
      .insert({
        code,
        state,
        user_id: userId,
        redirect_uri: redirectUri,
        expires_at: expiresAt
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create authorization code: ${error.message}`);
    }

    return data;
  }

  static async findByCode(code: string): Promise<IdeAuthCodeData | null> {
    const { data, error } = await supabaseAdmin
      .schema('duckcode')
      .from('ide_authorization_codes')
      .select('*')
      .eq('code', code)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No rows returned
      }
      throw new Error(`Failed to find authorization code: ${error.message}`);
    }

    return data;
  }

  static async markAsUsed(authCode: IdeAuthCodeData): Promise<void> {
    const { error: updateError } = await supabaseAdmin
      .schema('duckcode')
      .from('ide_authorization_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', authCode.id);

    if (updateError) {
      throw new Error(`Failed to mark authorization code as used: ${updateError.message}`);
    }
  }

  static async cleanupExpired(): Promise<void> {
    const { error } = await supabaseAdmin
      .schema('duckcode')
      .from('ide_authorization_codes')
      .delete()
      .lt('expires_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (error) {
      throw new Error(`Failed to cleanup expired codes: ${error.message}`);
    }
  }
}
