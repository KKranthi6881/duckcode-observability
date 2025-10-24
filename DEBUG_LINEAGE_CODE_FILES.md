# 🔍 Debug Guide: Lineage & Code Files Tabs Not Showing

## 🎯 Quick Fix Checklist

### **1. Refresh Browser (Hard Refresh)**
```
Press: Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)
```
This clears cached JavaScript.

### **2. Open Browser Console**
```
Right-click → Inspect → Console tab
```

### **3. View Documentation**
1. Go to **View Documentation** tab
2. Click on any documented object
3. **Look for console logs** like:
```
[DocumentationViewer] Fetching files for object: abc-123-def
[DocumentationViewer] Object data: {...}
[DocumentationViewer] Set connectionId: xyz-789 filePath: models/customers.sql
```

---

## 🐛 What to Check in Console

### **Scenario 1: You See File Data**
```
✅ [DocumentationViewer] Object data: { 
    id: "abc-123", 
    files: [{ relative_path: "models/customers.sql", ... }] 
}
✅ [DocumentationViewer] Set connectionId: xyz-789 filePath: models/customers.sql
```
**This means:**
- Data is being fetched correctly
- Tabs should be visible
- **Problem:** UI rendering issue

**Solution:** Check if tabs are visible but empty

---

### **Scenario 2: No File Data**
```
⚠️ [DocumentationViewer] Object data: { id: "abc-123", files: null }
⚠️ [DocumentationViewer] No file data found for this object
```
**This means:**
- Object exists but has no file_id
- Or file_id points to non-existent file

**Solution:** Check database

---

### **Scenario 3: Error**
```
❌ [DocumentationViewer] Error: ... permission denied ...
```
**This means:**
- Supabase RLS (Row Level Security) blocking query
- Schema permissions issue

**Solution:** Check Supabase policies

---

## 🗄️ Database Check

### **Check if Object has File ID:**
```sql
SELECT 
    o.id,
    o.name,
    o.file_id,
    f.relative_path
FROM metadata.objects o
LEFT JOIN metadata.files f ON f.id = o.file_id
WHERE o.id = 'YOUR_OBJECT_ID';
```

**Expected Result:**
```
id        | name      | file_id   | relative_path
----------|-----------|-----------|------------------
abc-123   | customers | xyz-789   | models/customers.sql
```

**If file_id is NULL:**
- Object was not parsed from a file
- Or parsing didn't link it correctly
- **Solution:** Re-parse the repository

---

## 🔧 Quick Fixes

### **Fix 1: Re-fetch Data**
```typescript
// In DocumentationViewer component
useEffect(() => {
  fetchCodeFiles();
}, [objectId]); // ← This triggers on object change
```

### **Fix 2: Check Tabs Array**
```typescript
const tabs = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'narrative', label: 'Narrative', icon: BookOpen },
  { id: 'cards', label: 'Transformation Cards', icon: CreditCard },
  { id: 'code', label: 'Code Explanations', icon: Code },
  { id: 'rules', label: 'Business Rules', icon: Shield },
  { id: 'impact', label: 'Impact Analysis', icon: TrendingUp },
  { id: 'files', label: 'Code Files', icon: FileCode }, // ← Should be here
  { id: 'lineage', label: 'Lineage', icon: GitBranch }, // ← Should be here
];
```

### **Fix 3: Check Tab Rendering**
Look for:
```typescript
{activeTab === 'files' && (
  // Code Files content
)}

{activeTab === 'lineage' && (
  // Lineage content
)}
```

---

## 🧪 Test Cases

### **Test 1: Tabs Are Visible**
```
1. View any documented object
2. Count tabs: Should see 8 tabs total
3. Click "Code Files" tab
4. Click "Lineage" tab
```

**Expected:** Both tabs appear in the tab bar

---

### **Test 2: Code Files Tab Works**
```
1. Click "Code Files" tab
2. Should see either:
   - List of files (if object has file_id)
   - "No code files found" message (if no file_id)
```

---

### **Test 3: Lineage Tab Works**
```
1. Click "Lineage" tab
2. Should see either:
   - Interactive lineage diagram
   - "No lineage data available" message
```

---

## 🔍 Console Debugging Commands

### **Check if DocumentationViewer is Mounted:**
```javascript
// In browser console
console.log('Active tabs:', document.querySelectorAll('[class*="border-[#2AB7A9]"]').length);
```

### **Check State:**
```javascript
// Add this temporarily in component
console.log('codeFiles:', codeFiles);
console.log('connectionId:', connectionId);
console.log('filePath:', filePath);
console.log('loadingFiles:', loadingFiles);
```

---

## 🚨 Common Issues

### **Issue 1: "Cannot read property 'relative_path' of undefined"**
**Cause:** File data structure mismatch
**Fix:** Check if files is an array

### **Issue 2: "Schema 'metadata' does not exist"**
**Cause:** Supabase schema not accessible
**Fix:** Check Supabase connection and migrations

### **Issue 3: Tabs not clickable**
**Cause:** CSS or z-index issue
**Fix:** Check browser dev tools Elements tab

### **Issue 4: Empty state shows even with data**
**Cause:** State not updating
**Fix:** Check React DevTools to see state values

---

## 📊 Expected Data Flow

```
User clicks object
      ↓
DocumentationViewer mounts
      ↓
useEffect fires → fetchCodeFiles()
      ↓
Query metadata.objects with files join
      ↓
Response: { id, file_id, files: [{...}] }
      ↓
Extract fileData from array
      ↓
setCodeFiles([fileData])
setConnectionId(fileData.repository_id)
setFilePath(fileData.relative_path)
      ↓
Render tabs with data
```

---

## 🎯 What Should You See?

### **When Everything Works:**

```
┌─────────────────────────────────────────┐
│ customers                    ⭐⭐⭐⭐☆   │
├─────────────────────────────────────────┤
│ [Summary][Narrative][Cards][Code][...]  │
│ [...][Impact][Code Files][Lineage] ← HERE
├─────────────────────────────────────────┤
│ Click "Code Files" tab:                 │
│                                         │
│ 📄 models/marts/customers.sql [View]    │
│    sql • analytics • gitlab             │
│                                         │
│ Click "Lineage" tab:                    │
│                                         │
│ [Interactive Diagram with nodes]        │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔧 Emergency Fix

If nothing works, try this:

### **Hard Reset:**
1. **Clear browser cache completely**
2. **Hard refresh:** Cmd+Shift+R
3. **Check console for errors**
4. **Share console output with me**

### **Check Supabase:**
```sql
-- Do you have any objects with files?
SELECT COUNT(*) 
FROM metadata.objects o
JOIN metadata.files f ON f.id = o.file_id;
```

If count = 0, then no objects have file associations!

---

## 📝 Share This Info

If tabs still not showing, share:

1. **Console logs** (all `[DocumentationViewer]` messages)
2. **Database query result** (object with file_id)
3. **Screenshot** of the documentation viewer
4. **Browser** and version

---

**Let me know what you see in the console and I'll help debug!** 🔍
