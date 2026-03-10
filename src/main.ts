import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as os from 'os';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for Flutter app
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Enable API versioning (URI versioning: /v1/...)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global exception filter to standardize error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger/OpenAPI Configuration
  const config = new DocumentBuilder()
    .setTitle('Smart Gate API')
    .setDescription(
      'Comprehensive API documentation for Smart Gate - Digital Gatekeeper Application. This API provides endpoints for managing residents, visitors, staff, parking, maintenance, marketplace, and more.',
    )
    .setVersion('1.0')
    .addTag('Authentication', 'User authentication and authorization endpoints')
    .addTag('Users', 'User profile management')
    .addTag('Visitors', 'Visitor management and tracking')
    .addTag('Staff', 'Staff registry and activity tracking')
    .addTag('Parking', 'Parking slot management and applications')
    .addTag('Maintenance', 'Maintenance fee and payment management')
    .addTag('Amenities', 'Amenity booking management')
    .addTag('Complaints', 'Complaint filing and management')
    .addTag('Vehicles', 'Vehicle registration and entry tracking')
    .addTag('Packages', 'Package delivery management')
    .addTag('Documents', 'Document storage and management')
    .addTag('Emergency', 'Emergency contact management')
    .addTag('Pets', 'Pet registration and management')
    .addTag('Chat', 'Community chat functionality')
    .addTag('Events', 'Event management and RSVP')
    .addTag('Marketplace', 'Marketplace listings and transactions')
    .addTag('Notifications', 'Push notification management')
    .addTag('Admin', 'Administrative endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller!
    )
    .addServer('http://localhost:5050/v1', 'Local Development Server')
    .addServer('http://192.168.1.11:5050/v1', 'Local Network Server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'Smart Gate API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  const port = process.env.PORT ?? 5050;
  await app.listen(port, '0.0.0.0');

  // Get local IP address
  const networkInterfaces = os.networkInterfaces();
  let localIp = '192.168.1.11'; // Default IP, will be detected if available
  if (networkInterfaces) {
    for (const interfaceName in networkInterfaces) {
      const addresses = networkInterfaces[interfaceName];
      if (addresses) {
        for (const address of addresses) {
          if (address.family === 'IPv4' && !address.internal) {
            localIp = address.address;
            break;
          }
        }
        if (localIp !== '192.168.1.11') break;
      }
    }
  }

  console.log(`\n🚀 Application is running on:`);
  console.log(`  - http://localhost:${port}`);
  console.log(`  - http://${localIp}:${port}`);
  console.log(`\n📚 Swagger API Documentation available at:`);
  console.log(`  - http://localhost:${port}/api`);
  console.log(`  - http://${localIp}:${port}/api`);
}
void bootstrap();
