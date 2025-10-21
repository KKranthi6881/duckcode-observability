# Debug: Data Not Being Saved ❌

**Status:** Investigating  
**Issue:** Extraction completes but database has 0 rows  
**Next Step:** Added error logging, need to run extraction again  

---

## 🔍 What We Know

### Extraction Logs Show Success:
```
✅ Extraction completed successfully
📊 8 models extracted
🔗 29 dependencies extracted
✅ All data stored in database
```

### Database Shows Empty:
```sql
SELECT COUNT(*) FROM metadata.objects 
WHERE connection_id = '259c2785...';

Result: 0 rows ❌
```

**Conclusion:** Supabase queries are failing silently!

---

## 🛠️ Error Logging Added

Added comprehensive logging to `storeManifestData()`:

```typescript
// 1. Log start
console.log(`💾 Storing manifest data for connection: ${connectionId}`);
console.log(`   Organization: ${organizationId}`);
console.log(`   Models to store: ${parsed.models.length}`);

// 2. Check repository errors
const { data: repo, error: repoError } = await supabase...
if (repoError && repoError.code !== 'PGRST116') {
  console.error('❌ Error fetching repository:', repoError);
  throw new Error(`Failed to fetch repository: ${repoError.message}`);
}

// 3. Check insert errors
const { data: newRepo, error: insertError } = await supabase...
if (insertError) {
  console.error('❌ Error creating repository:', insertError);
  throw new Error(`Failed to create repository: ${insertError.message}`);
}

// 4. Log each model
console.log(`📦 Storing ${parsed.models.length} models...`);
for (const model of parsed.models) {
  console.log(`   Processing model: ${model.name}`);
  
  // Check file errors
  const { data: file, error: fileError } = await supabase...
  if (fileError) {
    console.error(`   ❌ Error creating file for ${model.name}:`, fileError);
    continue;
  }
  
  console.log(`   ✅ File created: ${file.id}`);
  
  // Check object errors
  const { data: object, error: objectError } = await supabase...
  if (objectError) {
    console.error(`   ❌ Error creating object for ${model.name}:`, objectError);
    continue;
  }
  
  console.log(`   ✅ Object created: ${object?.id}`);
}
```

---

## 🧪 Next Steps

### Step 1: Run Extraction Again
```
1. Go to http://localhost:5175/admin/metadata
2. Click "Reset" on jaffle-shop-classic
3. Click "Extract"
4. Wait for completion
```

### Step 2: Watch Backend Logs
Look for these new log messages:
```
💾 Storing manifest data for connection: ...
   Organization: 88c41916...
   Models to store: 8
   
📁 Creating new repository record...
✅ Repository created: repo-id

📦 Storing 8 models...
   Processing model: customers
   ✅ File created: file-id
   ✅ Object created: object-id
   ...
```

### Step 3: Look for Errors
If something fails, you'll see:
```
❌ Error fetching repository: [error details]
❌ Error creating repository: [error details]
❌ Error creating file for customers: [error details]
❌ Error creating object for customers: [error details]
```

---

## 🤔 Likely Causes

### 1. RLS Policies
```
Supabase Row Level Security might be blocking inserts
Even service_role might need explicit policies
```

### 2. Missing Columns
```
Tables might be missing required columns
Insert might fail on NOT NULL constraints
```

### 3. Schema Permissions
```
metadata schema might need explicit permissions
Service role might not have access
```

### 4. Data Type Mismatch
```
Trying to insert wrong data types
JSON serialization issues
```

---

## 📋 What to Do Next

**Run the extraction and paste the full backend logs here.**

We'll see exactly which step fails and why, then fix it immediately.

**Expected to see in logs:**
- Repository creation success/failure
- Each model file creation with errors
- Each object creation with errors
- Specific error messages from Supabase

This will tell us exactly what's wrong! 🔍
