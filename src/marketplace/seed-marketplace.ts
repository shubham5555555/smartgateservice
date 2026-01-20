import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { MarketplaceListing, ListingCategory, ListingStatus } from '../schemas/marketplace-listing.schema';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';

const sampleProducts = [
  {
    title: 'Samsung 55" Smart TV',
    description: 'Excellent condition, used for 2 years. All accessories included. Remote control and wall mount available.',
    category: ListingCategory.ELECTRONICS,
    price: 25000,
    condition: 'Good',
    location: 'Block A, Flat 201',
    isNegotiable: true,
    images: ['https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=500'],
  },
  {
    title: 'Sofa Set (3+2)',
    description: 'Comfortable 3-seater and 2-seater sofa set. Brown color, well maintained. Moving out sale.',
    category: ListingCategory.FURNITURE,
    price: 15000,
    condition: 'Like New',
    location: 'Block B, Flat 302',
    isNegotiable: true,
    images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500'],
  },
  {
    title: 'iPhone 12 Pro',
    description: '128GB, Space Gray. Original box and charger included. Screen protector applied. Battery health 85%.',
    category: ListingCategory.ELECTRONICS,
    price: 35000,
    condition: 'Good',
    location: 'Block C, Flat 105',
    isNegotiable: false,
    images: ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500'],
  },
  {
    title: 'Washing Machine - LG 7kg',
    description: 'Fully automatic, top load. 2 years old, excellent working condition. Moving sale.',
    category: ListingCategory.APPLIANCES,
    price: 12000,
    condition: 'Good',
    location: 'Block A, Flat 401',
    isNegotiable: true,
    images: ['https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=500'],
  },
  {
    title: 'Study Table with Chair',
    description: 'Wooden study table with matching chair. Perfect for kids room. Good condition.',
    category: ListingCategory.FURNITURE,
    price: 3000,
    condition: 'Good',
    location: 'Block D, Flat 203',
    isNegotiable: true,
    images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500'],
  },
  {
    title: 'Bicycle - Hero Cycle',
    description: 'Adult bicycle, 26 inch. Good condition, recently serviced. Perfect for daily commute.',
    category: ListingCategory.VEHICLES,
    price: 2500,
    condition: 'Good',
    location: 'Block B, Flat 501',
    isNegotiable: true,
    images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500'],
  },
  {
    title: 'Books Collection - Fiction',
    description: 'Collection of 20+ fiction books including bestsellers. All in good condition.',
    category: ListingCategory.BOOKS,
    price: 2000,
    condition: 'Good',
    location: 'Block C, Flat 304',
    isNegotiable: true,
    images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500'],
  },
  {
    title: 'Dining Table (6 Seater)',
    description: 'Wooden dining table with 6 chairs. Excellent condition. Moving out sale.',
    category: ListingCategory.FURNITURE,
    price: 18000,
    condition: 'Like New',
    location: 'Block A, Flat 601',
    isNegotiable: true,
    images: ['https://images.unsplash.com/photo-1581539250439-c96689b516dd?w=500'],
  },
  {
    title: 'Gaming Console - PlayStation 4',
    description: 'PS4 with 2 controllers and 5 games. Excellent condition. All cables included.',
    category: ListingCategory.ELECTRONICS,
    price: 20000,
    condition: 'Good',
    location: 'Block D, Flat 402',
    isNegotiable: true,
    images: ['https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=500'],
  },
  {
    title: 'Refrigerator - Samsung 300L',
    description: 'Double door refrigerator. 2 years old, excellent condition. Moving sale.',
    category: ListingCategory.APPLIANCES,
    price: 18000,
    condition: 'Good',
    location: 'Block B, Flat 205',
    isNegotiable: true,
    images: ['https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=500'],
  },
];

async function seedMarketplace() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const listingModel = app.get<Model<any>>(getModelToken(MarketplaceListing.name));
  const userModel = app.get<Model<any>>(getModelToken(User.name));

  try {
    // Get first user to assign as seller
    const users = await userModel.find().limit(1).exec();
    if (users.length === 0) {
      console.log('❌ No users found. Please create a user first.');
      await app.close();
      return;
    }

    const sellerId = users[0]._id;
    console.log(`✅ Using user ${sellerId} as seller for sample products`);

    // Create sample listings
    let created = 0;
    let skipped = 0;
    
    for (const product of sampleProducts) {
      const existing = await listingModel.findOne({
        title: product.title,
        userId: sellerId,
      }).exec();

      if (!existing) {
        const listing = new listingModel({
          ...product,
          userId: sellerId,
          status: ListingStatus.ACTIVE,
        });
        await listing.save();
        console.log(`✅ Created: ${product.title}`);
        created++;
      } else {
        console.log(`⏭️  Skipped (already exists): ${product.title}`);
        skipped++;
      }
    }

    console.log(`\n✅ Sample products seeded successfully!`);
    console.log(`   Created: ${created}, Skipped: ${skipped}`);
  } catch (error) {
    console.error('❌ Error seeding marketplace:', error);
  } finally {
    await app.close();
  }
}

seedMarketplace();
