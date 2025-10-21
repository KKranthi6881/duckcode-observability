# Phase 4 & 5: Polish + Table View Implementation Plan

**Timeline:** Days 6-8  
**Status:** 🚀 READY TO START

---

## 🎨 Phase 4: Polish (Days 6-7)

### 4.1 Minimap Navigation
**Goal:** Bird's eye view of entire lineage graph for large datasets

**Features:**
- ✅ Small overview panel in corner
- ✅ Shows entire graph at scale
- ✅ Current viewport highlighted
- ✅ Click to jump to areas
- ✅ Drag viewport rectangle

**Implementation:**
- Use React Flow's built-in `<MiniMap />` component
- Custom styling to match DuckCode theme
- Position: bottom-right corner
- Size: 200x150px

---

### 4.2 Export Functionality
**Goal:** Save lineage diagrams for documentation/sharing

**Export Options:**
1. **PNG Image** - High-res screenshot of graph
2. **SVG Vector** - Scalable vector graphic
3. **JSON Data** - Raw lineage data for processing
4. **Markdown** - Documentation format

**Implementation:**
- Export button in header
- Dropdown menu for format selection
- Use `html-to-image` for PNG
- Use React Flow's export for SVG
- Custom formatter for Markdown

---

### 4.3 Animations & Transitions
**Goal:** Smooth, professional interactions

**Animation Types:**
1. **Node Expansion** - Smooth height transition
2. **Edge Creation** - Animated path drawing
3. **Zoom/Pan** - Easing transitions
4. **Loading States** - Skeleton loaders
5. **Hover Effects** - Scale + glow

**Implementation:**
- CSS transitions for node expansion
- Framer Motion for complex animations
- React Flow animation config
- Custom loading spinners

---

### 4.4 Additional Polish
- Search/filter nodes by name
- Highlight lineage paths on hover
- Keyboard shortcuts (Ctrl+F, Ctrl+Z, etc.)
- Dark mode support
- Responsive layout
- Performance optimization for large graphs (1000+ nodes)

---

## 📊 Phase 5: Table View (Day 8)

### 5.1 View Mode Toggle
**Goal:** Switch between visual graph and data table

**UI Elements:**
- Toggle buttons: `[Graph View] [Table View]`
- Smooth transition between modes
- Preserve filters/search state

---

### 5.2 Table View Features

**Columns:**
1. **Source Model** - Name + type badge
2. **Source Column** - Column name
3. **→** - Arrow indicator
4. **Target Model** - Name + type badge
5. **Target Column** - Column name
6. **Confidence** - Badge with %
7. **Transformation** - Type (direct, function, calculation)
8. **Actions** - View SQL, Focus in graph

**Features:**
- ✅ Sortable columns
- ✅ Filterable by model, column, confidence
- ✅ Search across all fields
- ✅ Export to CSV
- ✅ Pagination (50 per page)
- ✅ Click row → Focus in graph view

---

### 5.3 Advanced Table Features

**Multi-hop Lineage:**
- Show full lineage path in table
- Example: `source_col → intermediate_col → target_col`
- Expandable rows for detailed view

**Grouping:**
- Group by source model
- Group by target model
- Group by confidence tier

**Filtering:**
- Filter by confidence threshold
- Filter by transformation type
- Filter by model type (staging, marts, etc.)

---

## 📁 File Structure

```
frontend/src/components/lineage/
├── LineageGraph.tsx                 # Graph view (existing)
├── ExpandableModelNode.tsx          # Node component (existing)
├── LineageTable.tsx                 # NEW - Table view
├── LineageViewContainer.tsx         # NEW - View switcher
├── LineageMinimap.tsx              # NEW - Minimap component
├── LineageExport.tsx               # NEW - Export menu
├── LineageSearch.tsx               # NEW - Search/filter
└── animations/
    ├── nodeAnimation.ts            # NEW - Node animations
    └── edgeAnimation.ts            # NEW - Edge animations
```

---

## 🎯 Implementation Order

### Day 6 (Morning):
1. ✅ Add MiniMap component
2. ✅ Style minimap to match theme
3. ✅ Add export button + menu

### Day 6 (Afternoon):
4. ✅ Implement PNG export
5. ✅ Implement SVG export
6. ✅ Implement JSON export

### Day 7 (Morning):
7. ✅ Add node expansion animations
8. ✅ Add edge drawing animations
9. ✅ Add hover effects

### Day 7 (Afternoon):
10. ✅ Search/filter functionality
11. ✅ Keyboard shortcuts
12. ✅ Performance optimization

### Day 8 (Morning):
13. ✅ Create LineageTable component
14. ✅ Add view toggle
15. ✅ Implement sorting/filtering

### Day 8 (Afternoon):
16. ✅ Add CSV export
17. ✅ Click row → Focus in graph
18. ✅ Polish + testing

---

## 📦 Dependencies to Add

```json
{
  "dependencies": {
    "html-to-image": "^1.11.11",        // PNG export
    "framer-motion": "^10.16.4",        // Animations
    "react-table": "^7.8.0",            // Table component
    "file-saver": "^2.0.5"              // File downloads
  }
}
```

---

## 🎨 UI/UX Enhancements

### Header Controls:
```
[← Back] [Search: _____] [Export ▼] [Table View] [⛶ Fit View]
```

### Export Dropdown:
```
Export as...
├─ 📷 PNG Image
├─ 🎨 SVG Vector
├─ 📊 JSON Data
└─ 📝 Markdown
```

### Table View:
```
┌─────────────────────────────────────────────────────────┐
│ [Graph View] [Table View]  Search: [_____]  Export CSV │
├─────────────────────────────────────────────────────────┤
│ Source Model │ Column → Target Model │ Column │ Conf   │
├──────────────┼────────────────────────┼────────┼────────┤
│ stg_customers│ customer_id            │ ...    │ 100%   │
│              │ first_name             │ ...    │ 100%   │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Success Criteria

**Phase 4 Complete When:**
- ✅ Minimap shows entire graph
- ✅ Can export to PNG, SVG, JSON
- ✅ Smooth animations on all interactions
- ✅ Search/filter works
- ✅ Performance < 1s for 500 nodes

**Phase 5 Complete When:**
- ✅ Can toggle between graph and table view
- ✅ Table shows all lineage relationships
- ✅ Can sort, filter, search in table
- ✅ Can export table to CSV
- ✅ Click row focuses node in graph view

---

## 💡 Future Enhancements (Phase 6+)

- Impact analysis (what breaks if I change this?)
- Time-travel lineage (view at different points in time)
- Cost attribution (data processing costs per model)
- Data quality scores integration
- Lineage versioning (compare changes)
- Collaborative annotations

---

**Ready to start implementation!** 🎉
