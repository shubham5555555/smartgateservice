const axios = require('axios');

async function testPendingAPI() {
  try {
    // First login to get token
    const loginRes = await axios.post('http://localhost:5050/admin/auth/login', {
      email: 'admin@smartgate.com',
      password: 'admin123'
    });
    
    const token = loginRes.data.token;
    console.log('✅ Login successful');
    
    // Now test pending residents endpoint
    const pendingRes = await axios.get('http://localhost:5050/admin/residents/pending', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('\n📋 Response Status:', pendingRes.status);
    console.log('📋 Is Array?', Array.isArray(pendingRes.data));
    console.log('📋 Type:', typeof pendingRes.data);
    
    if (Array.isArray(pendingRes.data)) {
      console.log('📋 Array Length:', pendingRes.data.length);
      if (pendingRes.data.length > 0) {
        console.log('📋 First Item Keys:', Object.keys(pendingRes.data[0]));
        console.log('📋 First Item:', JSON.stringify(pendingRes.data[0], null, 2));
      }
    } else {
      console.log('📋 Response Data:', JSON.stringify(pendingRes.data, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testPendingAPI();
