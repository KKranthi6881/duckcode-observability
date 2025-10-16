# URI Redirect Fix - Extension Install Prompt

## Problem
After signup, VS Code showed "Would you like to install 'DuckCode Assistant' extension from 'DuckCode'?" prompt instead of just opening the extension.

## Root Cause
**URI Mismatch**: The redirect URI was `vscode://DuckCode.duck-code/auth/callback` but the extension's actual identifier is `DuckCode.duck-code-pro`.

VS Code didn't recognize the URI as belonging to an already-installed extension, so it prompted to install.

## Fix Applied

### File: `duck-code/webview-ui/src/services/authService.ts`

**Changed** (2 locations):
```typescript
// Before
const redirectUri = `vscode://DuckCode.duck-code/auth/callback`

// After  
const redirectUri = `vscode://DuckCode.duck-code-pro/auth/callback`
```

**Lines changed**:
- Line 108: `signIn()` method
- Line 154: `signUp()` method

## How It Works Now

1. User signs up in browser
2. Browser redirects to: `vscode://DuckCode.duck-code-pro/auth/callback?code=xxx`
3. VS Code recognizes `DuckCode.duck-code-pro` as installed extension
4. Opens extension directly (no install prompt)
5. Extension processes authentication
6. Profile updates with user data

## Testing

```bash
# Rebuild extension
cd /Users/Kranthi_1/duck-main/duck-code
npm run compile

# Test signup flow
# 1. Press F5 to launch Extension Development Host
# 2. Click "Sign Up" in IDE
# 3. Fill form in browser
# 4. Submit
# 5. Browser should redirect WITHOUT install prompt
# 6. IDE should authenticate immediately
```

## Expected Behavior

**Before Fix**:
- ❌ "Would you like to install extension?" prompt
- ❌ Confusing user experience
- ❌ Extra click required

**After Fix**:
- ✅ Direct redirect to IDE
- ✅ Smooth authentication
- ✅ No install prompt

---

**Status**: Fixed
**Date**: 2025-09-30
**Files Modified**: `webview-ui/src/services/authService.ts`
