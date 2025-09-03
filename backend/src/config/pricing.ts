export interface PricingTier {
  name: string;
  monthlyPrice: number;
  tokenLimit: number;
  requestLimit: number;
  features: string[];
}

export interface ModelPricing {
  name: string;
  inputTokenCost: number; // Cost per 1K tokens
  outputTokenCost: number; // Cost per 1K tokens
  ourPrice: number; // Our price with 80% profit margin
}

// OpenAI pricing (as of 2024)
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    inputTokenCost: 0.00015, // $0.15 per 1M tokens
    outputTokenCost: 0.0006, // $0.60 per 1M tokens
    ourPrice: 0.0011 // 80% profit margin
  },
  'gpt-4o': {
    name: 'GPT-4o',
    inputTokenCost: 0.005, // $5.00 per 1M tokens
    outputTokenCost: 0.015, // $15.00 per 1M tokens
    ourPrice: 0.036 // 80% profit margin
  },
  'gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    inputTokenCost: 0.01, // $10.00 per 1M tokens
    outputTokenCost: 0.03, // $30.00 per 1M tokens
    ourPrice: 0.072 // 80% profit margin
  }
};

export const PRICING_TIERS: Record<string, PricingTier> = {
  free: {
    name: 'Free',
    monthlyPrice: 0,
    tokenLimit: 10000, // 10K tokens per month
    requestLimit: 50, // 50 requests per month
    features: [
      'Basic AI assistance',
      'Limited token usage',
      'Community support'
    ]
  },
  pro: {
    name: 'Pro',
    monthlyPrice: 29,
    tokenLimit: 500000, // 500K tokens per month
    requestLimit: 2000, // 2K requests per month
    features: [
      'Advanced AI models',
      'Priority support',
      'Usage analytics',
      'Custom prompts'
    ]
  },
  enterprise: {
    name: 'Enterprise',
    monthlyPrice: 199,
    tokenLimit: 5000000, // 5M tokens per month
    requestLimit: 20000, // 20K requests per month
    features: [
      'All AI models',
      'Dedicated support',
      'Advanced analytics',
      'Custom integrations',
      'Team management',
      'SSO integration'
    ]
  }
};

export const calculateUsageCost = (tokens: number, model: string): number => {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  
  // Assuming average split of input/output tokens (60/40)
  const inputTokens = Math.floor(tokens * 0.6);
  const outputTokens = Math.floor(tokens * 0.4);
  
  const inputCost = (inputTokens / 1000) * pricing.inputTokenCost;
  const outputCost = (outputTokens / 1000) * pricing.outputTokenCost;
  
  return inputCost + outputCost;
};

export const calculateOurRevenue = (tokens: number, model: string): number => {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  
  return (tokens / 1000) * pricing.ourPrice;
};
