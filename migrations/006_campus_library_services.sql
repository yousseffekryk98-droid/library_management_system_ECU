-- ECU Library Pro v4.3: campus library services
-- Run after migrations 001 -> 005.

-- ============================================================
-- 1. Multi-branch library structure
-- ============================================================
CREATE TABLE IF NOT EXISTS library_branches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO library_branches(code,name) VALUES ('MAIN','ECU Main Library') ON CONFLICT (code) DO NOTHING;

ALTER TABLE book_copies ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES library_branches(id) ON DELETE SET NULL;
UPDATE book_copies bc
SET branch_id = (SELECT id FROM library_branches WHERE code = 'MAIN' LIMIT 1)
WHERE bc.branch_id IS NULL;

CREATE TABLE IF NOT EXISTS branch_transfers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  copy_id BIGINT NOT NULL REFERENCES book_copies(id) ON DELETE CASCADE,
  from_branch_id BIGINT REFERENCES library_branches(id) ON DELETE SET NULL,
  to_branch_id BIGINT NOT NULL REFERENCES library_branches(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','in_transit','received','cancelled')),
  requested_by UUID,
  approved_by UUID,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_branch_transfers_status ON branch_transfers(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_branch_transfers_copy ON branch_transfers(copy_id);

-- ============================================================
-- 2. Study spaces and bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS study_spaces (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id BIGINT REFERENCES library_branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  space_type TEXT NOT NULL DEFAULT 'seat'
    CHECK (space_type IN ('seat','desk','group_room','quiet_room','lab','meeting_room')),
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  floor TEXT,
  zone TEXT,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS space_bookings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  space_id BIGINT NOT NULL REFERENCES study_spaces(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked','approved','checked_in','completed','cancelled','no_show','rejected')),
  purpose TEXT,
  attendee_count INTEGER NOT NULL DEFAULT 1 CHECK (attendee_count > 0),
  approved_by UUID,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
CREATE INDEX IF NOT EXISTS idx_space_bookings_space_time ON space_bookings(space_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_space_bookings_student ON space_bookings(student_id, start_at DESC);

-- ============================================================
-- 3. Student/faculty acquisition suggestions
-- ============================================================
CREATE TABLE IF NOT EXISTS acquisition_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id TEXT REFERENCES students(student_id) ON DELETE SET NULL,
  requester_name TEXT,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  publisher TEXT,
  publication_year INTEGER,
  resource_type TEXT NOT NULL DEFAULT 'book'
    CHECK (resource_type IN ('book','ebook','journal','database','thesis','other')),
  reason TEXT,
  estimated_price NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','reviewing','approved','rejected','ordered','received','cancelled')),
  staff_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acquisition_requests_status ON acquisition_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acquisition_requests_student ON acquisition_requests(student_id, created_at DESC);

-- ============================================================
-- 4. Digital resource directory
-- ============================================================
CREATE TABLE IF NOT EXISTS digital_resources (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  resource_type TEXT NOT NULL DEFAULT 'ebook'
    CHECK (resource_type IN ('ebook','journal','database','thesis','article','video','website','other')),
  description TEXT,
  url TEXT NOT NULL,
  provider TEXT,
  subject TEXT,
  language TEXT,
  publication_year INTEGER,
  access_level TEXT NOT NULL DEFAULT 'campus'
    CHECK (access_level IN ('public','student','campus','staff')),
  license_note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_digital_resources_type ON digital_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_digital_resources_subject ON digital_resources(subject);

-- ============================================================
-- 5. Safe space booking helper
-- ============================================================
CREATE OR REPLACE FUNCTION book_my_study_space(
  space_id_in BIGINT,
  start_at_in TIMESTAMPTZ,
  end_at_in TIMESTAMPTZ,
  attendee_count_in INTEGER DEFAULT 1,
  purpose_in TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  sid TEXT;
  cap INTEGER;
  approval BOOLEAN;
  booking_id BIGINT;
BEGIN
  sid := current_patron_student_id();
  IF sid IS NULL THEN RAISE EXCEPTION 'Patron account not linked'; END IF;
  IF start_at_in < now() THEN RAISE EXCEPTION 'Booking must start in the future'; END IF;
  IF end_at_in <= start_at_in THEN RAISE EXCEPTION 'Invalid booking interval'; END IF;
  IF end_at_in - start_at_in > interval '4 hours' THEN RAISE EXCEPTION 'Maximum booking duration is 4 hours'; END IF;

  SELECT capacity, requires_approval INTO cap, approval
  FROM study_spaces
  WHERE id = space_id_in AND is_active = TRUE;
  IF cap IS NULL THEN RAISE EXCEPTION 'Study space not found'; END IF;
  IF attendee_count_in < 1 OR attendee_count_in > cap THEN RAISE EXCEPTION 'Attendee count exceeds capacity'; END IF;

  IF EXISTS (
    SELECT 1 FROM space_bookings
    WHERE space_id = space_id_in
      AND status IN ('booked','approved','checked_in')
      AND tstzrange(start_at, end_at, '[)') && tstzrange(start_at_in, end_at_in, '[)')
  ) THEN RAISE EXCEPTION 'Study space is already booked for that time'; END IF;

  INSERT INTO space_bookings(space_id, student_id, start_at, end_at, attendee_count, purpose, status)
  VALUES(space_id_in, sid, start_at_in, end_at_in, attendee_count_in, purpose_in, CASE WHEN approval THEN 'booked' ELSE 'approved' END)
  RETURNING id INTO booking_id;
  RETURN booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION cancel_my_space_booking(booking_id_in BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE space_bookings
  SET status = 'cancelled', updated_at = now()
  WHERE id = booking_id_in
    AND student_id = current_patron_student_id()
    AND status IN ('booked','approved');
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking cannot be cancelled'; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 6. Safe acquisition-suggestion helper
-- ============================================================
CREATE OR REPLACE FUNCTION submit_my_acquisition_request(
  title_in TEXT,
  author_in TEXT DEFAULT NULL,
  isbn_in TEXT DEFAULT NULL,
  resource_type_in TEXT DEFAULT 'book',
  reason_in TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  sid TEXT;
  request_id BIGINT;
  student_name_val TEXT;
BEGIN
  sid := current_patron_student_id();
  IF sid IS NULL THEN RAISE EXCEPTION 'Patron account not linked'; END IF;
  IF trim(COALESCE(title_in,'')) = '' THEN RAISE EXCEPTION 'Title is required'; END IF;
  IF resource_type_in NOT IN ('book','ebook','journal','database','thesis','other') THEN RAISE EXCEPTION 'Invalid resource type'; END IF;
  SELECT student_name INTO student_name_val FROM students WHERE student_id = sid;
  INSERT INTO acquisition_requests(student_id, requester_name, title, author, isbn, resource_type, reason)
  VALUES(sid, student_name_val, title_in, author_in, isbn_in, resource_type_in, reason_in)
  RETURNING id INTO request_id;
  RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 7. Branch transfer state helper
-- ============================================================
CREATE OR REPLACE FUNCTION advance_branch_transfer(transfer_id_in BIGINT, next_status_in TEXT)
RETURNS VOID AS $$
DECLARE
  tr RECORD;
BEGIN
  IF current_library_role() NOT IN ('bootstrap','admin','librarian','assistant') THEN RAISE EXCEPTION 'Staff write access required'; END IF;
  SELECT * INTO tr FROM branch_transfers WHERE id = transfer_id_in FOR UPDATE;
  IF tr.id IS NULL THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF next_status_in NOT IN ('approved','in_transit','received','cancelled') THEN RAISE EXCEPTION 'Invalid transfer state'; END IF;

  IF next_status_in = 'approved' AND tr.status <> 'requested' THEN RAISE EXCEPTION 'Only requested transfers can be approved'; END IF;
  IF next_status_in = 'in_transit' AND tr.status NOT IN ('requested','approved') THEN RAISE EXCEPTION 'Transfer cannot enter transit'; END IF;
  IF next_status_in = 'received' AND tr.status <> 'in_transit' THEN RAISE EXCEPTION 'Only in-transit transfers can be received'; END IF;

  UPDATE branch_transfers SET
    status = next_status_in,
    approved_by = CASE WHEN next_status_in = 'approved' THEN auth.uid() ELSE approved_by END,
    shipped_at = CASE WHEN next_status_in = 'in_transit' THEN now() ELSE shipped_at END,
    received_at = CASE WHEN next_status_in = 'received' THEN now() ELSE received_at END,
    updated_at = now()
  WHERE id = transfer_id_in;

  IF next_status_in = 'received' THEN
    UPDATE book_copies
    SET branch_id = tr.to_branch_id,
        branch = (SELECT name FROM library_branches WHERE id = tr.to_branch_id),
        updated_at = now()
    WHERE id = tr.copy_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION book_my_study_space(BIGINT,TIMESTAMPTZ,TIMESTAMPTZ,INTEGER,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION cancel_my_space_booking(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION submit_my_acquisition_request(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION advance_branch_transfer(BIGINT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION book_my_study_space(BIGINT,TIMESTAMPTZ,TIMESTAMPTZ,INTEGER,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_my_space_booking(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_my_acquisition_request(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION advance_branch_transfer(BIGINT,TEXT) TO authenticated;

-- ============================================================
-- 8. updated_at triggers
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['library_branches','branch_transfers','study_spaces','space_bookings','acquisition_requests','digital_resources'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- ============================================================
-- 9. RLS
-- ============================================================
ALTER TABLE library_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisition_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_resources ENABLE ROW LEVEL SECURITY;

-- Branches/spaces/digital resources are readable by staff and linked patrons.
DROP POLICY IF EXISTS branches_read ON library_branches;
DROP POLICY IF EXISTS branches_write ON library_branches;
CREATE POLICY branches_read ON library_branches FOR SELECT TO authenticated USING (is_library_staff() OR current_patron_student_id() IS NOT NULL);
CREATE POLICY branches_write ON library_branches FOR ALL TO authenticated USING (can_library_write()) WITH CHECK (can_library_write());

DROP POLICY IF EXISTS study_spaces_read ON study_spaces;
DROP POLICY IF EXISTS study_spaces_write ON study_spaces;
CREATE POLICY study_spaces_read ON study_spaces FOR SELECT TO authenticated USING (is_library_staff() OR current_patron_student_id() IS NOT NULL);
CREATE POLICY study_spaces_write ON study_spaces FOR ALL TO authenticated USING (can_library_write()) WITH CHECK (can_library_write());

DROP POLICY IF EXISTS digital_resources_read ON digital_resources;
DROP POLICY IF EXISTS digital_resources_write ON digital_resources;
CREATE POLICY digital_resources_read ON digital_resources FOR SELECT TO authenticated
USING (
  is_library_staff()
  OR (current_patron_student_id() IS NOT NULL AND is_active = TRUE AND access_level IN ('public','student','campus'))
);
CREATE POLICY digital_resources_write ON digital_resources FOR ALL TO authenticated USING (can_library_write()) WITH CHECK (can_library_write());

-- Transfers are internal staff operations.
DROP POLICY IF EXISTS branch_transfers_staff ON branch_transfers;
CREATE POLICY branch_transfers_staff ON branch_transfers FOR ALL TO authenticated
USING (is_library_staff()) WITH CHECK (can_library_write());

-- Patrons see only their own bookings/requests; changes use RPCs.
DROP POLICY IF EXISTS space_bookings_read ON space_bookings;
DROP POLICY IF EXISTS space_bookings_write ON space_bookings;
CREATE POLICY space_bookings_read ON space_bookings FOR SELECT TO authenticated
USING (is_library_staff() OR student_id = current_patron_student_id());
CREATE POLICY space_bookings_write ON space_bookings FOR ALL TO authenticated
USING (can_library_write()) WITH CHECK (can_library_write());

DROP POLICY IF EXISTS acquisition_requests_read ON acquisition_requests;
DROP POLICY IF EXISTS acquisition_requests_write ON acquisition_requests;
CREATE POLICY acquisition_requests_read ON acquisition_requests FOR SELECT TO authenticated
USING (is_library_staff() OR student_id = current_patron_student_id());
CREATE POLICY acquisition_requests_write ON acquisition_requests FOR ALL TO authenticated
USING (can_library_write()) WITH CHECK (can_library_write());

-- ============================================================
-- 10. Useful operational views
-- ============================================================
CREATE OR REPLACE VIEW study_space_schedule AS
SELECT
  ss.id AS space_id,
  ss.name,
  ss.space_type,
  ss.capacity,
  ss.floor,
  ss.zone,
  lb.name AS branch_name,
  sb.id AS booking_id,
  sb.student_id,
  sb.start_at,
  sb.end_at,
  sb.status AS booking_status,
  sb.attendee_count
FROM study_spaces ss
LEFT JOIN library_branches lb ON lb.id = ss.branch_id
LEFT JOIN space_bookings sb ON sb.space_id = ss.id AND sb.status IN ('booked','approved','checked_in');
ALTER VIEW study_space_schedule SET (security_invoker = true);
