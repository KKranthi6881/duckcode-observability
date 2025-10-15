# Phase 2: Admin Portal UI

## 🎯 Objective
Build comprehensive admin portal for enterprise team management, connector configuration, and organization settings.

## 🏗️ Architecture

### Frontend Components (React + TypeScript)

```
/admin-portal
  /dashboard        - Overview stats, recent activity
  /organization     - Org settings, billing, plan info
  /teams            - Team hierarchy management
  /users            - User management, invitations
  /connectors       - Connector configuration
  /api-keys         - LLM API key management
  /settings         - General settings, integrations
  /audit-logs       - Security and activity logs
```

## 📊 Key Features

### 1. Organization Dashboard
**Route**: `/admin/dashboard`

- Organization overview (users, teams, connectors)
- Recent metadata extraction jobs
- Usage metrics (API calls, storage)
- Quick actions (invite users, add connector)

### 2. Team Management
**Route**: `/admin/teams`

**Features**:
- Visual team hierarchy tree
- Create/edit/delete teams
- Drag-and-drop team reorganization
- Team details (members, roles, metadata access)
- Nested team support (Organization → Division → Department → Group)

**Components**:
- `TeamHierarchyTree.tsx` - Interactive tree view
- `TeamEditor.tsx` - Create/edit team modal
- `TeamMemberList.tsx` - List members with roles
- `TeamPermissions.tsx` - Manage team-level permissions

### 3. User Management
**Route**: `/admin/users`

**Features**:
- User list with search/filter
- Invite users via email
- Assign users to teams
- Assign organization-level roles
- Deactivate/reactivate users
- View user activity

**Components**:
- `UserList.tsx` - Searchable user table
- `InviteUserModal.tsx` - Send invitations
- `UserEditor.tsx` - Edit user details and roles
- `UserActivityLog.tsx` - Audit trail per user

### 4. Connector Management
**Route**: `/admin/connectors`

**Features**:
- List all connectors (GitHub, databases, BI tools)
- Add new connector
- Configure connector settings
- Test connection
- View connector status and last sync
- Schedule metadata extraction

**Connectors to Support**:
- ✅ GitHub (already exists)
- Snowflake
- BigQuery
- PostgreSQL
- MySQL
- Redshift
- Databricks
- Tableau
- Looker
- Power BI

**Components**:
- `ConnectorList.tsx` - Grid/list of connectors
- `ConnectorWizard.tsx` - Step-by-step setup
- `ConnectorConfig.tsx` - Configuration form per type
- `ConnectorStatus.tsx` - Health checks and sync status

### 5. API Key Management
**Route**: `/admin/api-keys`

**Features**:
- Add/remove LLM provider API keys (OpenAI, Anthropic, Azure, Gemini)
- Mark default API key
- Test API key validity
- View API key usage stats
- Rotate/revoke keys
- Encrypted storage

**Components**:
- `ApiKeyList.tsx` - List with masked keys
- `AddApiKeyModal.tsx` - Add new key with provider selection
- `ApiKeyTester.tsx` - Test key before saving
- `ApiKeyUsageStats.tsx` - Usage charts per key

### 6. Settings
**Route**: `/admin/settings`

**Sections**:
- **General**: Organization name, logo, domain
- **Security**: SSO configuration, MFA enforcement
- **Integrations**: Slack, email notifications
- **Data Retention**: Metadata retention policies
- **Billing**: Plan details, usage limits

**Components**:
- `OrganizationSettings.tsx` - General settings form
- `SecuritySettings.tsx` - Security policies
- `IntegrationSettings.tsx` - Third-party integrations
- `BillingSettings.tsx` - Plan and billing info

### 7. Audit Logs
**Route**: `/admin/audit-logs`

**Features**:
- View all organization activity
- Filter by user, action, date range
- Export audit logs
- Real-time activity stream

**Events to Log**:
- User login/logout
- Team created/modified/deleted
- User invited/added/removed
- Connector added/modified/deleted
- API key added/rotated/revoked
- Metadata extraction started/completed
- Permission changes

**Components**:
- `AuditLogTable.tsx` - Filterable event table
- `AuditLogFilters.tsx` - Advanced filtering
- `AuditLogExport.tsx` - Export to CSV/JSON

## 🔐 Access Control

### Admin Roles
1. **Organization Admin** - Full access to all features
2. **Team Admin** - Manage assigned teams only
3. **Connector Admin** - Manage connectors and API keys
4. **Member** - Read-only access

### Route Protection
- Wrap admin routes with `RequireOrgAdmin` guard
- Check permissions before showing actions
- API calls validate user permissions server-side

## 🎨 UI/UX Design

### Design System
- Use existing VS Code theme integration
- Consistent with duckcode-observability frontend
- Tailwind CSS for styling
- shadcn/ui for components
- Lucide icons

### Navigation
```
Sidebar:
  - Dashboard
  - Teams
  - Users
  - Connectors
  - API Keys
  - Settings
  - Audit Logs

Header:
  - Organization switcher (if user in multiple orgs)
  - User profile menu
  - Notifications
  - Help/Documentation
```

## 🔄 Integration Points

### Backend APIs Required
- `/api/admin/organizations/*` - Org management
- `/api/admin/teams/*` - Team CRUD
- `/api/admin/users/*` - User management
- `/api/admin/invitations/*` - Invitation flow
- `/api/admin/connectors/*` - Connector management
- `/api/admin/api-keys/*` - API key management
- `/api/admin/audit-logs/*` - Activity logs

### Real-time Updates
- Use Supabase Realtime for live updates
- Subscribe to team changes
- Subscribe to user activity
- Subscribe to connector status changes

## ✅ Acceptance Criteria

- [ ] All admin routes accessible and functional
- [ ] Team hierarchy visual and editable
- [ ] User invitation flow works end-to-end
- [ ] Connectors can be added and configured
- [ ] API keys securely stored and manageable
- [ ] Audit logs capture all admin actions
- [ ] Mobile-responsive design
- [ ] Role-based access enforced

## 📝 Technical Stack

- **Framework**: React 18+ with TypeScript
- **Routing**: React Router v6
- **State**: Zustand or React Query
- **Forms**: React Hook Form + Zod validation
- **Tables**: TanStack Table
- **UI**: Tailwind CSS + shadcn/ui
- **Icons**: Lucide React
- **Charts**: Recharts or Chart.js
