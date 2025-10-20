# 🚀 Tantivy V2 - Quick Start Guide

## Prerequisites

1. **Rust** (1.70+)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Supabase** running locally or cloud instance

3. **PostgreSQL** with migrations applied

---

## Setup (5 minutes)

### 1. Configure Environment
```bash
cd tantivy-search-v2
cp .env.example .env
```

Edit `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
JWT_SECRET=your-jwt-secret
```

### 2. Build Service
```bash
cargo build --release
```

### 3. Run Service
```bash
cargo run --release
```

You should see:
```
🚀 Starting Tantivy V2 Search Service (Enterprise Edition)
🔒 Security: Per-org isolation + RLS + JWT validation
✅ Database connection established
✅ Cache manager initialized
✅ Supabase Storage client initialized
🌐 Server listening on http://127.0.0.1:3002
```

---

## Testing

### 1. Health Check (No Auth)
```bash
curl http://localhost:3002/api/v2/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "tantivy-search-v2",
  "version": "2.0.0",
  "security": "enterprise-grade"
}
```

### 2. Get JWT Token

First, authenticate with your backend to get a JWT:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com", "password": "password"}'
```

Save the token from the response.

### 3. Trigger Indexing
```bash
curl -X POST http://localhost:3002/api/v2/search/index \
  -H "Authorization: Bearer YOUR_JWT_HERE" \
  -H "Content-Type: application/json" \
  -d '{"organization_id": "your-org-uuid"}'
```

Expected response:
```json
{
  "success": true,
  "message": "Successfully indexed 50 objects",
  "objects_indexed": 50
}
```

### 4. Search
```bash
curl "http://localhost:3002/api/v2/search/query?q=customer" \
  -H "Authorization: Bearer YOUR_JWT_HERE"
```

Expected response:
```json
{
  "results": [
    {
      "object_id": "uuid",
      "name": "customers",
      "full_name": "public.customers",
      "description": "Customer table",
      "object_type": "table",
      "file_path": "models/customers.sql",
      "confidence_score": 0.95,
      "score": 8.5
    }
  ],
  "total": 1,
  "query": "customer"
}
```

### 5. Autocomplete
```bash
curl "http://localhost:3002/api/v2/search/autocomplete?prefix=cust" \
  -H "Authorization: Bearer YOUR_JWT_HERE"
```

Expected response:
```json
{
  "suggestions": ["customers", "customer_orders", "customer_segments"]
}
```

### 6. Similar Objects
```bash
curl "http://localhost:3002/api/v2/search/similar?object_id=uuid" \
  -H "Authorization: Bearer YOUR_JWT_HERE"
```

### 7. Index Stats
```bash
curl "http://localhost:3002/api/v2/search/stats" \
  -H "Authorization: Bearer YOUR_JWT_HERE"
```

Expected response:
```json
{
  "num_docs": 50,
  "size_mb": 0.5,
  "last_indexed_at": "2025-10-17T19:00:00Z",
  "status": "active"
}
```

---

## Troubleshooting

### Service Won't Start

**Problem:** `JWT_SECRET must be set`
**Solution:** Add `JWT_SECRET` to `.env` file

**Problem:** `Failed to connect to database`
**Solution:** Check `DATABASE_URL` and ensure Supabase is running

**Problem:** `SUPABASE_SERVICE_ROLE_KEY must be set`
**Solution:** Get service role key from Supabase dashboard

### No Search Results

**Problem:** Index not built
**Solution:** Trigger indexing first with `/api/v2/search/index`

**Problem:** `Rate limit exceeded`
**Solution:** Wait 1 minute or adjust rate limits in security.rs

### Authorization Errors

**Problem:** `Invalid JWT token`
**Solution:** Get a fresh token from auth endpoint

**Problem:** `User role 'viewer' not authorized for action Index`
**Solution:** Only admins/owners can trigger indexing

---

## Next Steps

1. **Integrate with Backend**
   - Add Node.js proxy routes
   - Wire up authentication

2. **Update Frontend**
   - Connect SearchBar to v2 API
   - Add JWT tokens to requests

3. **Deploy to Production**
   - Set up systemd service
   - Configure HTTPS/TLS
   - Set up monitoring

---

## Performance Monitoring

Watch logs for performance metrics:
```
✅ Search complete in 5.23ms: 10 results
✅ Indexing complete in 2.35s: 50 objects, 524288 bytes
✅ Cache hit for org abc-123
📥 Cache miss, downloading index for org xyz-456
```

Check cache statistics:
```rust
let stats = cache.lock().unwrap().get_stats();
println!("Cache: {} entries, {} bytes", stats.entry_count, stats.total_size_bytes);
```

---

## Security Testing

Test cross-org access (should fail):
```bash
# Try to index another org (should return 403 Forbidden)
curl -X POST http://localhost:3002/api/v2/search/index \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"organization_id": "different-org-uuid"}'
```

Check audit logs:
```sql
SELECT * FROM security.search_access_logs 
WHERE organization_id = 'your-org-uuid'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Production Deployment

### systemd Service

Create `/etc/systemd/system/tantivy-search.service`:
```ini
[Unit]
Description=Tantivy V2 Search Service
After=network.target postgresql.service

[Service]
Type=simple
User=tantivy
WorkingDirectory=/opt/tantivy-search-v2
EnvironmentFile=/opt/tantivy-search-v2/.env
ExecStart=/opt/tantivy-search-v2/target/release/tantivy-search-v2
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable tantivy-search
sudo systemctl start tantivy-search
sudo systemctl status tantivy-search
```

---

**You're ready to search! 🚀**
