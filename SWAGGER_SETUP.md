# Swagger API Documentation Setup

## Overview

Swagger/OpenAPI documentation has been set up for the Smart Gate API. The documentation is automatically generated from your NestJS controllers and DTOs.

## Accessing Swagger UI

Once the backend server is running, access the Swagger documentation at:

- **Local**: http://localhost:5050/api
- **Network**: http://192.168.31.166:5050/api

## Features

### ✅ Implemented

1. **Swagger Configuration** (`src/main.ts`)
   - API title, description, and version
   - JWT Bearer authentication support
   - Multiple server configurations
   - Custom Swagger UI styling
   - Tag-based organization

2. **Documented Controllers**
   - ✅ Authentication (`/auth`)
   - ✅ Users (`/users`)
   - ✅ Vehicles (`/vehicles`)
   - ✅ Marketplace (`/marketplace`)
   - ✅ Admin (`/admin`)

3. **Documented DTOs**
   - ✅ LoginDto
   - ✅ VerifyOtpDto
   - ✅ UpdateProfileDto
   - ✅ CreateVehicleDto
   - ✅ CreateListingDto

### 🔄 To Be Documented

The following controllers still need Swagger decorators:

- Visitors (`/visitors`)
- Staff (`/staff`)
- Parking (`/parking`)
- Maintenance (`/maintenance`)
- Amenities (`/amenities`)
- Complaints (`/complaints`)
- Packages (`/packages`)
- Documents (`/documents`)
- Emergency (`/emergency`)
- Pets (`/pets`)
- Chat (`/chat`)
- Events (`/events`)
- Notifications (`/notifications`)
- Marketplace Chat (`/marketplace/chat`)

## Using Swagger UI

### 1. Authentication

1. Click the **"Authorize"** button at the top right
2. For user endpoints:
   - First, call `/auth/send-otp` with your phone number
   - Check backend console for OTP
   - Call `/auth/verify-otp` to get JWT token
   - Enter token in the format: `Bearer <your-token>`
3. For admin endpoints:
   - Call `/admin/auth/login` with admin credentials
   - Enter the returned token in the format: `Bearer <admin-token>`
4. Click **"Authorize"** to save the token

### 2. Testing Endpoints

1. Navigate to any endpoint in the Swagger UI
2. Click **"Try it out"**
3. Fill in the required parameters
4. Click **"Execute"**
5. View the response below

### 3. Response Examples

All endpoints include example responses showing:
- Success responses (200, 201)
- Error responses (400, 401, 404, etc.)
- Response schemas

## Adding Swagger to New Controllers

### Step 1: Add Tags and Bearer Auth

```typescript
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('YourModule')
@ApiBearerAuth('JWT-auth')
@Controller('your-endpoint')
@UseGuards(JwtAuthGuard)
export class YourController {
  // ...
}
```

### Step 2: Document Endpoints

```typescript
import { ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';

@Get(':id')
@ApiOperation({ 
  summary: 'Get item by ID',
  description: 'Detailed description of what this endpoint does',
})
@ApiParam({ name: 'id', description: 'Item ID' })
@ApiResponse({ 
  status: 200, 
  description: 'Item retrieved successfully',
})
@ApiResponse({ 
  status: 404, 
  description: 'Item not found',
})
async getItem(@Param('id') id: string) {
  // ...
}
```

### Step 3: Document DTOs

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreateItemDto {
  @ApiProperty({ 
    description: 'Item name',
    example: 'Example Item',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ 
    description: 'Item description',
    example: 'This is an example item',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
```

## Swagger Decorators Reference

### Controller Decorators

- `@ApiTags('TagName')` - Groups endpoints by tag
- `@ApiBearerAuth('JWT-auth')` - Adds Bearer auth requirement

### Method Decorators

- `@ApiOperation({ summary, description })` - Describes the endpoint
- `@ApiResponse({ status, description, schema })` - Documents responses
- `@ApiParam({ name, description })` - Documents path parameters
- `@ApiQuery({ name, description, required, enum })` - Documents query parameters
- `@ApiBody({ type: DtoClass })` - Documents request body

### DTO Decorators

- `@ApiProperty({ description, example, required, enum })` - Documents properties

## Example: Complete Controller Documentation

```typescript
import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateItemDto } from './dto/create-item.dto';

@ApiTags('Items')
@ApiBearerAuth('JWT-auth')
@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  @Post()
  @ApiOperation({ 
    summary: 'Create a new item',
    description: 'Creates a new item for the authenticated user',
  })
  @ApiBody({ type: CreateItemDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Item created successfully',
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data',
  })
  async create(@Request() req, @Body() createDto: CreateItemDto) {
    // Implementation
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get item by ID',
    description: 'Retrieves detailed information about a specific item',
  })
  @ApiParam({ name: 'id', description: 'Item ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Item retrieved successfully',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Item not found',
  })
  async findOne(@Param('id') id: string) {
    // Implementation
  }
}
```

## Exporting OpenAPI Spec

You can export the OpenAPI specification as JSON:

```bash
# The spec is available at:
curl http://localhost:5050/api-json > openapi.json
```

This can be used with:
- Postman (import OpenAPI spec)
- Insomnia
- Other API clients
- Code generation tools

## Best Practices

1. **Always document**:
   - Request/response schemas
   - Error responses
   - Required vs optional fields
   - Example values

2. **Use descriptive**:
   - Operation summaries (short)
   - Operation descriptions (detailed)
   - Property descriptions

3. **Include examples**:
   - Realistic example values
   - Example responses
   - Example error messages

4. **Organize with tags**:
   - Group related endpoints
   - Use consistent tag names
   - Order tags logically

5. **Document authentication**:
   - Mark protected endpoints with `@ApiBearerAuth`
   - Explain authentication flow
   - Provide token examples

## Troubleshooting

### Swagger UI not loading
- Check if server is running
- Verify port is correct (default: 5050)
- Check browser console for errors

### Authentication not working
- Ensure token format is: `Bearer <token>`
- Check token expiration
- Verify JWT secret matches

### Missing endpoints
- Ensure controller is imported in AppModule
- Check if decorators are properly applied
- Verify route paths are correct

## Next Steps

1. Add Swagger decorators to remaining controllers
2. Document all DTOs with `@ApiProperty`
3. Add response examples
4. Export OpenAPI spec for external tools
5. Set up automated API documentation generation in CI/CD

## Resources

- [NestJS Swagger Documentation](https://docs.nestjs.com/openapi/introduction)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
