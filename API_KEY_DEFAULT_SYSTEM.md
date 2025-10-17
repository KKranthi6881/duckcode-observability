# API Key Default System - How It Works

## ✅ System Working Correctly Now!

The API key sync is now working after setting `is_default = true`.

---

## 🔑 How Multiple API Keys Work

### Design: One Default Per Provider

Users can have **multiple API keys per provider**, but only **ONE can be marked as default**:

```
Organization: Acme Corp
├── OpenAI
│   ├── Production Key (default) ✅ ← IDE syncs this
│   ├── Development Key
│   └── Backup Key
├── Anthropic
│   ├── Main Claude Key (default) ✅ ← IDE syncs this
│   └── Testing Key
└── Azure OpenAI
    └── Azure Key (default) ✅ ← IDE syncs this
```

### Why This Design?

1. **Flexibility**: Different keys for different environments (prod, dev, testing)
2. **Security**: Rotate keys without disrupting all users immediately
3. **Simplicity**: IDE always knows which key to use (the default one)

---

## 🎯 User Experience

### Setting Default - Two Ways:

#### 1. When Creating a Key:
- Admin panel shows checkbox: ☑️ "Set as Default"
- User checks it → Key is marked as default
- User unchecks it → Key is NOT default (unless it's the first key - see improvement below)

#### 2. After Key Exists:
- Admin panel shows "Set Default" button on non-default keys
- Click button → Makes that key the default
- Automatically unsets previous default for same provider

### Visual Indicators:
- Default keys show: ⭐ Star icon
- Non-default keys show: "Set Default" button

---

## ✨ Improvement Made: Auto-Default First Key

### Problem Before:
- User adds first OpenAI key
- Forgets to check "Set as Default" ☐
- Key is created with `is_default = false`
- IDE sync fails: "No organization API key found"
- User has to manually click "Set Default" button

### Solution Now:
**Backend automatically sets first key as default**, regardless of checkbox state.

#### Logic:
```typescript
// Check if this is the first key for this provider
const existingKeys = await getKeysForProvider(org, provider);

if (existingKeys.length === 0) {
  // First key for this provider → auto-set as default
  shouldBeDefault = true;
  console.log('Auto-setting first key as default');
} else {
  // Not first key → use checkbox value
  shouldBeDefault = userCheckedDefaultBox;
}
```

### Benefits:
- ✅ IDE sync works immediately after adding first key
- ✅ No confusion about why sync doesn't work
- ✅ Better UX - sensible default behavior
- ✅ Users can still add non-default keys later

---

## 🔄 IDE Sync Behavior

### What Happens When User Clicks "Sync Organization API Key":

```
1. IDE sends request to backend:
   GET /api/organizations/{org_id}/api-keys/active

2. Backend queries database:
   SELECT * FROM organization_api_keys
   WHERE organization_id = {org_id}
     AND status = 'active'
     AND is_default = true  ← CRITICAL!

3. Backend returns:
   {
     "api_keys": {
       "openai": "sk-...",
       "anthropic": "sk-ant-...",
       "azure": "..."
     }
   }

4. IDE stores keys in VS Code SecretStorage

5. IDE auto-populates API key field with synced value
```

### Why `is_default` is Required:
- Without it, backend doesn't know which key to return
- User might have 5 OpenAI keys - which one should IDE use?
- Default flag makes it explicit: "Use THIS one"

---

## 🛠️ Technical Implementation

### Database Schema:
```sql
CREATE TABLE enterprise.organization_api_keys (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES enterprise.organizations,
  provider TEXT,  -- 'openai', 'anthropic', 'azure', etc.
  encrypted_key TEXT,
  key_name TEXT,
  is_default BOOLEAN DEFAULT FALSE,  ← The important flag!
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ,
  created_by UUID
);

-- Constraint: Only one default key per provider per organization
CREATE UNIQUE INDEX idx_one_default_per_provider 
ON enterprise.organization_api_keys(organization_id, provider)
WHERE is_default = true;
```

### Backend Endpoints:

#### 1. Create/Update Key:
```
POST /api/organizations/{org_id}/api-keys
Body: {
  provider: 'openai',
  api_key: 'sk-...',
  key_name: 'Production Key',
  is_default: true  // Optional - auto-set to true if first key
}
```

#### 2. Set Existing Key as Default:
```
POST /api/organizations/{org_id}/api-keys/{key_id}/set-default
- Unsets previous default for same provider
- Sets this key as default
```

#### 3. Get Active Keys (for IDE):
```
GET /api/organizations/{org_id}/api-keys/active
Returns: {
  "api_keys": {
    "openai": "sk-...",  // Decrypted default keys
    "anthropic": "sk-ant-..."
  }
}
```

---

## 📋 Files Modified

### Enhancement Added:
```
backend/src/api/controllers/apiKeys.controller.ts
- Added auto-default logic for first key
- Lines 117-130: Check if first key for provider
- Lines 161, 194: Use shouldBeDefault instead of raw is_default
```

### How It Works:
```typescript
// Before creating/updating key
const existingKeys = await getKeysForProvider(orgId, provider);

let shouldBeDefault = is_default;  // From user checkbox

// If this is first key, force default=true
if (!existingKeys || existingKeys.length === 0) {
  shouldBeDefault = true;
  console.log(`Auto-setting first ${provider} key as default`);
}

// Save with computed default value
await saveKey({ ...data, is_default: shouldBeDefault });
```

---

## 🧪 Testing the Enhancement

### Test Case 1: First Key (Auto-Default)
```bash
# 1. User adds first OpenAI key WITHOUT checking "Set as Default"
POST /api/organizations/{org}/api-keys
{ provider: 'openai', api_key: 'sk-...', is_default: false }

# 2. Backend auto-sets is_default=true (first key logic)

# 3. Verify in database:
SELECT is_default FROM organization_api_keys WHERE provider='openai';
# Result: t (true) ✅

# 4. IDE sync works immediately
```

### Test Case 2: Second Key (Respects Checkbox)
```bash
# 1. User adds second OpenAI key WITHOUT checking default
POST /api/organizations/{org}/api-keys
{ provider: 'openai', api_key: 'sk-new...', is_default: false }

# 2. Backend respects is_default=false (not first key)

# 3. Verify in database:
SELECT key_name, is_default FROM organization_api_keys WHERE provider='openai';
# Result:
# Production Key | t ← Still default
# Dev Key        | f ← New key, not default
```

### Test Case 3: Manual Set Default
```bash
# 1. User clicks "Set Default" button on Dev Key

# 2. Backend:
#    - Sets Dev Key: is_default=true
#    - Sets Production Key: is_default=false

# 3. IDE sync now returns Dev Key
```

---

## 🎓 Best Practices

### For Users:
1. ✅ **First key**: Just add it - will auto-become default
2. ✅ **Additional keys**: Check "Set as Default" if you want to switch
3. ✅ **Rotating keys**: Add new key as default, then delete old one
4. ✅ **Testing**: Add non-default test keys, switch when needed

### For Developers:
1. ✅ Backend handles auto-default logic (not frontend)
2. ✅ Database constraints ensure only one default per provider
3. ✅ Audit log tracks all default changes
4. ✅ IDE sync endpoint only returns default keys

---

## 🚀 Summary

### Problem:
- IDE sync failed: "No organization API key found"
- Cause: API key not marked as `is_default = true`

### Root Cause:
- User added key but didn't check "Set as Default" box
- Backend respected user's choice → `is_default = false`
- IDE couldn't find default key → sync failed

### Solution:
1. ✅ **Immediate fix**: Manually set `is_default = true` in database
2. ✅ **Long-term fix**: Auto-set first key as default (implemented now)

### Result:
- ✅ IDE sync works immediately after adding first key
- ✅ Users can still add multiple keys per provider
- ✅ Users can manually change which key is default
- ✅ Better UX - "it just works" for common case

---

## 📚 Related Documentation

- **API Key Sync Issue Analysis**: `/duck-code/API_KEY_SYNC_ISSUE_ANALYSIS.md`
- **Clear IDE Cache Guide**: `/duck-code/CLEAR_IDE_CACHE.md`
- **Duplicate Org Fix**: `DUPLICATE_ORG_FIX_COMPLETE.md`

---

**Status**: ✅ Implemented and Working
**Version**: Enhanced with auto-default (Oct 2025)
