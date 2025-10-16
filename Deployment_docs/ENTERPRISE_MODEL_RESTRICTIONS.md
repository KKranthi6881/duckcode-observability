# Enterprise Model Restrictions - Summary

## Overview
Restricted DuckCode IDE to enterprise-approved AI models only, simplifying the experience for data teams.

## Models Restricted (By Provider)

### 1. **OpenAI (openai-native)** ✅
**Approved Models (3):**
- `gpt-5-2025-08-07` - Best for coding and agentic tasks
- `gpt-5-mini-2025-08-07` - Faster, cost-efficient version
- `gpt-5-codex` - Specialized for code generation and data engineering

**Commented Out:** gpt-5-chat-latest, gpt-5-nano, gpt-4.1, o3, o4-mini, o1, gpt-4o, codex-mini-latest (and many others)

---

### 2. **Anthropic (anthropic)** ✅
**Approved Models (2):**
- `claude-sonnet-4-5-20250929` - Latest Sonnet model
- `claude-opus-4-1-20250805` - Premium Opus model

**Commented Out:** claude-sonnet-4-20250514, claude-opus-4-20250514, claude-3-7-sonnet, claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus, claude-3-haiku

---

### 3. **Azure OpenAI (openai)** ✅
**Approved Models (3):**
- `gpt-5-codex` - Code generation specialist
- `gpt-5` - General purpose (maps to gpt-5-2025-08-07)
- `gpt-5-mini` - Cost-efficient (maps to gpt-5-mini-2025-08-07)

**Note:** Azure uses the same OpenAI models, just accessed through Azure endpoints

---

### 4. **AWS Bedrock (bedrock)** ✅
**Approved Models (2):**
- `anthropic.claude-sonnet-4-5-20250929-v1:0` - Latest Sonnet on Bedrock
- `anthropic.claude-opus-4-1-20250805-v1:0` - Premium Opus on Bedrock

**Commented Out:** All Amazon Nova models, Llama models, Titan models, and older Claude versions

---

### 5. **Google Gemini (gemini)** ✅
**Approved Models (2):**
- `gemini-2.5-pro` - Premium model with tiered pricing
- `gemini-2.5-flash` - Fast, cost-efficient model

**Commented Out:** gemini-2.5-flash-preview, gemini-2.5-pro-exp, gemini-2.0-flash, gemini-2.0-flash-thinking, gemini-1.5-flash, gemini-1.5-pro

---

### 6. **Google Vertex AI (vertex)** ✅
**Approved Models (2):**
- `claude-sonnet-4-5@20250929` - Latest Sonnet on Vertex
- `claude-opus-4-1@20250805` - Premium Opus on Vertex

**Commented Out:** All Gemini models on Vertex, older Claude versions

---

## Summary Statistics

| Provider | Before | After | Reduction |
|----------|--------|-------|-----------|
| OpenAI | 20+ models | 3 models | 85% reduction |
| Anthropic | 8 models | 2 models | 75% reduction |
| AWS Bedrock | 30+ models | 2 models | 93% reduction |
| Google Gemini | 10+ models | 2 models | 80% reduction |
| Google Vertex | 15+ models | 2 models | 87% reduction |
| **TOTAL** | **~85 models** | **14 models** | **84% reduction** |

---

## Enterprise Benefits

### 1. **Simplified Selection**
- Users see only 14 carefully curated models instead of 85+
- Clear naming conventions
- Focused on data engineering use cases

### 2. **Cost Predictability**
- Known pricing for all models
- No experimental or preview models
- Consistent performance characteristics

### 3. **Security & Compliance**
- Only enterprise-approved providers
- No experimental or beta models
- Stable, production-ready options

### 4. **Reduced Support Burden**
- Fewer models = fewer configuration issues
- Clear documentation for each model
- Easier troubleshooting

---

## Technical Implementation

### Files Modified:
1. `/duck-code/src/shared/api.ts` - Model definitions
   - Commented out non-enterprise models
   - Updated default model IDs
   - Added enterprise-only comments

2. `/duck-code/webview-ui/src/components/settings/constants.ts` - Provider list
   - Reduced from 21 providers to 5
   - Added enterprise comment

3. `/duck-code/webview-ui/src/components/welcome/WelcomeView.tsx` - Welcome message
   - Added enterprise provider messaging

### Approach:
- **Commented out** old models instead of deleting them
- Preserves backward compatibility
- Easy to uncomment if needed for specific customers
- Backend still supports all models (for existing configurations)

---

## Model Selection Rationale

### Why These Models?

**OpenAI:**
- GPT-5 series: Latest generation, best performance
- Codex: Specialized for code generation (critical for data teams)

**Anthropic:**
- Sonnet 4.5: Latest, best balance of speed/quality
- Opus 4.1: Premium option for complex tasks

**AWS Bedrock:**
- Same Claude models, but via AWS infrastructure
- Important for customers with AWS commitments

**Google Gemini:**
- 2.5 Pro: Best quality
- 2.5 Flash: Best speed/cost ratio

**Google Vertex:**
- Same Claude models, but via GCP infrastructure
- Important for customers with GCP commitments

---

## Future Enhancements

### Potential Additions:
1. **Admin-controlled model lists** - Let org admins choose which models to enable
2. **Cost-tier restrictions** - Limit expensive models based on user role
3. **Model recommendations** - Suggest best model for specific tasks
4. **Usage analytics** - Track which models are most popular

### Not Recommended:
- Adding more providers (keep it simple)
- Adding experimental/preview models (stability over features)
- Adding local models like Ollama (enterprise security concerns)

---

## Migration Notes

### For Existing Users:
- Existing configurations will continue to work
- Old model selections will still function (backend supports all)
- New users will only see enterprise-approved models
- No breaking changes

### For Administrators:
- Can uncomment additional models in `api.ts` if needed
- Can customize provider list in `constants.ts`
- All changes are in frontend UI only

---

## Status: ✅ Complete

All enterprise model restrictions implemented and ready for production deployment.
