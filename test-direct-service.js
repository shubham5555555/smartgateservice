const mongoose = require('mongoose');

async function testDirect() {
  try {
    await mongoose.connect('mongodb://localhost:27017/smartgate');
    console.log('✅ Connected to MongoDB');
    
    const UserSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('User', UserSchema);
    
    const result = await User.find({
      $or: [
        { password: { $exists: true, $ne: null }, isApprovedByAdmin: false },
        { isProfileComplete: true, isApprovedByAdmin: false },
      ],
    })
    .select('email fullName phoneNumber role block flat flatNo building isEmailVerified isApprovedByAdmin isProfileComplete createdAt updatedAt')
    .sort({ createdAt: -1 })
    .lean()
    .exec();
    
    console.log('\n📋 Result type:', Array.isArray(result) ? 'array' : typeof result);
    console.log('📋 Result length:', Array.isArray(result) ? result.length : 'N/A');
    if (Array.isArray(result) && result.length > 0) {
      console.log('📋 First item keys:', Object.keys(result[0]));
      console.log('📋 Has emailOtp?', 'emailOtp' in result[0]);
      console.log('📋 Has fcmToken?', 'fcmToken' in result[0]);
      console.log('📋 Has __v?', '__v' in result[0]);
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDirect();
