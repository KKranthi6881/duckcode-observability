/**
 * Enterprise-grade password validation
 * Enforces strong password policies for security compliance
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventUserInfo: boolean;
}

// Default enterprise password policy
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfo: true
};

// Common passwords to block (top 100 most common)
const COMMON_PASSWORDS = [
  'password', '123456', '123456789', 'qwerty', 'abc123', 'password1',
  'password123', 'admin', 'letmein', 'welcome', 'monkey', '1234567890',
  'qwerty123', 'password!', 'admin123', 'root', 'toor', 'pass', 'test',
  'guest', 'user', 'master', 'hello', 'sunshine', 'princess', 'dragon',
  'shadow', 'superman', 'batman', 'trustno1', 'football', 'baseball',
  'welcome1', 'abc123!', 'password1!', 'qwerty1', 'letmein1'
];

/**
 * Validates password against enterprise security policy
 */
export function validatePassword(
  password: string,
  userInfo?: { email?: string; fullName?: string },
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  // Check minimum length
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  } else {
    score += 20;
    // Bonus for extra length
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 10;
  }

  // Check uppercase requirement
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (/[A-Z]/.test(password)) {
    score += 15;
  }

  // Check lowercase requirement
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (/[a-z]/.test(password)) {
    score += 15;
  }

  // Check numbers requirement
  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else if (/\d/.test(password)) {
    score += 15;
  }

  // Check special characters requirement
  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 15;
  }

  // Check for common passwords
  if (policy.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.some(common => lowerPassword.includes(common))) {
      errors.push('Password is too common. Please choose a more unique password');
      score -= 20;
    }
  }

  // Check for user information in password
  if (policy.preventUserInfo && userInfo) {
    const lowerPassword = password.toLowerCase();
    
    if (userInfo.email) {
      const emailParts = userInfo.email.toLowerCase().split('@')[0].split(/[._-]/);
      if (emailParts.some(part => part.length > 3 && lowerPassword.includes(part))) {
        errors.push('Password should not contain parts of your email address');
        score -= 15;
      }
    }
    
    if (userInfo.fullName) {
      const nameParts = userInfo.fullName.toLowerCase().split(/\s+/);
      if (nameParts.some(part => part.length > 3 && lowerPassword.includes(part))) {
        errors.push('Password should not contain parts of your name');
        score -= 15;
      }
    }
  }

  // Check for sequential characters
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
    errors.push('Password should not contain sequential characters (abc, 123, etc.)');
    score -= 10;
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password should not contain repeated characters (aaa, 111, etc.)');
    score -= 10;
  }

  // Bonus for character variety
  const charTypes = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  ].filter(Boolean).length;
  
  if (charTypes >= 4) score += 10;

  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine strength
  let strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  if (score < 40) {
    strength = 'weak';
  } else if (score < 60) {
    strength = 'medium';
  } else if (score < 80) {
    strength = 'strong';
  } else {
    strength = 'very-strong';
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
    score
  };
}

/**
 * Express validator middleware for password validation
 */
export function passwordValidationMiddleware(policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY) {
  return (value: string, { req }: any) => {
    const userInfo = {
      email: req.body.email,
      fullName: req.body.fullName || req.body.full_name
    };
    
    const result = validatePassword(value, userInfo, policy);
    
    if (!result.isValid) {
      throw new Error(result.errors.join('. '));
    }
    
    return true;
  };
}

/**
 * Generate password strength indicator for UI
 */
export function getPasswordStrengthIndicator(password: string): {
  strength: string;
  color: string;
  percentage: number;
} {
  const result = validatePassword(password);
  
  const colorMap = {
    'weak': '#ef4444',
    'medium': '#f59e0b',
    'strong': '#10b981',
    'very-strong': '#059669'
  };
  
  return {
    strength: result.strength,
    color: colorMap[result.strength],
    percentage: result.score
  };
}

export default {
  validatePassword,
  passwordValidationMiddleware,
  getPasswordStrengthIndicator,
  DEFAULT_PASSWORD_POLICY
};
