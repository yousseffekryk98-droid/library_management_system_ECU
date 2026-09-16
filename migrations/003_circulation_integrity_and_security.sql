-- Library Pro v4: circulation integrity + baseline Supabase RLS security
-- Run after 001 and 002.

-- Make the legacy increment/decrement RPCs idempotent by recalculating the
-- real number of active loans. This prevents counter drift on retries.
CREATE OR REPLACE FUNCTION increment_book_borrows(book_id_in BIGINT)
RETURNS VOID AS $$
BEGIN
  PERFORM recalculate_book_borrows(book_id_in);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION decrement_book_borrows(book_id_in BIGINT)
RETURNS VOID AS $$
BEGIN
  PERFORM recalculate_book_borrows(book_id_in);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Validate every checkout even if a client bypasses the normal UI.
CREATE OR REPLACE FUNCTION validate_new_loan()
RETURNS TRIGGER AS $$
DECLARE
  member_status TEXT;
  member_limit INTEGER;
  member_active INTEGER;
  total_copies INTEGER;
  active_copies INTEGER;
  archived BOOLEAN;
  reference_only BOOLEAN;
BEGIN
  SELECT status, borrow_limit
    INTO member_status, member_limit
  FROM students
  WHERE student_id = NEW.student_id;

  IF member_status IS NULL THEN
    RAISE EXCEPTION 'Student % does not exist', NEW.student_id;
  END IF;

  IF member_status <> 'active' THEN
    RAISE EXCEPTION 'Student % is not active', NEW.student_id;
  END IF;

  SELECT COUNT(*)::INTEGER
    INTO member_active
  FROM borrowing
  WHERE student_id = NEW.student_id AND return_date IS NULL;

  IF member_active >= COALESCE(member_limit, 3) THEN
    RAISE EXCEPTION 'Student % has reached the borrowing limit', NEW.student_id;
  END IF;

  SELECT quantity, COALESCE(current_borrows, 0), COALESCE(is_archived, FALSE), COALESCE(is_reference_only, FALSE)
    INTO total_copies, active_copies, archived, reference_only
  FROM books
  WHERE id = NEW.book_id
  FOR UPDATE;

  IF total_copies IS NULL THEN
    RAISE EXCEPTION 'Book % does not exist', NEW.book_id;
  END IF;

  IF archived THEN
    RAISE EXCEPTION 'Archived books cannot be borrowed';
  END IF;

  IF reference_only THEN
    RAISE EXCEPTION 'Reference-only books cannot be borrowed';
  END IF;

  IF COALESCE(total_copies, 0) - COALESCE(active_copies, 0) <= 0 THEN
    RAISE EXCEPTION 'No available copies remain';
  END IF;

  IF NEW.borrow_date IS NULL THEN NEW.borrow_date = now(); END IF;
  IF NEW.expected_return_date IS NULL THEN
    NEW.expected_return_date = now() + interval '14 days';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_new_loan ON borrowing;
CREATE TRIGGER trg_validate_new_loan
BEFORE INSERT ON borrowing
FOR EACH ROW EXECUTE FUNCTION validate_new_loan();

-- Keep counters correct even when a loan is changed outside the React app.
CREATE OR REPLACE FUNCTION sync_book_borrow_count_after_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.book_id IS NOT NULL THEN PERFORM recalculate_book_borrows(OLD.book_id); END IF;
    RETURN OLD;
  END IF;

  IF NEW.book_id IS NOT NULL THEN PERFORM recalculate_book_borrows(NEW.book_id); END IF;
  IF TG_OP = 'UPDATE' AND OLD.book_id IS DISTINCT FROM NEW.book_id AND OLD.book_id IS NOT NULL THEN
    PERFORM recalculate_book_borrows(OLD.book_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_book_borrow_count ON borrowing;
CREATE TRIGGER trg_sync_book_borrow_count
AFTER INSERT OR UPDATE OF return_date, book_id OR DELETE ON borrowing
FOR EACH ROW EXECUTE FUNCTION sync_book_borrow_count_after_change();

-- Mark fine status from payment totals.
CREATE OR REPLACE FUNCTION refresh_fine_status(fine_id_in BIGINT)
RETURNS VOID AS $$
DECLARE
  fine_amount NUMERIC(12,2);
  payment_total NUMERIC(12,2);
BEGIN
  SELECT amount INTO fine_amount FROM fines WHERE id = fine_id_in;
  IF fine_amount IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO payment_total
  FROM fine_payments WHERE fine_id = fine_id_in;

  UPDATE fines
  SET paid_amount = LEAST(payment_total, fine_amount),
      status = CASE
        WHEN status = 'waived' THEN 'waived'
        WHEN payment_total <= 0 THEN 'unpaid'
        WHEN payment_total < fine_amount THEN 'partial'
        ELSE 'paid'
      END,
      paid_at = CASE WHEN payment_total >= fine_amount THEN COALESCE(paid_at, now()) ELSE NULL END
  WHERE id = fine_id_in;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION sync_fine_after_payment()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_fine_status(COALESCE(NEW.fine_id, OLD.fine_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_fine_after_payment ON fine_payments;
CREATE TRIGGER trg_sync_fine_after_payment
AFTER INSERT OR UPDATE OR DELETE ON fine_payments
FOR EACH ROW EXECUTE FUNCTION sync_fine_after_payment();

-- Baseline RLS: the application already requires Supabase Auth, so block
-- anonymous database access while preserving current functionality for staff.
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowing ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_audit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'books','students','borrowing','settings','reservations','fines','fine_payments',
    'library_notices','inventory_audits','inventory_audit_items','audit_log','staff_profiles'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_staff_access ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY authenticated_staff_access ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl
    );
  END LOOP;
END $$;

-- Views should obey the querying user's permissions instead of view-owner rights.
ALTER VIEW book_availability SET (security_invoker = true);
ALTER VIEW overdue_loans SET (security_invoker = true);
ALTER VIEW library_dashboard_stats SET (security_invoker = true);

-- Restrict helper RPC execution to logged-in users.
REVOKE ALL ON FUNCTION increment_book_borrows(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION decrement_book_borrows(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION recalculate_book_borrows(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION refresh_all_book_borrow_counts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION refresh_fine_status(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION increment_book_borrows(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_book_borrows(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_book_borrows(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_all_book_borrow_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_fine_status(BIGINT) TO authenticated;
