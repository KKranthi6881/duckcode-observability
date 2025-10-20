# Migration from IDE Implementation to Cloud Implementation

## Key Differences Between IDE vs Cloud Version

### IDE Implementation (`duck-code/rust/tantivy-search`)
- **Storage:** Local file system (`index_path`)
- **Scope:** Single user, local files
- **tantivy version:** 0.22
- **Timestamp fields:** u64 (Unix timestamps)
- **Reload policy:** `ReloadPolicy::OnCommitWithDelay`
- **No authentication:** CLI tool, local access
- **No multi-tenancy:** Single index for single user

### Cloud Implementation (`tantivy-search-v2`)
- **Storage:** Supabase Cloud Storage (S3-compatible)
- **Scope:** Multi-organization, enterprise
- **tantivy version:** 0.22 (same!)
- **Timestamp fields:** Should use u64 (not chrono::DateTime)
- **Reload policy:** Should use `OnCommitWithDelay` (not `OnCommit`)
- **Authentication:** JWT + RBAC
- **Multi-tenancy:** Separate index per organization

## API Compatibility Changes for tantivy 0.22

### 1. ReloadPolicy Change
```rust
// OLD (0.21):
.reload_policy(ReloadPolicy::OnCommit)

// NEW (0.22):
.reload_policy(ReloadPolicy::OnCommitWithDelay)
```

### 2. DateTime Handling
```rust
// OLD (using chrono):
use chrono::{DateTime, Utc};
doc.add_date(fields.created_at, obj.created_at.into());

// NEW (using u64 timestamps):
let timestamp = obj.created_at.timestamp() as u64;
doc.add_u64(fields.created_at, timestamp);
```

### 3. Schema Definition
```rust
// OLD:
schema_builder.add_date_field("created_at", FAST | STORED);

// NEW:
schema_builder.add_u64_field("created_at", FAST | STORED);
```

### 4. PostgreSQL DateTime
```rust
// When reading from Postgres, convert to u64:
let created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
let timestamp = created_at.timestamp() as u64;
```

## Files Needing Updates

1. **src/schema.rs** - Change date fields to u64
2. **src/indexer.rs** - Convert DateTime to u64 timestamps
3. **src/searcher.rs** - Update ReloadPolicy
4. **src/api.rs** - Fix Arc/Data unwrapping
5. **src/cache.rs** - Fix borrow checker issue

## Benefits of Following IDE Pattern

✅ Proven working implementation  
✅ No zstd version conflicts  
✅ Simple timestamp handling  
✅ Compatible with tantivy 0.22  
✅ Lower complexity  

## What We're Adding (Cloud-Specific)

✅ Supabase Storage integration  
✅ Per-organization indexes  
✅ JWT authentication  
✅ RBAC (4-tier role system)  
✅ Audit logging  
✅ Rate limiting  
✅ Cache management (LRU + TTL)  

The IDE implementation is our foundation - we're just adding enterprise features on top!
