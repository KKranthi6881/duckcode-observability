import crypto from 'crypto';

/**
 * Encryption Service for API Keys
 * Uses AES-256-GCM for secure encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

// Get encryption key from environment or generate one
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY not configured in environment variables');
  }
  
  // Ensure key is 32 bytes for AES-256
  return crypto.scryptSync(key, 'salt', 32);
};

/**
 * Encrypt an API key
 */
export const encryptApiKey = (plaintext: string): string => {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt API key');
  }
};

/**
 * Decrypt an API key
 */
export const decryptApiKey = (encryptedData: string): string => {
  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt API key');
  }
};

/**
 * Mask an API key for display
 */
export const maskApiKey = (apiKey: string): string => {
  if (apiKey.length <= 12) {
    return '•'.repeat(apiKey.length);
  }
  
  const start = apiKey.slice(0, 8);
  const end = apiKey.slice(-4);
  const middle = '•'.repeat(20);
  
  return `${start}${middle}${end}`;
};

/**
 * Validate API key format
 */
export const validateApiKeyFormat = (provider: string, apiKey: string): boolean => {
  const patterns: Record<string, RegExp> = {
    openai: /^sk-[a-zA-Z0-9]{32,}$/,
    anthropic: /^sk-ant-[a-zA-Z0-9-]{95,}$/,
    azure: /^[a-zA-Z0-9]{32}$/,
    gemini: /^[a-zA-Z0-9_-]{39}$/,
    bedrock: /^[A-Z0-9]{20}$/,
  };
  
  const pattern = patterns[provider];
  if (!pattern) {
    // Unknown provider, allow any non-empty string
    return apiKey.length > 0;
  }
  
  return pattern.test(apiKey);
};

export default {
  encryptApiKey,
  decryptApiKey,
  maskApiKey,
  validateApiKeyFormat,
};
