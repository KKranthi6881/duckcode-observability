import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { stripeService } from '../services/stripe.service';

/**
 * Middleware to check if organization has active subscription
 * Allows access during trial period
 */
export const requireActiveSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.organization_id) {
      return res.status(401).json({ 
        message: 'No organization found',
        subscription_required: true 
      });
    }

    const isActive = await stripeService.isSubscriptionActive(req.user.organization_id);

    if (!isActive) {
      const subscriptionInfo = await stripeService.getSubscriptionInfo(req.user.organization_id);
      
      return res.status(402).json({
        message: 'Active subscription required',
        subscription_required: true,
        subscription_status: subscriptionInfo?.subscription_status || 'none',
        trial_expired: true,
      });
    }

    next();
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({ message: 'Error verifying subscription' });
  }
};

/**
 * Middleware to check if trial has expired and warn user
 * Doesn't block access, just adds warning headers
 */
export const checkTrialStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.organization_id) {
      return next();
    }

    const subscriptionInfo = await stripeService.getSubscriptionInfo(req.user.organization_id);
    
    if (subscriptionInfo?.subscription_status === 'trialing') {
      const daysRemaining = await stripeService.getTrialDaysRemaining(req.user.organization_id);
      
      // Add trial info to response headers
      res.setHeader('X-Trial-Days-Remaining', daysRemaining.toString());
      res.setHeader('X-Trial-Status', 'active');
      
      if (daysRemaining <= 7) {
        res.setHeader('X-Trial-Warning', `Trial expires in ${daysRemaining} days`);
      }
    }

    next();
  } catch (error) {
    console.error('Error checking trial status:', error);
    next(); // Don't block on error
  }
};

/**
 * Middleware to check if organization has specific plan (professional or enterprise)
 */
export const requirePlan = (requiredPlan: 'professional' | 'enterprise') => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user?.organization_id) {
        return res.status(401).json({ message: 'No organization found' });
      }

      const subscriptionInfo = await stripeService.getSubscriptionInfo(req.user.organization_id);

      if (!subscriptionInfo || subscriptionInfo.subscription_status === 'trialing') {
        return res.status(403).json({
          message: `This feature requires a ${requiredPlan} plan`,
          required_plan: requiredPlan,
          current_plan: subscriptionInfo?.subscription_plan || 'trial',
        });
      }

      // Check if plan is sufficient
      if (requiredPlan === 'enterprise' && subscriptionInfo.subscription_plan !== 'enterprise') {
        return res.status(403).json({
          message: 'This feature requires an Enterprise plan',
          required_plan: 'enterprise',
          current_plan: subscriptionInfo.subscription_plan,
        });
      }

      next();
    } catch (error) {
      console.error('Error checking plan:', error);
      res.status(500).json({ message: 'Error verifying plan' });
    }
  };
};

/**
 * Middleware to add subscription info to request
 * Useful for endpoints that need to know subscription details
 */
export const attachSubscriptionInfo = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.organization_id) {
      const subscriptionInfo = await stripeService.getSubscriptionInfo(req.user.organization_id);
      (req as any).subscription = subscriptionInfo;
    }
    next();
  } catch (error) {
    console.error('Error attaching subscription info:', error);
    next(); // Don't block on error
  }
};
