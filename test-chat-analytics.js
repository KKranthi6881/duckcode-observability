const axios = require('axios');

// Test chat analytics flow with realistic data
async function testChatAnalytics() {
    const baseUrl = 'http://localhost:3001';
    
    // Mock IDE session token (you'll need to replace this with a real token)
    const mockToken = 'your-ide-session-token-here';
    
    const headers = {
        'Authorization': `Bearer ${mockToken}`,
        'Content-Type': 'application/json'
    };

    try {
        console.log('Testing chat analytics flow...');

        // 1. Start a chat session
        console.log('\n1. Starting chat session...');
        const sessionResponse = await axios.post(`${baseUrl}/api/chat-analytics/session/start`, {
            sessionId: 'test-session-' + Date.now(),
            metadata: {
                ide_version: '1.0.0',
                platform: 'vscode',
                test: true
            }
        }, { headers });
        
        console.log('Session started:', sessionResponse.data);
        const sessionId = sessionResponse.data.session.id;

        // 2. Track a user message with current timestamp
        console.log('\n2. Tracking user message...');
        const userMessageResponse = await axios.post(`${baseUrl}/api/chat-analytics/message`, {
            sessionId: sessionId,
            messageType: 'user',
            content: 'Hello, this is a test message',
            inputTokens: 10,
            outputTokens: 0,
            modelName: 'test-model',
            responseTimeMs: Date.now(), // This was causing the overflow
            cost: 0.001,
            toolCalls: [],
            metadata: {
                test: true,
                timestamp: Date.now()
            }
        }, { headers });
        
        console.log('User message tracked:', userMessageResponse.data);

        // 3. Track an assistant message
        console.log('\n3. Tracking assistant message...');
        const assistantMessageResponse = await axios.post(`${baseUrl}/api/chat-analytics/message`, {
            sessionId: sessionId,
            messageType: 'assistant',
            content: 'Hello! This is a test response from the assistant.',
            inputTokens: 10,
            outputTokens: 25,
            modelName: 'gpt-4',
            responseTimeMs: Date.now() + 1500, // Large timestamp value
            cost: 0.002,
            toolCalls: [
                {
                    name: 'test_tool',
                    parameters: { test: true }
                }
            ],
            metadata: {
                test: true,
                response_generated_at: Date.now()
            }
        }, { headers });
        
        console.log('Assistant message tracked:', assistantMessageResponse.data);

        // 4. End the session
        console.log('\n4. Ending chat session...');
        const endSessionResponse = await axios.post(`${baseUrl}/api/chat-analytics/session/end`, {
            sessionId: sessionId,
            metadata: {
                test_completed: true,
                end_timestamp: Date.now()
            }
        }, { headers });
        
        console.log('Session ended:', endSessionResponse.data);

        console.log('\n✅ Chat analytics flow test completed successfully!');
        console.log('The integer overflow issue has been resolved.');

    } catch (error) {
        console.error('\n❌ Test failed:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            console.log('\nNote: You need to provide a valid IDE session token to run this test.');
            console.log('The authentication is working correctly - this is expected without a real token.');
        } else if (error.response?.status === 500) {
            console.log('\nServer error occurred. Check backend logs for details.');
        }
    }
}

// Run the test
testChatAnalytics();
