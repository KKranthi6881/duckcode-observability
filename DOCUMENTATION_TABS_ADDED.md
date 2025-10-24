# 📝 Documentation Viewer Enhancement - Code Files & Lineage Tabs

## ✅ What Was Added

Enhanced the **AI Documentation Viewer** with **2 new tabs** for better code exploration:

### **1. Code Files Tab** 📂
Shows all code files where this metadata object is defined/used:
- **Clickable file paths** - Links to CodeBase page
- **File metadata** - Type, repository, platform
- **"View File" buttons** - Opens in new tab
- **Professional UI** - With hover effects and styling
- **Empty state** - Shows message if no files found

### **2. Lineage Tab** 🌳
Visualizes data lineage using your existing CodeLineageView:
- **Integrated visualization** - Reuses your working lineage component
- **Upstream & downstream** - Shows dependencies
- **Interactive diagram** - Clickable nodes and navigation
- **Context-aware** - Shows lineage specific to this object
- **Empty state** - Handles objects without lineage data

---

## 📂 Files Modified

### **Frontend Components:**
1. **`DocumentationViewer.tsx`**
   - Added 2 new tabs (Code Files, Lineage)
   - Fetches file data from metadata schema
   - Renders clickable file links
   - Integrates CodeLineageView component

2. **`ObjectSelector.tsx`**
   - Added "View" button for documented objects
   - Callback to parent component
   - Click handling to load documentation

3. **`AIDocumentation.tsx`**
   - Updated handleViewDocumentation to pass objectId
   - Updated viewingDoc state to include objectId
   - Passes required props to DocumentationViewer

---

## 🎯 User Experience

### **Before:**
```
[Summary] [Narrative] [Cards] [Code] [Rules] [Impact]
```

### **After:**
```
[Summary] [Narrative] [Cards] [Code] [Rules] [Impact] [Code Files] [Lineage]
```

---

## 🔗 Code Files Tab Features

**What Users See:**
```
┌────────────────────────────────────────────────────┐
│ Source Files                                       │
├────────────────────────────────────────────────────┤
│ 📄 models/marts/customers.sql            [View File]│
│    sql • gitlab-data/analytics • GitLab            │
└────────────────────────────────────────────────────┘
```

**Features:**
- Click file path → Opens in CodeBase
- Click "View File" button → Opens in new tab
- Shows file type, repo, and platform
- Fetches from `metadata.files` table
- Links to: `/admin/codebase?file=...&repo=...`

---

## 🌳 Lineage Tab Features

**What Users See:**
```
┌────────────────────────────────────────────────────┐
│ Data Lineage: Visualize upstream/downstream       │
├────────────────────────────────────────────────────┤
│                                                     │
│     [Interactive Lineage Diagram]                 │
│     - Upstream dependencies                        │
│     - Downstream impacts                           │
│     - Clickable nodes                              │
│                                                     │
└────────────────────────────────────────────────────┘
```

**Features:**
- Reuses existing `CodeLineageView` component
- Shows lineage specific to this file/object
- Interactive diagram with zoom/pan
- Clickable nodes to explore
- Fetches connectionId and filePath from metadata

---

## 🔄 Data Flow

```
User clicks "View" on documented object
          ↓
handleViewDocumentation(objectId, objectName)
          ↓
DocumentationViewer receives:
  - documentation (6 layers)
  - objectName
  - objectId
  - organizationId
          ↓
useEffect → fetchCodeFiles()
          ↓
Queries metadata.objects → get file_id
          ↓
Queries metadata.files → get file details
          ↓
Sets state:
  - codeFiles[] (for Code Files tab)
  - connectionId (for Lineage tab)
  - filePath (for Lineage tab)
```

---

## 📋 Database Queries

### **Code Files Tab:**
```sql
-- Get file_id from object
SELECT file_id 
FROM metadata.objects 
WHERE id = ?;

-- Get file details
SELECT id, relative_path, file_type, repository_id,
       repositories.name, repositories.platform
FROM metadata.files
LEFT JOIN metadata.repositories ON repositories.id = repository_id
WHERE id = ?;
```

### **Lineage Tab:**
Uses existing `CodeLineageView` which queries:
- `metadata.files`
- `metadata.objects`  
- `metadata.dependencies`

---

## 🎨 UI Components

### **Code Files - File Card:**
```tsx
<div className="border rounded-lg p-4 hover:border-[#2AB7A9]">
  <a href="/admin/codebase?file=..." className="text-[#2AB7A9]">
    📄 models/marts/customers.sql
  </a>
  <div className="text-xs text-gray-600">
    <span className="badge">sql</span> • 
    gitlab-data/analytics • 
    GitLab
  </div>
  <button>View File</button>
</div>
```

### **Lineage - Empty State:**
```tsx
<div className="text-center py-12">
  <GitBranch className="h-16 w-16 opacity-50" />
  <p>No lineage data available</p>
  <p>This object is not associated with a code file.</p>
</div>
```

---

## ✅ Testing Checklist

- [x] Code Files tab renders
- [x] File links are clickable
- [x] "View File" button works
- [x] Lineage tab renders
- [x] CodeLineageView integration works
- [x] Empty states display correctly
- [x] Tab navigation works
- [x] Props passed correctly
- [x] No TypeScript errors

---

## 🚀 How to Use

1. **Go to:** `/admin/ai-documentation`
2. **Find documented object** (green "Documented" badge)
3. **Click "View" button**
4. **Navigate to new tabs:**
   - **Code Files** - See where it's defined
   - **Lineage** - See dependencies

---

## 💡 Benefits

### **For Users:**
- ✅ Understand where objects are defined
- ✅ Navigate to actual code easily
- ✅ Visualize data flow
- ✅ Explore dependencies
- ✅ Better code comprehension

### **For Development:**
- ✅ Reused existing CodeLineageView
- ✅ Minimal new code
- ✅ Consistent UI patterns
- ✅ Type-safe implementation
- ✅ Proper error handling

---

## 🎯 Example Workflow

```
1. User views "customers" table documentation
2. Clicks "Code Files" tab
3. Sees: models/marts/customers.sql
4. Clicks file link → Opens in CodeBase
5. Clicks "Lineage" tab
6. Sees visual diagram of dependencies
7. Clicks upstream node → Explores further
```

---

## 📊 Impact

**Before:** Users saw AI-generated docs only  
**After:** Users can explore code files AND data lineage

**Result:** Complete code understanding in one place! 🎉

---

**Status:** ✅ COMPLETE - Ready to use!
