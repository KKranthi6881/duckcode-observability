import { Request, Response, NextFunction } from 'express';
import cacheService from '../utils/CacheService';

/**
 * Cache middleware with HTTP cache headers
 */
export function cacheMiddleware(ttlSeconds: number = 300) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL and user
    const userId = (req.user as any)?.id || 'anonymous';
    const cacheKey = `http:${userId}:${req.originalUrl}`;

    // Check cache
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`[Cache] HIT: ${req.originalUrl}`);
      
      // Set cache headers
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Expires', new Date(Date.now() + ttlSeconds * 1000).toUTCString());
      
      return res.json(cachedData);
    }

    console.log(`[Cache] MISS: ${req.originalUrl}`);
    res.setHeader('X-Cache', 'MISS');

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function(body: any) {
      // Only cache successful responses
      if (res.statusCode === 200) {
        cacheService.set(cacheKey, body, ttlSeconds * 1000);
      }

      // Set cache headers for client-side caching
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Expires', new Date(Date.now() + ttlSeconds * 1000).toUTCString());

      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate cache for specific patterns
 */
export function invalidateCache(pattern: string): number {
  const stats = cacheService.getStats();
  let deletedCount = 0;

  for (const key of stats.keys) {
    if (key.includes(pattern)) {
      cacheService.delete(key);
      deletedCount++;
    }
  }

  console.log(`[Cache] Invalidated ${deletedCount} entries matching: ${pattern}`);
  return deletedCount;
}

/**
 * Cache invalidation middleware for POST/PUT/DELETE
 */
export function invalidateCacheMiddleware(patterns: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store original methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    const invalidatePatterns = () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach(pattern => invalidateCache(pattern));
      }
    };

    res.json = function(body: any) {
      invalidatePatterns();
      return originalJson(body);
    };

    res.send = function(body: any) {
      invalidatePatterns();
      return originalSend(body);
    };

    next();
  };
}
