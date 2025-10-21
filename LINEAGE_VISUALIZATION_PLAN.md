# Enterprise Lineage Visualization - Implementation Plan

**Date:** October 20, 2025  
**Inspiration:** Atlan, dbt Cloud, OpenMetadata  
**Goal:** Best-in-class data lineage visualization  

---

## 🎯 Design Philosophy

### Visual Hierarchy (Like Atlan/dbt Cloud)
```
Level 1: MODEL LINEAGE (Collapsed - Default View)
  ├─ raw_customers
  ├─ stg_customers  
  ├─ customers
  └─ orders

Level 2: COLUMN LINEAGE (Expanded - On Click)
  ├─ stg_customers
  │   ├─ customer_id ───────┐
  │   ├─ first_name ────────┤
  │   └─ last_name ─────────┤
  ├─                         ↓
  └─ customers
      ├─ customer_id (95% confidence)
      ├─ first_name (95% confidence)
      └─ last_name (95% confidence)
```

### Interaction Flow
1. **Default:** Model-level DAG (100% confidence)
2. **Click Model:** Expand to show columns (7-10 visible)
3. **"Show More":** Expand to see all columns
4. **Click Column:** Highlight lineage path end-to-end
5. **Hover:** Show transformation details & confidence

---

## 🏗️ Architecture

### Tech Stack (Like OpenMetadata)
```typescript
Frontend:
- ReactFlow - Graph visualization (used by OpenMetadata, Atlan)
- dagre - Auto-layout algorithm
- Ant Design - UI components
- Tailwind CSS - Styling
- Lucide Icons - Modern icons

Backend:
- Existing API endpoints (no changes needed!)
- Data already in metadata.columns_lineage
```

### Component Hierarchy
```
LineagePage/
├─ LineageGraph/              (Main container)
│  ├─ ReactFlow                (Graph renderer)
│  ├─ ModelNode                (Collapsed node)
│  ├─ ExpandedModelNode        (With columns)
│  ├─ ColumnNode               (Individual column)
│  ├─ LineageEdge              (Model edge)
│  └─ ColumnLineageEdge        (Column edge with confidence)
├─ LineageControls/            (Top toolbar)
│  ├─ ZoomControls
│  ├─ LayoutToggle (Horizontal/Vertical)
│  ├─ FilterControls
│  └─ DownloadButton
├─ LineageDetails/             (Right panel)
│  ├─ NodeDetails
│  ├─ ColumnDetails
│  └─ TransformationSQL
└─ LineageTable/               (Alternative table view)
   └─ ColumnLineageTable
```

---

## 📊 Data Flow

### 1. API Endpoints (Backend)

```typescript
GET /api/metadata/lineage/model/:connectionId
→ Returns model-level DAG

Response:
{
  nodes: [
    { id: 'uuid', name: 'customers', type: 'model', ... },
    { id: 'uuid', name: 'stg_customers', type: 'model', ... }
  ],
  edges: [
    { source: 'stg_customers', target: 'customers', confidence: 1.0 }
  ]
}

GET /api/metadata/lineage/columns/:objectId
→ Returns columns for a specific model

Response:
{
  objectId: 'uuid',
  objectName: 'customers',
  columns: [
    { id: 'uuid', name: 'customer_id', dataType: 'bigint', ... }
  ],
  columnLineages: [
    {
      sourceColumn: 'customer_id',
      sourceObject: 'stg_customers',
      targetColumn: 'customer_id',
      transformationType: 'direct',
      confidence: 0.95,
      expression: 'c.customer_id'
    }
  ]
}

GET /api/metadata/lineage/column/:objectId/:columnName
→ Returns end-to-end lineage for specific column

Response:
{
  column: 'customer_id',
  path: [
    { object: 'raw_customers', column: 'id' },
    { object: 'stg_customers', column: 'customer_id' },
    { object: 'customers', column: 'customer_id' }
  ],
  transformations: [...]
}
```

### 2. React State Management

```typescript
// Global lineage state
interface LineageState {
  // Model-level data
  models: Model[];
  modelEdges: ModelEdge[];
  
  // Expanded models (track which are open)
  expandedModels: Set<string>;
  
  // Column-level data (lazy loaded)
  columnsByModel: Map<string, Column[]>;
  columnLineages: ColumnLineage[];
  
  // UI state
  selectedNode: string | null;
  selectedColumn: { modelId: string; columnName: string } | null;
  layout: 'horizontal' | 'vertical';
  zoom: number;
}
```

