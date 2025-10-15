# Enterprise Features Setup

## Required Environment Variables

Add these to your `.env` file:

```bash
# API Key Encryption
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your-32-byte-hex-string-here

# Existing Variables (verify these are set)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
```

## Generate Encryption Key

Run this command to generate a secure encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and add it to your `.env` file as `ENCRYPTION_KEY`.

## Backend Endpoints Added

### API Keys Management
- `POST /api/enterprise/api-keys` - Create and encrypt API key
- `GET /api/enterprise/api-keys/:organizationId` - Get all keys
- `PATCH /api/enterprise/api-keys/:keyId/status` - Update status
- `DELETE /api/enterprise/api-keys/:keyId` - Delete key
- `POST /api/enterprise/api-keys/:keyId/decrypt` - Decrypt key (admin only)

### Invitations
- `POST /api/enterprise/invitations` - Send invitations
- `POST /api/enterprise/invitations/:token/accept` - Accept invitation
- `DELETE /api/enterprise/invitations/:invitationId` - Cancel invitation

### Organizations
- `PATCH /api/enterprise/organizations/:organizationId` - Update settings
- `DELETE /api/enterprise/organizations/:organizationId` - Delete organization

### Permissions
- `POST /api/enterprise/permissions/check` - Check user permission

## Security Features

### API Key Encryption
- **Algorithm**: AES-256-GCM
- **Key Derivation**: Scrypt with salt
- **Storage**: Only encrypted values stored in database
- **Display**: Keys masked as `sk-12345678••••••••••••••••••5678`

### Permission Checks
All endpoints enforce RBAC permissions:
- `api_keys:create` - Create API keys
- `api_keys:read` - View API keys
- `users:invite` - Send invitations
- `organization:update` - Modify organization
- `organization:delete` - Delete organization

### Admin-Only Operations
- Decrypt API keys
- Delete organizations
- Manage all organization settings

## Testing

### 1. Start Backend
```bash
cd backend
npm run dev
```

### 2. Test API Key Creation
```bash
curl -X POST http://localhost:3001/api/enterprise/api-keys \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org-id",
    "provider": "openai",
    "api_key": "sk-test123456789",
    "key_name": "Test Key",
    "is_default": true
  }'
```

### 3. Test Invitation
```bash
curl -X POST http://localhost:3001/api/enterprise/invitations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org-id",
    "emails": ["user@example.com"],
    "role_id": "role-id",
    "message": "Welcome!"
  }'
```

## Email Service (TODO)

Invitation emails are not yet implemented. When a user is invited:
1. Invitation record is created in database
2. Invitation token is generated
3. Console log shows invitation details
4. **TODO**: Integrate email service (SendGrid, AWS SES, etc.)

## Frontend Integration

Update your frontend service to call these endpoints:

```typescript
// Example: Create API Key
const response = await fetch('/api/enterprise/api-keys', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    organization_id,
    provider: 'openai',
    api_key: 'sk-...',
    key_name: 'Production Key',
    is_default: true,
  }),
});
```

## Troubleshooting

### "ENCRYPTION_KEY not configured"
- Add `ENCRYPTION_KEY` to your `.env` file
- Restart the backend server

### "Invalid encrypted data format"
- API key was not encrypted properly
- Check encryption key is consistent
- Delete and recreate the API key

### "Insufficient permissions"
- User doesn't have required permission
- Check user's role assignments
- Verify RLS policies are active

## Next Steps

1. ✅ Backend endpoints implemented
2. ⏳ Add email service for invitations
3. ⏳ Add toast notifications in frontend
4. ⏳ Test end-to-end workflows
5. ⏳ Production deployment
