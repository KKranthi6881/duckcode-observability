# dbt Installation Options for Backend

**Question:** Do we need to install dbt-core in our backend?

**Answer:** You have 3 options, depending on your deployment preference.

---

## **Option 1: Direct Installation (Simplest)**

### Install dbt directly on server

**Setup:**
```bash
# On your server (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install python3 python3-pip

# Install dbt-core and adapters
pip3 install dbt-core dbt-snowflake dbt-bigquery dbt-postgres dbt-redshift
```

**Pros:**
- ✅ Simplest setup
- ✅ Works immediately
- ✅ No Docker required
- ✅ Good for development/testing

**Cons:**
- ❌ Python dependency mixed with Node.js app
- ❌ Version conflicts possible
- ❌ Hard to support different dbt versions per project
- ❌ Less isolated

**Best for:** Development, small deployments, quick testing

---

## **Option 2: Docker Container (Recommended)**

### Use Docker to isolate dbt execution

**Setup:**

1. **Build Docker image:**
```bash
cd backend
docker build -f Dockerfile.dbt -t dbt-runner:latest .
```

2. **No system-wide installation needed!**

**Backend code automatically uses Docker:**
```typescript
// Uses DbtRunnerDocker.ts
docker run -v /tmp/repo:/project dbt-runner:latest dbt parse
```

**Pros:**
- ✅ **Isolated** - No conflicts with system Python
- ✅ **Clean** - Backend stays Node.js only
- ✅ **Versioned** - Can support multiple dbt versions
- ✅ **Production-ready** - Industry standard
- ✅ **Scalable** - Easy to run in Kubernetes

**Cons:**
- ⚠️ Requires Docker installed
- ⚠️ Slightly slower startup (first run)

**Best for:** Production, staging, enterprise deployments

---

## **Option 3: Separate Microservice (Advanced)**

### Create a dedicated dbt parsing service

**Architecture:**
```
Node.js Backend → HTTP API → Python dbt Service
                             (Flask/FastAPI)
```

**Backend calls API:**
```typescript
const response = await fetch('http://dbt-service:8000/parse', {
  method: 'POST',
  body: JSON.stringify({ repoUrl, branch, token })
});
```

**Pros:**
- ✅ **Complete separation** of concerns
- ✅ **Language-appropriate** - Python for dbt, Node.js for API
- ✅ **Independently scalable**
- ✅ **Can reuse** across multiple backends

**Cons:**
- ❌ More complex architecture
- ❌ Network latency
- ❌ Two services to deploy

**Best for:** Large-scale, microservices architecture

---

## **Recommended Approach: Option 2 (Docker)**

### Why Docker is Best for Production

1. **Clean Separation**
   - Backend = Node.js only
   - dbt = Python in container
   - No mixing, no conflicts

2. **Version Flexibility**
   ```dockerfile
   # Can build different versions
   FROM python:3.11-slim
   RUN pip install dbt-core==1.7.0
   
   # Or
   FROM python:3.11-slim
   RUN pip install dbt-core==1.6.0
   ```

3. **Easy Deployment**
   ```bash
   # Build once, run anywhere
   docker build -t dbt-runner .
   
   # Deploy to any cloud
   - AWS ECS/Fargate
   - Google Cloud Run
   - Azure Container Instances
   - Kubernetes
   ```

4. **Consistent Environment**
   - Same Python version everywhere
   - Same dbt version everywhere
   - Same dependencies everywhere

---

## **Implementation Guide**

### For Docker Approach (Recommended)

#### 1. Build Docker Image

```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend

# Build dbt runner image
docker build -f Dockerfile.dbt -t dbt-runner:latest .

# Test it works
docker run --rm dbt-runner:latest dbt --version
# Output: installed version 1.7.0
```

#### 2. Update Backend to Use Docker

```typescript
// In ExtractionOrchestrator.ts
import { DbtRunnerDocker } from './DbtRunnerDocker';

// Change from:
// this.dbtRunner = new DbtRunner();

// To:
this.dbtRunner = new DbtRunnerDocker();
```

#### 3. Environment Variable

```bash
# backend/.env
DBT_DOCKER_IMAGE=dbt-runner:latest
DBT_WORK_DIR=/tmp/dbt-extractions
```

