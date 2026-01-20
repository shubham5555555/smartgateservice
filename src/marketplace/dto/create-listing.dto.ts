import { IsString, IsNumber, IsEnum, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ListingCategory, ListingStatus } from '../../schemas/marketplace-listing.schema';

export class CreateListingDto {
  @ApiProperty({ 
    description: 'Listing title',
    example: 'Samsung 55" Smart TV',
    required: true,
  })
  @IsString()
  title: string;

  @ApiProperty({ 
    description: 'Detailed description of the item',
    example: 'Excellent condition, used for 2 years. All accessories included.',
    required: true,
  })
  @IsString()
  description: string;

  @ApiProperty({ 
    description: 'Product category',
    enum: ListingCategory,
    example: ListingCategory.ELECTRONICS,
    required: true,
  })
  @IsEnum(ListingCategory)
  category: ListingCategory;

  @ApiProperty({ 
    description: 'Price in INR',
    example: 25000,
    required: true,
  })
  @IsNumber()
  price: number;

  @ApiProperty({ 
    description: 'Array of image URLs',
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiProperty({ 
    description: 'Item condition',
    example: 'Good',
    required: false,
  })
  @IsString()
  @IsOptional()
  condition?: string;

  @ApiProperty({ 
    description: 'Pickup location',
    example: 'Block A, Flat 201',
    required: false,
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ 
    description: 'Whether price is negotiable',
    example: true,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isNegotiable?: boolean;

  @ApiProperty({ 
    description: 'Contact phone number',
    example: '9876543210',
    required: false,
  })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiProperty({ 
    description: 'Contact email address',
    example: 'seller@example.com',
    required: false,
  })
  @IsString()
  @IsOptional()
  contactEmail?: string;
}
