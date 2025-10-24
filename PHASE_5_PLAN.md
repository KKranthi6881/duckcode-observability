# 🚀 Phase 5: Admin UI - Implementation Plan

## Overview

Phase 5 builds the admin UI for triggering and monitoring AI documentation generation jobs. This integrates with the Phase 4 API endpoints.

---

## 📋 Components to Build

### **1. Main Page: AIDocumentation.tsx**
**Location:** `frontend/src/pages/admin/AIDocumentation.tsx`

**Features:**
- Tab-based interface (Generate | Jobs | Viewing Documentation)
- Object browser with metadata search integration
- Job configuration panel
- Real-time job status monitor
- Cost estimation display

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ AI Documentation Generation              [Help] │
├─────────────────────────────────────────────────┤
│ [Generate] [Jobs] [View Docs]                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Generate Tab:                                   │
│  ┌────────────────┐  ┌───────────────────────┐ │
│  │ Object Selector│  │ Configuration         │ │
│  │                │  │ - Skip existing       │ │
│  │ [Search...]    │  │ - Max retries         │ │
│  │                │  │                       │ │
│  │ □ table_a     │  │ Est. Cost: $0.15     │ │
│  │ □ table_b     │  │ Objects: 3           │ │
│  │ ☑ model_c     │  │                       │ │
│  │                │  │ [Generate Docs] ───── │ │
│  └────────────────┘  └───────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### **2. ObjectSelector Component**
**Location:** `frontend/src/pages/admin/components/ObjectSelector.tsx`

**Features:**
- List all metadata objects
- Multi-select checkboxes
- Search/filter by name, schema, type
- Show documentation status (documented vs not)
- Pagination
- Integration with Tantivy search

**Props:**
```typescript
interface ObjectSelectorProps {
  onSelectionChange: (selectedIds: string[]) => void;
  selectedIds: string[];
  organizationId: string;
}
```

---

### **3. JobConfiguration Component**
**Location:** `frontend/src/pages/admin/components/JobConfiguration.tsx`

**Features:**
- Options form (skip existing, regenerate all, max retries)
- Cost estimation calculator
- API key status check
- Generate button with confirmation
- Progress indicator during job creation

**Props:**
```typescript
interface JobConfigurationProps {
  selectedObjectIds: string[];
  onJobCreated: (jobId: string) => void;
  organizationId: string;
}
```

**Cost Calculation:**
```typescript
// gpt-4o-mini: ~$0.002-$0.005 per object
const estimatedCost = selectedObjectIds.length * 0.005;
```

---

### **4. JobStatusMonitor Component**
**Location:** `frontend/src/pages/admin/components/JobStatusMonitor.tsx`

**Features:**
- Real-time job progress display
- List of active/completed jobs
- Progress bar per job
- Current object being processed
- Job control buttons (pause, resume, cancel)
- Auto-refresh with polling
- WebSocket support (future enhancement)

**Props:**
```typescript
interface JobStatusMonitorProps {
  organizationId: string;
  highlightJobId?: string; // Focus on a specific job
}
```

---

### **5. DocumentationViewer Component**
**Location:** `frontend/src/pages/admin/components/DocumentationViewer.tsx`

**Features:**
- Display generated documentation
- Multi-layer tabs (Summary | Narrative | Cards | Code | Rules | Impact)
- Markdown rendering
- Copy to clipboard
- Download as PDF/Markdown
- Share functionality

---

## 🔌 API Integration

### **Service: aiDocumentationService.ts**
**Location:** `frontend/src/services/aiDocumentationService.ts`

```typescript
export class AIDocumentationService {
  // Job Management
  async createJob(orgId: string, objectIds: string[], options: JobOptions): Promise<JobResponse>
  async getJobStatus(jobId: string): Promise<Job>
  async listJobs(orgId: string, params: ListParams): Promise<JobList>
  async cancelJob(jobId: string): Promise<void>
  async pauseJob(jobId: string): Promise<void>
  async resumeJob(jobId: string): Promise<void>
  
  // Documentation Access
  async getObjectDocumentation(objectId: string): Promise<Documentation>
}
```