---

## 🎨 Visual Design

### Model Node (Collapsed)
```
┌─────────────────────────┐
│ 📊 customers            │
│ ───────────────────────  │
│ • 5 columns             │
│ • 2 dependencies        │
│ • 100% confidence       │
│                         │
│ [Expand Columns ↓]     │
└─────────────────────────┘
```

### Expanded Model Node (7-10 columns visible)
```
┌─────────────────────────────────────┐
│ 📊 customers                [↑]     │
│ ─────────────────────────────────── │
│ Columns (Showing 7 of 12):         │
│                                     │
│ ├─ ○ customer_id      [95%] ●──┐  │
│ ├─ ○ first_name       [95%] ●──┤  │
│ ├─ ○ last_name        [95%] ●──┤  │
│ ├─ ○ first_order      [90%] ●──┤  │
│ ├─ ○ recent_order     [90%] ●──┤  │
│ ├─ ○ total_orders     [90%] ●──┤  │
│ └─ ○ lifetime_value   [90%] ●──┘  │
│                                     │
│ [+ Show 5 more columns]            │
└─────────────────────────────────────┘
         ↓ Connections
```

### Edge Styling
```typescript
// Model-level edge (GOLD - 100%)
style: {
  stroke: '#10b981',  // Green
  strokeWidth: 3,
  strokeDasharray: '0'
}

// Column edge by confidence:
GOLD (100%):    #10b981 (green), solid, width: 2
SILVER (90-95%): #3b82f6 (blue), solid, width: 2  
BRONZE (85-90%): #f59e0b (orange), solid, width: 2
LOW (<85%):     #ef4444 (red), dashed, width: 1
```

### Confidence Badges
```
[100%] → Green badge, "GOLD"
[95%]  → Blue badge, "SILVER" 
[90%]  → Orange badge, "BRONZE"
[75%]  → Red badge, "REVIEW"
```

---

## 🔄 Interaction Patterns

### 1. Initial Load
```
1. Fetch model-level lineage
2. Auto-layout with dagre
3. Render model nodes (collapsed)
4. Render model edges
5. Center on main entity
```

### 2. Expand Model (Click)
```
User clicks "Expand Columns" on customers node:
→ fetchColumns(customersId)
→ Render top 7-10 columns
→ Animate node expansion
→ Show "Show more" if > 10 columns
→ Fetch column lineages for visible columns
→ Render column edges with confidence colors
```

### 3. Show More Columns
```
User clicks "+ Show 5 more":
→ Expand node height
→ Render next batch of columns
→ Fetch their lineages
→ Re-layout connections
→ Update "Show more" button
```

### 4. Column Click (Trace Lineage)
```
User clicks "customer_id" column:
→ fetchColumnPath(objectId, 'customer_id')
→ Highlight entire path:
   raw_customers.id → 
   stg_customers.customer_id → 
   customers.customer_id
→ Show transformation details in right panel
→ Dim non-related nodes/edges
```

### 5. Collapse Model
```
User clicks collapse button:
→ Animate collapse
→ Remove column nodes/edges
→ Return to model-level view
→ Clear column lineage cache (optional)
```

---

## 📱 UI Features

### Top Toolbar
```
┌────────────────────────────────────────────────────┐
│ [←] customers Lineage                              │
│                                                     │
│ [◐] Layout │ [⊕⊖] Zoom │ [◰] Fit │ [↓] Export   │
│ [━━━] Confidence: All ▼ │ [◰] Show SQL           │
└────────────────────────────────────────────────────┘
```

### Right Panel (Slide-in)
```
┌─────────────────────────────────┐
│ Column Details                  │
│ ─────────────────────────────   │
│                                 │
│ 📊 customers.customer_id        │
│                                 │
│ Source Path:                    │
│ ├─ raw_customers.id (seed)     │
│ ├─ stg_customers.customer_id   │
│ └─ customers.customer_id       │
│                                 │
│ Transformation:                 │
│ Type: direct                    │
│ Confidence: 95%                 │
│                                 │
│ SQL Expression:                 │
│ ┌─────────────────────────────┐ │
│ │ c.customer_id               │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ [View Full Model SQL →]         │
└─────────────────────────────────┘
```

