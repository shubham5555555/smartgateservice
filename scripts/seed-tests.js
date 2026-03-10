const mongoose = require('mongoose');
const { Schema } = mongoose;
require('dotenv').config({ path: '../.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartgate';

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to Mongo');

  const userSchema = new Schema({
    phoneNumber: String,
    email: String,
    password: String,
    fullName: String,
    role: String,
  }, { timestamps: true });

  const buildingSchema = new Schema({
    name: String,
    address: String,
    type: String,
    floors: Array,
    totalFlats: Number,
    availableFlats: Number,
    occupiedFlats: Number,
  }, { timestamps: true });

  const User = mongoose.model('UserSeed', userSchema);
  const Building = mongoose.model('BuildingSeed', buildingSchema);

  await User.deleteMany({});
  await Building.deleteMany({});

  const admin = await User.create({
    phoneNumber: '9000000000',
    email: 'admin@local.test',
    password: 'adminpass',
    fullName: 'Test Admin',
    role: 'Admin',
  });

  const resident = await User.create({
    phoneNumber: '9111111111',
    email: 'resident@local.test',
    password: 'residentpass',
    fullName: 'Test Resident',
    role: 'Owner',
  });

  const building = await Building.create({
    name: 'Tower A',
    address: 'Block A',
    type: 'Apartment',
    floors: [
      { floorNumber: 1, flats: [{ flatNumber: '101', status: 'available' }, { flatNumber: '102', status: 'available' }] },
    ],
    totalFlats: 2,
    availableFlats: 2,
    occupiedFlats: 0,
  });

  console.log('Seeded admin id:', admin._id.toString());
  console.log('Seeded resident id:', resident._id.toString());
  console.log('Seeded building id:', building._id.toString());

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

