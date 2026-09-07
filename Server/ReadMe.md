# PPM Chits — Simple Secure Backend (PostgreSQL)

PostgreSQL for real durability and multi-user concurrency, but kept as simple as
possible: no ORM, one main file, three total files in the whole project.

## Files

- `server.js` — the entire app (routes, security, database queries)
- `init-db.js` — run once to create the `users` table
- `.env.example` — copy to `.env` and fill in

## What makes it secure

- **bcrypt** password hashing (12 rounds)
- **JWT session token in an httpOnly cookie** — not readable by frontend JS
- **Rate limiting** on `/login` (10 attempts / 15 min / IP)
- **Account lockout** after 5 failed logins (15 min lock)
- **Generic error messages** — doesn't reveal whether an email exists
- **Helmet** headers + **CORS locked to your domain**
- **Parameterized SQL** everywhere (`$1, $2...`) — no SQL injection risk, even
  without an ORM

## Setup

### 1. Install PostgreSQL (if not already)
On Windows: download the installer from postgresql.org — it installs as a
Windows Service and starts automatically.

### 2. Create the database and a user
Open `psql` (or pgAdmin) and run:
```sql
CREATE DATABASE ppm_chits;
CREATE USER ppm_user WITH ENCRYPTED PASSWORD 'choose-a-strong-password';
GRANT ALL PRIVILEGES ON DATABASE ppm_chits TO ppm_user;
```

### 3. Install dependencies
```bash
npm install
```

### 4. Configure environment
```bash
cp .env.example .env
```
Edit `.env`:
- `DATABASE_URL` — match the DB/user/password from step 2
- `JWT_SECRET` — generate with `openssl rand -base64 64`
- `CORS_ORIGIN` — your frontend's URL
- `COOKIE_DOMAIN` — your domain
- `COOKIE_SECURE=false` for local dev over plain HTTP, `true` in production

### 5. Create the table
```bash
npm run init-db
```

### 6. Run it
```bash
npm run dev     # dev, auto-restart
npm start        # production
```

## Create your first admin

```
POST /api/auth/register
{
  "email": "admin@yourdomain.com",
  "password": "SomeStrongPassword123",
  "name": "Admin User",
  "role": "admin"
}
```

**Then lock down `/api/auth/register`** (wrap with `requireAuth` +
`requireRole("admin")`, or just comment the route out) so it isn't publicly
open once you're live.

## Backups

PostgreSQL needs an explicit dump, unlike copying a single SQLite file:

```bat
pg_dump -U ppm_user -d ppm_chits -F c -f D:\Backups\ppm_chits_%date%.dump
```

Put this in Windows Task Scheduler to run nightly, and also sync the backups
folder to an external drive or cloud storage.

## API

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | none (lock down after first admin) | Create a user |
| POST | `/api/auth/login` | none | Log in, sets the `token` cookie |
| POST | `/api/auth/logout` | none | Clears the cookie |
| GET | `/api/auth/me` | cookie | Returns the logged-in user |
| GET | `/api/health` | none | Confirms server + DB connection are alive |

Frontend calls must use `credentials: "include"` so the cookie is sent/received.
This matches the `LoginPage.jsx` built earlier — no frontend changes needed.