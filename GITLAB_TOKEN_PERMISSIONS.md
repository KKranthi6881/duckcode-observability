# GitLab Token Permissions Issue - RESOLVED ✅

## Issue
When trying to browse GitLab repository files in the CodeBase section, you get this error:
```
insufficient_scope: The request requires higher privileges than provided by the access token.
Required scope: ai_workflows api read_api
```

## Root Cause
The GitLab Personal Access Token used to connect the repository doesn't have the required API scopes to read repository contents.

## Solution: Regenerate GitLab Token with Correct Scopes

### Step 1: Create New GitLab Personal Access Token

1. **Go to GitLab Settings**
   - Navigate to: https://gitlab.com/-/user_settings/personal_access_tokens
   - Or click: Profile → Preferences → Access Tokens

2. **Create New Token**
   - Token name: `DuckCode Repository Access`
   - Expiration date: Set as needed (or no expiration)
   
3. **Select Required Scopes** ✅
   - ✅ **`api`** - Full API access (recommended)
   - OR
   - ✅ **`read_api`** - Read-only API access (minimum required)
   
   **Additional recommended scopes:**
   - ✅ `read_repository` - Read repository contents
   - ✅ `read_user` - Read user information

4. **Generate Token**
   - Click "Create personal access token"
   - **IMPORTANT:** Copy the token immediately (it won't be shown again)
   - Token format: `glpat-xxxxxxxxxxxxxxxxxxxx`

### Step 2: Update Repository Connection

1. **Go to Admin Settings**
   - Navigate to: DuckCode Observability → Settings → Admin

2. **Delete Old Connection** (if exists)
   - Find: `gitlab-data/analytics`
   - Click: Delete/Remove

3. **Add New Connection**
   - Repository URL: `https://gitlab.com/gitlab-data/analytics.git`
   - Branch: `master`
   - Access Token: Paste your new token (glpat-...)
   - Provider: Select "GitLab"

4. **Test Connection**
   - Click "Connect Repository"
   - Wait for metadata extraction to complete

### Step 3: Verify Access

1. **Navigate to CodeBase**
   - Go to: DuckCode Observability → CodeBase

2. **Click on Repository**
   - Select: `gitlab-data/analytics`

3. **Verify File Tree Loads**
   - You should see the repository file structure
   - Click on any file to view its content

## Token Scope Comparison

| Scope | Access Level | CodeBase Browsing | Metadata Extraction |
|-------|-------------|-------------------|---------------------|
| `api` | Full API access | ✅ Works | ✅ Works |
| `read_api` | Read-only API | ✅ Works | ✅ Works |
| `read_repository` | Repository read | ⚠️ Limited | ✅ Works |
| `ai_workflows` | AI features only | ❌ Fails | ❌ Fails |

## What Each Scope Provides

### `api` (Recommended)
- Complete read/write access to GitLab API
- Can read repository contents, branches, commits
- Can read project metadata
- Can read user information
- **Best for:** Full integration with DuckCode

### `read_api` (Minimum Required)
- Read-only access to GitLab API
- Can read repository contents
- Can read project metadata
- Cannot modify anything
- **Best for:** Security-conscious environments

### `read_repository`
- Read repository contents only
- May work for metadata extraction
- **Not sufficient** for full CodeBase browsing
- Missing project-level API access

## Troubleshooting

### Error: "insufficient_scope"
**Solution:** Regenerate token with `api` or `read_api` scope

### Error: "401 Unauthorized"
**Solution:** Token may be expired or invalid. Generate new token.

### Error: "404 Not Found"
**Solution:** 
- Check repository URL is correct
- Ensure token has access to the repository
- Verify repository is not private (or token has private repo access)

### File Tree Loads But Files Don't Open
**Solution:** Ensure token has `read_repository` scope in addition to `api`/`read_api`

## Security Best Practices

1. **Use Minimum Required Scopes**
   - For read-only access: Use `read_api` + `read_repository`
   - For full features: Use `api`

2. **Set Token Expiration**
   - Recommended: 90 days or less
   - Rotate tokens regularly

3. **Store Tokens Securely**
   - DuckCode encrypts tokens using AES-256-GCM
   - Tokens are never exposed in logs or UI

4. **Audit Token Usage**
   - Review GitLab audit logs regularly
   - Revoke unused tokens

## Next Steps

After updating the token:
1. ✅ File tree browsing will work
2. ✅ File content viewing will work
3. ✅ Metadata extraction will continue working
4. ✅ All CodeBase features will be functional

## Reference

- GitLab Personal Access Tokens: https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html
- GitLab API Scopes: https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html#personal-access-token-scopes
- DuckCode Documentation: See `GITLAB_SUPPORT_STATUS.md`
