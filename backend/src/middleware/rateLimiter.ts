import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Enterprise-grade rate limiting middleware
 * Protects against brute force attacks and DDoS
 */

// Strict rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: 'too_many_requests',
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    retryAfter: 15 * 60
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip successful requests from counting
  skipSuccessfulRequests: false,
  // Skip failed requests from counting (set to true to only count successful logins)
  skipFailedRequests: false,
  // Custom key generator (use IP + user agent for better tracking)
  keyGenerator: (req: Request) => {
    return `${req.ip}-${req.headers['user-agent'] || 'unknown'}`;
  },
  // Custom handler for rate limit exceeded
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'too_many_requests',
      message: 'Too many authentication attempts from this IP. Please try again later.',
      retryAfter: 15 * 60 // 15 minutes in seconds
    });
  }
});

// Moderate rate limiter for registration
export const registrationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 3 : 100, // 3 in prod, 100 in dev for testing
  message: {
    error: 'too_many_requests',
    message: 'Too many registration attempts from this IP. Please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: Request) => {
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'too_many_requests',
      message: 'Too many registration attempts from this IP. Please try again later.',
      retryAfter: 60 * 60 // 1 hour in seconds
    });
  }
});

// General API rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'too_many_requests',
    message: 'Too many requests. Please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    const userId = (req as any).user?.id;
    return userId || req.ip || 'unknown';
  }
});

// Strict rate limiter for password reset
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  message: {
    error: 'too_many_requests',
    message: 'Too many password reset attempts. Please try again in 1 hour.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip || 'unknown';
  }
});

// IDE token exchange rate limiter
export const ideTokenRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 token exchanges per window
  message: {
    error: 'too_many_requests',
    message: 'Too many token exchange attempts. Please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `${req.ip}-ide-token`;
  }
});

// Export all rate limiters
export default {
  authRateLimiter,
  registrationRateLimiter,
  apiRateLimiter,
  passwordResetRateLimiter,
  ideTokenRateLimiter
};