---

## 🎨 UI/UX Design

### **Design System**
- Follow existing admin panel styling
- Use Tailwind CSS classes
- Lucide React icons
- Responsive grid layout
- Loading states
- Error handling

### **Colors** (from existing system)
```css
Primary: #2AB7A9 (teal)
Secondary: #F5B72F (yellow)
Accent: #8B5CF6 (purple)
Success: #10B981 (green)
Warning: #F59E0B (amber)
Error: #EF4444 (red)
```

### **Key Icons**
```typescript
import {
  FileText,      // Documentation
  Play,          // Generate
  Pause,         // Pause job
  Square,        // Stop job
  RefreshCw,     // Resume
  CheckCircle,   // Completed
  Clock,         // Processing
  AlertCircle,   // Failed
  DollarSign,    // Cost
  Zap,           // AI/GPT
} from 'lucide-react';
```

---

## 📝 Implementation Steps

### **Step 1: Create Service Layer**
```bash
frontend/src/services/aiDocumentationService.ts
```

**Implement:**
- API client with auth headers
- Error handling
- Type definitions

---

### **Step 2: Create Main Page**
```bash
frontend/src/pages/admin/AIDocumentation.tsx
```

**Features:**
- Tab navigation
- State management
- Layout structure

---

### **Step 3: Object Selector**
```bash
frontend/src/pages/admin/components/ObjectSelector.tsx
```

**Integrate:**
- Fetch objects from metadata API
- Multi-select functionality
- Search/filter UI

---

### **Step 4: Job Configuration**
```bash
frontend/src/pages/admin/components/JobConfiguration.tsx
```

**Features:**
- Form with validation
- Cost calculator
- API key check
- Job creation

---

### **Step 5: Job Status Monitor**
```bash
frontend/src/pages/admin/components/JobStatusMonitor.tsx
```

**Features:**
- Real-time polling (every 5s)
- Job list with status
- Progress bars
- Control buttons

---

### **Step 6: Documentation Viewer**
```bash
frontend/src/pages/admin/components/DocumentationViewer.tsx
```

**Features:**
- Tabbed interface for layers
- Markdown rendering
- Code syntax highlighting

---

### **Step 7: Integration**

**Update exports:**
```typescript
// frontend/src/pages/admin/index.ts
export { AIDocumentation } from './AIDocumentation';
```

**Add route:**
```typescript
// frontend/src/App.tsx
import { AIDocumentation } from './pages/admin';

<Route path="/admin" element={<AdminLayout />}>
  {/* ... existing routes ... */}
  <Route path="ai-documentation" element={<AIDocumentation />} />
</Route>
```

**Update navigation:**
```typescript
// frontend/src/pages/admin/AdminLayout.tsx
// Add menu item
{
  name: 'AI Documentation',
  href: '/admin/ai-documentation',
  icon: Zap,
}
```

---

## 🧪 Testing Checklist

- [ ] Create job with 1-3 objects
- [ ] Monitor real-time progress
- [ ] Pause and resume job
- [ ] Cancel job
- [ ] View generated documentation
- [ ] Cost estimation accuracy
- [ ] Error handling (no API key, rate limit)
- [ ] Pagination works
- [ ] Search functionality
- [ ] Mobile responsive

---

## 💰 Cost Estimation Logic

```typescript
function calculateEstimatedCost(objectCount: number): { min: number; max: number } {
  const minCostPerObject = 0.002; // Simple objects
  const maxCostPerObject = 0.005; // Complex objects
  
  return {
    min: objectCount * minCostPerObject,
    max: objectCount * maxCostPerObject,
  };
}

// Display: "$0.15 - $0.30 (for 50 objects)"
```

---

## 🔄 Polling Strategy

