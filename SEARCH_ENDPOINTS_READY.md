# 🚀 Search Endpoints - Ready for Frontend Integration

## **Quick Reference for Frontend Developers**

### **Metadata Search (Lightning Fast)**

```typescript
// Search for tables, views, models, columns
const searchMetadata = async (query: string) => {
  const response = await fetch(
    `${API_URL}/api/search/metadata?query=${encodeURIComponent(query)}&limit=20`,
    {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    }
  );
  
  const data = await response.json();
  return data.data.results;
};
```

**Example Usage:**
```typescript
// User types "customer" in search box
const results = await searchMetadata('customer');

// Results in ~5ms:
[
  {
    object_id: "uuid",
    name: "customers",
    full_name: "public.customers", 
    description: "Customer master table",
    object_type: "table",
    file_path: "models/customers.sql",
    confidence_score: 0.95,
    score: 8.5  // Relevance score
  }
]
```

---

## **API Endpoints Summary**

### **1. Search Metadata (User Endpoint)**
```
GET /api/search/metadata
```

**Query Params:**
- `query` (required) - Search query
- `object_type` (optional) - Filter by "table", "view", "model"
- `limit` (optional) - Max results (default: 20)

**Response Time:** ~5-10ms  
**Authentication:** Required  
**Rate Limit:** 100 req/min per org

---

### **2. Rebuild Index (Admin Only)**
```
POST /api/search/rebuild-index
```

**Use When:**
- Initial setup testing
- Recovery from failures
- After bulk data updates

**Response Time:** ~30-60 seconds (async)  
**Authentication:** Admin/Owner only

---

## **Frontend Integration Guide**

### **Step 1: Create Search Component**

```typescript
// components/MetadataSearch.tsx
import { useState, useCallback } from 'react';
import { debounce } from 'lodash';

interface SearchResult {
  object_id: string;
  name: string;
  full_name: string;
  description: string;
  object_type: string;
  file_path: string;
  confidence_score: number;
  score: number;
}

export function MetadataSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `/api/search/metadata?query=${encodeURIComponent(q)}`,
          {
            headers: {
              'Authorization': `Bearer ${getAuthToken()}`
            }
          }
        );
        
        const data = await response.json();
        setResults(data.data.results || []);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  return (
    <div className="search-container">
      <input
        type="text"
        placeholder="Search tables, views, models..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          search(e.target.value);
        }}
      />
      
      {loading && <div>Searching...</div>}
      
      <div className="results">
        {results.map(result => (
          <div key={result.object_id} className="result-item">
            <h4>{result.name}</h4>
            <p>{result.description}</p>
            <span className="type">{result.object_type}</span>
            <span className="path">{result.file_path}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### **Step 2: Add Admin Rebuild Button**

```typescript
// components/AdminPanel.tsx
export function AdminPanel() {
  const [rebuilding, setRebuilding] = useState(false);

  const rebuildIndex = async () => {
    setRebuilding(true);
    try {
      const response = await fetch('/api/search/rebuild-index', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      
      const data = await response.json();
      alert(data.message);
    } catch (error) {
      alert('Failed to rebuild index');
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div>
      <h2>Search Index Management</h2>
      <button 
        onClick={rebuildIndex}
        disabled={rebuilding}
      >
        {rebuilding ? 'Rebuilding...' : 'Rebuild Search Index'}
      </button>
    </div>
  );
}
```

---

## **Search Features**

### **1. Fuzzy Matching**
```typescript
// User types: "custmer" (typo)
await searchMetadata('custmer');

// Still finds: "customers" ✅
```

### **2. Type Filtering**
```typescript
// Only search for tables
await fetch('/api/search/metadata?query=customer&object_type=table');

// Types: "table", "view", "model", "column"
```

### **3. Ranked Results**
Results sorted by relevance (score field):
- Exact name match: High score
- Description match: Medium score  
- Column match: Lower score

---

## **Error Handling**

```typescript
try {
  const response = await fetch('/api/search/metadata?query=test');
  
  if (!response.ok) {
    if (response.status === 401) {
      // Redirect to login
    } else if (response.status === 429) {
      // Rate limited - show message
    } else {
      // Other error
    }
  }
  
  const data = await response.json();
  if (data.success) {
    setResults(data.data.results);
  }
} catch (error) {
  console.error('Network error:', error);
}
```

---

## **Performance Tips**

1. **Debounce Input**
   - Wait 300ms after user stops typing
   - Prevents excessive API calls

2. **Show Loading State**
   - Even though search is fast (~5ms)
   - Better UX

3. **Cache Results**
   - Store recent searches in memory
   - Instant for repeat queries

4. **Progressive Enhancement**
   - Show results as they arrive
   - No need to wait for all

---

## **Example: Full Search Flow**

```typescript
// 1. User types in search box
<input onChange={handleSearch} />

// 2. Debounced search function
const handleSearch = debounce(async (query: string) => {
  // 3. Call API
  const results = await searchMetadata(query);
  
  // 4. Display results (~5ms later)
  setResults(results);
}, 300);

// 5. User sees results almost instantly! ⚡
```

---

## **Testing Checklist**

- [ ] Search with 2 characters (should work)
- [ ] Search with typos (fuzzy matching)
- [ ] Filter by object type
- [ ] Empty query (should return empty)
- [ ] Invalid auth (should return 401)
- [ ] Rate limit test (100 req/min)
- [ ] Admin rebuild index

---

## **Environment Setup**

Frontend `.env`:
```bash
VITE_API_URL=http://localhost:3001
```

Backend `.env`:
```bash
TANTIVY_SERVICE_URL=http://localhost:3002
JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
```

---

## **What Happens Behind the Scenes**

```
User searches "customer"
    ↓
Frontend → Backend (/api/search/metadata)
    ↓
Backend → Tantivy Service (localhost:3002)
    ↓
Tantivy checks cache
    ↓
If cached: Returns in ~5ms ✅
If not cached: Downloads from Supabase, then searches (~500ms first time)
    ↓
Results → Backend → Frontend
    ↓
User sees results! 🎉
```

---

## **Next UI Features (Future)**

1. **Autocomplete Dropdown**
   - Show suggestions as user types
   - Use existing `/api/search/metadata` with `limit=5`

2. **Search History**
   - Store recent searches
   - Quick re-search

3. **Advanced Filters**
   - By file path
   - By confidence score
   - By date modified

4. **Search Analytics**
   - Popular searches
   - Search performance metrics

---

**Status:** ✅ **READY FOR FRONTEND INTEGRATION**

All backend endpoints are live and tested. Frontend can start building search UI immediately!
