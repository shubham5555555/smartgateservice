const http = require('http');

const BASE_URL = 'http://localhost:5050';
const PHONE_NUMBER = '9999999999';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

let token = '';
let userId = '';
let staffId = '';
let visitorId = '';

// Helper function to make HTTP requests
function makeRequest(method, endpoint, data = null, useAuth = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (useAuth && token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, raw: body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test result printer
function printResult(testName, result, showData = false) {
  const success = result.status >= 200 && result.status < 300;
  const icon = success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
  console.log(`${icon} ${testName} - Status: ${result.status}`);
  if (showData && result.data) {
    console.log(`   Response: ${JSON.stringify(result.data).substring(0, 150)}...`);
  }
  return success;
}

async function runTests() {
  console.log('==========================================');
  console.log('Smart Gate API Testing');
  console.log('==========================================\n');

  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Send OTP
    console.log('1. Testing Send OTP...');
    const otpResult = await makeRequest('POST', '/auth/send-otp', {
      phoneNumber: PHONE_NUMBER,
    });
    if (printResult('Send OTP', otpResult)) {
      passed++;
      console.log(`   ${colors.yellow}Note: Check backend console for OTP${colors.reset}`);
    } else {
      failed++;
    }
    console.log('');

    // Test 2: Verify OTP (using a test OTP - in real scenario, get from backend logs)
    console.log('2. Testing Verify OTP...');
    console.log(`   ${colors.yellow}Please check backend console for the OTP and enter it:${colors.reset}`);
    // For automated testing, we'll skip this and use a mock
    // In production, you'd read from backend logs or use a test OTP
    console.log(`   ${colors.blue}Skipping OTP verification for automated test${colors.reset}`);
    console.log('   To test manually, use the OTP from backend console\n');
    
    // If you want to test with a real OTP, uncomment below:
    // const readline = require('readline');
    // const rl = readline.createInterface({
    //   input: process.stdin,
    //   output: process.stdout
    // });
    // const otp = await new Promise(resolve => rl.question('Enter OTP: ', resolve));
    // rl.close();
    
    // const verifyResult = await makeRequest('POST', '/auth/verify-otp', {
    //   phoneNumber: PHONE_NUMBER,
    //   otp: otp,
    // });
    // if (printResult('Verify OTP', verifyResult, true)) {
    //   token = verifyResult.data.accessToken;
    //   userId = verifyResult.data.user?.id;
    //   passed++;
    // } else {
    //   failed++;
    // }
    // console.log('');

    // For demonstration, we'll show what the authenticated endpoints would look like
    console.log(`   ${colors.blue}Continuing with authenticated endpoint tests (requires valid token)${colors.reset}\n`);

    // Test 3: Get User Profile (requires auth)
    console.log('3. Testing Get User Profile (requires auth)...');
    console.log(`   ${colors.yellow}This requires a valid JWT token from OTP verification${colors.reset}\n`);

    // Test 4: Update User Profile
    console.log('4. Testing Update User Profile (requires auth)...');
    console.log(`   ${colors.yellow}This requires a valid JWT token from OTP verification${colors.reset}\n`);

    // Test 5: Create Staff
    console.log('5. Testing Create Staff (requires auth)...');
    console.log(`   ${colors.yellow}This requires a valid JWT token from OTP verification${colors.reset}\n`);

    // Test 6: Get Staff List
    console.log('6. Testing Get Staff List (requires auth)...');
    console.log(`   ${colors.yellow}This requires a valid JWT token from OTP verification${colors.reset}\n`);

    // Test 7: Get My Parking Slots
    console.log('7. Testing Get My Parking Slots (requires auth)...');
    console.log(`   ${colors.yellow}This requires a valid JWT token from OTP verification${colors.reset}\n`);

    // Test 8: Apply for Parking
    console.log('8. Testing Apply for Parking (requires auth)...');
    console.log(`   ${colors.yellow}This requires a valid JWT token from OTP verification${colors.reset}\n`);

    // Test 9: Get Current Maintenance Dues
    console.log('9. Testing Get Current Maintenance Dues (requires auth)...');
    console.log(`   ${colors.yellow}This requires a valid JWT token from OTP verification${colors.reset}\n`);

    // Test 10: Create Visitor
    console.log('10. Testing Create Visitor (requires auth)...');
    console.log(`   ${colors.yellow}This requires a valid JWT token from OTP verification${colors.reset}\n`);

    console.log('==========================================');
    console.log(`Test Summary: ${colors.green}${passed} passed${colors.reset}, ${colors.red}${failed} failed${colors.reset}`);
    console.log('==========================================');
    console.log(`\n${colors.yellow}Note:${colors.reset} To test authenticated endpoints:`);
    console.log('1. Run the backend server');
    console.log('2. Check backend console for OTP when sending OTP');
    console.log('3. Use the OTP to verify and get JWT token');
    console.log('4. Use the JWT token in Authorization header for other endpoints');
    console.log('\nOr use the bash script: ./test-apis.sh (interactive)');

  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
  }
}

// Run tests
runTests();
