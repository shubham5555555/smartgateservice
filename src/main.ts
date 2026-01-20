import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for Flutter app
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  // Enable validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Swagger/OpenAPI Configuration
  const config = new DocumentBuilder()
    .setTitle('Smart Gate API')
    .setDescription('Comprehensive API documentation for Smart Gate - Digital Gatekeeper Application. This API provides endpoints for managing residents, visitors, staff, parking, maintenance, marketplace, and more.')
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
    .addServer('http://localhost:5050', 'Local Development Server')
    .addServer('http://192.168.31.166:5050', 'Local Network Server')
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
  console.log(`Application is running on:`);
  console.log(`  - http://localhost:${port}`);
  console.log(`  - http://192.168.31.166:${port}`);
  console.log(`\n📚 Swagger API Documentation available at:`);
  console.log(`  - http://localhost:${port}/api`);
  console.log(`  - http://192.168.31.166:${port}/api`);
}
bootstrap();
