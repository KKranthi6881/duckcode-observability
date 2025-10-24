# 🚀 How to Use AI Documentation - SIMPLE GUIDE

## 📍 Step-by-Step Instructions

### **Step 1: Navigate to AI Documentation**

```
URL: http://localhost:5175/admin/ai-documentation
```

Or click in menu:
```
Admin → AI Documentation
```

---

### **Step 2: You'll See This Screen**

```
┌─────────────────────────────────────────────────────────┐
│ AI Documentation Generation                      [Help] │
├─────────────────────────────────────────────────────────┤
│ [Generate] [Jobs] [View Documentation]                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  LEFT SIDE                    RIGHT SIDE                │
│  ┌─────────────────┐         ┌──────────────────┐      │
│  │ Select Objects  │         │  Configuration   │      │
│  │                 │         │                  │      │
│  │ [Search...]     │         │ ☑ Skip existing  │      │
│  │                 │         │ ☐ Regenerate all │      │
│  │ ☐ customers     │         │ Max retries: 3   │      │
│  │ ☑ orders        │         │                  │      │
│  │ ☑ products      │         │ Est: $0.01       │      │
│  │ ☐ sales         │         │                  │      │
│  │                 │         │ [Generate Docs]  │ ← CLICK!
│  └─────────────────┘         └──────────────────┘      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### **Step 3: Select Objects**

**What you do:**
1. ☑️ Click checkboxes next to objects you want documented
2. Use search bar to filter (optional)
3. Use dropdowns to filter by type (optional)

**What you'll see:**
- List of all your metadata objects
- Green badge = already documented
- No badge = needs documentation

---

### **Step 4: Click "Generate Documentation"**

**Before clicking, check:**
- ✅ API Key Status: Shows green "OpenAI API Key Configured"
- ✅ Selected objects: At least 1 checked
- ✅ Cost estimate: Shows $0.00X (very cheap!)

**Click the big button:**
```
[⚡ Generate Documentation]
```

---

### **Step 5: Auto-Switch to Jobs Tab**

**You'll immediately see:**
```
┌─────────────────────────────────────────────────────────┐
│ Jobs                                      [Filter: All] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Job: Processing                         [⏸ Pause] [⏹]  │
│  ━━━━━━━━━━━━━━━━━░░░░░░░░ 45%                         │
│  2 / 5 objects                                          │
│  Current: orders                                        │
│                                                          │
│  Tokens: 1,234     Cost: $0.003                         │
│  Started: 5 seconds ago                                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**What happens:**
- Progress bar moves (updates every 5 seconds)
- Shows current object being processed
- Shows real-time cost
- You can pause/cancel if needed

---

### **Step 6: View Documentation**

**When job completes:**
1. Status changes to "Completed" (green)
2. Click "View Documentation" tab
3. OR select object from Generate tab

**What you'll see:**
```
┌─────────────────────────────────────────────────────────┐
│ orders                                   ⭐⭐⭐☆☆ 3/5    │
├─────────────────────────────────────────────────────────┤
│ [Summary] [Narrative] [Cards] [Code] [Rules] [Impact]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📄 Executive Summary                                   │
│  ─────────────────────────────────────────────────────  │
│  Tracks customer orders including items, quantities,    │
│  pricing, and fulfillment status. Critical for revenue  │
│  tracking and inventory management...                   │
│                                                          │
│                                            [Copy]        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**6 tabs to explore:**
- **Summary** - One paragraph overview
- **Narrative** - Full story (what/journey/impact)
- **Cards** - Step-by-step transformations
- **Code** - Explanations in plain English
- **Rules** - Business rules documented
- **Impact** - Who uses it and why

---

## ⚠️ Common Issues

### **"OpenAI API Key Required" error**

**Solution:**
```
1. Go to: /admin/api-keys
2. Click "Add API Key"
3. Provider: openai
4. Paste key: sk-...
5. Check "Default"
6. Save
```

### **No objects showing**

**Solution:**
```
1. Go to: /admin/metadata
2. Extract metadata first
3. Wait for completion
4. Then return to AI Documentation
```

### **Job stuck at 0%**

**Solution:**
```
1. Check backend logs
2. Verify API key is valid
3. Check internet connection
4. Cancel and retry
```

---

## 🎯 Quick Test (Right Now!)

Want to test it immediately?

### **1. Check if you have metadata:**
```bash
# In terminal:
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend
npx ts-node -e "
import { supabase } from './src/config/supabase';
const run = async () => {
  const { data } = await supabase
    .schema('metadata')
    .from('objects')
    .select('id, name, object_type')
    .limit(5);
  console.log('Objects:', data);
};
run();
"
```

### **2. Check if you have API key:**
```
Go to: http://localhost:5175/admin/api-keys
Look for: OpenAI key with "Default" badge
```

### **3. Generate docs for 1 object:**
```
1. Open: http://localhost:5175/admin/ai-documentation
2. Select 1 object
3. Click Generate
4. Wait ~15 seconds
5. View result!
```

---

## 💡 Pro Tips

### **Cost Saving:**
- ✅ Enable "Skip existing" - Don't regenerate
- ✅ Start with 1-2 objects to test
- ✅ Use filters to select strategically

### **Best Practices:**
- 📊 Document important tables first
- 🔄 Regenerate if metadata changes
- 👥 Share docs with your team
- 📋 Copy to Confluence/Notion

### **Performance:**
- ⚡ Process 10 objects at once = 3-4 minutes
- 💰 10 objects = ~$0.03 cost
- 🎯 Quality is consistent and high

---

## 🎉 That's It!

**3 Simple Steps:**
1. Select objects (checkboxes)
2. Click "Generate Documentation" button
3. Wait and view results

**No complex setup. No configuration needed. Just click and go!**

---

## 📞 Need Help?

**Common Questions:**

**Q: How long does it take?**
A: 10-30 seconds per object

**Q: How much does it cost?**
A: $0.002-$0.005 per object (very cheap!)

**Q: Can I cancel?**
A: Yes! Click pause or cancel button

**Q: What if it fails?**
A: It will retry automatically (up to 3 times)

**Q: Can I run multiple jobs?**
A: Yes! Each organization can have multiple jobs

---

**That's the entire system! Simple and powerful.** 🚀
