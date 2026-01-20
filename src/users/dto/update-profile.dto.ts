import { IsOptional, IsString, IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../schemas/user.schema';

export class UpdateProfileDto {
  @ApiProperty({ 
    description: 'Full name of the user',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ 
    description: 'Email address',
    example: 'john.doe@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ 
    description: 'URL to profile photo',
    example: 'https://example.com/profile.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @ApiProperty({ 
    description: 'User role',
    enum: UserRole,
    example: UserRole.OWNER,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ 
    description: 'Building block',
    example: 'Block A',
    required: false,
  })
  @IsOptional()
  @IsString()
  block?: string;

  @ApiProperty({ 
    description: 'Flat number',
    example: '101',
    required: false,
  })
  @IsOptional()
  @IsString()
  flat?: string;

  @ApiProperty({ 
    description: 'Residential address',
    example: '123 Main Street',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ 
    description: 'Emergency contact name',
    example: 'Jane Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  emergencyContact?: string;
}
