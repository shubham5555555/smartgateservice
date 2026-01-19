const http = require('http');

const BASE_URL = 'http://localhost:5050';
const PHONE_NUMBER = '9999999999';
const ADMIN_EMAIL = 'admin@smartgate.com';
const ADMIN_PASSWORD = 'admin123';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

let userToken = '';
let adminToken = '';
let guardToken = '';
let userId = '';
let adminId = '';
let guardId = '';
let testData = {
  visitorId: '',
  complaintId: '',
  packageId: '',
  vehicleId: '',
  petId: '',
  staffId: '',
  eventId: '',
  documentId: '',
};

// Helper function to make HTTP requests
function makeRequest(method, endpoint, data = null, useAuth = false, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 5050,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const authToken = token || (useAuth ? (userToken || adminToken || guardToken) : null);
    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
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
function printResult(testName, result, showData = false, expectedStatus = 200) {
  const success = result.status === expectedStatus || (expectedStatus === 200 && result.status >= 200 && result.status < 300);
  const icon = success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
  const statusColor = success ? colors.green : colors.red;
  console.log(`${icon} ${testName}`);
  console.log(`   Status: ${statusColor}${result.status}${colors.reset}${expectedStatus !== 200 ? ` (expected: ${expectedStatus})` : ''}`);
  
  if (result.status >= 400 && result.data) {
    const errorMsg = typeof result.data === 'object' ? (result.data.message || result.data.error || JSON.stringify(result.data).substring(0, 100)) : result.data.substring(0, 100);
    console.log(`   ${colors.red}Error:${colors.reset} ${errorMsg}`);
  }
  
  if (showData && result.data && result.status < 400) {
    const dataStr = typeof result.data === 'object' ? JSON.stringify(result.data).substring(0, 200) : result.data.substring(0, 200);
    console.log(`   ${colors.cyan}Response:${colors.reset} ${dataStr}...`);
  }
  return success;
}

async function testSection(title) {
  console.log(`\n${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.magenta}${title}${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}\n`);
}

async function runTests() {
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}Smart Gate API Comprehensive Testing${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // ==========================================
    // 1. AUTHENTICATION APIs
    // ==========================================
    await testSection('1. AUTHENTICATION APIs');

    // 1.1 Send OTP (User)
    console.log('1.1 Testing Send OTP (User)...');
    const otpResult = await makeRequest('POST', '/auth/send-otp', {
      phoneNumber: PHONE_NUMBER,
    });
    if (printResult('Send OTP (User)', otpResult)) {
      passed++;
      console.log(`   ${colors.yellow}Note: Check backend console for OTP${colors.reset}`);
    } else {
      failed++;
    }
    console.log('');

    // 1.2 Verify OTP (User) - Using default test OTP
    console.log('1.2 Testing Verify OTP (User)...');
    console.log(`   ${colors.yellow}Using test OTP: 123456${colors.reset}`);
    const verifyResult = await makeRequest('POST', '/auth/verify-otp', {
      phoneNumber: PHONE_NUMBER,
      otp: '123456',
    });
    if (printResult('Verify OTP (User)', verifyResult)) {
      userToken = verifyResult.data.accessToken;
      userId = verifyResult.data.user?.id || verifyResult.data.user?._id;
      passed++;
      console.log(`   ${colors.green}Token obtained: ${userToken ? 'Yes' : 'No'}${colors.reset}`);
    } else {
      failed++;
      console.log(`   ${colors.yellow}Skipping user-authenticated tests...${colors.reset}`);
    }
    console.log('');

    // 1.3 Admin Login
    console.log('1.3 Testing Admin Login...');
    const adminLoginResult = await makeRequest('POST', '/admin/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (printResult('Admin Login', adminLoginResult)) {
      adminToken = adminLoginResult.data.accessToken;
      adminId = adminLoginResult.data.user?.id || adminLoginResult.data.user?._id;
      passed++;
    } else {
      failed++;
      console.log(`   ${colors.yellow}Skipping admin-authenticated tests...${colors.reset}`);
    }
    console.log('');

    // 1.4 Guard Login (if guard exists)
    console.log('1.4 Testing Guard Login...');
    const guardLoginResult = await makeRequest('POST', '/admin/guard/auth/login', {
      phoneNumber: '9999999998',
      password: 'guard123',
    });
    if (printResult('Guard Login', guardLoginResult, false, 200)) {
      guardToken = guardLoginResult.data.accessToken;
      guardId = guardLoginResult.data.guard?.id || guardLoginResult.data.guard?._id;
      passed++;
    } else {
      skipped++;
      console.log(`   ${colors.yellow}Guard login skipped (guard may not exist)${colors.reset}`);
    }
    console.log('');

    // ==========================================
    // 2. USER APIs
    // ==========================================
    if (userToken) {
      await testSection('2. USER APIs');

      // 2.1 Get User Profile
      console.log('2.1 Testing Get User Profile...');
      const profileResult = await makeRequest('GET', '/users/profile', null, true);
      if (printResult('Get User Profile', profileResult)) passed++;
      else failed++;
      console.log('');

      // 2.2 Update User Profile
      console.log('2.2 Testing Update User Profile...');
      const updateProfileResult = await makeRequest('PUT', '/users/profile', {
        name: 'Test User Updated',
      }, true);
      if (printResult('Update User Profile', updateProfileResult)) passed++;
      else failed++;
      console.log('');

      // 2.3 Update FCM Token
      console.log('2.3 Testing Update FCM Token...');
      const fcmTokenResult = await makeRequest('PUT', '/users/profile/fcm-token', {
        fcmToken: 'test-fcm-token-12345',
      }, true);
      if (printResult('Update FCM Token', fcmTokenResult)) passed++;
      else failed++;
      console.log('');
    } else {
      skipped += 3;
    }

    // ==========================================
    // 3. VISITOR APIs
    // ==========================================
    if (userToken) {
      await testSection('3. VISITOR APIs');

      // 3.1 Create Visitor
      console.log('3.1 Testing Create Visitor...');
      const visitorPhoneNumber = `8${Date.now().toString().slice(-9)}`;
      const createVisitorResult = await makeRequest('POST', '/visitors', {
        name: 'Test Visitor',
        type: 'Guest',
        phoneNumber: visitorPhoneNumber,
        expectedDate: new Date().toISOString(),
      }, true);
      if (printResult('Create Visitor', createVisitorResult)) {
        testData.visitorId = createVisitorResult.data._id || createVisitorResult.data.id;
        passed++;
      } else {
        failed++;
      }
      console.log('');

      // 3.2 Get Visitors
      console.log('3.2 Testing Get Visitors...');
      const getVisitorsResult = await makeRequest('GET', '/visitors', null, true);
      if (printResult('Get Visitors', getVisitorsResult)) passed++;
      else failed++;
      console.log('');

      // 3.3 Get Today Visitors
      console.log('3.3 Testing Get Today Visitors...');
      const todayVisitorsResult = await makeRequest('GET', '/visitors/today', null, true);
      if (printResult('Get Today Visitors', todayVisitorsResult)) passed++;
      else failed++;
      console.log('');

      // 3.4 Approve Visitor (if visitor exists)
      if (testData.visitorId) {
        console.log('3.4 Testing Approve Visitor...');
        const approveVisitorResult = await makeRequest('POST', `/visitors/${testData.visitorId}/approve`, null, true);
        if (printResult('Approve Visitor', approveVisitorResult)) passed++;
        else failed++;
        console.log('');
      }
    } else {
      skipped += 4;
    }

    // ==========================================
    // 4. COMPLAINT APIs
    // ==========================================
    if (userToken) {
      await testSection('4. COMPLAINT APIs');

      // 4.1 Create Complaint
      console.log('4.1 Testing Create Complaint...');
      const createComplaintResult = await makeRequest('POST', '/complaints', {
        title: 'Test Complaint',
        description: 'This is a test complaint',
        category: 'Maintenance',
        priority: 'Medium',
        status: 'Open',
      }, true);
      if (printResult('Create Complaint', createComplaintResult)) {
        testData.complaintId = createComplaintResult.data._id || createComplaintResult.data.id;
        passed++;
      } else {
        failed++;
      }
      console.log('');

      // 4.2 Get My Complaints
      console.log('4.2 Testing Get My Complaints...');
      const getComplaintsResult = await makeRequest('GET', '/complaints', null, true);
      if (printResult('Get My Complaints', getComplaintsResult)) passed++;
      else failed++;
      console.log('');

      // 4.3 Get Complaint By ID
      if (testData.complaintId) {
        console.log('4.3 Testing Get Complaint By ID...');
        const getComplaintResult = await makeRequest('GET', `/complaints/${testData.complaintId}`, null, true);
        if (printResult('Get Complaint By ID', getComplaintResult)) passed++;
        else failed++;
        console.log('');
      }
    } else {
      skipped += 3;
    }

    // ==========================================
    // 5. PACKAGE APIs
    // ==========================================
    if (userToken) {
      await testSection('5. PACKAGE APIs');

      // 5.1 Create Package
      console.log('5.1 Testing Create Package...');
      const trackingNumber = `TEST${Date.now()}`;
      const createPackageResult = await makeRequest('POST', '/packages', {
        trackingNumber: trackingNumber,
        recipientName: 'Test Recipient',
        recipientPhone: '8888888888',
        deliveryCompany: 'Test Carrier',
      }, true);
      if (printResult('Create Package', createPackageResult)) {
        testData.packageId = createPackageResult.data._id || createPackageResult.data.id;
        passed++;
      } else {
        failed++;
      }
      console.log('');

      // 5.2 Get My Packages
      console.log('5.2 Testing Get My Packages...');
      const getPackagesResult = await makeRequest('GET', '/packages', null, true);
      if (printResult('Get My Packages', getPackagesResult)) passed++;
      else failed++;
      console.log('');

      // 5.3 Get Pending Packages
      console.log('5.3 Testing Get Pending Packages...');
      const pendingPackagesResult = await makeRequest('GET', '/packages/pending', null, true);
      if (printResult('Get Pending Packages', pendingPackagesResult)) passed++;
      else failed++;
      console.log('');

      // 5.4 Get Package By ID
      if (testData.packageId) {
        console.log('5.4 Testing Get Package By ID...');
        const getPackageResult = await makeRequest('GET', `/packages/${testData.packageId}`, null, true);
        if (printResult('Get Package By ID', getPackageResult)) passed++;
        else failed++;
        console.log('');
      }
    } else {
      skipped += 4;
    }

    // ==========================================
    // 6. MAINTENANCE APIs
    // ==========================================
    if (userToken) {
      await testSection('6. MAINTENANCE APIs');

      // 6.1 Get Current Dues
      console.log('6.1 Testing Get Current Dues...');
      const currentDuesResult = await makeRequest('GET', '/maintenance/current-dues', null, true);
      if (printResult('Get Current Dues', currentDuesResult)) passed++;
      else failed++;
      console.log('');

      // 6.2 Get Payment History
      console.log('6.2 Testing Get Payment History...');
      const paymentHistoryResult = await makeRequest('GET', '/maintenance/payment-history', null, true);
      if (printResult('Get Payment History', paymentHistoryResult)) passed++;
      else failed++;
      console.log('');

      // 6.3 Get Total Amount Due
      console.log('6.3 Testing Get Total Amount Due...');
      const totalDueResult = await makeRequest('GET', '/maintenance/total-due', null, true);
      if (printResult('Get Total Amount Due', totalDueResult)) passed++;
      else failed++;
      console.log('');
    } else {
      skipped += 3;
    }

    // ==========================================
    // 7. VEHICLE APIs
    // ==========================================
    if (userToken) {
      await testSection('7. VEHICLE APIs');

      // 7.1 Create Vehicle
      console.log('7.1 Testing Create Vehicle...');
      const vehicleNumber = `TEST${Date.now()}`;
      const createVehicleResult = await makeRequest('POST', '/vehicles', {
        vehicleNumber: vehicleNumber,
        vehicleType: 'Car',
        brand: 'Test Brand',
        model: 'Test Model',
        color: 'Red',
      }, true);
      if (printResult('Create Vehicle', createVehicleResult)) {
        testData.vehicleId = createVehicleResult.data._id || createVehicleResult.data.id;
        passed++;
      } else {
        failed++;
      }
      console.log('');

      // 7.2 Get My Vehicles
      console.log('7.2 Testing Get My Vehicles...');
      const getVehiclesResult = await makeRequest('GET', '/vehicles', null, true);
      if (printResult('Get My Vehicles', getVehiclesResult)) passed++;
      else failed++;
      console.log('');

      // 7.3 Get Vehicle By ID
      if (testData.vehicleId) {
        console.log('7.3 Testing Get Vehicle By ID...');
        const getVehicleResult = await makeRequest('GET', `/vehicles/${testData.vehicleId}`, null, true);
        if (printResult('Get Vehicle By ID', getVehicleResult)) passed++;
        else failed++;
        console.log('');
      }
    } else {
      skipped += 3;
    }

    // ==========================================
    // 8. PET APIs
    // ==========================================
    if (userToken) {
      await testSection('8. PET APIs');

      // 8.1 Create Pet
      console.log('8.1 Testing Create Pet...');
      const createPetResult = await makeRequest('POST', '/pets', {
        name: 'Test Pet',
        type: 'Dog',
        breed: 'Test Breed',
        age: 2,
      }, true);
      if (printResult('Create Pet', createPetResult)) {
        testData.petId = createPetResult.data._id || createPetResult.data.id;
        passed++;
      } else {
        failed++;
      }
      console.log('');

      // 8.2 Get My Pets
      console.log('8.2 Testing Get My Pets...');
      const getPetsResult = await makeRequest('GET', '/pets', null, true);
      if (printResult('Get My Pets', getPetsResult)) passed++;
      else failed++;
      console.log('');

      // 8.3 Get Pet By ID
      if (testData.petId) {
        console.log('8.3 Testing Get Pet By ID...');
        const getPetResult = await makeRequest('GET', `/pets/${testData.petId}`, null, true);
        if (printResult('Get Pet By ID', getPetResult)) passed++;
        else failed++;
        console.log('');
      }
    } else {
      skipped += 3;
    }

    // ==========================================
    // 9. PARKING APIs
    // ==========================================
    if (userToken) {
      await testSection('9. PARKING APIs');

      // 9.1 Get My Slots
      console.log('9.1 Testing Get My Slots...');
      const getSlotsResult = await makeRequest('GET', '/parking/my-slots', null, true);
      if (printResult('Get My Slots', getSlotsResult)) passed++;
      else failed++;
      console.log('');

      // 9.2 Apply for Parking
      console.log('9.2 Testing Apply for Parking...');
      const applyParkingResult = await makeRequest('POST', '/parking/apply', {
        description: 'Need parking slot for my car',
        parkingType: 'Permanent',
        licensePlate: 'TEST1234',
      }, true);
      if (printResult('Apply for Parking', applyParkingResult)) passed++;
      else failed++;
      console.log('');

      // 9.3 Get Applications
      console.log('9.3 Testing Get Applications...');
      const getApplicationsResult = await makeRequest('GET', '/parking/applications', null, true);
      if (printResult('Get Applications', getApplicationsResult)) passed++;
      else failed++;
      console.log('');

      // 9.4 Get Application Status
      console.log('9.4 Testing Get Application Status...');
      const getStatusResult = await makeRequest('GET', '/parking/application-status', null, true);
      if (printResult('Get Application Status', getStatusResult)) passed++;
      else failed++;
      console.log('');
    } else {
      skipped += 4;
    }

    // ==========================================
    // 10. AMENITIES APIs
    // ==========================================
    if (userToken) {
      await testSection('10. AMENITIES APIs');

      // 10.1 Get Available Slots
      console.log('10.1 Testing Get Available Slots...');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const availableSlotsResult = await makeRequest('GET', `/amenities/available-slots/Gym/${dateStr}`, null, true);
      if (printResult('Get Available Slots', availableSlotsResult)) passed++;
      else failed++;
      console.log('');

      // 10.2 Book Amenity
      console.log('10.2 Testing Book Amenity...');
      // Use a unique time slot to avoid conflicts
      const timeSlot = `14:00-15:00`;
      const bookAmenityResult = await makeRequest('POST', '/amenities/book', {
        amenityType: 'Gym',
        bookingDate: dateStr,
        timeSlot: timeSlot,
      }, true);
      if (printResult('Book Amenity', bookAmenityResult)) {
        passed++;
      } else {
        // If it fails due to slot already booked, that's expected behavior
        if (bookAmenityResult.status === 400 && bookAmenityResult.data?.message?.includes('already booked')) {
          console.log(`   ${colors.yellow}Note: Time slot already booked (expected if slot was booked in previous test)${colors.reset}`);
          skipped++;
        } else {
          failed++;
        }
      }
      console.log('');

      // 10.3 Get My Bookings
      console.log('10.3 Testing Get My Bookings...');
      const getBookingsResult = await makeRequest('GET', '/amenities/my-bookings', null, true);
      if (printResult('Get My Bookings', getBookingsResult)) passed++;
      else failed++;
      console.log('');

      // 10.4 Get Upcoming Bookings
      console.log('10.4 Testing Get Upcoming Bookings...');
      const upcomingBookingsResult = await makeRequest('GET', '/amenities/upcoming', null, true);
      if (printResult('Get Upcoming Bookings', upcomingBookingsResult)) passed++;
      else failed++;
      console.log('');
    } else {
      skipped += 4;
    }

    // ==========================================
    // 11. DOCUMENT APIs
    // ==========================================
    if (userToken) {
      await testSection('11. DOCUMENT APIs');

      // 11.1 Create Document
      console.log('11.1 Testing Create Document...');
      const createDocumentResult = await makeRequest('POST', '/documents', {
        documentType: 'Aadhar',
        documentNumber: 'TEST123456',
        fileUrl: 'https://example.com/document.pdf',
        expiryDate: new Date().toISOString(),
      }, true);
      if (printResult('Create Document', createDocumentResult)) {
        testData.documentId = createDocumentResult.data._id || createDocumentResult.data.id;
        passed++;
      } else {
        failed++;
      }
      console.log('');

      // 11.2 Get My Documents
      console.log('11.2 Testing Get My Documents...');
      const getDocumentsResult = await makeRequest('GET', '/documents', null, true);
      if (printResult('Get My Documents', getDocumentsResult)) passed++;
      else failed++;
      console.log('');

      // 11.3 Get Document By ID
      if (testData.documentId) {
        console.log('11.3 Testing Get Document By ID...');
        const getDocumentResult = await makeRequest('GET', `/documents/${testData.documentId}`, null, true);
        if (printResult('Get Document By ID', getDocumentResult)) passed++;
        else failed++;
        console.log('');
      }
    } else {
      skipped += 3;
    }

    // ==========================================
    // 12. EMERGENCY APIs
    // ==========================================
    await testSection('12. EMERGENCY APIs');

    // 12.1 Get Emergency Contacts (Public)
    console.log('12.1 Testing Get Emergency Contacts (Public)...');
    const getEmergencyContactsResult = await makeRequest('GET', '/emergency/contacts');
    if (printResult('Get Emergency Contacts', getEmergencyContactsResult)) passed++;
    else failed++;
    console.log('');

    // 12.2 Get Contacts By Type (Public)
    console.log('12.2 Testing Get Contacts By Type...');
    const getContactsByTypeResult = await makeRequest('GET', '/emergency/contacts/Police');
    if (printResult('Get Contacts By Type', getContactsByTypeResult)) passed++;
    else failed++;
    console.log('');

    // 12.3 Send SOS (Authenticated)
    if (userToken) {
      console.log('12.3 Testing Send SOS...');
      const sendSOSResult = await makeRequest('POST', '/emergency/sos', {
        location: 'Test Location',
        message: 'Test SOS Message',
      }, true);
      if (printResult('Send SOS', sendSOSResult)) passed++;
      else failed++;
      console.log('');
    } else {
      skipped++;
    }

    // ==========================================
    // 13. STAFF APIs
    // ==========================================
    if (userToken) {
      await testSection('13. STAFF APIs');

      // 13.1 Create Staff
      console.log('13.1 Testing Create Staff...');
      const staffPhoneNumber = `7${Date.now().toString().slice(-9)}`;
      const createStaffResult = await makeRequest('POST', '/staff', {
        name: 'Test Staff',
        phoneNumber: staffPhoneNumber,
        type: 'Housekeeping',
        role: 'Cleaner',
      }, true);
      if (printResult('Create Staff', createStaffResult)) {
        testData.staffId = createStaffResult.data._id || createStaffResult.data.id;
        passed++;
      } else {
        failed++;
      }
      console.log('');

      // 13.2 Get My Staff
      console.log('13.2 Testing Get My Staff...');
      const getStaffResult = await makeRequest('GET', '/staff', null, true);
      if (printResult('Get My Staff', getStaffResult)) passed++;
      else failed++;
      console.log('');

      // 13.3 Get Staff By ID
      if (testData.staffId) {
        console.log('13.3 Testing Get Staff By ID...');
        const getStaffByIdResult = await makeRequest('GET', `/staff/${testData.staffId}`, null, true);
        if (printResult('Get Staff By ID', getStaffByIdResult)) passed++;
        else failed++;
        console.log('');
      }
    } else {
      skipped += 3;
    }

    // ==========================================
    // 14. CHAT APIs
    // ==========================================
    if (userToken) {
      await testSection('14. CHAT APIs');

      // 14.1 Get Messages
      console.log('14.1 Testing Get Messages...');
      const getMessagesResult = await makeRequest('GET', '/chat/messages?limit=10', null, true);
      if (printResult('Get Messages', getMessagesResult)) passed++;
      else failed++;
      console.log('');
    } else {
      skipped++;
    }

    // ==========================================
    // 15. EVENT APIs
    // ==========================================
    if (userToken) {
      await testSection('15. EVENT APIs');

      // 15.1 Create Event
      console.log('15.1 Testing Create Event...');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);
      const createEventResult = await makeRequest('POST', '/events', {
        title: 'Test Event',
        description: 'This is a test event',
        type: 'Celebration',
        startDate: tomorrow.toISOString(),
        endDate: dayAfter.toISOString(),
        location: 'Test Location',
      }, true);
      if (printResult('Create Event', createEventResult)) {
        testData.eventId = createEventResult.data._id || createEventResult.data.id;
        passed++;
      } else {
        failed++;
      }
      console.log('');

      // 15.2 Get All Events
      console.log('15.2 Testing Get All Events...');
      const getEventsResult = await makeRequest('GET', '/events', null, true);
      if (printResult('Get All Events', getEventsResult)) passed++;
      else failed++;
      console.log('');

      // 15.3 Get Upcoming Events
      console.log('15.3 Testing Get Upcoming Events...');
      const getUpcomingResult = await makeRequest('GET', '/events?upcoming=true', null, true);
      if (printResult('Get Upcoming Events', getUpcomingResult)) passed++;
      else failed++;
      console.log('');

      // 15.4 Get My Events
      console.log('15.4 Testing Get My Events...');
      const getMyEventsResult = await makeRequest('GET', '/events/my-events', null, true);
      if (printResult('Get My Events', getMyEventsResult)) passed++;
      else failed++;
      console.log('');

      // 15.5 Get Event By ID
      if (testData.eventId) {
        console.log('15.5 Testing Get Event By ID...');
        const getEventResult = await makeRequest('GET', `/events/${testData.eventId}`, null, true);
        if (printResult('Get Event By ID', getEventResult)) passed++;
        else failed++;
        console.log('');
      }
    } else {
      skipped += 5;
    }

    // ==========================================
    // 16. SEARCH APIs
    // ==========================================
    if (userToken) {
      await testSection('16. SEARCH APIs');

      // 16.1 Search
      console.log('16.1 Testing Search...');
      const searchResult = await makeRequest('GET', '/search?q=test', null, true);
      if (printResult('Search', searchResult)) passed++;
      else failed++;
      console.log('');
    } else {
      skipped++;
    }

    // ==========================================
    // 17. ADMIN APIs
    // ==========================================
    if (adminToken) {
      await testSection('17. ADMIN APIs');

      // 17.1 Get Dashboard Stats
      console.log('17.1 Testing Get Dashboard Stats...');
      const dashboardStatsResult = await makeRequest('GET', '/admin/dashboard/stats', null, true, adminToken);
      if (printResult('Get Dashboard Stats', dashboardStatsResult)) passed++;
      else failed++;
      console.log('');

      // 17.2 Get All Residents
      console.log('17.2 Testing Get All Residents...');
      const getAllResidentsResult = await makeRequest('GET', '/admin/residents', null, true, adminToken);
      if (printResult('Get All Residents', getAllResidentsResult)) passed++;
      else failed++;
      console.log('');

      // 17.3 Get All Visitors
      console.log('17.3 Testing Get All Visitors...');
      const getAllVisitorsResult = await makeRequest('GET', '/admin/visitors', null, true, adminToken);
      if (printResult('Get All Visitors', getAllVisitorsResult)) passed++;
      else failed++;
      console.log('');

      // 17.4 Get All Complaints
      console.log('17.4 Testing Get All Complaints...');
      const getAllComplaintsResult = await makeRequest('GET', '/admin/complaints', null, true, adminToken);
      if (printResult('Get All Complaints', getAllComplaintsResult)) passed++;
      else failed++;
      console.log('');

      // 17.5 Get All Staff
      console.log('17.5 Testing Get All Staff...');
      const getAllStaffResult = await makeRequest('GET', '/admin/staff', null, true, adminToken);
      if (printResult('Get All Staff', getAllStaffResult)) passed++;
      else failed++;
      console.log('');

      // 17.6 Get All Guards
      console.log('17.6 Testing Get All Guards...');
      const getAllGuardsResult = await makeRequest('GET', '/admin/guards', null, true, adminToken);
      if (printResult('Get All Guards', getAllGuardsResult)) passed++;
      else failed++;
      console.log('');

      // 17.7 Get All Events
      console.log('17.7 Testing Get All Events (Admin)...');
      const getAllEventsResult = await makeRequest('GET', '/admin/events', null, true, adminToken);
      if (printResult('Get All Events (Admin)', getAllEventsResult)) passed++;
      else failed++;
      console.log('');

      // 17.8 Get All Packages
      console.log('17.8 Testing Get All Packages...');
      const getAllPackagesResult = await makeRequest('GET', '/admin/packages', null, true, adminToken);
      if (printResult('Get All Packages', getAllPackagesResult)) passed++;
      else failed++;
      console.log('');

      // 17.9 Get All Vehicles
      console.log('17.9 Testing Get All Vehicles...');
      const getAllVehiclesResult = await makeRequest('GET', '/admin/vehicles', null, true, adminToken);
      if (printResult('Get All Vehicles', getAllVehiclesResult)) passed++;
      else failed++;
      console.log('');

      // 17.10 Get All Documents
      console.log('17.10 Testing Get All Documents...');
      const getAllDocumentsResult = await makeRequest('GET', '/admin/documents', null, true, adminToken);
      if (printResult('Get All Documents', getAllDocumentsResult)) passed++;
      else failed++;
      console.log('');

      // 17.11 Get All Emergency Contacts
      console.log('17.11 Testing Get All Emergency Contacts...');
      const getAllEmergencyResult = await makeRequest('GET', '/admin/emergency/contacts', null, true, adminToken);
      if (printResult('Get All Emergency Contacts', getAllEmergencyResult)) passed++;
      else failed++;
      console.log('');

      // 17.12 Get All Pets
      console.log('17.12 Testing Get All Pets...');
      const getAllPetsResult = await makeRequest('GET', '/admin/pets', null, true, adminToken);
      if (printResult('Get All Pets', getAllPetsResult)) passed++;
      else failed++;
      console.log('');

      // 17.13 Get All Notices
      console.log('17.13 Testing Get All Notices...');
      const getAllNoticesResult = await makeRequest('GET', '/admin/notices', null, true, adminToken);
      if (printResult('Get All Notices', getAllNoticesResult)) passed++;
      else failed++;
      console.log('');

      // 17.14 Get All Chat Messages
      console.log('17.14 Testing Get All Chat Messages...');
      const getAllChatMessagesResult = await makeRequest('GET', '/admin/chat/messages?limit=10', null, true, adminToken);
      if (printResult('Get All Chat Messages', getAllChatMessagesResult)) passed++;
      else failed++;
      console.log('');

      // 17.15 Send Notification to User
      if (userId) {
        console.log('17.15 Testing Send Notification to User...');
        const sendNotifResult = await makeRequest('POST', '/admin/notifications/send-to-user', {
          userId: userId,
          title: 'Test Notification',
          body: 'This is a test notification',
        }, true, adminToken);
        if (printResult('Send Notification to User', sendNotifResult)) passed++;
        else failed++;
        console.log('');
      } else {
        skipped++;
      }
    } else {
      skipped += 15;
    }

    // ==========================================
    // 18. NOTIFICATION APIs (via notifications controller)
    // ==========================================
    if (adminToken && userId) {
      await testSection('18. NOTIFICATION APIs');

      // 18.1 Send Notification to User
      console.log('18.1 Testing Send Notification to User (Notifications Controller)...');
      const sendNotifUserResult = await makeRequest('POST', '/notifications/send-to-user', {
        userId: userId,
        title: 'Test Notification',
        body: 'This is a test notification from notifications controller',
      }, true, adminToken);
      if (printResult('Send Notification to User', sendNotifUserResult)) passed++;
      else failed++;
      console.log('');

      // 18.2 Send Notification to All Users
      console.log('18.2 Testing Send Notification to All Users...');
      const sendNotifAllUsersResult = await makeRequest('POST', '/notifications/send-to-all-users', {
        title: 'Broadcast Notification',
        body: 'This is a broadcast notification to all users',
      }, true, adminToken);
      if (printResult('Send Notification to All Users', sendNotifAllUsersResult)) passed++;
      else failed++;
      console.log('');

      // 18.3 Send Notification to All Guards
      console.log('18.3 Testing Send Notification to All Guards...');
      const sendNotifAllGuardsResult = await makeRequest('POST', '/notifications/send-to-all-guards', {
        title: 'Guard Notification',
        body: 'This is a notification to all guards',
      }, true, adminToken);
      if (printResult('Send Notification to All Guards', sendNotifAllGuardsResult)) passed++;
      else failed++;
      console.log('');
    } else {
      skipped += 3;
    }

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}TEST SUMMARY${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
    console.log(`${colors.green}✓ Passed:${colors.reset} ${passed}`);
    console.log(`${colors.red}✗ Failed:${colors.reset} ${failed}`);
    console.log(`${colors.yellow}⊘ Skipped:${colors.reset} ${skipped}`);
    console.log(`${colors.cyan}Total Tests:${colors.reset} ${passed + failed + skipped}\n`);

    if (failed === 0) {
      console.log(`${colors.green}🎉 All tests passed!${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}⚠️  Some tests failed. Check the errors above.${colors.reset}\n`);
    }

  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    console.error(error.stack);
  }
}

// Run tests
runTests();
