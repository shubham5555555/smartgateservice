# Environment Variables Setup Guide

This guide explains how to set up environment variables for the Smart Gate backend.

## Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` file with your actual values

3. Restart the backend server

## Environment Variables

### Required Variables

#### Server Configuration
- `PORT` - Server port (default: 5050)
- `NODE_ENV` - Environment (development/production)

#### Database Configuration
- `MONGODB_URI` - MongoDB connection string (default: mongodb://localhost:27017/smartgate)

#### Security Configuration
- `JWT_SECRET` - Secret key for JWT token signing (REQUIRED in production)

#### Admin Configuration
- `ADMIN_EMAIL` - Admin login email (default: admin@smartgate.com)
- `ADMIN_PASSWORD` - Admin login password (default: admin123)
- `ADMIN_PASSWORD_HASHED` - Optional: Hashed password using bcrypt (if set, takes precedence over ADMIN_PASSWORD)

### Optional Variables

#### Firebase Admin SDK
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_PRIVATE_KEY` - Firebase private key (with escaped newlines)
- `FIREBASE_CLIENT_EMAIL` - Firebase client email

**Note:** Firebase can also be configured using `firebase-service-account.json` file (recommended).

#### QR Code Configuration
- `QR_VALIDITY_HOURS` - QR code validity duration in hours (default: 24)

## Setup Instructions

### 1. Create .env File

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

### 2. Configure MongoDB

Update `MONGODB_URI` in `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/smartgate
```

For MongoDB Atlas (cloud):
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smartgate
```

### 3. Set JWT Secret

Generate a strong random string for JWT_SECRET:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:
```env
JWT_SECRET=your-generated-secret-key-here
```

### 4. Configure Admin Credentials

Update admin email and password:

```env
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your-secure-password
```

**For Production:** Use hashed password:

```bash
# Generate hashed password using Node.js
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-password', 10).then(hash => console.log(hash))"
```

Add to `.env`:
```env
ADMIN_PASSWORD_HASHED=$2b$10$YourHashedPasswordHere
```

### 5. Configure Firebase (Optional)

**Option 1: Using Service Account File (Recommended)**
- Place `firebase-service-account.json` in the `backend` directory
- No environment variables needed

**Option 2: Using Environment Variables**
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKeyHere\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
```

## Environment File Structure

```
backend/
├── .env                 # Your actual environment variables (not in git)
├── .env.example         # Example file (in git)
└── firebase-service-account.json  # Firebase credentials (not in git)
```

## Security Best Practices

1. **Never commit `.env` file to git** - It's already in `.gitignore`
2. **Use strong JWT_SECRET** - Generate a random 32+ character string
3. **Use hashed passwords** - Use `ADMIN_PASSWORD_HASHED` in production
4. **Rotate secrets regularly** - Change JWT_SECRET periodically
5. **Use different values for dev/prod** - Never use production secrets in development

## Production Deployment

For production deployments:

1. Set `NODE_ENV=production`
2. Use environment variables from your hosting platform (Heroku, AWS, etc.)
3. Never use default values for sensitive variables
4. Enable MongoDB authentication
5. Use strong, unique secrets

## Troubleshooting

### Environment variables not loading?

1. Make sure `.env` file exists in `backend` directory
2. Restart the server after changing `.env`
3. Check for typos in variable names
4. Ensure no extra spaces around `=` sign

### MongoDB connection issues?

1. Verify MongoDB is running: `mongod --version`
2. Check `MONGODB_URI` format
3. Test connection: `mongosh "your-connection-string"`

### JWT authentication failing?

1. Verify `JWT_SECRET` is set
2. Ensure same secret is used for signing and verification
3. Check token expiration settings

## Example .env File

```env
# Server
PORT=5050
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/smartgate

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Admin
ADMIN_EMAIL=admin@smartgate.com
ADMIN_PASSWORD=admin123

# Firebase (Optional - can use service account file instead)
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com

# QR Code
QR_VALIDITY_HOURS=24
```

## Next Steps

After setting up environment variables:

1. Install dependencies: `npm install`
2. Start the server: `npm run start:dev`
3. Test the API: `node test-all-apis.js`

For more information, see the main [README.md](../README.md).
