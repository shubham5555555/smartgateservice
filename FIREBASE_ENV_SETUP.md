# Firebase Environment Variables Setup ✅

## Firebase Configuration Added

The `.env` file has been updated with Firebase Admin SDK configuration from `firebase-service-account.json`.

### Firebase Environment Variables

- **FIREBASE_PROJECT_ID**: `smartgate-193ef`
- **FIREBASE_CLIENT_EMAIL**: `firebase-adminsdk-fbsvc@smartgate-193ef.iam.gserviceaccount.com`
- **FIREBASE_PRIVATE_KEY**: (Configured with proper escaped newlines)

## How It Works

The backend supports two methods for Firebase configuration:

### Method 1: Service Account File (Current - Recommended)
- Uses `firebase-service-account.json` file in the backend root
- This is the default method and is already working

### Method 2: Environment Variables (Now Available)
- Uses `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, and `FIREBASE_CLIENT_EMAIL`
- Automatically falls back to this if service account file is not found
- Useful for production deployments where files are not preferred

## Priority Order

1. **First**: Tries to load `firebase-service-account.json` file
2. **Second**: Falls back to environment variables if file not found
3. **Logs warning** if neither is available

## Verification

To verify Firebase is initialized correctly, check the backend logs when starting:

```bash
npm run start:dev
```

You should see one of these messages:
- ✅ `Firebase Admin initialized with service account file`
- ✅ `Firebase Admin initialized with environment variables`
- ⚠️ `Firebase Admin not initialized: Missing environment variables` (if both methods fail)

## All Environment Variables Configured

### Server
- `PORT=5050`
- `NODE_ENV=development`

### Database
- `MONGODB_URI=mongodb://localhost:27017/smartgate`

### Security
- `JWT_SECRET` (Update this in production!)

### Admin
- `ADMIN_EMAIL=admin@smartgate.com`
- `ADMIN_PASSWORD=admin123`

### Firebase ✅
- `FIREBASE_PROJECT_ID=smartgate-193ef`
- `FIREBASE_PRIVATE_KEY` (configured)
- `FIREBASE_CLIENT_EMAIL` (configured)

### Other
- `QR_VALIDITY_HOURS=24`

## Next Steps

1. **Update JWT_SECRET** for production:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Update MongoDB URI** if using cloud database:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smartgate
   ```

3. **Update Admin Credentials** for production:
   ```env
   ADMIN_EMAIL=your-admin@email.com
   ADMIN_PASSWORD=your-secure-password
   ```

4. **Restart the server** to apply changes:
   ```bash
   npm run start:dev
   ```

## Security Notes

- ✅ `.env` file is excluded from git
- ✅ Firebase credentials are configured
- ⚠️ Update `JWT_SECRET` before production deployment
- ⚠️ Use strong admin password in production
- ⚠️ Consider using `ADMIN_PASSWORD_HASHED` instead of plain password

## Testing

Test Firebase notifications:
```bash
node test-all-apis.js
```

The notification endpoints should work correctly with Firebase configured.
