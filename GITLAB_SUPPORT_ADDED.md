# GitLab Support Added to Metadata Extraction

## Overview
Successfully added GitLab connectivity to the metadata extraction page alongside existing GitHub support.

## Changes Made

### 1. **Provider Selection**
Added a dropdown to choose between GitHub and GitLab when adding a new repository:
```typescript
provider: 'github' as 'github' | 'gitlab'
```

### 2. **Dynamic UI Updates**
The form now adapts based on the selected provider:

#### Repository URL Placeholder
- **GitHub**: `https://github.com/owner/repo`
- **GitLab**: `https://gitlab.com/owner/repo`

#### Access Token Label
- **GitHub**: "GitHub Access Token"
- **GitLab**: "GitLab Access Token"

#### Access Token Placeholder
- **GitHub**: `ghp_...`
- **GitLab**: `glpat-...`

#### Token Scope Instructions
- **GitHub**: "Token needs 'repo' scope to read repository contents"
- **GitLab**: "Token needs 'read_repository' scope to read repository contents"

### 3. **API Integration**
Updated the connection API call to include the provider:
```typescript
await axios.post(`${API_BASE}/api/admin/metadata/connections`, {
  repositoryUrl: newRepo.url,
  branch: newRepo.branch,
  accessToken: newRepo.accessToken,
  provider: newRepo.provider  // ← New field
});
```

### 4. **State Management**
Updated form state to include provider:
```typescript
const [newRepo, setNewRepo] = useState({
  url: '',
  branch: 'main',
  accessToken: '',
  provider: 'github' as 'github' | 'gitlab'
});
```

## User Experience

### Adding a GitHub Repository
1. Click "Add Repository"
2. Select "GitHub" from provider dropdown (default)
3. Enter GitHub repository URL
4. Enter branch name (default: main)
5. Enter GitHub Personal Access Token (ghp_...)
6. Click "Add"

### Adding a GitLab Repository
1. Click "Add Repository"
2. Select "GitLab" from provider dropdown
3. Enter GitLab repository URL
4. Enter branch name (default: main)
5. Enter GitLab Access Token (glpat-...)
6. Click "Add"

## Token Requirements

### GitHub Token
- **Scope needed**: `repo`
- **Format**: `ghp_...`
- **How to create**: GitHub Settings → Developer settings → Personal access tokens

### GitLab Token
- **Scope needed**: `read_repository`
- **Format**: `glpat-...`
- **How to create**: GitLab Settings → Access Tokens → Add new token

## Backend Requirements

The backend API endpoint `/api/admin/metadata/connections` must be updated to:
1. Accept the `provider` field
2. Handle GitLab authentication differently from GitHub
3. Support GitLab API for repository cloning and metadata extraction
4. Store provider information in the database

### Expected Backend Changes
```typescript
// Backend should handle both providers
interface ConnectionRequest {
  repositoryUrl: string;
  branch: string;
  accessToken: string;
  provider: 'github' | 'gitlab';  // ← New field
}

// Use appropriate API based on provider
if (provider === 'gitlab') {
  // Use GitLab API
  // https://gitlab.com/api/v4/...
} else {
  // Use GitHub API
  // https://api.github.com/...
}
```

## Database Schema Update

The `github_connections` table should be updated to support both providers:

```sql
-- Add provider column
ALTER TABLE metadata.github_connections 
ADD COLUMN provider VARCHAR(20) DEFAULT 'github';

-- Or rename table to be provider-agnostic
ALTER TABLE metadata.github_connections 
RENAME TO repository_connections;
```

## Files Modified

### Frontend
- `/frontend/src/pages/admin/MetadataExtraction.tsx`
  - Added provider selection dropdown
  - Made UI labels and placeholders dynamic
  - Updated API call to include provider
  - Updated state management

## Testing Checklist

- [ ] GitHub repository connection works
- [ ] GitLab repository connection works
- [ ] Provider dropdown switches UI correctly
- [ ] Placeholders update based on provider
- [ ] Token label updates based on provider
- [ ] Scope instructions update based on provider
- [ ] API receives provider field
- [ ] Backend handles GitLab authentication
- [ ] Metadata extraction works for GitLab repos
- [ ] Both providers can coexist in the same organization

## Next Steps

### Backend Implementation Required
1. Update API endpoint to accept `provider` field
2. Implement GitLab API client
3. Add GitLab authentication handling
4. Update database schema to store provider
5. Implement GitLab repository cloning
6. Add GitLab-specific metadata extraction logic

### Future Enhancements
1. Add Bitbucket support
2. Add Azure DevOps support
3. Show provider icon/badge on repository cards
4. Filter repositories by provider
5. Provider-specific extraction settings

## Status
✅ **Frontend Complete** - GitLab support added to UI
⏳ **Backend Pending** - Backend needs to be updated to handle GitLab

The frontend is ready to support both GitHub and GitLab repositories. The backend API needs to be updated to handle the new `provider` field and implement GitLab-specific logic.
