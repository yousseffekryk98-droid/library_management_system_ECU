-- ECU Library Pro v4.4: copy-level circulation
-- Run after migrations 001 -> 006.

-- Ensure a physical copy cannot be active on two loans at once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_loan_per_copy
  ON borrowing(copy_id)
  WHERE copy_id IS NOT NULL AND return_date IS NULL;

-- Keep physical-copy status synchronized even if a staff client edits borrowing directly.
CREATE OR REPLACE FUNCTION sync_copy_status_after_loan_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.copy_id IS NOT NULL THEN
      UPDATE book_copies
      SET status = CASE WHEN status = 'loaned' THEN 'available' ELSE status END,
          updated_at = now()
      WHERE id = OLD.copy_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.copy_id IS NOT NULL THEN
      UPDATE book_copies SET status = 'loaned', updated_at = now() WHERE id = NEW.copy_id;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.copy_id IS DISTINCT FROM NEW.copy_id AND OLD.copy_id IS NOT NULL THEN
    UPDATE book_copies
    SET status = CASE WHEN status = 'loaned' THEN 'available' ELSE status END,
        updated_at = now()
    WHERE id = OLD.copy_id;
  END IF;

  IF NEW.copy_id IS NOT NULL THEN
    UPDATE book_copies
    SET status = CASE
      WHEN NEW.return_date IS NULL THEN 'loaned'
      WHEN status = 'loaned' THEN 'available'
      ELSE status
    END,
    updated_at = now()
    WHERE id = NEW.copy_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_copy_status_after_loan_change ON borrowing;
CREATE TRIGGER trg_sync_copy_status_after_loan_change
AFTER INSERT OR UPDATE OF copy_id, return_date OR DELETE ON borrowing
FOR EACH ROW EXECUTE FUNCTION sync_copy_status_after_loan_change();

