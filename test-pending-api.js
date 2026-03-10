const axios = require('axios');

async function testPendingAPI() {
  try {
    // First login to get token
    const loginRes = await axios.post('http://localhost:5050/admin/auth/login', {
      email: 'admin@smartgate.com',
      password: 'admin123'
    });
    
    const token = loginRes.data.token;
    console.log('✅ Login successful, token:', token.substring(0, 20) + '...');
    
    // Now test pending residents endpoint
    const pendingRes = await axios.get('http://localhost:5050/admin/residents/pending', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('\n📋 Response Status:', pendingRes.status);
    console.log('📋 Response Data:', JSON.stringify(pendingRes.data, null, 2));
    
    if (Array.isArray(pendingRes.data) && pendingRes.data.length > 0) {
      console.log('\n🔍 First Resident Keys:', Object.keys(pendingRes.data[0]));
      console.log('🔍 Has emailOtp?', 'emailOtp' in pendingRes.data[0]);
      console.log('🔍 Has fcmToken?', 'fcmToken' in pendingRes.data[0]);
      console.log('🔍 Has __v?', '__v' in pendingRes.data[0]);
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testPendingAPI();
