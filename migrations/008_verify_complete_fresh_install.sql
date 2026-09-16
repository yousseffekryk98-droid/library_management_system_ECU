-- ECU Library Management System
-- Migration 008: verify a COMPLETE fresh install
--
-- Run this after migrations 001 -> 007. It makes no application-data changes.
-- It raises an exception if any required table, view, function, RLS flag, or
-- baseline setting is missing. If it finishes successfully, the database has
-- the schema expected by Library Pro v4.4+.

BEGIN;

SET search_path TO public;

-- -----------------------------------------------------------------------------
-- Required tables
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  missing TEXT[];
BEGIN
  SELECT array_agg(required_name ORDER BY required_name)
  INTO missing
  FROM (
    VALUES
      ('library_schema_migrations'),
      ('books'),
      ('students'),
      ('borrowing'),
      ('settings'),
      ('reservations'),
      ('fines'),
      ('fine_payments'),
      ('library_notices'),
      ('inventory_audits'),
      ('inventory_audit_items'),
      ('audit_log'),
      ('staff_profiles'),
      ('book_copies'),
      ('vendors'),
      ('purchase_orders'),
      ('purchase_order_items'),
      ('book_incidents'),
      ('notice_templates'),
      ('patron_accounts'),
      ('reading_lists'),
      ('reading_list_items'),
      ('library_branches'),
      ('branch_transfers'),
      ('study_spaces'),
      ('space_bookings'),
      ('acquisition_requests'),
      ('digital_resources')
  ) AS required(required_name)
  WHERE to_regclass('public.' || required_name) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Fresh-install verification failed. Missing tables: %', array_to_string(missing, ', ');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Required views
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  missing TEXT[];
BEGIN
  SELECT array_agg(required_name ORDER BY required_name)
  INTO missing
  FROM (
    VALUES
      ('book_availability'),
      ('overdue_loans'),
      ('library_dashboard_stats'),
      ('copy_inventory_summary'),
      ('acquisitions_summary'),
      ('patron_catalog'),
      ('patron_my_account_summary'),
      ('study_space_schedule')
  ) AS required(required_name)
  WHERE to_regclass('public.' || required_name) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Fresh-install verification failed. Missing views: %', array_to_string(missing, ', ');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Required functions / RPCs
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regprocedure('public.set_updated_at()') IS NULL THEN missing := array_append(missing, 'set_updated_at()'); END IF;
  IF to_regprocedure('public.increment_book_borrows(bigint)') IS NULL THEN missing := array_append(missing, 'increment_book_borrows(bigint)'); END IF;
  IF to_regprocedure('public.decrement_book_borrows(bigint)') IS NULL THEN missing := array_append(missing, 'decrement_book_borrows(bigint)'); END IF;
  IF to_regprocedure('public.recalculate_book_borrows(bigint)') IS NULL THEN missing := array_append(missing, 'recalculate_book_borrows(bigint)'); END IF;
  IF to_regprocedure('public.refresh_all_book_borrow_counts()') IS NULL THEN missing := array_append(missing, 'refresh_all_book_borrow_counts()'); END IF;
  IF to_regprocedure('public.refresh_fine_status(bigint)') IS NULL THEN missing := array_append(missing, 'refresh_fine_status(bigint)'); END IF;
  IF to_regprocedure('public.current_library_role()') IS NULL THEN missing := array_append(missing, 'current_library_role()'); END IF;
  IF to_regprocedure('public.bootstrap_first_library_admin(text)') IS NULL THEN missing := array_append(missing, 'bootstrap_first_library_admin(text)'); END IF;
  IF to_regprocedure('public.upsert_staff_profile(uuid,text,text,boolean)') IS NULL THEN missing := array_append(missing, 'upsert_staff_profile(uuid,text,text,boolean)'); END IF;
  IF to_regprocedure('public.receive_purchase_order_item(bigint,integer)') IS NULL THEN missing := array_append(missing, 'receive_purchase_order_item(bigint,integer)'); END IF;
  IF to_regprocedure('public.open_copy_incident(bigint,text,text,bigint,text,numeric,boolean)') IS NULL THEN missing := array_append(missing, 'open_copy_incident(...)'); END IF;
  IF to_regprocedure('public.current_patron_student_id()') IS NULL THEN missing := array_append(missing, 'current_patron_student_id()'); END IF;
  IF to_regprocedure('public.is_library_staff()') IS NULL THEN missing := array_append(missing, 'is_library_staff()'); END IF;
  IF to_regprocedure('public.can_library_write()') IS NULL THEN missing := array_append(missing, 'can_library_write()'); END IF;
  IF to_regprocedure('public.link_patron_account(uuid,text,text)') IS NULL THEN missing := array_append(missing, 'link_patron_account(uuid,text,text)'); END IF;
  IF to_regprocedure('public.create_my_reservation(bigint)') IS NULL THEN missing := array_append(missing, 'create_my_reservation(bigint)'); END IF;
  IF to_regprocedure('public.cancel_my_reservation(bigint)') IS NULL THEN missing := array_append(missing, 'cancel_my_reservation(bigint)'); END IF;
  IF to_regprocedure('public.mark_my_notice_read(bigint)') IS NULL THEN missing := array_append(missing, 'mark_my_notice_read(bigint)'); END IF;
  IF to_regprocedure('public.book_my_study_space(bigint,timestamp with time zone,timestamp with time zone,integer,text)') IS NULL THEN missing := array_append(missing, 'book_my_study_space(...)'); END IF;
  IF to_regprocedure('public.cancel_my_space_booking(bigint)') IS NULL THEN missing := array_append(missing, 'cancel_my_space_booking(bigint)'); END IF;
  IF to_regprocedure('public.submit_my_acquisition_request(text,text,text,text,text)') IS NULL THEN missing := array_append(missing, 'submit_my_acquisition_request(...)'); END IF;
  IF to_regprocedure('public.advance_branch_transfer(bigint,text)') IS NULL THEN missing := array_append(missing, 'advance_branch_transfer(bigint,text)'); END IF;
  IF to_regprocedure('public.checkout_library_copy(bigint,text,text,text,text,text,integer,text)') IS NULL THEN missing := array_append(missing, 'checkout_library_copy(...)'); END IF;
  IF to_regprocedure('public.return_library_loan(bigint,text,text)') IS NULL THEN missing := array_append(missing, 'return_library_loan(bigint,text,text)'); END IF;
  IF to_regprocedure('public.resolve_available_copy(text)') IS NULL THEN missing := array_append(missing, 'resolve_available_copy(text)'); END IF;

  IF cardinality(missing) > 0 THEN
    RAISE EXCEPTION 'Fresh-install verification failed. Missing functions/RPCs: %', array_to_string(missing, ', ');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Required important indexes
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  missing TEXT[];
BEGIN
  SELECT array_agg(required_name ORDER BY required_name)
  INTO missing
  FROM (
    VALUES
      ('idx_one_active_hold_per_student_book'),
      ('idx_one_active_loan_per_copy'),
      ('idx_books_barcode_unique'),
      ('idx_borrowing_active_due')
  ) AS required(required_name)
  WHERE to_regclass('public.' || required_name) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Fresh-install verification failed. Missing indexes: %', array_to_string(missing, ', ');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- RLS must be enabled on all security-sensitive tables.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  missing_rls TEXT[];
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname)
  INTO missing_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname = ANY (ARRAY[
      'books','students','borrowing','settings','reservations','fines','fine_payments',
      'library_notices','inventory_audits','inventory_audit_items','audit_log','staff_profiles',
      'book_copies','vendors','purchase_orders','purchase_order_items','book_incidents','notice_templates',
      'patron_accounts','reading_lists','reading_list_items','library_branches','branch_transfers',
      'study_spaces','space_bookings','acquisition_requests','digital_resources'
    ])
    AND c.relrowsecurity = FALSE;

  IF missing_rls IS NOT NULL THEN
    RAISE EXCEPTION 'Fresh-install verification failed. RLS is not enabled on: %', array_to_string(missing_rls, ', ');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Baseline configuration values expected by application/database helpers.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  missing TEXT[];
