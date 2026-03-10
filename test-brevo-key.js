require('dotenv').config();
const axios = require('axios');

async function testBrevoKey() {
  const apiKey = process.env.BREVO_API_KEY;
  
  console.log('🔍 Testing Brevo API Key...\n');
  
  if (!apiKey) {
    console.log('❌ BREVO_API_KEY not found in .env');
    return;
  }
  
  // Show first and last chars for security
  const keyPreview = apiKey.length > 30 
    ? `${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 10)}`
    : apiKey.substring(0, 20) + '...';
  
  console.log(`📋 Key Preview: ${keyPreview}`);
  console.log(`📏 Key Length: ${apiKey.length} characters`);
  console.log(`🔤 Key Type: ${apiKey.startsWith('xkeysib-') ? '✅ API Key (correct)' : apiKey.startsWith('xsmtpsib-') ? '❌ SMTP Password (wrong!)' : '⚠️  Unknown format'}`);
  console.log('');
  
  if (!apiKey.startsWith('xkeysib-')) {
    console.log('❌ ERROR: This is NOT an API key!');
    console.log('   - API keys start with: xkeysib-');
    console.log('   - SMTP passwords start with: xsmtpsib-');
    console.log('   - You need to get your API key from: https://app.brevo.com/settings/keys/api');
    return;
  }
  
  console.log('🧪 Testing API key with Brevo...\n');
  
  try {
    // Test by getting account info (lightweight test)
    const response = await axios.get('https://api.brevo.com/v3/account', {
      headers: {
        'api-key': apiKey.trim(),
        'Accept': 'application/json'
      }
    });
    
    console.log('✅ SUCCESS! API Key is valid!\n');
    console.log('📊 Account Info:');
    console.log(`   Company: ${response.data.companyName || 'N/A'}`);
    console.log(`   Email: ${response.data.email || 'N/A'}`);
    console.log(`   Plan: ${response.data.plan?.type || 'N/A'}`);
    console.log('');
    console.log('✅ Your API key is working correctly!');
    console.log('📧 You can now send emails.');
    
  } catch (error) {
    console.log('❌ FAILED! API Key is invalid.\n');
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
      
      if (error.response.status === 401) {
        console.log('');
        console.log('💡 This means:');
        console.log('   - The API key is invalid or expired');
        console.log('   - Or you\'re using an SMTP password instead');
        console.log('   - Get a new API key from: https://app.brevo.com/settings/keys/api');
      }
    } else {
      console.log(`   Error: ${error.message}`);
    }
  }
}

testBrevoKey();
