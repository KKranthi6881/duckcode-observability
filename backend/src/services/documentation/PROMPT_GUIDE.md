# GPT Prompt Engineering Guide

## Overview

This guide documents the prompt templates used for each documentation layer. These prompts are optimized for GPT-4o to generate business-friendly documentation from technical code.

---

## Layer 1: Executive Summary

### Objective
Generate a 2-3 sentence summary that executives can understand in 10 seconds.

### Prompt Template
```
You are a business documentation expert. Generate a concise executive summary for this data model.

OBJECT DETAILS:
- Name: {object_name}
- Type: {object_type}
- Description: {description}
- Columns: {column_list}
- Dependencies: {dependency_count} upstream sources

CODE SAMPLE:
{first_500_chars_of_code}

REQUIREMENTS:
- Write 2-3 sentences maximum
- Focus on WHAT it calculates and WHY it matters
- Use business language, avoid technical jargon
- Include who might use it and for what decisions
- Be specific about the business purpose

FORMAT:
Return ONLY the summary text, no headers, bullet points, or formatting.

EXAMPLE (do not copy, use as reference only):
"Calculates predicted customer lifetime value over 12 months based on purchase history and behavior patterns. Used by Marketing for campaign targeting and Finance for revenue forecasting. Updates daily at 6 AM to support strategic decision-making."
```

### Key Parameters
- **Temperature:** 0.7 (creative but consistent)
- **Max Tokens:** 250
- **Response Format:** text

### Quality Indicators
- ✅ 2-3 sentences
- ✅ Business language (no SQL terms)
- ✅ Mentions use case
- ✅ Explains business value

---

## Layer 2: Business Narrative

### Objective
Tell a story about what the data model does and why it exists.

### Prompt Template
```
Generate a business narrative that explains this data model's purpose and flow.

OBJECT DETAILS:
Name: {object_name}
Type: {object_type}
File: {file_path}
Columns: {column_count} columns
Dependencies: {dependency_count} upstream sources

CODE:
{full_definition}

REQUIREMENTS:
Return a JSON object with these exact fields:
{
  "whatItDoes": "2-3 sentence explanation of the transformation in business terms",
  "dataJourney": ["Step 1: What happens first", "Step 2: Next step", "Step 3: Final step"],
  "businessImpact": "How this affects business decisions and who uses it"
}

GUIDELINES:
- Use clear, non-technical language suitable for business analysts
- Focus on the "why" not just the "what"
- Describe the data journey as a story
- Explain business value, not technical implementation

Return ONLY valid JSON, no markdown code blocks or explanations.
```

### Key Parameters
- **Temperature:** 0.7
- **Max Tokens:** 600
- **Response Format:** json_object

### Quality Indicators
- ✅ Story format (beginning → middle → end)
- ✅ Business terms only
- ✅ 3-5 steps in data journey
- ✅ Clear impact statement

---

## Layer 3: Transformation Cards

### Objective
Create visual step-by-step cards showing input → logic → output.

### Prompt Template
```
Analyze this SQL/code and break it down into visual transformation steps.

OBJECT: {object_name}
TYPE: {object_type}

CODE:
{full_definition}

COLUMNS:
{column_list_with_types}

REQUIREMENTS:
Return a JSON object with a "cards" array. Each card should have:
{
  "cards": [
    {
      "stepNumber": 1,
      "title": "Filter Active Customers",
      "input": "2.5M total customers",
      "logic": "WHERE last_order_date >= CURRENT_DATE - 90 days",
      "output": "450K active customers (18%)",
      "whyItMatters": "Focus on engaged customers for accurate predictions"
    }
  ]
}

GUIDELINES:
- Identify 3-7 key transformation steps that a business user would understand
- Use business language for titles and "whyItMatters"
- Include approximate data volumes where possible (e.g., "1M rows → 500K rows")
- Extract actual logic from the code (WHERE clauses, JOINs, aggregations)
- Focus on steps that transform or filter data significantly

Return ONLY valid JSON, no markdown or explanations.
```

### Key Parameters
- **Temperature:** 0.7
- **Max Tokens:** 1200
- **Response Format:** json_object

### Quality Indicators
- ✅ 3-7 cards (not too many)
- ✅ Each card has input/logic/output
- ✅ Business-friendly titles
- ✅ "Why it matters" explains value
- ✅ Data volumes included

---

## Layer 4: Code Explanations

### Objective
Side-by-side code blocks with plain English explanations.

### Prompt Template
```
Create side-by-side code and plain English explanations for key sections of this code.

OBJECT: {object_name}

CODE:
{full_definition}

REQUIREMENTS:
Return a JSON object with an "explanations" array:
{
  "explanations": [
    {
      "codeBlock": "SELECT ... WHERE status = 'completed'",
      "plainEnglish": "We only look at orders that have been completed",
      "businessContext": "This ensures revenue metrics reflect actual paid orders, not pending ones"
    }
  ]
}

GUIDELINES:
- Focus on the most important business logic sections (WHERE, JOIN, aggregations, CASE statements)
- Extract 3-6 key code blocks
- plainEnglish should explain WHAT the code does in simple terms
- businessContext should explain WHY it matters for business decisions
- Use complete code snippets (keep SELECT/FROM/WHERE together)

Return ONLY valid JSON, no markdown.
```

### Key Parameters
- **Temperature:** 0.7
- **Max Tokens:** 1200
- **Response Format:** json_object