-- Transactional staff checkout by physical accession/barcode.
CREATE OR REPLACE FUNCTION checkout_library_copy(
  copy_id_in BIGINT,
  student_id_in TEXT,
  student_name_in TEXT,
  college_name_in TEXT DEFAULT NULL,
  faculty_name_in TEXT DEFAULT NULL,
  academic_year_in TEXT DEFAULT NULL,
  duration_days_in INTEGER DEFAULT 14,
  note_in TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  copy_row RECORD;
  loan_id BIGINT;
  max_days INTEGER;
BEGIN
  IF current_library_role() NOT IN ('bootstrap','admin','librarian','assistant') THEN
    RAISE EXCEPTION 'Staff circulation access required';
  END IF;

  IF duration_days_in < 1 OR duration_days_in > 120 THEN
    RAISE EXCEPTION 'Loan duration must be between 1 and 120 days';
  END IF;

  -- Existing UI historically creates student rows during first checkout; preserve that workflow safely.
  INSERT INTO students(student_id, student_name, college_name, faculty_name, academic_year)
  VALUES(student_id_in, student_name_in, college_name_in, faculty_name_in, academic_year_in)
  ON CONFLICT (student_id) DO UPDATE SET
    student_name = EXCLUDED.student_name,
    college_name = COALESCE(EXCLUDED.college_name, students.college_name),
    faculty_name = COALESCE(EXCLUDED.faculty_name, students.faculty_name),
    academic_year = COALESCE(EXCLUDED.academic_year, students.academic_year),
    updated_at = now();

  SELECT bc.*, b.title AS book_title, b.is_reference_only, b.is_archived
  INTO copy_row
  FROM book_copies bc
  JOIN books b ON b.id = bc.book_id
  WHERE bc.id = copy_id_in
  FOR UPDATE OF bc, b;

  IF copy_row.id IS NULL THEN RAISE EXCEPTION 'Physical copy not found'; END IF;
  IF copy_row.status <> 'available' THEN RAISE EXCEPTION 'Copy % is not available (status: %)', copy_row.accession_number, copy_row.status; END IF;
  IF copy_row.is_reference_only OR copy_row.status = 'reference' THEN RAISE EXCEPTION 'Reference-only copies cannot leave the library'; END IF;
  IF copy_row.is_archived THEN RAISE EXCEPTION 'Archived title cannot be borrowed'; END IF;

  IF EXISTS (SELECT 1 FROM borrowing WHERE copy_id = copy_id_in AND return_date IS NULL) THEN
    RAISE EXCEPTION 'Copy already has an active loan';
  END IF;

  SELECT COALESCE(NULLIF(value,''),'14')::INTEGER INTO max_days
  FROM settings WHERE key = 'default_loan_days';
  max_days := COALESCE(max_days, 14);

  INSERT INTO borrowing(
    book_id, copy_id, book_title, student_id, student_name,
    college_name, faculty_name, academic_year,
    borrow_date, expected_return_date, return_date,
    notes, issued_by
  ) VALUES (
    copy_row.book_id, copy_id_in, copy_row.book_title, student_id_in, student_name_in,
    college_name_in, faculty_name_in, academic_year_in,
    now(), now() + make_interval(days => duration_days_in), NULL,
    note_in, auth.uid()
  ) RETURNING id INTO loan_id;

  -- INSERT trigger synchronizes the copy and the existing borrowing trigger recalculates title counters.
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, metadata)
  VALUES(auth.uid(), 'checkout', 'borrowing', loan_id::TEXT,
    jsonb_build_object('copy_id', copy_id_in, 'accession_number', copy_row.accession_number, 'student_id', student_id_in));

  RETURN loan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION return_library_loan(
  borrowing_id_in BIGINT,
  condition_on_return_in TEXT DEFAULT NULL,
  note_in TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  loan_row RECORD;
  next_copy_condition TEXT;
BEGIN
  IF current_library_role() NOT IN ('bootstrap','admin','librarian','assistant') THEN
    RAISE EXCEPTION 'Staff circulation access required';
  END IF;

  SELECT * INTO loan_row
  FROM borrowing
  WHERE id = borrowing_id_in
  FOR UPDATE;

  IF loan_row.id IS NULL THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF loan_row.return_date IS NOT NULL THEN RAISE EXCEPTION 'Loan is already returned'; END IF;

  UPDATE borrowing
  SET return_date = now(),
      condition_on_return = condition_on_return_in,
      returned_to = auth.uid(),
      notes = CASE
        WHEN note_in IS NULL OR trim(note_in) = '' THEN notes
        WHEN notes IS NULL OR trim(notes) = '' THEN note_in
        ELSE notes || E'\nReturn: ' || note_in
      END
  WHERE id = borrowing_id_in;

  IF loan_row.copy_id IS NOT NULL AND condition_on_return_in IS NOT NULL THEN
    next_copy_condition := CASE lower(condition_on_return_in)
      WHEN 'new' THEN 'new'
      WHEN 'good' THEN 'good'
      WHEN 'fair' THEN 'fair'
      WHEN 'poor' THEN 'poor'
      WHEN 'damaged' THEN 'damaged'
      ELSE NULL
    END;

    IF next_copy_condition IS NOT NULL THEN
      UPDATE book_copies
      SET condition = next_copy_condition,
          status = CASE WHEN next_copy_condition = 'damaged' THEN 'damaged' ELSE status END,
          updated_at = now()
      WHERE id = loan_row.copy_id;
    END IF;
  END IF;

  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, metadata)
  VALUES(auth.uid(), 'return', 'borrowing', borrowing_id_in::TEXT,
    jsonb_build_object('copy_id', loan_row.copy_id, 'student_id', loan_row.student_id, 'condition', condition_on_return_in));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Simple barcode/accession resolver for scanner-oriented circulation UI.
CREATE OR REPLACE FUNCTION resolve_available_copy(scan_in TEXT)
RETURNS TABLE(copy_id BIGINT, book_id BIGINT, accession_number TEXT, barcode TEXT, title TEXT, author TEXT, location TEXT) AS $$
BEGIN
  IF NOT is_library_staff() THEN RAISE EXCEPTION 'Staff access required'; END IF;
  RETURN QUERY
  SELECT bc.id, bc.book_id, bc.accession_number, bc.barcode, b.title, b.author,
         NULLIF(trim(concat_ws(' / ', COALESCE(lb.name, bc.branch), bc.room, bc.sector, bc.shelf_number)), '')
  FROM book_copies bc
  JOIN books b ON b.id = bc.book_id
  LEFT JOIN library_branches lb ON lb.id = bc.branch_id
  WHERE bc.status = 'available'
    AND (bc.accession_number = scan_in OR bc.barcode = scan_in OR b.isbn = scan_in)
  ORDER BY CASE WHEN bc.accession_number = scan_in OR bc.barcode = scan_in THEN 0 ELSE 1 END, bc.id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION checkout_library_copy(BIGINT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION return_library_loan(BIGINT,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION resolve_available_copy(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION checkout_library_copy(BIGINT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION return_library_loan(BIGINT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_available_copy(TEXT) TO authenticated;
