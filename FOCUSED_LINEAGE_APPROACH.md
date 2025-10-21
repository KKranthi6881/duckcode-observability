# Focused Lineage Approach (dbt Cloud/Atlan Style) 🎯

**Status:** 🚧 IN PROGRESS  
**Date:** October 21, 2025

---

## 🎯 New Approach

### **Problem with Current Implementation:**
- Shows random models without context
- No clear starting point
- Progressive loading adds more random models
- Hard to understand dependencies

### **New Solution: Focused Lineage**
Start with ONE model → Show its lineage context → Expand directionally

---

## 🏗️ Architecture

### **1. Model Selector**
✅ Created: `ModelSelector.tsx`
- Dropdown to choose focal model
- Search all available models
- Shows upstream/downstream counts
- Beautiful UI with Target icon

### **2. Backend API**
✅ Created: `getFocusedLineage` endpoint
- Route: `/api/metadata/lineage/focused/:connectionId/:modelId`
- Query params: `upstreamLimit=5&downstreamLimit=5`
- Returns: Focal model + upstream + downstream

### **3. Frontend Component**
🚧 In Progress: `FocusedLineageGraph.tsx`
- Replaces random model loading
- Starts from selected model
- Shows 5 upstream, 5 downstream
- Expansion buttons on edges

---

## 📊 User Flow

```
1. Open Lineage View
   ↓
2. [Select a Model]  ← Model Selector
   ↓
3. View Focused Lineage
   ┌─────────────────────────────────────┐
   │  ← 5 Upstream  [FOCAL]  5 Downstream →  │
   └─────────────────────────────────────┘
   ↓
4. Click [+] on edges to expand more
   ↓
5. See more models in that direction
```

---

## 🎨 Visual Design

### **Initial State:**
```
┌────────────────────────────────────────┐
│   🎯 Select a Model to Explore         │
│                                        │
│   ┌──────────────────────────────────┐│
│   │  🎯 Select a model...       ▼   ││
│   └──────────────────────────────────┘│
│                                        │
│   Choose a model to see its complete  │
│   upstream and downstream lineage     │
└────────────────────────────────────────┘
```

### **After Selection:**
```
┌────────────────────────────────────────────────┐
│ 🎯 customers  ↑5 upstream · ↓3 downstream Change│
├────────────────────────────────────────────────┤
│                                                │
│  [+]←[src1]←[src2]←[CUSTOMERS]→[mdl1]→[mdl2]→[+]│
│                      ↑FOCAL↑                   │
│                                                │
│  ← Click + to load 5 more upstream             │
│     Click + to load 5 more downstream →        │
└────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Status

### **Backend** ✅
- [x] `getFocusedLineage` controller
- [x] Recursive upstream fetching
- [x] Recursive downstream fetching
- [x] Route added to API
- [x] Returns focal model + context

### **Frontend** 🚧
- [x] ModelSelector component
- [ ] FocusedLineageGraph component
- [ ] Expansion buttons on edges
- [ ] Load more upstream logic
- [ ] Load more downstream logic
- [ ] Integration with LineageViewContainer

---

## 📝 Next Steps

1. **Complete FocusedLineageGraph component**
2. **Add expansion buttons**
3. **Implement load more logic**
4. **Test with real data**
5. **Deploy and iterate**

---

**This approach will make lineage much more understandable!**