#### 4. Deploy

**Development:**
```bash
# Local Docker
docker build -t dbt-runner .
npm run dev
```

**Production (AWS ECS):**
```bash
# Push to ECR
docker tag dbt-runner:latest 123456.dkr.ecr.us-east-1.amazonaws.com/dbt-runner:latest
docker push 123456.dkr.ecr.us-east-1.amazonaws.com/dbt-runner:latest

# Backend automatically uses it
```

**Production (Kubernetes):**
```yaml
# deployment.yaml
spec:
  containers:
  - name: backend
    image: my-backend:latest
    env:
    - name: DBT_DOCKER_IMAGE
      value: "dbt-runner:latest"
```

---

## **For Development (Quick Start)**

### If you want to test immediately without Docker:

```bash
# Install dbt locally
pip3 install dbt-core dbt-duckdb

# Use DbtRunner.ts (without Docker)
# It will call dbt directly from system

# Test
dbt --version
# Should output: installed version 1.7.0+
```

**Then in code:**
```typescript
// Use regular DbtRunner
import { DbtRunner } from './DbtRunner';
this.dbtRunner = new DbtRunner();
```

---

## **Comparison Matrix**

| Feature | Direct Install | Docker | Microservice |
|---------|---------------|--------|--------------|
| **Setup Complexity** | ⭐ Easy | ⭐⭐ Medium | ⭐⭐⭐ Hard |
| **Production Ready** | ⭐⭐ OK | ⭐⭐⭐ Excellent | ⭐⭐⭐ Excellent |
| **Isolation** | ❌ Poor | ✅ Excellent | ✅ Perfect |
| **Version Support** | ❌ One version | ✅ Multiple | ✅ Multiple |
| **Deployment** | ⭐⭐ OK | ⭐⭐⭐ Easy | ⭐⭐ Medium |
| **Scalability** | ⭐⭐ Limited | ⭐⭐⭐ Excellent | ⭐⭐⭐ Unlimited |
| **Maintenance** | ⭐⭐ OK | ⭐⭐⭐ Low | ⭐⭐ Medium |

---

## **My Recommendation**

### For Your Project: **Use Docker (Option 2)**

**Reasons:**
1. ✅ Production-ready from day 1
2. ✅ Clean separation (Node.js + Python isolated)
3. ✅ Easy to deploy (single image)
4. ✅ Support multiple dbt versions in future
5. ✅ Industry standard approach

**Implementation:**
```bash
# 1. Build Docker image (5 minutes)
docker build -f Dockerfile.dbt -t dbt-runner:latest .

# 2. Update code to use DbtRunnerDocker (already done!)

# 3. Set environment variable
DBT_DOCKER_IMAGE=dbt-runner:latest

# 4. Done! No dbt installation on system needed
```

---

## **Quick Start (Docker)**

```bash
# Step 1: Build dbt Docker image
cd backend
docker build -f Dockerfile.dbt -t dbt-runner:latest .

# Step 2: Verify it works
docker run --rm dbt-runner:latest dbt --version

# Step 3: Update ExtractionOrchestrator
# (Already uses DbtRunnerDocker by default)

# Step 4: Start backend
npm run dev

# Step 5: Test extraction!
# No dbt installation on your system needed!
```

---

## **Files Created**

- ✅ `backend/Dockerfile.dbt` - Docker image for dbt
- ✅ `backend/src/services/metadata/extraction/DbtRunnerDocker.ts` - Docker-based runner
- ✅ `backend/src/services/metadata/extraction/DbtRunner.ts` - Direct install runner
- ✅ `DBT_INSTALLATION_OPTIONS.md` - This documentation

**You can use either DbtRunner or DbtRunnerDocker - both work!**

---

## **Summary**

**Question:** Do we need to install dbt-core in backend?

**Answer:**
- **Option 1 (Quick Test):** Yes, install directly (`pip install dbt-core`)
- **Option 2 (Production):** No, use Docker (recommended) ✅
- **Option 3 (Advanced):** No, separate microservice

**Recommended:** **Use Docker** - Clean, isolated, production-ready! 🐳
