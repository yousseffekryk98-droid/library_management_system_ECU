-- Library Pro v4 expansion
-- Safe to run after 001_create_schema_and_functions.sql

-- ---------- Core catalog improvements ----------
ALTER TABLE books ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'Arabic';
ALTER TABLE books ADD COLUMN IF NOT EXISTS publication_year INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS acquisition_date DATE;
ALTER TABLE books ADD COLUMN IF NOT EXISTS acquisition_source TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS location_note TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS is_reference_only BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE books ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE books ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_books_barcode_unique
  ON books(barcode) WHERE barcode IS NOT NULL AND barcode <> '';
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
CREATE INDEX IF NOT EXISTS idx_books_location ON books(sector, shelf_number);

-- ---------- Student / member improvements ----------
ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE students ADD COLUMN IF NOT EXISTS borrow_limit INTEGER NOT NULL DEFAULT 3;
ALTER TABLE students ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_status_check'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_status_check
      CHECK (status IN ('active', 'suspended', 'graduated', 'inactive'));
  END IF;
END $$;

-- ---------- Loan lifecycle improvements ----------
ALTER TABLE borrowing ADD COLUMN IF NOT EXISTS renewed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE borrowing ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE borrowing ADD COLUMN IF NOT EXISTS condition_on_issue TEXT;
ALTER TABLE borrowing ADD COLUMN IF NOT EXISTS condition_on_return TEXT;
ALTER TABLE borrowing ADD COLUMN IF NOT EXISTS issued_by UUID;
ALTER TABLE borrowing ADD COLUMN IF NOT EXISTS returned_to UUID;
ALTER TABLE borrowing ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_borrowing_active_due
  ON borrowing(expected_return_date) WHERE return_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_borrowing_active_student
  ON borrowing(student_id) WHERE return_date IS NULL;

-- ---------- Reservations / holds ----------
CREATE TABLE IF NOT EXISTS reservations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'ready', 'fulfilled', 'cancelled', 'expired')),
  queue_position INTEGER,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reservations_book_status ON reservations(book_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_student ON reservations(student_id, reserved_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_hold_per_student_book
  ON reservations(book_id, student_id)
  WHERE status IN ('waiting', 'ready');

-- ---------- Fines and payments ----------
CREATE TABLE IF NOT EXISTS fines (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  borrowing_id BIGINT REFERENCES borrowing(id) ON DELETE SET NULL,
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'overdue'
    CHECK (type IN ('overdue', 'lost', 'damage', 'manual')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'partial', 'paid', 'waived')),
  reason TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  waived_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fines_student_status ON fines(student_id, status);

CREATE TABLE IF NOT EXISTS fine_payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fine_id BIGINT NOT NULL REFERENCES fines(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT DEFAULT 'cash',
  reference TEXT,
  received_by UUID,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Notices / operational communication ----------
CREATE TABLE IF NOT EXISTS library_notices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id TEXT REFERENCES students(student_id) ON DELETE CASCADE,
  borrowing_id BIGINT REFERENCES borrowing(id) ON DELETE CASCADE,
  reservation_id BIGINT REFERENCES reservations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'email', 'sms', 'whatsapp')),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notices_status_schedule ON library_notices(status, scheduled_for);

-- ---------- Inventory audits ----------
CREATE TABLE IF NOT EXISTS inventory_audits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  started_by UUID,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS inventory_audit_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  audit_id BIGINT NOT NULL REFERENCES inventory_audits(id) ON DELETE CASCADE,
  book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  expected_quantity INTEGER NOT NULL DEFAULT 0,
  counted_quantity INTEGER,
  condition_note TEXT,
  scanned_at TIMESTAMPTZ,
  UNIQUE(audit_id, book_id)
);

-- ---------- Audit trail ----------
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- ---------- Staff profile / role model ----------
CREATE TABLE IF NOT EXISTS staff_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'librarian'
    CHECK (role IN ('admin', 'librarian', 'assistant', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Settings defaults ----------
INSERT INTO settings(key, value) VALUES
  ('default_loan_days', '14'),
  ('max_renewals', '2'),
  ('daily_fine_egp', '2'),
  ('fine_grace_days', '0'),
  ('reservation_hold_hours', '48'),
  ('library_name', 'ECU Library')
ON CONFLICT (key) DO NOTHING;

-- ---------- updated_at helper ----------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_books_updated_at ON books;
CREATE TRIGGER trg_books_updated_at BEFORE UPDATE ON books
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_students_updated_at ON students;
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_borrowing_updated_at ON borrowing;
CREATE TRIGGER trg_borrowing_updated_at BEFORE UPDATE ON borrowing
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_reservations_updated_at ON reservations;
CREATE TRIGGER trg_reservations_updated_at BEFORE UPDATE ON reservations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_fines_updated_at ON fines;
CREATE TRIGGER trg_fines_updated_at BEFORE UPDATE ON fines
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_staff_profiles_updated_at ON staff_profiles;
CREATE TRIGGER trg_staff_profiles_updated_at BEFORE UPDATE ON staff_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- Useful views ----------
CREATE OR REPLACE VIEW book_availability AS
SELECT
  b.*,
  GREATEST(COALESCE(b.quantity, 0) - COALESCE(b.current_borrows, 0), 0) AS available_copies,
  (COALESCE(b.quantity, 0) - COALESCE(b.current_borrows, 0)) > 0 AS is_available
FROM books b
WHERE COALESCE(b.is_archived, FALSE) = FALSE;

CREATE OR REPLACE VIEW overdue_loans AS
SELECT
  br.*,
  GREATEST(FLOOR(EXTRACT(EPOCH FROM (now() - br.expected_return_date)) / 86400), 0)::INTEGER AS overdue_days
FROM borrowing br
WHERE br.return_date IS NULL
  AND br.expected_return_date IS NOT NULL
  AND br.expected_return_date < now();

CREATE OR REPLACE VIEW library_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM books WHERE COALESCE(is_archived, FALSE) = FALSE) AS titles,
  (SELECT COALESCE(SUM(quantity), 0) FROM books WHERE COALESCE(is_archived, FALSE) = FALSE) AS physical_copies,
  (SELECT COUNT(*) FROM borrowing WHERE return_date IS NULL) AS active_loans,
  (SELECT COUNT(*) FROM overdue_loans) AS overdue_loans,
  (SELECT COUNT(*) FROM reservations WHERE status IN ('waiting', 'ready')) AS active_reservations,
  (SELECT COUNT(*) FROM students WHERE status = 'active') AS active_students,
  (SELECT COALESCE(SUM(amount - paid_amount), 0) FROM fines WHERE status IN ('unpaid', 'partial')) AS outstanding_fines;

-- ---------- Operational helpers ----------
CREATE OR REPLACE FUNCTION recalculate_book_borrows(book_id_in BIGINT)
RETURNS INTEGER AS $$
DECLARE active_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO active_count
  FROM borrowing
  WHERE book_id = book_id_in AND return_date IS NULL;

  UPDATE books SET current_borrows = active_count WHERE id = book_id_in;
  RETURN active_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION refresh_all_book_borrow_counts()
RETURNS VOID AS $$
BEGIN
  UPDATE books b
  SET current_borrows = (
    SELECT COUNT(*) FROM borrowing br
    WHERE br.book_id = b.id AND br.return_date IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Repair any historical counter drift once during migration.
SELECT refresh_all_book_borrow_counts();
