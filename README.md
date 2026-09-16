# ECU Library Management System

A bilingual Arabic/English university library operations platform built with React, TypeScript, Vite, Tailwind CSS and Supabase.

## What the system covers

### Core library operations

- Catalog/title management
- Per-copy accession and barcode tracking
- Copy condition, branch, room, sector and shelf location
- Student/member records and borrowing history
- Checkout and return workflows
- Availability tracking and overdue detection
- Reservations / holds with waiting, ready, fulfilled, cancelled and expired states
- Fines, partial payments, waivers and payment records
- Lost / damaged / repair incident workflow
- Inventory audit / stocktake sessions
- Audit-log data model

### Acquisitions

- Vendor directory
- Purchase orders and order states
- Purchase-order line items
- Receiving workflow
- Automatic creation of new catalog titles when a received PO item is not yet linked to a book
- Automatic creation of physical accession copies on receiving
- EGP-based acquisition totals with shipping support

### Notifications

- In-app, email, SMS and WhatsApp-ready notice queue
- Arabic and English templates
- Due-date reminders
- Overdue notices
- Reservation-ready notices
- Manual notices
- Pending / sent / failed / read states

The repository manages the queue and templates. Actual outbound email/SMS/WhatsApp delivery requires a provider or server-side worker and should not expose provider secrets in the browser.

### Staff and security

- Supabase Auth sessions
- Staff roles: `admin`, `librarian`, `assistant`, `viewer`
- First-admin bootstrap flow
- Staff role management by Auth UUID
- Active/disabled staff profiles
- Role-aware Row Level Security
- Anonymous database access blocked
- Student accounts separated from staff accounts

### Student self-service portal

A Supabase Auth user can be linked to an ECU student ID from **Staff & Roles**. A linked student sees a separate portal rather than the staff application.

The portal includes:

- Searchable library catalog
- Live physical-copy availability and location
- Student's own active and historical loans
- Overdue visibility
- Self-service title reservations
- Reservation cancellation
- Student's own fines and balances
- Student's own notices
- Notice read state
- Account and borrowing-limit information
- Arabic and English UI

RLS ensures a linked student can only read their own private circulation/financial data.

### Reporting and UX

- Live management dashboard
- Operational statistics
- Popular books and category distribution
- CSV loan export
- Arabic RTL and English LTR
- Responsive desktop/tablet/mobile shell
- Separate responsive student portal

## Architecture

Supabase is the single source of truth for authentication and library data. The Node/Express entrypoint is stateless and only hosts Vite during development or the built SPA in production. It also exposes `GET /health` for hosting checks.

The old duplicated SQLite API, local `library.db`, unrestricted SQL import endpoint and client-visible lock PIN were removed.

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

Run these SQL files in this exact order in Supabase SQL Editor:

1. `migrations/001_create_schema_and_functions.sql`
2. `migrations/002_library_pro_v4.sql`
3. `migrations/003_circulation_integrity_and_security.sql`
4. `migrations/004_enterprise_library_operations.sql`
5. `migrations/005_patron_portal_and_role_security.sql`

What they do:

- **001**: original catalog, students, borrowing and settings foundation.
- **002**: reservations, fines/payments, notices, stocktake tables, audit log, staff profiles, richer catalog/member fields and reporting views.
- **003**: database-level checkout validation, safe borrow-counter synchronization, fine/payment synchronization and initial RLS.
- **004**: physical-copy/accession tracking, vendors/acquisitions, receiving, lost/damaged incidents, notification templates, patron-account mapping, reading lists and staff bootstrap helpers.
- **005**: role-aware core RLS and student self-service functions/views.

Test migrations on a staging Supabase project before applying them to production.

### 4. Create the first administrator

Create the first staff user in **Supabase Authentication** and sign into the app.

If `staff_profiles` is empty, **Staff & Roles** shows the one-time **Make me admin** bootstrap control. It inserts the currently authenticated Auth user as the first library administrator.

After that, administrators can create additional users in Supabase Auth and assign their UUIDs to roles from **Staff & Roles**.

### 5. Create a student portal login

1. Ensure the student exists in the application's `students` table.
2. Create the student's user account in Supabase Authentication.
3. Open **Staff & Roles**.
4. Under **Link student portal account**, paste the Auth user UUID and ECU student ID.
5. When that student signs in, the app automatically loads the student portal instead of the staff dashboard.

Do not add a student Auth user to `staff_profiles` unless that person is genuinely authorized as library staff.

### 6. Run

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

GitHub Actions also runs `npm ci`, TypeScript checking and the production build on pushes and pull requests.

## Database safeguards

New loans are rejected at the database layer when a student is inactive, has reached the borrowing limit, the title is archived/reference-only, or there are no available copies. Borrow counters are recalculated from actual active loans rather than blindly incremented/decremented.

Role-aware RLS separates staff and patrons. Students can browse the catalog and access their own member/loan/reservation/fine/notice data, but operational writes remain staff-controlled. Student reservations and notice read-state changes use restricted RPCs rather than broad table-write permission.

The first-admin bootstrap only works while no staff profile exists. After that, staff changes require authorized staff RPCs.

## Main staff screens

- Dashboard
- Inventory / catalog
- Copies & Stocktake
- Borrowing
- Students
- Circulation Center
- Fines & Payments
- Acquisitions & Vendors
- Notification Center
- Reports & Analytics
- Staff & Roles
- Settings

## Student portal screens

- Catalog
- My Loans
- Reservations
- Fines
- Notices
- Account

## Deployment

The frontend can be deployed to platforms that support a Vite SPA. If the Express server is used, run:

```bash
npm run build
NODE_ENV=production npm run start
```

Configure the same Supabase public environment variables on the hosting platform.

For static-only hosting, build with `npm run build` and deploy `dist`. Configure SPA fallback to `index.html`.

## Production security notes

- Use only the Supabase anon/public key in the frontend.
- Never expose the service-role key in browser code.
- Enable MFA for privileged staff where appropriate.
- Create Auth users through trusted administrative processes; the browser app intentionally does not hold service-role credentials.
- Outbound email/SMS/WhatsApp delivery should run server-side or through a trusted provider integration.
- Review Supabase Auth email-confirmation, password, MFA and session policies before launch.
- Keep migrations under version control and test restoration/backup procedures.
- Review open dependency-security issues before production rollout.
