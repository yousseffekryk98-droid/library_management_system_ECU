-- ECU Library Management System
-- Migration 001: complete fresh-database foundation
--
-- This file is intentionally self-contained for an EMPTY Supabase/PostgreSQL
-- database. Later migrations (002+) may add columns/tables with IF NOT EXISTS,
-- but they must never rely on undocumented/manual schema state.

BEGIN;

SET search_path TO public;

-- -----------------------------------------------------------------------------
-- Migration ledger
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS library_schema_migrations (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Shared updated_at helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- -----------------------------------------------------------------------------
-- Core catalog / titles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  publisher TEXT,
  classification_number TEXT,
  edition_number TEXT,
  isbn TEXT,
  category TEXT,
  condition TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  sector TEXT,
  shelf_number TEXT,
  current_borrows INTEGER NOT NULL DEFAULT 0 CHECK (current_borrows >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_title_001 ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author_001 ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_isbn_001 ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_category_001 ON books(category);
CREATE INDEX IF NOT EXISTS idx_books_location_001 ON books(sector, shelf_number);

DROP TRIGGER IF EXISTS trg_books_updated_at ON books;
CREATE TRIGGER trg_books_updated_at
BEFORE UPDATE ON books
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Members / students
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  student_id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  college_name TEXT,
  faculty_name TEXT,
  academic_year TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_name_001 ON students(student_name);
CREATE INDEX IF NOT EXISTS idx_students_faculty_001 ON students(faculty_name);
CREATE INDEX IF NOT EXISTS idx_students_academic_year_001 ON students(academic_year);

DROP TRIGGER IF EXISTS trg_students_updated_at ON students;
CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Borrowing / circulation history
-- Keep denormalized title/student fields because the existing UI/reporting uses
-- historical snapshots. book_id/student_id still reference the source records.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS borrowing (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id BIGINT REFERENCES books(id) ON DELETE SET NULL,
  book_title TEXT,
  student_id TEXT REFERENCES students(student_id) ON DELETE SET NULL,
  student_name TEXT,
  college_name TEXT,
  faculty_name TEXT,
  academic_year TEXT,
  borrow_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return_date TIMESTAMPTZ,
  return_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expected_return_date IS NULL OR expected_return_date >= borrow_date),
  CHECK (return_date IS NULL OR return_date >= borrow_date)
);

CREATE INDEX IF NOT EXISTS idx_borrowing_student_id ON borrowing(student_id);
CREATE INDEX IF NOT EXISTS idx_borrowing_book_id ON borrowing(book_id);
CREATE INDEX IF NOT EXISTS idx_borrowing_borrow_date_001 ON borrowing(borrow_date DESC);
CREATE INDEX IF NOT EXISTS idx_borrowing_active_001 ON borrowing(expected_return_date) WHERE return_date IS NULL;

DROP TRIGGER IF EXISTS trg_borrowing_updated_at ON borrowing;
CREATE TRIGGER trg_borrowing_updated_at
BEFORE UPDATE ON borrowing
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Key/value operational settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
CREATE TRIGGER trg_settings_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO settings(key, value) VALUES
  ('current_dr', 'Chief Librarian'),
  ('library_name', 'ECU Library'),
  ('default_loan_days', '14'),
  ('max_renewals', '2'),
  ('daily_fine_egp', '2'),
  ('fine_grace_days', '0'),
  ('reservation_hold_hours', '48')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Legacy-compatible helper RPCs
-- Migration 003 replaces these with count-reconciliation implementations, but
-- defining them here means the core application has no missing-function window.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_book_borrows(book_id_in BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE books
  SET current_borrows = COALESCE(current_borrows, 0) + 1
  WHERE id = book_id_in;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION decrement_book_borrows(book_id_in BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE books
  SET current_borrows = GREATEST(COALESCE(current_borrows, 0) - 1, 0)
  WHERE id = book_id_in;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- Record the migration. ON CONFLICT keeps the file safe to re-run during setup.
-- -----------------------------------------------------------------------------
INSERT INTO library_schema_migrations(version, description)
VALUES ('001', 'Fresh core schema: books, students, borrowing, settings and helpers')
ON CONFLICT (version) DO UPDATE SET description = EXCLUDED.description;

COMMIT;
