# Authentication Flow - IDE to SaaS Integration

## Current Problem

When a user is logged into the IDE and opens the SaaS dashboard:
1. Dashboard redirects to `/login`
2. Login page tries to redirect back to IDE
3. Creates an infinite redirect loop
4. User can't access the dashboard

## Root Cause

The SaaS web UI and IDE use **separate authentication systems**:
- **IDE**: Uses custom OAuth flow with backend JWT tokens
- **SaaS Dashboard**: Uses Supabase authentication

They don't share sessions, so being logged into the IDE doesn't authenticate you for the dashboard.

## Solution Options

### Option 1: Shared Session Token (Recommended)

When IDE opens the dashboard, pass the session token as a URL parameter:

```typescript
// In IDE: Open dashboard with token
const dashboardUrl = `http://localhost:5175/dashboard/ide-analytics?ide_token=${encodeURIComponent(sessionToken)}`;
vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));

// In Dashboard: Auto-login with IDE token
if (ideToken) {
  // Exchange IDE token for Supabase session
  const { data } = await fetch('/api/auth/ide/exchange-token', {
    method: 'POST',
    body: JSON.stringify({ ide_token: ideToken })
  });
  
  // Set Supabase session
  await supabase.auth.setSession(data.session);
}
```

### Option 2: Remove Authentication from Analytics Dashboard

Since analytics are user-specific and the backend validates tokens, we could:
1. Remove `ProtectedRoute` wrapper from analytics routes
2. Let the backend handle all authentication
3. Show login prompt only if API returns 401

### Option 3: Separate IDE Analytics View

Create a dedicated analytics view that doesn't require web authentication:
- IDE fetches analytics data directly from backend
- Displays in a VS Code webview panel
- No need to open browser at all

## Recommended Implementation

**Use Option 1** - Shared session token flow:

### Step 1: Update IDE to pass token

```typescript
// duck-code/src/services/cloud/DuckCodeCloudService.ts
public async openAnalyticsDashboard() {
  const session = this.getSession();
  if (!session) {
    vscode.window.showErrorMessage('Please sign in first');
    return;
  }
  
  const dashboardUrl = `http://localhost:5175/dashboard/ide-analytics?ide_token=${encodeURIComponent(session.token)}`;
  await vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
}
```

### Step 2: Add token exchange endpoint

```typescript
// backend/src/api/routes/auth.routes.ts
router.post('/ide/exchange-token', async (req, res) => {
  const { ide_token } = req.body;
  
  // Validate IDE token
  const decoded = jwt.verify(ide_token, process.env.JWT_SECRET);
  
  // Get user from database
  const { data: user } = await supabaseDuckCode
    .from('duckcode.user_profiles')
    .select('*')
    .eq('id', decoded.user.id)
    .single();
  
  // Create Supabase session
  const { data: session } = await supabaseDuckCode.auth.admin.createSession({
    user_id: user.id
  });
  
  res.json({ session });
});
```

### Step 3: Auto-login in dashboard

```typescript
// frontend/src/pages/AnalyticsDashboard.tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const ideToken = params.get('ide_token');
  
  if (ideToken) {
    // Exchange token and set session
    fetch('/api/auth/ide/exchange-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ide_token: ideToken })
    })
    .then(res => res.json())
    .then(data => {
      supabase.auth.setSession(data.session);
      // Remove token from URL
      window.history.replaceState({}, '', '/dashboard/ide-analytics');
    });
  }
}, []);
```

## Quick Fix (Temporary)

For immediate testing, disable authentication on analytics routes:

```typescript
// frontend/src/App.tsx
// Change from:
<Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>

// To:
<Route path="/dashboard" element={<DashboardLayout />}>
```

This allows you to test the analytics functionality while we implement proper SSO.

## Testing

1. Sign into IDE
2. Click "View Analytics" (or open http://localhost:5175/dashboard/ide-analytics)
3. Should automatically authenticate and show dashboard
4. No separate login required

## Files to Modify

1. `duck-code/src/services/cloud/DuckCodeCloudService.ts` - Add openAnalyticsDashboard()
2. `backend/src/api/routes/auth.routes.ts` - Add /ide/exchange-token endpoint
3. `frontend/src/pages/AnalyticsDashboard.tsx` - Add auto-login logic
4. `frontend/src/App.tsx` - Temporarily remove ProtectedRoute for testing

---

**Next Steps**: Which option would you prefer? Option 1 (SSO) is most user-friendly but requires more changes. Option 2 (remove auth) is quickest for testing.
