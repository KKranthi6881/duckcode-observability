# Cancel/Stop Feature Improved ✅

**Date:** October 20, 2025  
**Issue:** "No active extraction found" error when clicking Stop  
**Root Cause:** Extraction failed quickly and removed itself from memory before UI could cancel  
**Solution:** Check both in-memory AND database status, allow reset for failed states  

---

## 🐛 The Problem

When you clicked "Stop" on a failed extraction, you got:
```
No active extraction found for this connection
```

**Why this happened:**

```
1. Extraction starts → Added to activeExtractions map
2. Extraction fails (e.g., profile mismatch)
3. Error handler removes from activeExtractions
4. Connection status in DB → 'failed'
5. User clicks "Stop"
6. Cancel checks activeExtractions → Not found!
7. Returns error message
```

The extraction had already failed and cleaned itself up, but the UI still showed "extracting" until the next poll.

---

## 🔧 The Fix

### Backend - Improved Cancel Logic

**Before (❌ Only checked memory):**
```typescript
async cancelExtraction(connectionId: string) {
  const progress = this.activeExtractions.get(connectionId);
  
  if (!progress) {
    return false; // Error!
  }
  // ...
}
```

**After (✅ Checks memory AND database):**
```typescript
async cancelExtraction(connectionId: string) {
  // Check in-memory state
  const progress = this.activeExtractions.get(connectionId);
  
  // Also check database status
  const connection = await this.getConnection(connectionId);
  
  // Allow canceling for:
  // 1. Actively running (in memory)
  // 2. 'extracting', 'failed', or 'error' (in database)
  const cancelableStatuses = ['extracting', 'failed', 'error'];
  const canCancel = progress || cancelableStatuses.includes(connection.status);
  
  if (!canCancel) {
    console.log(`Cannot cancel - status: ${connection.status}`);
    return false;
  }
  
  // Reset to 'connected' status
  await this.updateConnectionStatus(connectionId, 'connected', undefined);
  // ...
}
```

### Frontend - Smart Button Display

**New UI Logic:**

```typescript
{connection.status === 'extracting' ? (
  <Button className="red">Stop</Button>      // ← Active extraction
) : connection.status === 'error' || connection.status === 'failed' ? (
  <Button className="orange">Reset</Button>  // ← Failed/Error - can reset
) : (
  <Button><Play /> Extract</Button>          // ← Ready to start
)}
```

---

## 🎨 New User Experience

### Scenario 1: Active Extraction
```
┌──────────────────────────────────┐
│ jaffle-shop     [🛑 Stop] [🗑️]  │
│ Status: Extracting... 45%        │
│ ████████████░░░░░░░░              │
└──────────────────────────────────┘

Click "Stop" → 
✅ Extraction cancelled
✅ Status → Connected
✅ Ready to retry
```

### Scenario 2: Failed Extraction
```
┌──────────────────────────────────┐
│ jaffle-shop   [🔄 Reset] [🗑️]   │
│ Status: Failed                   │
│ ❌ Profile not found             │
└──────────────────────────────────┘

Click "Reset" → 
✅ Error cleared
✅ Status → Connected
✅ Ready to retry
```

### Scenario 3: Error State
```
┌──────────────────────────────────┐
│ dbt-core      [🔄 Reset] [🗑️]   │
│ Status: Error                    │
│ ❌ No dbt_project.yml            │
└──────────────────────────────────┘

Click "Reset" →
✅ Error cleared
✅ Status → Connected  
✅ Can try different repo
```

---

## ✅ What This Fixes

### 1. Fast-Failing Extractions
```
Problem: Extraction fails in 2 seconds
Old: "No active extraction found" error
New: "Reset" button clears error state ✅
```

### 2. Stuck Error States
```
Problem: Connection stuck in 'failed' status
Old: No way to clear except disconnect
New: "Reset" button clears to 'connected' ✅
```

### 3. Between-State Issues
```
Problem: DB shows 'extracting' but memory doesn't
Old: Cancel fails with error message
New: Checks both, allows cancel ✅
```

---

## 🧪 Testing

### Test 1: Stop Active Extraction
```bash
1. Start extraction
2. Wait for progress to show
3. Click "Stop" button (red)
4. ✅ Should cancel successfully
5. ✅ Status → Connected
```

### Test 2: Reset Failed Extraction
```bash
1. Start extraction that will fail
2. Wait for error message
3. Click "Reset" button (orange)
4. ✅ Should clear error state
5. ✅ Status → Connected
6. ✅ Can click "Extract" again
```

### Test 3: Quick Failure
```bash
1. Connect wrong repo (no dbt_project.yml)
2. Click "Extract"
3. Fails immediately
4. Click "Reset" (appears orange)
5. ✅ Should work even though extraction already failed
```

---

## 📊 Button States

| Connection Status | Button Shown | Color  | Action |
|------------------|--------------|--------|---------|
| `connected`      | Extract      | Default| Start extraction |
| `completed`      | Extract      | Default| Re-extract |
| `extracting`     | Stop         | Red    | Cancel extraction |
| `failed`         | Reset        | Orange | Clear error, reset to connected |
| `error`          | Reset        | Orange | Clear error, reset to connected |

---

## 🔍 Backend Logs (Improved)

### When Canceling Active Extraction:
```
🛑 Cancelling/resetting extraction for connection: abc-123
   Current status: extracting
✅ Extraction cancelled/reset to 'connected' status
```

### When Resetting Failed State:
```
🛑 Cancelling/resetting extraction for connection: abc-123
   Current status: failed
✅ Extraction cancelled/reset to 'connected' status
```

### When Already Connected:
```
⚠️  Cannot cancel extraction for: abc-123
   Connection status: connected
   Tip: Status must be 'extracting', 'failed', or 'error' to cancel
```

---

## 📝 Summary

**Problem:** Cancel button failed with "No active extraction found"  
**Root Cause:** Extraction removed from memory before UI could cancel  
**Solution:**  
  - ✅ Check both memory AND database status  
  - ✅ Allow cancel/reset for 'extracting', 'failed', 'error'  
  - ✅ Smart button display (Stop/Reset/Extract)  

**Benefits:**
- ✅ No more "No active extraction found" errors
- ✅ Can reset failed/error states easily
- ✅ No need to disconnect/reconnect to clear errors
- ✅ Better UX with smart button labels

**Try it now:**
1. Go to `http://localhost:5175/admin/metadata`
2. Start an extraction
3. Click "Stop" or "Reset" depending on state
4. Should work perfectly! 🚀
