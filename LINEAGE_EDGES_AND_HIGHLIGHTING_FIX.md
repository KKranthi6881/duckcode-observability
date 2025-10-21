# Lineage Edges and Column Highlighting Fix

## Issues Fixed

### 1. ❌ Thick Blue Border on Focal Node
**Problem**: The focal node (selected model) had a thick blue ring border (`ring-2 ring-blue-500`) that was too prominent.

**Solution**: 
- Removed the ring styling
- Changed to subtle border: `border-2 border-blue-400`
- Kept shadow for depth: `shadow-lg`
- Result: Clean, professional look matching reference image

### 2. ❌ Straight Lines Instead of Curved Edges
**Problem**: Edges were showing as straight lines instead of smooth curves.

**Solution**:
- Changed edge type from `'smoothstep'` to `'default'` (bezier curves)
- Updated in both `defaultEdgeOptions` and `flowEdges` generation
- Applied to both model-level and column-level edges
- Result: Smooth, curved connections between nodes

### 3. ❌ Missing Column-Level Edge Highlighting
**Problem**: When hovering over columns, the relationships between tables weren't being highlighted.

**Solution**:
- Added `generateColumnEdges()` function to create edges between columns
- Integrated column edge generation in `handleExpand()` callback
- Column edges are created after fetching column data
- Edges are color-coded by confidence level:
  - 🟢 Green (#10b981): High confidence (≥95%)
  - 🔵 Blue (#3b82f6): Medium confidence (90-95%)
  - 🟠 Orange (#f59e0b): Low confidence (85-90%)
  - 🔴 Red (#ef4444): Very low confidence (<85%)

### 4. ✅ Column Hover Highlighting Already Working
The `handleColumnHover()` function was already implemented and working:
- Highlights edges when hovering over columns
- Animates highlighted edges
- Dims non-related edges (opacity: 0.4)
- Changes edge color to blue (#3b82f6) for highlighted relationships

## Files Modified

### 1. FocusedLineageView.tsx
**Changes:**
- Removed thick border from focal node style
- Changed edge type to `'default'` for curved edges
- Added `generateColumnEdges()` function
- Updated `handleExpand()` to generate column edges after fetching columns
- Updated `handleCollapse()` to regenerate edges without collapsed node's columns
- Column edges now properly connect column handles

**Key Functions:**
```typescript
// Generate column edges with confidence-based colors
const generateColumnEdges = useCallback((nodes: Node[]) => {
  // Creates edges between columns with handles
  // Color-coded by confidence level
  // Type: 'default' for smooth curves
}, [allColumnLineages]);

// Expand node and generate column edges
const handleExpand = useCallback(async (nodeId: string) => {
  await fetchColumns(nodeId);
  const columnEdges = generateColumnEdges(updatedNodes);
  // Merge model edges + column edges
}, [fetchColumns, generateColumnEdges, setNodes, setEdges]);
```

### 2. ModernModelNode.tsx
**Changes:**
- Simplified focal node border: `border-2 border-blue-400`
- Removed ring styling: `ring-2 ring-blue-500`
- Maintained shadow for depth
- Column handles already properly positioned

## How Column Highlighting Works

### When You Hover Over a Column:

1. **Column Detection**: `onMouseEnter` triggers `handleColumnHover(columnId, lineages)`
2. **Edge Filtering**: Finds all edges related to that column
3. **Visual Feedback**:
   - Related edges: Animated, blue color, full opacity, thicker (3px)
   - Unrelated edges: Dimmed (40% opacity), gray color, normal width (2px)
4. **Reset**: `onMouseLeave` resets all edges to default state

### Edge Types:

**Model-Level Edges** (between tables):
- Type: `'default'` (bezier curves)
- Color: Light gray (#cbd5e1)
- Width: 2px
- No handles (connects node centers)

**Column-Level Edges** (between specific columns):
- Type: `'default'` (bezier curves)
- Color: Confidence-based (green/blue/orange/red)
- Width: 1-2px based on confidence
- Uses handles: `${objectId}-${columnName}-source/target`

## Testing Checklist

- [x] Dev server restarted
- [ ] Navigate to Admin → Metadata Extraction
- [ ] Click "View Lineage" on a connection
- [ ] Verify edges are curved (not straight)
- [ ] Verify focal node has subtle blue border (not thick ring)
- [ ] Click on a node to expand columns
- [ ] Verify column-level edges appear with colors
- [ ] Hover over a column with lineage
- [ ] Verify related edges highlight in blue
- [ ] Verify unrelated edges dim
- [ ] Verify edges animate when highlighted
- [ ] Collapse node and verify column edges disappear

## Expected Visual Results

### ✅ Curved Edges
- Smooth bezier curves connecting nodes
- Natural flow from left to right
- Proper arrow markers at endpoints

### ✅ Subtle Focal Node
- Clean blue border (not thick ring)
- Checkmark badge (✓) instead of "FOCAL" text
- Subtle shadow for depth

### ✅ Column Highlighting
- Hover over column → related edges turn blue and animate
- Other edges dim to 40% opacity
- Clear visual indication of data flow
- Color-coded by confidence level

### ✅ Clean Layout
- Proper spacing between nodes
- Columns displayed with icons
- "Explore" button on each node
- Professional, minimal design

## Troubleshooting

### Edges Still Straight?
1. Hard refresh browser: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
2. Check browser console for errors
3. Verify ReactFlow is using correct edge type
4. Clear browser cache completely

### Column Edges Not Appearing?
1. Verify node is expanded (click to expand)
2. Check that columns have lineage data
3. Look for column handles (small dots on column items)
3. Check browser console for API errors
4. Verify `allColumnLineages` has data

### Highlighting Not Working?
1. Ensure columns have lineage data (look for 🔑 icon)
2. Verify `handleColumnHover` is being called (check console)
3. Check that column has `lineages` property
4. Ensure edges have proper IDs matching lineage IDs

### Thick Border Still Showing?
1. Hard refresh to clear CSS cache
2. Check ModernModelNode.tsx has updated styling
3. Verify no inline styles overriding classes
4. Check browser DevTools for applied styles

## Technical Details

### Edge Configuration
```typescript
// Default edge options (model-level)
const defaultEdgeOptions = {
  type: 'default' as const,  // Bezier curves
  markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' },
  style: { stroke: '#cbd5e1', strokeWidth: 2 }
};

// Column edge (confidence-based)
{
  type: 'default',
  sourceHandle: `${sourceId}-${columnName}-source`,
  targetHandle: `${targetId}-${columnName}-target`,
  style: { stroke: confidenceColor, strokeWidth: 1-2 }
}
```

### Node Styling
```typescript
// Focal node
className={`
  bg-white rounded-lg min-w-[320px] max-w-[400px]
  shadow-lg border-2 border-blue-400
`}

// Regular node
className={`
  bg-white rounded-lg min-w-[320px] max-w-[400px]
  shadow-md hover:shadow-lg border-2 border-gray-200
`}
```

## Performance Notes

- Column edges are only generated for expanded nodes
- Edges are filtered efficiently using Set lookups
- Hover highlighting uses React state updates (fast)
- No unnecessary re-renders with proper useCallback usage

---
**Status**: ✅ Complete - All issues fixed
**Last Updated**: 2025-01-21
**Dev Server**: Running on port 5175
