#!/bin/bash

# Script to add ENCRYPTION_KEY to .env file
# This key is used for encrypting GitHub access tokens

set -e

echo "🔐 Adding ENCRYPTION_KEY to .env file..."

# Generate a secure random key
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Check if ENCRYPTION_KEY already exists in .env
if grep -q "^ENCRYPTION_KEY=" .env 2>/dev/null; then
    echo "⚠️  ENCRYPTION_KEY already exists in .env"
    echo "   Current value will NOT be changed to avoid breaking existing encrypted data"
    echo "   If you need to rotate the key, manually update it in .env"
    exit 0
fi

# Add ENCRYPTION_KEY to .env file
echo "" >> .env
echo "# GitHub Token Encryption Key (AES-256-GCM)" >> .env
echo "# Generated: $(date)" >> .env
echo "# DO NOT COMMIT THIS KEY TO VERSION CONTROL" >> .env
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env

echo "✅ ENCRYPTION_KEY added to .env successfully!"
echo ""
echo "🔒 Your encryption key (first 20 chars): ${ENCRYPTION_KEY:0:20}..."
echo ""
echo "⚠️  IMPORTANT:"
echo "   1. Keep this key secure - never commit to git"
echo "   2. Backup this key - you'll need it to decrypt tokens"
echo "   3. Use different keys for dev/staging/production"
echo "   4. Restart your backend server: npm run dev"
echo ""
echo "📝 Key has been saved to .env file"