### Quality Indicators
- ✅ 3-6 explanations
- ✅ Code snippets are complete
- ✅ Plain English is truly simple
- ✅ Business context explains "why"

---

## Layer 5: Business Rules

### Objective
Extract business rules embedded in code (WHERE clauses, CASE statements).

### Prompt Template
```
Extract business rules from this code. Business rules are filters, validations, thresholds, or conditions that enforce business logic.

CODE:
{full_definition}

REQUIREMENTS:
Return a JSON object with a "rules" array:
{
  "rules": [
    {
      "rule": "Only count completed orders with no refunds",
      "codeReference": "WHERE status = 'completed' AND refund_amount = 0",
      "impact": "Ensures revenue metrics reflect actual money received, not pending or refunded transactions"
    }
  ]
}

GUIDELINES:
- Identify WHERE clauses, CASE statements, and conditional logic
- Focus on business conditions, not technical SQL syntax
- Explain the business impact of each rule
- Extract 2-5 most important rules

Return ONLY valid JSON.
```

### Key Parameters
- **Temperature:** 0.7
- **Max Tokens:** 900
- **Response Format:** json_object

### Quality Indicators
- ✅ 2-5 rules (most important)
- ✅ Rules are business conditions
- ✅ Code references are accurate
- ✅ Impact explains consequences

---

## Layer 6: Impact Analysis

### Objective
Explain who uses this data and why it matters if it breaks.

### Prompt Template
```
Analyze who uses this data and why it matters for business decisions.

OBJECT: {object_name}
TYPE: {object_type}
DOWNSTREAM CONSUMERS: {downstream_count} models/reports depend on this
EXAMPLES: {downstream_names}

REQUIREMENTS:
Return JSON:
{
  "usedBy": [
    {"team": "Marketing", "frequency": "daily", "purpose": "Campaign targeting and ROI analysis"}
  ],
  "questionsAnswered": [
    "Which customers should we target for upsell campaigns?",
    "What is our predicted revenue for next quarter?"
  ],
  "downstreamImpact": "If this model breaks, marketing cannot target campaigns and finance loses revenue forecasting capability. Estimated impact: $500K/month in missed opportunities."
}

GUIDELINES:
- Infer teams based on object name and type (e.g., "customer_ltv" → Marketing, Finance)
- List 2-4 business questions this data helps answer
- Explain downstream impact if this breaks
- Be specific about business consequences

Return ONLY valid JSON.
```

### Key Parameters
- **Temperature:** 0.7
- **Max Tokens:** 700
- **Response Format:** json_object

### Quality Indicators
- ✅ Teams are realistic
- ✅ Questions are specific
- ✅ Impact is quantified
- ✅ Explains consequences

---

## Common Prompt Patterns

### 1. Clear Structure
```
OBJECT DETAILS:
- Name: ...
- Type: ...

CODE:
...

REQUIREMENTS:
Return JSON with:
{...}

GUIDELINES:
- Point 1
- Point 2
```

**Why:** Clear sections help GPT understand context and format

### 2. JSON Response Format
```
response_format: { type: 'json_object' }
```

**Why:** More reliable than parsing markdown, validates structure

### 3. Examples (Reference Only)
```
EXAMPLE (do not copy, use as reference only):
"..."
```

**Why:** Provides format guidance without copying content

### 4. Negative Instructions
```
- Use business language, avoid technical jargon
- Return ONLY JSON, no markdown code blocks
```

**Why:** Prevents common mistakes

### 5. Output Constraints
```
- Write 2-3 sentences maximum
- Extract 3-7 key steps
- Identify 2-5 most important rules
```

**Why:** Controls output length and quality

---

## Prompt Optimization Tips

### 1. Be Specific
❌ "Explain this code"
✅ "Extract 3-6 business rules from WHERE clauses and CASE statements"

### 2. Set Context
Always include:
- Object name and type
- Column count
- Dependency count
- Code sample

### 3. Control Format
Use `response_format: { type: 'json_object' }` for structured data

### 4. Provide Examples
Show format with "do not copy" disclaimer

### 5. Use Constraints
Limit output length (2-3 sentences, 3-7 cards, etc.)

### 6. Focus on Business Value
Every prompt should emphasize:
- Business language
- Why it matters
- Who uses it
- Impact

---

## Testing & Iteration

### Quality Checklist

For each layer, verify:
- [ ] Business language (no SQL jargon)
- [ ] Accurate code references
- [ ] Appropriate length
- [ ] Explains "why" not just "what"
- [ ] Useful for non-technical users

### A/B Testing Strategy

1. Generate docs for 10 sample models
2. Review quality manually
3. Identify weak points
4. Adjust prompts
5. Regenerate and compare
6. Iterate until 90%+ quality

### Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Too technical | Add "use business language" constraint |
| Too long | Add length limit (2-3 sentences, etc.) |
| Too generic | Ask for specific examples/volumes |
| JSON parse fails | Check `response_format` parameter |
| Missing context | Include more object metadata |

---

## Future Improvements

### 1. Few-Shot Learning
Add 2-3 real examples per layer to improve consistency

### 2. Chain-of-Thought
Ask GPT to think step-by-step for complex analysis

### 3. Self-Critique
Have GPT review and improve its own output

### 4. Adaptive Prompts
Adjust based on object type (table vs view vs model)

### 5. Multi-Pass Generation
Generate → critique → regenerate for higher quality
