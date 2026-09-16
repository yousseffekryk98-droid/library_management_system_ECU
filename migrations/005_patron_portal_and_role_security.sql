-- ECU Library Pro v4.2: patron self-service + role-aware RLS
-- Run after migrations 001 -> 004.

-- ============================================================
-- 1. Staff/patron helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION current_patron_student_id()
RETURNS TEXT AS $$
  SELECT student_id FROM patron_accounts WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION is_library_staff()
RETURNS BOOLEAN AS $$
  SELECT current_library_role() IN ('bootstrap','admin','librarian','assistant','viewer');
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION can_library_write()
RETURNS BOOLEAN AS $$
  SELECT current_library_role() IN ('bootstrap','admin','librarian','assistant');
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION current_patron_student_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION is_library_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION can_library_write() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_patron_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_library_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION can_library_write() TO authenticated;

-- Staff links an already-created Supabase Auth user to a student record.
CREATE OR REPLACE FUNCTION link_patron_account(user_id_in UUID, student_id_in TEXT, language_in TEXT DEFAULT 'ar')
RETURNS VOID AS $$
BEGIN
  IF current_library_role() NOT IN ('bootstrap','admin','librarian') THEN RAISE EXCEPTION 'Admin or librarian role required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE student_id = student_id_in) THEN RAISE EXCEPTION 'Student not found'; END IF;
  IF language_in NOT IN ('ar','en') THEN RAISE EXCEPTION 'Invalid language'; END IF;
  INSERT INTO patron_accounts(user_id, student_id, preferred_language)
  VALUES(user_id_in, student_id_in, language_in)
  ON CONFLICT (user_id) DO UPDATE SET student_id = EXCLUDED.student_id, preferred_language = EXCLUDED.preferred_language, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION link_patron_account(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION link_patron_account(UUID,TEXT,TEXT) TO authenticated;

-- ============================================================
-- 2. Replace broad authenticated policies on core tables
-- ============================================================
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'books','students','borrowing','settings','reservations','fines','fine_payments',
    'library_notices','inventory_audits','inventory_audit_items','audit_log'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_staff_access ON %I', tbl);
  END LOOP;
END $$;

-- Books: staff can manage, patrons can browse catalog.
DROP POLICY IF EXISTS books_read ON books;
DROP POLICY IF EXISTS books_write ON books;
CREATE POLICY books_read ON books FOR SELECT TO authenticated
USING (is_library_staff() OR current_patron_student_id() IS NOT NULL);
CREATE POLICY books_write ON books FOR ALL TO authenticated
USING (can_library_write()) WITH CHECK (can_library_write());

-- Physical copies: patrons can see availability/location but never mutate it.
DROP POLICY IF EXISTS library_staff_read ON book_copies;
DROP POLICY IF EXISTS library_staff_write ON book_copies;
DROP POLICY IF EXISTS book_copies_read ON book_copies;
DROP POLICY IF EXISTS book_copies_write ON book_copies;
CREATE POLICY book_copies_read ON book_copies FOR SELECT TO authenticated
USING (is_library_staff() OR current_patron_student_id() IS NOT NULL);
CREATE POLICY book_copies_write ON book_copies FOR ALL TO authenticated
USING (can_library_write()) WITH CHECK (can_library_write());

-- Students: patrons only see their own member record.
DROP POLICY IF EXISTS students_read ON students;
DROP POLICY IF EXISTS students_write ON students;
CREATE POLICY students_read ON students FOR SELECT TO authenticated
USING (is_library_staff() OR student_id = current_patron_student_id());
CREATE POLICY students_write ON students FOR ALL TO authenticated
USING (can_library_write()) WITH CHECK (can_library_write());

-- Loans: patrons only see their own history; circulation remains staff-only.
DROP POLICY IF EXISTS borrowing_read ON borrowing;
DROP POLICY IF EXISTS borrowing_write ON borrowing;
CREATE POLICY borrowing_read ON borrowing FOR SELECT TO authenticated
USING (is_library_staff() OR student_id = current_patron_student_id());
CREATE POLICY borrowing_write ON borrowing FOR ALL TO authenticated
USING (can_library_write()) WITH CHECK (can_library_write());

-- Settings: authenticated users can read library settings; staff writes.
DROP POLICY IF EXISTS settings_read ON settings;
DROP POLICY IF EXISTS settings_write ON settings;
CREATE POLICY settings_read ON settings FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY settings_write ON settings FOR ALL TO authenticated USING (can_library_write()) WITH CHECK (can_library_write());

-- Reservations: patrons see their own rows. Mutations go through controlled RPCs below.
DROP POLICY IF EXISTS reservations_read ON reservations;
DROP POLICY IF EXISTS reservations_write ON reservations;
CREATE POLICY reservations_read ON reservations FOR SELECT TO authenticated
USING (is_library_staff() OR student_id = current_patron_student_id());
CREATE POLICY reservations_write ON reservations FOR ALL TO authenticated
USING (can_library_write()) WITH CHECK (can_library_write());

-- Fines and payments: patrons see only their own financial history.
DROP POLICY IF EXISTS fines_read ON fines;
DROP POLICY IF EXISTS fines_write ON fines;
CREATE POLICY fines_read ON fines FOR SELECT TO authenticated
USING (is_library_staff() OR student_id = current_patron_student_id());
CREATE POLICY fines_write ON fines FOR ALL TO authenticated
USING (can_library_write()) WITH CHECK (can_library_write());

DROP POLICY IF EXISTS fine_payments_read ON fine_payments;
DROP POLICY IF EXISTS fine_payments_write ON fine_payments;
CREATE POLICY fine_payments_read ON fine_payments FOR SELECT TO authenticated
USING (
  is_library_staff()
  OR EXISTS (SELECT 1 FROM fines f WHERE f.id = fine_id AND f.student_id = current_patron_student_id())
);
CREATE POLICY fine_payments_write ON fine_payments FOR ALL TO authenticated
USING (can_library_write()) WITH CHECK (can_library_write());

-- Notices: patrons can read their own notices, staff owns queue mutation.
DROP POLICY IF EXISTS library_notices_read ON library_notices;
DROP POLICY IF EXISTS library_notices_write ON library_notices;
CREATE POLICY library_notices_read ON library_notices FOR SELECT TO authenticated
USING (is_library_staff() OR student_id = current_patron_student_id());
CREATE POLICY library_notices_write ON library_notices FOR ALL TO authenticated
USING (can_library_write()) WITH CHECK (can_library_write());

-- Stocktake and audit trail are internal staff data.
DROP POLICY IF EXISTS inventory_audits_staff ON inventory_audits;
CREATE POLICY inventory_audits_staff ON inventory_audits FOR ALL TO authenticated
USING (is_library_staff()) WITH CHECK (can_library_write());
DROP POLICY IF EXISTS inventory_audit_items_staff ON inventory_audit_items;
CREATE POLICY inventory_audit_items_staff ON inventory_audit_items FOR ALL TO authenticated
USING (is_library_staff()) WITH CHECK (can_library_write());
DROP POLICY IF EXISTS audit_log_staff ON audit_log;
CREATE POLICY audit_log_staff ON audit_log FOR SELECT TO authenticated
USING (current_library_role() IN ('bootstrap','admin','librarian'));

-- Vendors/acquisitions/incidents/templates were created in 004; viewers stay read-only.
-- Their 004 policies already distinguish read vs write using current_library_role().

-- ============================================================
-- 3. Patron self-service RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION create_my_reservation(book_id_in BIGINT)
RETURNS BIGINT AS $$
DECLARE
  sid TEXT;
  reservation_id BIGINT;
  next_pos INTEGER;
BEGIN
  sid := current_patron_student_id();
  IF sid IS NULL THEN RAISE EXCEPTION 'Patron account not linked'; END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE student_id = sid AND status = 'active') THEN RAISE EXCEPTION 'Member is not active'; END IF;
  IF NOT EXISTS (SELECT 1 FROM books WHERE id = book_id_in AND COALESCE(is_archived,FALSE) = FALSE) THEN RAISE EXCEPTION 'Book not found'; END IF;
  IF EXISTS (SELECT 1 FROM reservations WHERE book_id = book_id_in AND student_id = sid AND status IN ('waiting','ready')) THEN RAISE EXCEPTION 'Active reservation already exists'; END IF;
  SELECT COALESCE(MAX(queue_position),0) + 1 INTO next_pos FROM reservations WHERE book_id = book_id_in AND status IN ('waiting','ready');
  INSERT INTO reservations(book_id, student_id, status, queue_position)
  VALUES(book_id_in, sid, 'waiting', next_pos)
  RETURNING id INTO reservation_id;
  RETURN reservation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION cancel_my_reservation(reservation_id_in BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE reservations
  SET status = 'cancelled', updated_at = now()
  WHERE id = reservation_id_in
    AND student_id = current_patron_student_id()
    AND status IN ('waiting','ready');
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation cannot be cancelled'; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION mark_my_notice_read(notice_id_in BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE library_notices
  SET status = 'read'
  WHERE id = notice_id_in
    AND student_id = current_patron_student_id()
    AND status IN ('sent','read');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION create_my_reservation(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION cancel_my_reservation(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mark_my_notice_read(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_my_reservation(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_my_reservation(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_my_notice_read(BIGINT) TO authenticated;

-- ============================================================
-- 4. Patron-safe views
-- ============================================================
CREATE OR REPLACE VIEW patron_catalog AS
SELECT
  b.id,
  b.title,
  b.author,
  b.publisher,
  b.isbn,
  b.category,
  b.language,
  b.publication_year,
  b.edition_number,
  b.classification_number,
  b.is_reference_only,
  COUNT(bc.id) FILTER (WHERE bc.status <> 'withdrawn') AS total_tracked_copies,
  COUNT(bc.id) FILTER (WHERE bc.status = 'available') AS available_copies,
  MIN(NULLIF(trim(concat_ws(' / ', bc.branch, bc.room, bc.sector, bc.shelf_number)), '')) AS location
FROM books b
LEFT JOIN book_copies bc ON bc.book_id = b.id
WHERE COALESCE(b.is_archived,FALSE) = FALSE
GROUP BY b.id;
ALTER VIEW patron_catalog SET (security_invoker = true);

CREATE OR REPLACE VIEW patron_my_account_summary AS
SELECT
  s.student_id,
  s.student_name,
  s.email,
  s.phone,
  s.faculty_name,
  s.department,
  s.academic_year,
  s.status,
  s.borrow_limit,
  (SELECT COUNT(*) FROM borrowing br WHERE br.student_id = s.student_id AND br.return_date IS NULL) AS active_loans,
  (SELECT COUNT(*) FROM reservations r WHERE r.student_id = s.student_id AND r.status IN ('waiting','ready')) AS active_reservations,
  (SELECT COALESCE(SUM(f.amount - f.paid_amount),0) FROM fines f WHERE f.student_id = s.student_id AND f.status IN ('unpaid','partial')) AS outstanding_fines
FROM students s
WHERE s.student_id = current_patron_student_id();
ALTER VIEW patron_my_account_summary SET (security_invoker = true);