```typescript
useEffect(() => {
  if (!activeJobIds.length) return;
  
  const pollInterval = setInterval(async () => {
    for (const jobId of activeJobIds) {
      const status = await aiDocService.getJobStatus(jobId);
      updateJobStatus(jobId, status);
      
      // Stop polling if job is complete
      if (['completed', 'failed', 'cancelled'].includes(status.status)) {
        removeActiveJob(jobId);
      }
    }
  }, 5000); // Poll every 5 seconds
  
  return () => clearInterval(pollInterval);
}, [activeJobIds]);
```

---

## 📊 State Management

```typescript
interface AIDocumentationState {
  // Object Selection
  selectedObjectIds: string[];
  objects: MetadataObject[];
  isLoadingObjects: boolean;
  
  // Job Management
  activeJobs: Job[];
  completedJobs: Job[];
  currentJobId?: string;
  
  // Configuration
  jobOptions: JobOptions;
  estimatedCost: { min: number; max: number };
  
  // API Key
  hasAPIKey: boolean;
  apiKeyProvider: string;
}
```

---

## 🚦 Error Handling

```typescript
try {
  const job = await createJob(...);
  toast.success('Documentation generation started!');
  navigate(`/admin/ai-documentation?jobId=${job.jobId}`);
} catch (error) {
  if (error.status === 403) {
    toast.error('Only admins can generate documentation');
  } else if (error.message.includes('API key')) {
    toast.error('OpenAI API key not configured', {
      action: {
        label: 'Configure',
        onClick: () => navigate('/admin/api-keys'),
      },
    });
  } else {
    toast.error('Failed to create job: ' + error.message);
  }
}
```

---

## ⏱️ Estimated Implementation Time

| Component | Time | Complexity |
|-----------|------|------------|
| Service Layer | 1 hour | Medium |
| Main Page | 1 hour | Medium |
| Object Selector | 2 hours | High |
| Job Configuration | 1 hour | Low |
| Job Status Monitor | 2 hours | High |
| Documentation Viewer | 1.5 hours | Medium |
| Integration & Testing | 1.5 hours | Medium |
| **Total** | **10 hours** | **Medium-High** |

---

## 🎯 MVP vs Full Features

### **MVP (Phase 5.1) - 4 hours**
- ✅ Basic object list (no search)
- ✅ Simple job creation
- ✅ Job status display
- ✅ View documentation

### **Full (Phase 5.2) - 6 hours**
- ✅ Advanced search with Tantivy
- ✅ Real-time polling
- ✅ Pause/resume/cancel
- ✅ Cost estimation
- ✅ Export functionality
- ✅ Mobile responsive

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "lucide-react": "^0.263.1",      // Icons
    "react-markdown": "^8.0.7",       // Markdown rendering
    "react-syntax-highlighter": "^15.5.0", // Code highlighting
    "date-fns": "^2.30.0",           // Date formatting
    "zustand": "^4.4.1"              // State management (optional)
  }
}
```

---

## 🔮 Future Enhancements (Phase 6+)

1. **WebSocket Support** - Real-time updates without polling
2. **Batch Operations** - Generate docs for entire schema
3. **Scheduling** - Schedule regeneration on metadata changes
4. **Templates** - Custom documentation templates
5. **Quality Scoring** - Rate documentation quality
6. **Version History** - Track documentation changes
7. **Comments** - Add notes to documentation
8. **Export Options** - PDF, Confluence, Notion integration

---

## ✅ Phase 5 Complete Criteria

- [ ] Can select objects from metadata
- [ ] Can create documentation job
- [ ] Can monitor job progress in real-time
- [ ] Can view generated documentation
- [ ] Displays cost estimates
- [ ] Shows API key status
- [ ] Handles errors gracefully
- [ ] Mobile responsive
- [ ] Integrated with admin navigation
- [ ] Test with real data

---

## 🚀 Quick Start

Once implemented:

1. Navigate to `/admin/ai-documentation`
2. Select objects from list
3. Configure options
4. Click "Generate Documentation"
5. Monitor progress
6. View results

---

**Ready to implement? Start with Step 1: Service Layer!**
