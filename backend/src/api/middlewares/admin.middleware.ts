import { Request, Response, NextFunction } from 'express';

// Simple admin check based on a comma-separated list of admin emails in env
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const email = (req.user?.email || '').toLowerCase();

  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: user not found in request context' });
  }

  if (!admins.length) {
    return res.status(500).json({ error: 'Server not configured: ADMIN_EMAILS is empty' });
  }

  if (!email || !admins.includes(email)) {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }

  return next();
}
