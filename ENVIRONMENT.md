# Environment configuration

Environment variables for the two deployable services:

| Repo | GitHub | Env file | Loaded by |
|---|---|---|---|
| Backend (NestJS) | `shubham5555555/smartgateservice` | `backend/.env` | `@nestjs/config` `ConfigService` (also `process.env` in `scripts/`) |
| Admin dashboard (Next.js) | `shubham5555555/smartgatedash` | `admin-dashboard/.env.local` | Next.js build/runtime (`NEXT_PUBLIC_*` is baked into the browser bundle at build time) |

Both env files are git-ignored. Copy the matching `.env.example` and fill in real values. Never commit real values.

---

## 1. Backend (`backend/.env`)

### Required

| Variable | Purpose | Example | Notes |
|---|---|---|---|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/smartgate` | Production uses Atlas (`mongodb+srv://…`). Transactions are used when the server is a replica set and fall back to plain writes on a standalone server. |
| `JWT_SECRET` | Signs admin, guard and resident tokens | 64-char random hex | **No default. The API will not start without it.** Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Admin tokens expire in 24 h, resident tokens in 7 d. Changing it logs everyone out. |
| `BREVO_API_KEY` | Brevo transactional email (OTP, resident emails) | `xkeysib-…` | **No default. `EmailService` throws at boot if missing.** |
| `BREVO_SENDER_EMAIL` | From-address for Brevo mail | `noreply@yourdomain.com` | Must be a verified sender in Brevo. |
| `ADMIN_EMAIL` | Bootstrap platform admin login | `admin@smartgate.com` | On first start with an empty `adminusers` collection this account is created as **super_admin**. After that, manage admins from the dashboard (Admin Users page); the env values remain a login fallback. |
| `ADMIN_PASSWORD` | Bootstrap admin password (plain) | strong password | Hashed on save. Use `ADMIN_PASSWORD_HASHED` instead in production. |
| `ADMIN_PASSWORD_HASHED` | Bootstrap admin password (bcrypt hash) | `$2b$10$…` | Takes precedence over `ADMIN_PASSWORD` when set. |

### Redis (required in production)

| Variable | Purpose | Example | Notes |
|---|---|---|---|
| `REDIS_URL` | Cache (`CacheService`) and BullMQ image queue | `redis://127.0.0.1:6379/0` or `rediss://default:<password>@host:port` | The cache is fail-soft: if Redis is down, reads and writes are skipped and the API keeps working. The image queue (`queue.service.ts`, `image.processor.ts`) is **not** fail-soft. See the security note below about the built-in fallback. |

### Push notifications (Firebase Admin)

Either place `firebase-service-account.json` in the backend root (preferred, git-ignored), **or** set all three:

| Variable | Purpose | Example |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project | `smartgate-193ef` |
| `FIREBASE_CLIENT_EMAIL` | Service-account email | `firebase-adminsdk-…@smartgate-193ef.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | Service-account private key | `"-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"` — keep the quotes, `\n` is converted at runtime |

If neither is present, push notifications are disabled and the API logs a warning. Guard alerts (new visits, watchlist hits, overstay) depend on this.

### File uploads (AWS S3)

| Variable | Purpose | Example |
|---|---|---|
| `AWS_REGION` | Bucket region | `ap-south-1` |
| `AWS_S3_BUCKET_NAME` | Bucket for visitor photos, documents | `smartgate-uploads` |
| `AWS_ACCESS_KEY_ID` | IAM key with put/get on that bucket | `AKIA…` |
| `AWS_SECRET_ACCESS_KEY` | IAM secret | — |

When any of these is missing, `S3Service.isConfigured` is false: photo upload endpoints return 503, the gate form hides the photo step, and the guard app reports `photoUploadAvailable: false`. A site setting that requires a visitor photo cannot be satisfied without S3.

### Optional

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5050` | HTTP port. |
| `NODE_ENV` | `development` | `production` switches the logger to JSON and lowers verbosity. |
| `LOG_LEVEL` | `info` | Winston level: `error`, `warn`, `info`, `debug`. |
| `QR_VALIDITY_HOURS` | `24` | Legacy resident-visitor QR validity. Commercial passes use per-site `passValidityHours` and the visit-type catalogue instead. |
| `API_BASE` | `http://localhost:5050` | Only used by `scripts/run-integration-tests.js`. |

