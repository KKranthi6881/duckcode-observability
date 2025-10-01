#!/bin/bash

# Insert test data into duckcode.conversation_analytics
# This script uses the service_role key to bypass RLS

echo "📊 Inserting test conversation data..."

curl -X POST "http://127.0.0.1:54321/rest/v1/conversation_analytics" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -H "Accept-Profile: duckcode" \
  -H "Content-Profile: duckcode" \
  -d '{
    "user_id": "test-user-123",
    "conversation_id": "test-conv-002",
    "topic_title": "Build Analytics Dashboard",
    "model_name": "claude-3-5-sonnet-20241022",
    "provider_name": "anthropic",
    "total_tokens_in": 15000,
    "total_tokens_out": 3500,
    "total_cache_reads": 7200,
    "actual_api_cost": 0.035,
    "charged_cost": 0.07,
    "profit_amount": 0.035,
    "profit_margin": 100.00,
    "message_count": 8,
    "status": "completed"
  }'

echo ""
echo "✅ Test data inserted!"
echo ""
echo "Verify with:"
echo "  Open Supabase Studio: http://127.0.0.1:54323"
echo "  Navigate to: duckcode schema → conversation_analytics table"
echo ""
echo "Or check backend API:"
echo "  curl http://localhost:3001/api/analytics/conversations -H 'Authorization: Bearer YOUR_TOKEN'"
