# Clipixx Backend

Express API server for the Clipixx platform — connecting the React frontend to PostgreSQL.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: PostgreSQL (any provider — Supabase, AWS RDS, local, etc.)
- **Authentication**: Firebase Admin SDK

## Project Structure

```
backend/
├── config/
│   ├── db.js              # PostgreSQL pool (fail-fast env validation)
│   └── firebase.js        # Firebase Admin SDK initialization
├── middleware/
│   ├── auth.js            # Firebase token verification
│   ├── errorHandler.js    # Centralized JSON error handler
│   ├── rateLimiter.js     # Rate limiting (public forms + general API)
│   └── validate.js        # express-validator result checker
├── migrations/
│   ├── 001_create_stars.sql
│   ├── 002_create_profiles.sql
│   ├── 003_create_suggestions_applications.sql
│   ├── 004_create_feedback.sql
│   └── 005_add_text_search_index.sql
├── routes/
│   ├── stars.js           # GET /api/stars (paginated), GET /api/stars/:id
│   ├── suggestions.js     # POST /api/suggestions
│   ├── applications.js    # POST /api/applications
│   ├── feedback.js        # POST /api/feedback
│   └── profiles.js        # GET/POST/PUT /api/profiles
├── .env.example
├── migrate.js             # Migration runner
├── package.json
└── server.js              # Entry point
```

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description | Example |
|---|---|---|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | *(required, no default)* |
| `DB_NAME` | Database name | `clipixx` |
| `DB_POOL_MAX` | Max pool connections | `20` |
| `DB_SSL` | Enable SSL | `false` (set `true` for cloud DBs) |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `http://localhost:5173` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to Firebase service account JSON | `./config/firebase-service-account.json` |

### 3. Run Database Migrations

```bash
npm run migrate
```

Check migration status:

```bash
npm run migrate:status
```

### 4. Start the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

## API Endpoints

### Public (no auth required)

| Method | Endpoint | Description | Rate Limit |
|---|---|---|---|
| `GET` | `/api/health` | Server + DB health check | 100/15min |
| `GET` | `/api/stars` | List stars (paginated) | 100/15min |
| `GET` | `/api/stars/:id` | Get star detail | 100/15min |
| `POST` | `/api/suggestions` | Submit star suggestion | 5/15min |
| `POST` | `/api/applications` | Submit creator application | 5/15min |
| `POST` | `/api/feedback` | Submit feedback | 5/15min |

### Authenticated (Firebase token required)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/profiles/me` | Get current user's profile |
| `POST` | `/api/profiles` | Create profile |
| `PUT` | `/api/profiles/me` | Update profile |

Include the Firebase ID token as: `Authorization: Bearer <token>`

### Pagination

List endpoints accept `page` and `limit` query parameters:

```
GET /api/stars?page=1&limit=10&category=Actor&sort=rating&order=desc
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

## Security

- **Helmet** — sets secure HTTP headers
- **Rate Limiting** — 5 req/15min on public forms, 100 req/15min general
- **Input Validation** — `express-validator` on all POST/PUT endpoints
- **Parameterized Queries** — all SQL uses `$1, $2, ...` parameters (no injection risk)
- **Fail-fast Config** — server refuses to start if any required env var is missing
- **Graceful Shutdown** — closes DB pool on `SIGTERM`/`SIGINT`

## Database Portability

The database uses **standard PostgreSQL** only — no vendor-specific features. To migrate to a different PostgreSQL provider, change only the `DB_*` environment variables.
