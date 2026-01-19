const http = require('http');
const readline = require('readline');

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
    const dataStr = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    console.log(`   Response: ${dataStr.substring(0, 200)}...`);
  }
  return success;
}

function question(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function runTests() {
  console.log('==========================================');
  console.log('Smart Gate API Testing (Automated)');
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
      console.log(`   ${colors.yellow}✓ OTP sent! Check backend console for the OTP code${colors.reset}`);
    } else {
      failed++;
      console.log(`   ${colors.red}Failed to send OTP${colors.reset}`);
      return;
    }
    console.log('');

    // Test 2: Verify OTP (using default OTP for test number)
    console.log('2. Testing Verify OTP...');
    const DEFAULT_OTP = PHONE_NUMBER === '9999999999' ? '123456' : null;
    let otp;
    
    if (DEFAULT_OTP) {
      console.log(`   ${colors.blue}Using default OTP: ${DEFAULT_OTP}${colors.reset}`);
      otp = DEFAULT_OTP;
    } else {
      otp = await question(`   ${colors.blue}Enter the OTP from backend console: ${colors.reset}`);
    }
    
    const verifyResult = await makeRequest('POST', '/auth/verify-otp', {
      phoneNumber: PHONE_NUMBER,
      otp: otp.trim(),
    });
    
    if (printResult('Verify OTP', verifyResult, true)) {
      token = verifyResult.data.accessToken;
      userId = verifyResult.data.user?.id || verifyResult.data.user?._id;
      passed++;
      console.log(`   ${colors.green}✓ Authentication successful!${colors.reset}`);
      console.log(`   Token: ${token.substring(0, 30)}...`);
      console.log(`   User ID: ${userId}`);
    } else {
      failed++;
      console.log(`   ${colors.red}Failed to verify OTP. Cannot continue with authenticated tests.${colors.reset}`);
      return;
    }
    console.log('');

    if (!token) {
      console.log(`   ${colors.red}No token received. Exiting.${colors.reset}`);
      return;
    }

    // Test 3: Get User Profile
    console.log('3. Testing Get User Profile...');
    const profileResult = await makeRequest('GET', '/users/profile', null, true);
    if (printResult('Get Profile', profileResult, true)) {
      passed++;
    } else {
      failed++;
    }
    console.log('');

    // Test 4: Update User Profile
    console.log('4. Testing Update User Profile...');
    const updateResult = await makeRequest('PUT', '/users/profile', {
      fullName: 'Test User',
      email: 'test@example.com',
      role: 'Owner',
      block: 'A',
      flat: '101',
      address: '102, Riverdale Residency',
    }, true);
    if (printResult('Update Profile', updateResult, true)) {
      passed++;
    } else {
      failed++;
    }
    console.log('');

    // Test 5: Create Staff
    console.log('5. Testing Create Staff...');
    const createStaffResult = await makeRequest('POST', '/staff', {
      name: 'John Doe',
      role: 'Driver',
      phoneNumber: '9876543210',
    }, true);
    if (printResult('Create Staff', createStaffResult, true)) {
      staffId = createStaffResult.data._id || createStaffResult.data.id;
      passed++;
      console.log(`   Staff ID: ${staffId}`);
    } else {
      failed++;
    }
    console.log('');

    // Test 6: Get Staff List
    console.log('6. Testing Get Staff List...');
    const staffListResult = await makeRequest('GET', '/staff', null, true);
    if (printResult('Get Staff List', staffListResult, true)) {
      passed++;
    } else {
      failed++;
    }
    console.log('');

    // Test 7: Staff Check-in
    if (staffId) {
      console.log('7. Testing Staff Check-in...');
      const checkInResult = await makeRequest('POST', `/staff/${staffId}/check-in`, null, true);
      if (printResult('Staff Check-in', checkInResult, true)) {
        passed++;
      } else {
        failed++;
      }
      console.log('');

      // Test 8: Get Staff Activity
      console.log('8. Testing Get Staff Activity...');
      const activityResult = await makeRequest('GET', `/staff/${staffId}/activity`, null, true);
      if (printResult('Get Staff Activity', activityResult, true)) {
        passed++;
      } else {
        failed++;
      }
      console.log('');

      // Test 9: Staff Check-out
      console.log('9. Testing Staff Check-out...');
      const checkOutResult = await makeRequest('POST', `/staff/${staffId}/check-out`, null, true);
      if (printResult('Staff Check-out', checkOutResult, true)) {
        passed++;
      } else {
        failed++;
      }
      console.log('');
    }

    // Test 10: Get My Parking Slots
    console.log('10. Testing Get My Parking Slots...');
    const slotsResult = await makeRequest('GET', '/parking/my-slots', null, true);
    if (printResult('Get My Slots', slotsResult, true)) {
      passed++;
    } else {
      failed++;
    }
    console.log('');

    // Test 11: Apply for Parking
    console.log('11. Testing Apply for Parking...');
    const applyParkingResult = await makeRequest('POST', '/parking/apply', {
      description: 'Permanent Sticker Request',
      parkingType: 'Permanent',
      vehicle: 'Mercedes Benz S-Class',
      licensePlate: 'MH 43 SA 1139',
      block: 'A',
    }, true);
    if (printResult('Apply Parking', applyParkingResult, true)) {
      passed++;
    } else {
      failed++;
    }
    console.log('');

    // Test 12: Get Parking Applications
    console.log('12. Testing Get Parking Applications...');
    const applicationsResult = await makeRequest('GET', '/parking/applications', null, true);
    if (printResult('Get Applications', applicationsResult, true)) {
      passed++;
    } else {
      failed++;
    }
    console.log('');

    // Test 13: Get Current Maintenance Dues
    console.log('13. Testing Get Current Maintenance Dues...');
    const duesResult = await makeRequest('GET', '/maintenance/current-dues', null, true);
    if (printResult('Get Current Dues', duesResult, true)) {
      passed++;
    } else {
      failed++;
    }
    console.log('');

    // Test 14: Get Payment History
    console.log('14. Testing Get Payment History...');
    const historyResult = await makeRequest('GET', '/maintenance/payment-history', null, true);
    if (printResult('Get Payment History', historyResult, true)) {
      passed++;
    } else {
      failed++;
    }
    console.log('');

    // Test 15: Get Total Amount Due
    console.log('15. Testing Get Total Amount Due...');
    const totalResult = await makeRequest('GET', '/maintenance/total-due', null, true);
    if (printResult('Get Total Due', totalResult, true)) {
      passed++;
      if (totalResult.data.totalAmountDue !== undefined) {
        console.log(`   Total Amount Due: ₹${totalResult.data.totalAmountDue}`);
      }
    } else {
      failed++;
    }
    console.log('');

    // Test 16: Create Visitor
    console.log('16. Testing Create Visitor...');
    const createVisitorResult = await makeRequest('POST', '/visitors', {
      name: 'Test Visitor',
      type: 'Guest',
      phoneNumber: '9876543210',
      isPreApproved: false,
    }, true);
    if (printResult('Create Visitor', createVisitorResult, true)) {
      visitorId = createVisitorResult.data._id || createVisitorResult.data.id;
      passed++;
      console.log(`   Visitor ID: ${visitorId}`);
    } else {
      failed++;
    }
    console.log('');

    // Test 17: Get Visitors
    console.log('17. Testing Get Visitors...');
    const visitorsResult = await makeRequest('GET', '/visitors', null, true);
    if (printResult('Get Visitors', visitorsResult, true)) {
      passed++;
    } else {
      failed++;
    }
    console.log('');

    // Test 18: Get Today's Visitors
    console.log('18. Testing Get Today\'s Visitors...');
    const todayVisitorsResult = await makeRequest('GET', '/visitors/today', null, true);
    if (printResult('Get Today Visitors', todayVisitorsResult, true)) {
      passed++;
    } else {
      failed++;
    }
    console.log('');

    // Test 19: Approve Visitor
    if (visitorId) {
      console.log('19. Testing Approve Visitor...');
      const approveResult = await makeRequest('POST', `/visitors/${visitorId}/approve`, null, true);
      if (printResult('Approve Visitor', approveResult, true)) {
        passed++;
      } else {
        failed++;
      }
      console.log('');
    }

    console.log('==========================================');
    console.log(`Test Summary: ${colors.green}${passed} passed${colors.reset}, ${colors.red}${failed} failed${colors.reset}`);
    console.log('==========================================');

  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    console.error(error.stack);
  }
}

// Run tests
runTests();
