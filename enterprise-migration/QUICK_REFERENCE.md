# Enterprise Migration - Quick Reference

## 📁 Folder Structure

```
enterprise-migration/
├── README.md                        # Overview and getting started
├── IMPLEMENTATION_ROADMAP.md        # Timeline, resources, budget
├── QUICK_REFERENCE.md              # This file - quick lookup
│
├── 01-database-schema/
│   ├── PLAN.md                      # Schema design and tables
│   └── TASKS.md                     # 85 actionable tasks
│
├── 02-admin-portal/
│   ├── PLAN.md                      # UI components and features
│   └── (create TASKS.md)
│
├── 03-metadata-service/
│   ├── PLAN.md                      # Cloud extraction service
│   └── (create TASKS.md)
│
├── 04-sync-engine/
│   ├── PLAN.md                      # Cloud ↔ Local sync
│   └── (create TASKS.md)
│
├── 05-connectors/
│   ├── PLAN.md                      # Multi-source connectors
│   └── (create TASKS.md)
│
├── 06-security/
│   ├── PLAN.md                      # RBAC, audit, encryption
│   └── (create TASKS.md)
│
├── 07-documentation/
│   ├── PLAN.md                      # AI-powered docs
│   └── (create TASKS.md)
│
└── 08-deployment/
    ├── PLAN.md                      # Migration strategy
    └── (create TASKS.md)
```

## 🎯 Phase Summaries

### Phase 1: Database Schema (3 weeks)
**What**: Create enterprise multi-tenant database schema
**Key Tables**: 
- `organizations` - Enterprise customers
- `teams` - Hierarchical team structure
- `team_members` - User-team mapping
- `organization_api_keys` - Customer LLM keys
- `organization_roles` - Custom roles/permissions

**Output**: Supabase schema ready for multi-tenant data

---

### Phase 2: Admin Portal (4 weeks)
**What**: Build React admin interface
**Key Features**:
- Organization dashboard
- Team hierarchy management
- User invitations
- Connector configuration
- API key management
- Audit logs viewer

**Output**: Admin portal deployed and accessible

---

### Phase 3: Metadata Service (4 weeks)
**What**: Cloud-based metadata extraction (replicate duck-code logic)
**Key Components**:
- SQLglot parser integration (Python microservice)
- Job queue for extraction tasks
- GitHub connector enhancement
- Metadata storage in Supabase

**Output**: Metadata extracts to cloud instead of local-only

---

### Phase 4: Sync Engine (3 weeks)
**What**: Bidirectional sync between cloud and IDE
**Key Features**:
- Initial full sync
- Incremental delta sync
- Background auto-sync
- Conflict resolution (cloud wins)

**Output**: IDE stays in sync with cloud metadata

---

### Phase 5: Connectors (3 weeks)
**What**: Support multiple data sources
**Connectors**:
- GitHub (enhance existing)
- Snowflake
- BigQuery
- PostgreSQL
- Databricks
- Tableau
- Looker

**Output**: Enterprises can connect all their data sources

---

### Phase 6: Security & RBAC (2 weeks)
**What**: Enterprise-grade security
**Key Features**:
- Role-based access control
- Row-level security (RLS)
- API key encryption
- Audit logging
- Rate limiting
- Compliance (SOC 2, GDPR)

**Output**: Enterprise security requirements met

---

### Phase 7: Documentation (2 weeks)
**What**: AI-powered metadata documentation
**Key Features**:
- Auto-generate table/column descriptions
- AI verification of metadata accuracy
- Quality scoring (0-100)
- Improvement suggestions
- Documentation templates

**Output**: Automated, high-quality documentation

---

### Phase 8: Deployment (3 weeks)
**What**: Migrate users to enterprise platform
**Key Steps**:
- Schema migrations
- Data migration
- Backend deployment
- Frontend deployment
- User onboarding
- Monitoring

**Output**: Enterprise platform live in production

## 🔑 Key Concepts