BEGIN
  SELECT array_agg(k ORDER BY k)
  INTO missing
  FROM unnest(ARRAY[
    'library_name',
    'default_loan_days',
    'max_renewals',
    'daily_fine_egp',
    'fine_grace_days',
    'reservation_hold_hours',
    'default_branch',
    'acquisition_currency',
    'lost_book_replacement_multiplier',
    'damage_fee_max_egp',
    'due_reminder_days'
  ]) AS x(k)
  WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.key = x.k);

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Fresh-install verification failed. Missing settings: %', array_to_string(missing, ', ');
  END IF;
END $$;

-- Record the full migration chain only after every verification above succeeds.
INSERT INTO library_schema_migrations(version, description) VALUES
  ('002', 'Library Pro operational schema'),
  ('003', 'Circulation integrity and baseline security'),
  ('004', 'Enterprise copy, acquisitions, incidents, notifications and staff schema'),
  ('005', 'Patron portal and role-aware security'),
  ('006', 'Campus branches, study spaces, digital resources and acquisition requests'),
  ('007', 'Transactional physical-copy circulation'),
  ('008', 'Complete fresh-install schema verification')
ON CONFLICT (version) DO UPDATE SET description = EXCLUDED.description;

COMMIT;

-- If the query reaches here without an exception, the schema is complete.
SELECT
  'ECU Library database fresh install verified successfully' AS status,
  (SELECT COUNT(*) FROM library_schema_migrations) AS recorded_migrations,
  now() AS verified_at;
