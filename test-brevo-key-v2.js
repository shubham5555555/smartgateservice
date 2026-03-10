require('dotenv').config();
const Brevo = require('@getbrevo/brevo');

async function testBrevoKey() {
  console.log('🔍 Testing Brevo API Key...\n');
  
  const apiKey = process.env.BREVO_API_KEY;
  
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
  
  try {
    // Test using TransactionalEmailsApi (same as our service)
    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      Brevo.TransactionalEmailsApiApiKeys.apiKey,
      apiKey.trim(),
    );
    
    console.log('🧪 Testing API key with Brevo TransactionalEmailsApi...\n');
    
    // Test by sending a simple email (or we can test account API)
    // Let's test account info first (lighter test)
    const accountApi = new Brevo.AccountApi();
    accountApi.setApiKey(
      Brevo.AccountApiApiKeys.apiKey,
      apiKey.trim(),
    );
    
    const accountInfo = await accountApi.getAccount();
    
    console.log('✅ SUCCESS! API Key is valid!\n');
    console.log('📊 Account Info:');
    console.log(`   Company: ${accountInfo.companyName || 'N/A'}`);
    console.log(`   Email: ${accountInfo.email || 'N/A'}`);
    console.log(`   Plan: ${accountInfo.plan?.type || 'N/A'}`);
    console.log('');
    console.log('✅ Your API key is working correctly!');
    console.log('📧 You can now send transactional emails.');
    
    // Now test sending a simple email
    console.log('\n🧪 Testing email sending capability...\n');
    
    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.subject = 'Test Email - Smart Gate';
    sendSmtpEmail.htmlContent = '<p>This is a test email from Smart Gate API.</p>';
    sendSmtpEmail.sender = {
      name: 'Smart Gate',
      email: process.env.BREVO_SENDER_EMAIL || 'ershubhamkaushik05@gmail.com',
    };
    sendSmtpEmail.to = [{ email: 'idevshubham@gmail.com' }];
    
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${result.messageId}`);
    console.log('');
    console.log('🎉 Everything is working! Your API key is valid and can send emails.');
    
  } catch (error) {
    console.log('❌ FAILED! API Key test failed.\n');
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.body || error.response.text, null, 2)}`);
      
      if (error.response.status === 401) {
        console.log('');
        console.log('💡 This means:');
        console.log('   - The API key is invalid or expired');
        console.log('   - Or the API key doesn\'t have required permissions');
        console.log('   - Get a new API key from: https://app.brevo.com/settings/keys/api');
        console.log('   - Make sure it has "Send emails" permission');
      } else if (error.response.status === 400) {
        console.log('');
        console.log('💡 This might be a sender email issue:');
        console.log('   - Make sure the sender email is verified in Brevo');
        console.log('   - Check: https://app.brevo.com/settings/senders');
      }
    } else {
      console.log(`   Error: ${error.message}`);
      if (error.stack) {
        console.log(`   Stack: ${error.stack.split('\n')[0]}`);
      }
    }
  }
}

testBrevoKey();
