# ECU Library Management System

A bilingual Arabic/English university library operations platform built with React, TypeScript, Vite, Tailwind CSS and Supabase.

## What the system covers

- Catalog and copy inventory management
- Student/member records and borrowing history
- Checkout and return workflows
- Availability tracking and overdue detection
- Reservations / holds with waiting, ready, fulfilled, cancelled and expired states
- Fine/payment data model
- Operational notices data model (in-app, email, SMS, WhatsApp-ready)
- Inventory audit / stock-take data model
- Staff profile and role model (admin, librarian, assistant, viewer)
- Audit-log data model
- Reports dashboard with live statistics, popular books, collection categories and CSV loan export
- Arabic RTL and English LTR UI
- Responsive desktop/tablet/mobile navigation
- Supabase Auth session handling

## Architecture

The browser application uses Supabase as the single source of truth for authentication and library data. The Node/Express entrypoint is intentionally stateless and only hosts Vite during development or the built SPA in production. It also exposes `GET /health` for hosting checks.

The old duplicated SQLite API and unrestricted SQL import endpoint were removed in v4 to avoid maintaining two databases and to remove an unsafe administrative surface.

## Local setup

### Requirements

- Node.js 20+ (Node 22 recommended)
- npm
- A Supabase project

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_PUBLIC_ANON_KEY"
PORT=3000
```

Never put a Supabase service-role key in a `VITE_` variable or commit it to GitHub.

### 3. Apply database migrations

Run these SQL files in order in the Supabase SQL Editor:

1. `migrations/001_create_schema_and_functions.sql`
2. `migrations/002_library_pro_v4.sql`
3. `migrations/003_circulation_integrity_and_security.sql`

Migration 002 adds the v4 operational schema. Migration 003 adds circulation validation, counter repair, fine/payment synchronization and baseline authenticated-user Row Level Security.

### 4. Create a staff login

Create the first staff account in Supabase Authentication. The app requires a valid Supabase Auth session.

Optionally add that user to `staff_profiles` using the Auth user UUID:

```sql
insert into staff_profiles (user_id, display_name, role)
values ('AUTH_USER_UUID', 'Chief Librarian', 'admin')
on conflict (user_id) do update
set display_name = excluded.display_name,
    role = excluded.role;
```

### 5. Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Checks and production build

```bash
npm run check
npm run start
```

`npm run check` runs TypeScript checking and a Vite production build.

## Database safeguards added in v4

New loans are rejected at the database layer when a student is inactive, has reached their borrowing limit, the title is archived/reference-only, or there are no available copies. Borrow counters are recalculated from actual active loans rather than blindly incremented/decremented, making retries safer and repairing historical counter drift.

Baseline RLS blocks anonymous table access and permits authenticated staff sessions. The `staff_profiles.role` field is present for finer-grained permissions in a later hardening pass if the university wants different database permissions for admin/librarian/assistant/viewer roles.

## Main v4 screens

- Dashboard
- Inventory
- Borrowing
- Students
- Circulation Center
- Reports & Analytics
- Settings

## Deployment

The frontend can be deployed to platforms that support a Vite SPA. If the Express server is used, run `npm run build` and start with `NODE_ENV=production npm run start`. Configure the same Supabase public environment variables on the hosting platform.

For static-only hosting, build with `npm run build` and deploy the `dist` directory. Configure SPA fallback to `index.html`.

## Security notes

- Use only the Supabase anon/public key in the frontend.
- Never expose the service-role key to the browser.
- Require staff accounts to use strong passwords and enable MFA in Supabase where appropriate.
- Review and tighten RLS role policies before a production rollout with multiple staff privilege levels.
- Keep database migrations under version control and test them on a staging Supabase project before production.