Present in the current `.env` but **not read by any code**: `BREVO_SMTP_HOST`, `BREVO_SMTP_PORT`, `BREVO_SMTP_USER`, `BREVO_SMTP_PASSWORD`. They can be removed; mail goes through the Brevo REST API.

CORS is `origin: true` in `main.ts` (every origin is allowed with credentials). There is no `CORS_ORIGIN` variable despite the comment in the old example file.

### Scripts

`scripts/migrate-multi-tenant.js` and `scripts/migrate-site-modes.js` read `MONGODB_URI` from the environment (default local). Run them once against production after deploying the multi-tenant / site-mode build:

```bash
cd backend && MONGODB_URI="mongodb+srv://…" node scripts/migrate-multi-tenant.js
```

```bash
cd backend && MONGODB_URI="mongodb+srv://…" node scripts/migrate-site-modes.js
```

### Local development and smoke tests

Never point local runs at the production database. Override at the command line:

```bash
cd backend && MONGODB_URI=mongodb://localhost:27017/smartgate_dev REDIS_URL=redis://127.0.0.1:6379/1 JWT_SECRET=local-dev-secret PORT=5077 pnpm start:dev
```

---

## 2. Admin dashboard (`admin-dashboard/.env.local`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | `https://api-smartgate.brahmaastra.ai/v1` | Base URL of the backend **including `/v1`**. Baked into the bundle at `next build`; rebuild after changing it. Local: `http://localhost:5050/v1`. |
| `NODE_ENV` | no | set by Next | `development` / `production`. |

Everything else the dashboard needs is fixed in code:

- **Firebase web config** (`lib/firebase/config.ts`): API key, project `smartgate-193ef`, measurement ID. Web Firebase keys are public identifiers, not secrets; restrict them by HTTP referrer in the Google Cloud console.
- **Public links** (gate QR poster, invite links, visitor pass) are built from `window.location.origin`, so the dashboard must be served from the domain visitors will open, or behind a reverse proxy that preserves the host.
- **Ports**: `pnpm dev` and `pnpm start` listen on **3001**.
- **Brand assets**: drop `logo.png` / `logo-mark.png` into `public/brand/` (see `public/brand/README.md`); no env needed.

Build and run:

```bash
cd admin-dashboard && pnpm install && pnpm build && pnpm start
```

---

## 3. Mobile apps (for completeness)

The guard app and resident app have no `.env`. The API base URL is a constant in `lib/config/api_config.dart` in each app, and Firebase is configured through the platform files (`google-services.json` / `GoogleService-Info.plist`). The resident app's Android signing keystore and `key.properties` live in `frontend/` and must never be committed (they are ignored by the root `.gitignore`).

---

## 4. Security notes (action needed)

1. **Rotate the Redis Cloud password.** `backend/src/queues/queue.service.ts` and `backend/src/queues/image.processor.ts` contain a full `redis://default:<password>@…redislabs.com` URL as the code fallback for `REDIS_URL`. That string has been on GitHub since the earlier "Replace process.env with ConfigService" commit. Rotate the password in Redis Cloud, set the new URL only in `.env`, and replace the fallback with a localhost default.
2. **Change the bootstrap admin password** before the first production start, or set `ADMIN_PASSWORD_HASHED`. The defaults in `.env.example` are placeholders.
3. **Restrict CORS** in `main.ts` to the dashboard origin(s) once the domains are final.
4. **Secrets belong only in `.env` files and the host's secret store.** Both repos ignore `.env*`; keep it that way and use the `.env.example` files as the shared template.
