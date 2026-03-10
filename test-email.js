const axios = require('axios');

async function testEmail() {
  try {
    console.log('📧 Testing email sending to idevshubham@gmail.com...\n');
    
    const response = await axios.post('http://localhost:5050/auth/register/send-email-otp', {
      email: 'idevshubham@gmail.com'
    });
    
    console.log('✅ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Error occurred:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

testEmail();
