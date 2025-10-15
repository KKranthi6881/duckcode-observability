# Enterprise Data Catalog Migration Plan

## 🎯 Project Vision
Transform DuckCode from individual-user IDE tool to **Enterprise Data Catalog SaaS** platform (like Atlan/Monte Carlo) with:
- Team-based organization management (2-50+ users per enterprise)
- Centralized metadata extraction in cloud
- Customer-provided LLM API keys (no DuckCode LLM hosting)
- Admin controls for connectors, users, and settings
- Bidirectional sync between cloud and IDE

## 📁 Implementation Phases

### Phase 1: Database Schema (Team & Organization Management)
**Folder**: `01-database-schema/`
- Create enterprise team hierarchy (Organization → Teams → Users)
- Role-based access control tables
- API key management per organization
- Migration scripts for Supabase

### Phase 2: Admin Portal UI
**Folder**: `02-admin-portal/`
- Team admin dashboard
- User management (invite, roles, permissions)
- Connector configuration interface
- Settings and API key management

### Phase 3: Central Metadata Extraction Service
**Folder**: `03-metadata-service/`
- Cloud-based metadata processor (replicate duck-code logic)
- GitHub connector integration
- SQLglot-based SQL parsing in cloud
- Store metadata in Supabase tables

### Phase 4: Metadata Sync Engine
**Folder**: `04-sync-engine/`
- Cloud → Local SQLite sync protocol
- Incremental updates and delta sync
- Conflict resolution strategy
- Background sync service

### Phase 5: Enhanced Connector Framework
**Folder**: `05-connectors/`
- GitHub (already exists - enhance for enterprise)
- Database connectors (Snowflake, BigQuery, Postgres, etc.)
- BI tools (Tableau, Looker, Power BI)
- Connector plugin architecture

### Phase 6: Security & RBAC
**Folder**: `06-security/`
- Row-level security policies
- Team-based data isolation
- Audit logging
- API key encryption and rotation

### Phase 7: Auto-Documentation & AI Verification
**Folder**: `07-documentation/`
- Automated documentation generation
- AI agent verification of metadata
- Quality scoring system
- Documentation templates

### Phase 8: Deployment & Migration
**Folder**: `08-deployment/`
- Migration from current architecture
- Deployment scripts
- Testing strategy
- Rollback procedures

## 🚀 Getting Started

1. Start with **Phase 1** - Database schema is the foundation
2. Each folder contains:
   - `PLAN.md` - Detailed implementation plan
   - `TASKS.md` - Actionable task list with checkboxes
   - `IMPLEMENTATION.md` - Technical specifications
   - Supporting code/SQL files as needed

## 📊 Current State

### ✅ What We Have
- IDE with local metadata extraction (SQLite)
- Provider settings for custom API keys
- GitHub integration in observability
- OAuth authentication
- Basic analytics tracking

### ⚠️ What We Need
- Team/organization management
- Central cloud metadata extraction
- Admin portal
- Enhanced RBAC
- Connector framework
- Metadata sync system

## 🎯 Success Criteria

**For Phase 1 Completion:**
- [ ] Database schema deployed to Supabase
- [ ] Teams and organizations can be created
- [ ] Users can be assigned to teams with roles
- [ ] API keys are managed per organization

**For Full Migration:**
- [ ] Enterprise customers can sign up and create organizations
- [ ] Admins can invite users and manage teams
- [ ] GitHub connector extracts metadata to cloud
- [ ] Metadata syncs to local IDE instances
- [ ] All enterprise security features active
- [ ] Production deployment successful

## 📞 Next Steps

**Start here**: Navigate to `01-database-schema/` and review the plan.

Each phase is independent but builds on previous phases. You can work on multiple phases in parallel once Phase 1 is stable.