### Multi-Tenancy
- Each organization is isolated
- RLS policies enforce data boundaries
- Users can belong to multiple organizations
- Organization admins control their data

### Team Hierarchy
```
Organization (Acme Corp)
  └── Division (Engineering)
      └── Department (Data Platform)
          └── Team (Analytics)
              └── Users (Alice, Bob, Carol)
```

### Metadata Flow
```
GitHub → Connector → Extraction Service → Supabase → Sync → IDE SQLite
```

### Authentication
```
User → OAuth → SaaS Login → JWT Token → IDE → Metadata Sync
```

## 📊 Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Queue**: BullMQ (optional)
- **Parser**: SQLglot (Python subprocess)

### Frontend
- **Framework**: React 18+
- **Language**: TypeScript
- **Routing**: React Router v6
- **State**: Zustand / React Query
- **UI**: Tailwind CSS + shadcn/ui
- **Forms**: React Hook Form + Zod

### IDE Extension
- **Platform**: VS Code Extension
- **Language**: TypeScript
- **Database**: SQLite3
- **UI**: React (webview)

### Infrastructure
- **Hosting**: Vercel / AWS / GCP / Azure
- **Database**: Supabase Cloud
- **Monitoring**: Datadog / New Relic
- **Errors**: Sentry
- **CI/CD**: GitHub Actions

## 🚀 Getting Started Commands

### Phase 1 - Database
```bash
cd enterprise-migration/01-database-schema
# Review PLAN.md
# Create migration file in duckcode-observability/supabase/migrations/
# Test locally: supabase db reset
```

### Phase 2 - Admin Portal
```bash
cd duckcode-observability/frontend
# Create admin routes
# Build components from PLAN.md
npm run dev
```

### Phase 3 - Metadata Service
```bash
cd duckcode-observability/backend
# Create services/metadata/ folder
# Replicate logic from duck-code/src/core/metadata/
npm run dev
```

### Phase 4 - Sync Engine
```bash
cd duck-code/src/services/sync
# Create MetadataSyncService.ts
# Test with: npm run test:sync
```

### Phase 5 - Connectors
```bash
cd duckcode-observability/backend/src/services/connectors
# Create connector classes
# Test connection before extraction
```

## 📋 Checklists

### Before Starting Any Phase
- [ ] Read PLAN.md thoroughly
- [ ] Understand dependencies on previous phases
- [ ] Set up development environment
- [ ] Create feature branch
- [ ] Write tests first (TDD)

### Before Deploying Any Phase
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Migration scripts tested
- [ ] Rollback plan ready
- [ ] Monitoring configured

### After Deploying Any Phase
- [ ] Monitor for errors
- [ ] Verify all features working
- [ ] Gather user feedback
- [ ] Fix bugs quickly
- [ ] Update documentation

## 🆘 Common Issues & Solutions

### Issue: SQLglot not working in Node.js
**Solution**: Create Python microservice or use child_process

### Issue: RLS blocking service_role queries
**Solution**: Use service_role key which bypasses RLS

### Issue: Sync too slow
**Solution**: Optimize queries, add indexes, use compression

### Issue: Users confused by new features
**Solution**: Better onboarding, tooltips, documentation

## 📞 Who to Ask

### Database Questions
→ Database Engineer or Backend Lead

### UI/UX Questions
→ Frontend Lead or Product Manager

### Security Questions
→ Security Engineer or DevOps Lead

### Architecture Questions
→ Tech Lead or CTO

## 🎯 Success Criteria

**You'll know you're done when**:
- ✅ All 8 phases deployed to production
- ✅ 90%+ users migrated to organizations
- ✅ Zero critical bugs
- ✅ Performance targets met
- ✅ Positive user feedback
- ✅ Enterprise customers signed up

---

**Pro Tip**: Work incrementally. Deploy small, test often, gather feedback early.

**Remember**: This is a marathon, not a sprint. Quality > Speed.