### Minimap (Bottom Right)
```
┌─────────────────┐
│     ▪           │
│   ▪ ▪ ▪         │
│     ▪   ▪       │
│       ▪         │
│                 │
│   [Current View]│
└─────────────────┘
```

---

## 🚀 Implementation Phases

### Phase 1: Core Graph (Week 1 - Days 1-2)
- [ ] Install ReactFlow + dependencies
- [ ] Create LineagePage component
- [ ] Implement model-level graph
- [ ] Add auto-layout with dagre
- [ ] Basic zoom/pan controls
- [ ] Model node component
- [ ] Model edge component

### Phase 2: Column Expansion (Week 1 - Days 3-4)
- [ ] Expandable model nodes
- [ ] Column node components
- [ ] Column lineage edges
- [ ] Confidence color coding
- [ ] "Show more" pagination
- [ ] Animate expand/collapse

### Phase 3: Interactions (Week 1 - Day 5)
- [ ] Column click → trace path
- [ ] Highlight lineage path
- [ ] Right panel details
- [ ] Transformation SQL display
- [ ] Filter by confidence
- [ ] Search functionality

### Phase 4: Polish (Week 2 - Days 1-2)
- [ ] Minimap
- [ ] Export to PNG/SVG
- [ ] Keyboard shortcuts
- [ ] Loading states
- [ ] Error handling
- [ ] Responsive design
- [ ] Performance optimization

### Phase 5: Table View (Week 2 - Day 3)
- [ ] Alternative table view
- [ ] Column lineage table
- [ ] Search/filter
- [ ] Export to CSV
- [ ] Toggle view mode

---

## 📐 Layout Algorithm

### Horizontal Layout (Default)
```
Level 0:    Level 1:       Level 2:      Level 3:
┌─────┐     ┌─────┐        ┌─────┐       ┌─────┐
│ raw │ ──→ │ stg │ ────→  │ dim │  ──→  │ fct │
└─────┘     └─────┘        └─────┘       └─────┘
```

### Vertical Layout (Alternative)
```
      ┌─────┐
      │ raw │
      └─────┘
         ↓
      ┌─────┐
      │ stg │
      └─────┘
         ↓
      ┌─────┐
      │ dim │
      └─────┘
         ↓
      ┌─────┐
      │ fct │
      └─────┘
```

### Auto-layout Rules
1. Group by layer (depth from source)
2. Minimize edge crossings
3. Align vertically by column connections
4. Space evenly within layer
5. Respect minimum node spacing (150px)

---

## 🎯 Success Metrics

### Performance
- Initial load: < 500ms (50 nodes)
- Expand model: < 200ms
- Column click: < 100ms
- Smooth 60fps interactions

### UX
- Intuitive expand/collapse
- Clear confidence indicators
- Easy column tracing
- No information overload (7-10 columns)
- Responsive feedback

### Visual Quality
- Professional appearance
- Atlan/dbt Cloud level design
- Consistent color scheme
- Smooth animations
- High contrast for accessibility

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "reactflow": "^11.10.0",
    "dagre": "^0.8.5",
    "@types/dagre": "^0.7.52",
    "antd": "^5.12.0",
    "lucide-react": "^0.300.0",
    "tailwindcss": "^3.4.0"
  }
}
```

---

## 🎨 Color Palette

```css
/* Confidence Colors */
--gold: #10b981;      /* 100% - Green */
--silver: #3b82f6;    /* 90-95% - Blue */
--bronze: #f59e0b;    /* 85-90% - Orange */
--review: #ef4444;    /* <85% - Red */

/* Node Colors */
--model: #6366f1;     /* Indigo */
--column: #8b5cf6;    /* Purple */
--selected: #ec4899;  /* Pink */

/* Background */
--bg-primary: #f9fafb;
--bg-secondary: #ffffff;
--border: #e5e7eb;
```

---

## 🚀 Ready to Build!

**Start with:** Phase 1 - Core Graph (Model-level lineage)

This will give us:
1. Beautiful model DAG like dbt Cloud
2. Foundation for column expansion
3. Professional visualization

**Next Steps:**
1. Create frontend folder structure
2. Install dependencies
3. Build LineagePage component
4. Add API routes in backend

**Should I start implementing Phase 1?** 🎯
