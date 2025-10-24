# Smart Object Selection for AI Documentation

## Problem
With 4000+ models in a data warehouse, users need an efficient way to select which objects to document without overwhelming the system or spending hours clicking checkboxes.

## Solution: Multi-Level Filtering + Batch Processing

### ✅ Features Implemented

#### 1. **Basic Filters**
- **Search**: Find objects by name, schema, or file path
- **Type Filter**: Filter by object_type (table, view, model, etc.)
- **Documentation Status**: Show only documented or undocumented objects

#### 2. **Advanced Filters** (New!)
- **Schema Filter**: Select all objects in a specific schema (e.g., `analytics`, `staging`)
- **Folder Filter**: Select all files in a directory (e.g., `models/marts/`)
- **Row Count Filter**: Focus on large/important tables (e.g., tables with >1000 rows)

#### 3. **Batch Limits** (New!)
- **50 Object Limit**: Prevents system overload
- **Visual Warnings**: Yellow alert when limit is reached
- **Status Badges**: "Within limit" (green) or "Over limit" (red)
- **Enforced Selection**: Blocks selecting more than 50 objects

---

## How to Use (For 4000+ Models)

### **Strategy 1: Process by Folder**
```
1. Click "Advanced Filters"
2. Select folder: "models/marts/"
3. Click "Select All Filtered" (selects up to 50)
4. Generate documentation
5. Repeat for next folder
```

**Use Case**: Document all production models first, then staging models later.

---

### **Strategy 2: Process by Schema**
```
1. Click "Advanced Filters"
2. Select schema: "analytics"
3. Click "Select All Filtered"
4. Generate documentation
5. Repeat for other schemas
```

**Use Case**: Different teams own different schemas.

---

### **Strategy 3: Process Important Tables Only**
```
1. Click "Advanced Filters"
2. Set "Minimum Row Count": 10000
3. Filter shows only large/active tables
4. Select the important ones
5. Generate documentation
```

**Use Case**: Focus on high-impact models that users actually query.

---

### **Strategy 4: Process Undocumented Only**
```
1. Set filter: "Undocumented" status
2. Set filter type: "model"
3. Click "Select All Filtered"
4. Generate documentation
5. Next batch
```

**Use Case**: Fill in gaps without re-documenting existing objects.

---

## Workflow Example

### For 4000 Models in `models/`:

```
models/
├── staging/          (1500 models) → Skip for now
├── intermediate/     (1000 models) → Skip for now
├── marts/
│   ├── finance/      (200 models)  → Batch 1-4
│   ├── marketing/    (150 models)  → Batch 5-7
│   └── product/      (180 models)  → Batch 8-11
└── core/             (970 models)  → Batch 12+
```

**Process**:
1. Filter folder: `models/marts/finance/`
2. Select 50 → Generate
3. Select next 50 → Generate
4. Continue until folder complete
5. Move to next folder

**Total Batches**: ~80 batches for 4000 models
**Time per batch**: 2-5 minutes
**Total time**: 3-7 hours (can run overnight)

---

## UI Components

### Filter Panel
```
┌────────────────────────────────────────┐
│ 🔍 Search objects...                   │
├────────────────────────────────────────┤
│ [Type Filter ▼] [Status Filter ▼]     │
├────────────────────────────────────────┤
│ ▼ Advanced Filters (schema, folder...) │
│ ┌────────────────────────────────────┐ │
│ │ Schema: analytics                  │ │
│ │ Folder: models/marts/finance/      │ │
│ │ Min Rows: 1000                     │ │
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│ ⚠️  Batch Limit Reached               │
│ You've selected 50 objects.            │
│ Process this batch before continuing.  │
├────────────────────────────────────────┤
│ [Select All Filtered] 50 of 200 ✓      │
└────────────────────────────────────────┘
```

---

## Batch Limit Details

- **Limit**: 50 objects per batch
- **Why?**: 
  - AI API rate limits
  - Database performance
  - Better progress tracking
  - Faster feedback on errors

- **Enforcement**:
  - Visual warning at 50+ selections
  - Blocks clicking more items
  - "Select All" respects limit

---

## Best Practices

### ✅ DO:
- Use folder filters for organized batch processing
- Filter by row count to prioritize important tables
- Process undocumented objects in small batches
- Run batches overnight for large sets

### ❌ DON'T:
- Try to document all 4000 models at once
- Select random objects without a strategy
- Ignore the batch limit warning
- Re-document already completed objects

---

## Future Enhancements (Optional)

1. **Tag System**: Let users tag models as "critical", "deprecated", etc.
2. **Auto-Priority**: ML model to suggest which objects to document first
3. **Scheduled Batches**: Set up automatic documentation runs
4. **Team Assignment**: Assign folders to different teams

---

## Technical Details

### Code Changes
- **File**: `frontend/src/pages/admin/components/ObjectSelector.tsx`
- **New State**: `filterSchema`, `filterFolder`, `minRowCount`, `showAdvancedFilters`
- **Batch Limit**: `BATCH_LIMIT = 50`
- **Filter Logic**: Cascading filters with AND conditions

### Performance
- Filters run client-side (instant feedback)
- No API calls until "Generate" clicked
- Batch processing prevents backend overload

---

## Status
✅ **COMPLETE** - Ready for production use with 4000+ models!
