# Simplified Role System - 3 Standard Roles

## 🎯 **Three Role Categories**

### **1. Viewer** 👁️
**Who:** Architects, Data Analysts, Business Users
**Access:**
- ✅ View metadata and code architecture
- ✅ View dashboards and analytics
- ✅ View data lineage
- ✅ Read documentation
- ✅ View team structure
- ❌ Cannot modify anything
- ❌ Cannot see API keys
- ❌ Cannot invite users
- ❌ Cannot access settings

**Use Case:** "I need to see and analyze the data, but not change anything"

---

### **2. Member** 🔧
**Who:** Data Engineers, Developers
**Access:**
- ✅ Everything Viewer can do
- ✅ Create and manage connectors
- ✅ Run metadata extraction
- ✅ Create and edit teams
- ✅ Upload code for analysis
- ✅ Manage their own work
- ❌ Cannot see/manage API keys (admin provides keys)
- ❌ Cannot invite users
- ❌ Cannot access organization settings
- ❌ Cannot delete teams/users

**Use Case:** "I need to work with data and run operations, but admin handles keys"

---

### **3. Admin** 👑
**Who:** Organization Administrators, IT Managers
**Access:**
- ✅ Everything Member can do
- ✅ Manage API keys (OpenAI, Anthropic, etc.)
- ✅ Invite and remove users
- ✅ Assign roles to users
- ✅ Organization settings
- ✅ Billing and subscription
- ✅ View audit logs
- ✅ Delete resources

**Use Case:** "I manage the entire organization and all its resources"

---

## 📊 **Capability Matrix**

| Feature | Viewer | Member | Admin |
|---------|--------|--------|-------|
| **Viewing** |
| View metadata | ✅ | ✅ | ✅ |
| View dashboards | ✅ | ✅ | ✅ |
| View teams | ✅ | ✅ | ✅ |
| View lineage | ✅ | ✅ | ✅ |
| **Operations** |
| Create connectors | ❌ | ✅ | ✅ |
| Run extraction | ❌ | ✅ | ✅ |
| Manage teams | ❌ | ✅ | ✅ |
| Upload code | ❌ | ✅ | ✅ |
| **Administration** |
| Manage API keys | ❌ | ❌ | ✅ |
| Invite users | ❌ | ❌ | ✅ |
| Assign roles | ❌ | ❌ | ✅ |
| Organization settings | ❌ | ❌ | ✅ |
| Billing | ❌ | ❌ | ✅ |
| Audit logs | ❌ | ❌ | ✅ |

---

## 🔧 **Implementation**

### **Database: 3 Default Roles**
```sql
-- These are created automatically for every organization
1. Viewer (is_default: true)
2. Member (is_default: true)
3. Admin (is_default: true)

-- NO custom roles
-- NO permission editing
-- Just assign users to one of these 3 roles
```

### **UI Simplification**
```
❌ REMOVE: Role creation page
❌ REMOVE: Permission editor
❌ REMOVE: Complex permission selection

✅ KEEP: Simple role dropdown (Viewer/Member/Admin)
✅ ADD: Clear role descriptions
✅ ADD: "What can this role do?" tooltip
```

### **Invitation Flow**
```
1. Admin clicks "Invite User"
2. Enters email
3. Selects role: [Viewer] [Member] [Admin]
   - Shows description under each option
4. Click Send
5. Done!
```

---

## 💡 **Benefits**

1. **Simple to Understand**
   - "Viewer = read-only"
   - "Member = can work"
   - "Admin = can manage"

2. **Standard Industry Practice**
   - Most SaaS products use this model
   - Familiar to users

3. **No Decision Fatigue**
   - No "which permissions do I need?"
   - Just pick the role type

4. **Secure by Default**
   - Clear separation of duties
   - Admin controls sensitive resources (API keys)

5. **Easy to Explain to Customers**
   - "We have 3 simple roles: view, work, manage"

---

## 🚀 **Migration Plan**

1. **Update default role creation**
   - Keep only 3 roles: Viewer, Member, Admin
   - Remove custom role creation

2. **Simplify UI**
   - Remove Roles page (or make it info-only)
   - Update invitation to show 3 options
   - Add role descriptions

3. **Update permissions**
   - Hardcode permissions for each role
   - No UI for permission editing

---

**This is MUCH simpler and more maintainable!** 🎉
