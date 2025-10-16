/**
 * Encryption utilities for API key management
 * Uses AES-256-GCM for secure encryption/decryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag
const KEY_LENGTH = 32; // 32 bytes for AES-256

/**
 * Get encryption key from environment variable
 * Falls back to a default key for development (NOT for production!)
 */
function getEncryptionKey(): Buffer {
  const keyString = process.env.API_KEY_ENCRYPTION_SECRET;
  
  if (!keyString) {
    console.warn('⚠️  API_KEY_ENCRYPTION_SECRET not set! Using default dev key.');
    // Default key for development only
    return crypto.scryptSync('dev-secret-key-do-not-use-in-prod', 'salt', KEY_LENGTH);
  }
  
  // Convert hex string to buffer, or derive key from string
  if (keyString.length === KEY_LENGTH * 2) {
    // Assume it's a hex string
    return Buffer.from(keyString, 'hex');
  } else {
    // Derive key from passphrase
    return crypto.scryptSync(keyString, 'salt', KEY_LENGTH);
  }
}

/**
 * Encrypt an API key
 * @param apiKey - The plain text API key to encrypt
 * @returns Object containing encrypted key, IV, and auth tag
 */
export function encryptAPIKey(apiKey: string): {
  encryptedKey: string;
  iv: string;
  authTag: string;
} {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encryptedKey: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    console.error('❌ Encryption failed:', error);
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Decrypt an API key
 * @param encryptedKey - The encrypted API key (hex string)
 * @param iv - The initialization vector (hex string)
 * @param authTag - The authentication tag (hex string)
 * @returns The decrypted API key
 */
export function decryptAPIKey(
  encryptedKey: string,
  iv: string,
  authTag: string
): string {
  try {
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ Decryption failed:', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Mask an API key for display purposes
 * Shows first 7 and last 4 characters, masks the rest
 * @param apiKey - The API key to mask
 * @returns Masked API key (e.g., "sk-1234***************abcd")
 */
export function maskAPIKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) {
    return '***';
  }
  
  const start = apiKey.substring(0, 7);
  const end = apiKey.substring(apiKey.length - 4);
  const masked = '*'.repeat(Math.min(apiKey.length - 11, 20));
  
  return `${start}${masked}${end}`;
}

/**
 * Validate API key format
 * Basic validation - can be extended for provider-specific checks
 * @param apiKey - The API key to validate
 * @param provider - The provider type (optional)
 * @returns True if valid, false otherwise
 */
export function validateAPIKeyFormat(
  apiKey: string,
  provider?: string
): boolean {
  if (!apiKey || apiKey.length < 10) {
    return false;
  }
  
  // Provider-specific validation
  switch (provider) {
    case 'openai':
      // OpenAI keys start with 'sk-'
      return apiKey.startsWith('sk-') && apiKey.length > 20;
    
    case 'anthropic':
      // Anthropic keys start with 'sk-ant-'
      return apiKey.startsWith('sk-ant-') && apiKey.length > 30;
    
    case 'azure':
      // Azure keys are 32 character hex strings
      return /^[a-f0-9]{32}$/i.test(apiKey);
    
    case 'gemini':
      // Google AI keys start with 'AIza'
      return apiKey.startsWith('AIza') && apiKey.length > 30;
    
    default:
      // Generic validation: must be at least 10 characters
      return apiKey.length >= 10;
  }
}
