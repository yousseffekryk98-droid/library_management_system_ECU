-- Migration: create core tables and helper functions for Library Management

-- Books table
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
  quantity INTEGER DEFAULT 1,
  sector TEXT,
  shelf_number TEXT,
  current_borrows INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  student_id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  college_name TEXT,
  faculty_name TEXT,
  academic_year TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Borrowing records
CREATE TABLE IF NOT EXISTS borrowing (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id BIGINT REFERENCES books(id) ON DELETE SET NULL,
  book_title TEXT,
  student_id TEXT,
  student_name TEXT,
  college_name TEXT,
  faculty_name TEXT,
  academic_year TEXT,
  borrow_date TIMESTAMPTZ,
  expected_return_date TIMESTAMPTZ,
  return_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_borrowing_student_id ON borrowing(student_id);
CREATE INDEX IF NOT EXISTS idx_borrowing_book_id ON borrowing(book_id);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Helper RPCs to increment/decrement book current_borrows
-- Increment
CREATE OR REPLACE FUNCTION increment_book_borrows(book_id_in BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE books SET current_borrows = COALESCE(current_borrows, 0) + 1 WHERE id = book_id_in;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement (never below zero)
CREATE OR REPLACE FUNCTION decrement_book_borrows(book_id_in BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE books SET current_borrows = GREATEST(COALESCE(current_borrows, 0) - 1, 0) WHERE id = book_id_in;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed a default setting (optional)
INSERT INTO settings (key, value)
VALUES ('current_dr', 'Chief Librarian')
ON CONFLICT (key) DO NOTHING;

-- End of migration
