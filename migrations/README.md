# ECU Library database migrations

These files are the complete database definition for a **brand-new empty Supabase project**. No application table, view, function or policy needs to exist before `001`.

Run the SQL files in this exact order:

1. `001_create_schema_and_functions.sql`
2. `002_library_pro_v4.sql`
3. `003_circulation_integrity_and_security.sql`
4. `004_enterprise_library_operations.sql`
5. `005_patron_portal_and_role_security.sql`
6. `006_campus_library_services.sql`
7. `007_copy_level_circulation.sql`
8. `008_verify_complete_fresh_install.sql`

`008` is a verification migration. It raises an error if a required table, view, RPC/function, important index, RLS setting or baseline application setting is missing. When it succeeds, it records the full chain in `public.library_schema_migrations`.

## Fresh Supabase setup

1. Create a new Supabase project.
2. Open **SQL Editor**.
3. Run `001` and wait for success.
4. Continue through `008`, one file at a time, in numeric order.
5. Do not create tables manually between migrations.
6. After `008` succeeds, create the first staff user in Supabase Authentication, sign into the app, and use the first-admin bootstrap in **Staff & Roles**.

## Important

- The `auth` schema and `auth.users` table are supplied by Supabase itself; the migrations reference them for staff and student portal identities.
- Never put the Supabase service-role key in frontend environment variables.
- Test the complete chain on staging before applying it to production.
- Do not run only the latest migration on an empty database. All files from `001` onward are part of the install.

GitHub Actions also runs the complete migration chain against a clean PostgreSQL 16 database with minimal Supabase Auth compatibility stubs. This catches ordering and SQL errors before merge.
