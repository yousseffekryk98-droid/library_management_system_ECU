-- ECU Library Pro v4.1: enterprise library operations
-- Run after 001, 002 and 003.

-- ============================================================
-- 1. Physical copy / accession tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS book_copies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  accession_number TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','loaned','reserved','lost','damaged','repair','reference','withdrawn')),
  condition TEXT NOT NULL DEFAULT 'good'
    CHECK (condition IN ('new','good','fair','poor','damaged')),
  branch TEXT DEFAULT 'ECU Main Library',
  room TEXT,
  sector TEXT,
  shelf_number TEXT,
  acquired_at DATE,
  acquisition_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (acquisition_cost >= 0),
  last_inventory_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_book_copies_book ON book_copies(book_id);
CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies(status);
CREATE INDEX IF NOT EXISTS idx_book_copies_location ON book_copies(branch, room, sector, shelf_number);

-- Add optional copy-level relationship to loans without breaking existing book-level circulation.
ALTER TABLE borrowing ADD COLUMN IF NOT EXISTS copy_id BIGINT REFERENCES book_copies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_borrowing_copy_active ON borrowing(copy_id) WHERE return_date IS NULL;

-- Backfill accession rows for current aggregate inventory.
INSERT INTO book_copies (book_id, accession_number, barcode, status, condition, sector, shelf_number, acquired_at, acquisition_cost)
SELECT
  b.id,
  'ECU-' || b.id::TEXT || '-' || gs.n::TEXT,
  CASE WHEN gs.n = 1 AND b.barcode IS NOT NULL AND b.barcode <> '' THEN b.barcode ELSE NULL END,
  CASE WHEN gs.n <= COALESCE(b.current_borrows, 0) THEN 'loaned' ELSE 'available' END,
  CASE
    WHEN lower(COALESCE(b.condition, '')) = 'new' THEN 'new'
    WHEN lower(COALESCE(b.condition, '')) IN ('fair','poor','damaged') THEN lower(b.condition)
    ELSE 'good'
  END,
  b.sector,
  b.shelf_number,
  b.acquisition_date,
  COALESCE(b.price, 0)
FROM books b
CROSS JOIN LATERAL generate_series(1, GREATEST(COALESCE(b.quantity, 1), 1)) AS gs(n)
WHERE NOT EXISTS (SELECT 1 FROM book_copies bc WHERE bc.book_id = b.id)
ON CONFLICT (accession_number) DO NOTHING;

-- ============================================================
-- 2. Vendors and acquisitions
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  tax_number TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  vendor_id BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','ordered','partially_received','received','cancelled')),
  requested_by UUID,
  approved_by UUID,
  order_date DATE,
  expected_date DATE,
  currency TEXT NOT NULL DEFAULT 'EGP',
  shipping_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  book_id BIGINT REFERENCES books(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (received_quantity <= quantity)
);
CREATE INDEX IF NOT EXISTS idx_po_items_order ON purchase_order_items(purchase_order_id);

-- ============================================================
-- 3. Lost / damaged / repair incident workflow
-- ============================================================
CREATE TABLE IF NOT EXISTS book_incidents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  copy_id BIGINT REFERENCES book_copies(id) ON DELETE SET NULL,
  book_id BIGINT REFERENCES books(id) ON DELETE SET NULL,
  borrowing_id BIGINT REFERENCES borrowing(id) ON DELETE SET NULL,
  student_id TEXT REFERENCES students(student_id) ON DELETE SET NULL,
  incident_type TEXT NOT NULL CHECK (incident_type IN ('lost','damage','repair','missing_inventory','other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','awaiting_payment','repairing','resolved','written_off')),
  description TEXT,
  estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  charged_fine_id BIGINT REFERENCES fines(id) ON DELETE SET NULL,
  reported_by UUID,
  assigned_to UUID,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_book_incidents_status ON book_incidents(status, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_book_incidents_copy ON book_incidents(copy_id);

-- ============================================================
-- 4. Notification templates + delivery queue
-- ============================================================
CREATE TABLE IF NOT EXISTS notice_templates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('in_app','email','sms','whatsapp')),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','ar')),
  subject_template TEXT,
  body_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO notice_templates(code,name,channel,language,subject_template,body_template) VALUES
 ('loan_due_en','Loan due reminder','email','en','ECU Library: book due soon','Your borrowed book is due on {{due_date}}. Please return or renew it before the due date.'),
 ('loan_overdue_en','Overdue loan','email','en','ECU Library: overdue book','Your borrowed book is overdue by {{overdue_days}} day(s). Please return it as soon as possible.'),
 ('hold_ready_en','Reservation ready','email','en','ECU Library: reservation ready','Your reserved title is ready for pickup until {{expires_at}}.'),
 ('loan_due_ar','تذكير بموعد الإرجاع','email','ar','مكتبة ECU: موعد إرجاع الكتاب','موعد إرجاع الكتاب المستعار هو {{due_date}}. يرجى الإرجاع أو التجديد قبل الموعد.'),
 ('loan_overdue_ar','كتاب متأخر','email','ar','مكتبة ECU: تأخير في الإرجاع','الكتاب المستعار متأخر {{overdue_days}} يوم. يرجى إرجاعه في أقرب وقت.'),
 ('hold_ready_ar','الحجز جاهز','email','ar','مكتبة ECU: الحجز جاهز','الكتاب المحجوز جاهز للاستلام حتى {{expires_at}}.')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 5. Patron self-service identity mapping and preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS patron_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL UNIQUE REFERENCES students(student_id) ON DELETE CASCADE,
  preferred_language TEXT NOT NULL DEFAULT 'ar' CHECK (preferred_language IN ('ar','en')),
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  sms_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. Saved searches / reading lists
-- ============================================================
CREATE TABLE IF NOT EXISTS reading_lists (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reading_list_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reading_list_id BIGINT NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE,
  book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  note TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reading_list_id, book_id)
);

-- ============================================================
-- 7. Staff bootstrap and role helpers
-- ============================================================
CREATE OR REPLACE FUNCTION current_library_role()
RETURNS TEXT AS $$
DECLARE
  r TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM staff_profiles) THEN RETURN 'bootstrap'; END IF;
  SELECT role INTO r FROM staff_profiles WHERE user_id = auth.uid() AND is_active = TRUE;
  RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION bootstrap_first_library_admin(display_name_in TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF EXISTS (SELECT 1 FROM staff_profiles) THEN RETURN FALSE; END IF;
  INSERT INTO staff_profiles(user_id, display_name, role, is_active)
  VALUES (auth.uid(), COALESCE(display_name_in, 'Library Administrator'), 'admin', TRUE);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION current_library_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION bootstrap_first_library_admin(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_library_role() TO authenticated;
GRANT EXECUTE ON FUNCTION bootstrap_first_library_admin(TEXT) TO authenticated;

-- Admin-managed staff profile mutation helper. Creating the auth user itself remains in Supabase Auth.
CREATE OR REPLACE FUNCTION upsert_staff_profile(user_id_in UUID, display_name_in TEXT, role_in TEXT, active_in BOOLEAN DEFAULT TRUE)
RETURNS VOID AS $$
BEGIN
  IF current_library_role() NOT IN ('admin','bootstrap') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF role_in NOT IN ('admin','librarian','assistant','viewer') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  INSERT INTO staff_profiles(user_id, display_name, role, is_active)
  VALUES (user_id_in, display_name_in, role_in, active_in)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION upsert_staff_profile(UUID,TEXT,TEXT,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION upsert_staff_profile(UUID,TEXT,TEXT,BOOLEAN) TO authenticated;

-- ============================================================
-- 8. Acquisition receiving helper
-- ============================================================
CREATE OR REPLACE FUNCTION receive_purchase_order_item(item_id_in BIGINT, qty_in INTEGER DEFAULT 1)
RETURNS INTEGER AS $$
DECLARE
  item RECORD;
  i INTEGER;
  new_copy_id BIGINT;
  accession TEXT;
BEGIN
  IF current_library_role() NOT IN ('admin','librarian','assistant','bootstrap') THEN RAISE EXCEPTION 'Staff write access required'; END IF;
  IF qty_in <= 0 THEN RAISE EXCEPTION 'Received quantity must be positive'; END IF;

  SELECT poi.*, po.po_number INTO item
  FROM purchase_order_items poi
  JOIN purchase_orders po ON po.id = poi.purchase_order_id
  WHERE poi.id = item_id_in
  FOR UPDATE;

  IF item.id IS NULL THEN RAISE EXCEPTION 'Purchase-order item not found'; END IF;
  IF item.received_quantity + qty_in > item.quantity THEN RAISE EXCEPTION 'Cannot receive more than ordered quantity'; END IF;

  IF item.book_id IS NULL THEN
    INSERT INTO books(title, author, isbn, quantity, current_borrows, price, acquisition_date, acquisition_source)
    VALUES(item.title, item.author, item.isbn, 0, 0, item.unit_price, CURRENT_DATE, 'Purchase Order ' || item.po_number)
    RETURNING id INTO item.book_id;
    UPDATE purchase_order_items SET book_id = item.book_id WHERE id = item.id;
  END IF;

  FOR i IN 1..qty_in LOOP
    accession := 'ECU-' || item.book_id::TEXT || '-PO' || item.purchase_order_id::TEXT || '-' || (item.received_quantity + i)::TEXT || '-' || floor(extract(epoch from clock_timestamp()))::BIGINT::TEXT;
    INSERT INTO book_copies(book_id, accession_number, status, condition, acquired_at, acquisition_cost, notes)
    VALUES(item.book_id, accession, 'available', 'new', CURRENT_DATE, item.unit_price, 'Received via ' || item.po_number)
    RETURNING id INTO new_copy_id;
  END LOOP;

  UPDATE purchase_order_items
  SET received_quantity = received_quantity + qty_in
  WHERE id = item.id;

  UPDATE books
  SET quantity = (SELECT COUNT(*) FROM book_copies WHERE book_id = item.book_id AND status <> 'withdrawn'),
      acquisition_date = COALESCE(acquisition_date, CURRENT_DATE)
  WHERE id = item.book_id;

  UPDATE purchase_orders po
  SET status = CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM purchase_order_items x
      WHERE x.purchase_order_id = po.id AND x.received_quantity < x.quantity
    ) THEN 'received'
    ELSE 'partially_received'
  END,
  updated_at = now()
  WHERE po.id = item.purchase_order_id;

  RETURN new_copy_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION receive_purchase_order_item(BIGINT,INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION receive_purchase_order_item(BIGINT,INTEGER) TO authenticated;

-- ============================================================
-- 9. Incident helper: open lost/damage case and optionally charge fine
-- ============================================================
CREATE OR REPLACE FUNCTION open_copy_incident(
  copy_id_in BIGINT,
  incident_type_in TEXT,
  student_id_in TEXT DEFAULT NULL,
  borrowing_id_in BIGINT DEFAULT NULL,
  description_in TEXT DEFAULT NULL,
  estimated_cost_in NUMERIC DEFAULT 0,
  create_fine_in BOOLEAN DEFAULT FALSE
) RETURNS BIGINT AS $$
DECLARE
  book_id_val BIGINT;
  incident_id BIGINT;
  fine_id_val BIGINT;
BEGIN
  IF current_library_role() NOT IN ('admin','librarian','assistant','bootstrap') THEN RAISE EXCEPTION 'Staff write access required'; END IF;
  IF incident_type_in NOT IN ('lost','damage','repair','missing_inventory','other') THEN RAISE EXCEPTION 'Invalid incident type'; END IF;
  SELECT book_id INTO book_id_val FROM book_copies WHERE id = copy_id_in;
  IF book_id_val IS NULL THEN RAISE EXCEPTION 'Copy not found'; END IF;

  UPDATE book_copies SET
    status = CASE WHEN incident_type_in = 'lost' THEN 'lost' WHEN incident_type_in IN ('damage','repair') THEN 'damaged' ELSE status END,
    condition = CASE WHEN incident_type_in IN ('damage','repair') THEN 'damaged' ELSE condition END,
    updated_at = now()
  WHERE id = copy_id_in;

  IF create_fine_in AND student_id_in IS NOT NULL AND estimated_cost_in > 0 THEN
    INSERT INTO fines(borrowing_id, student_id, type, amount, reason, due_date)
    VALUES(borrowing_id_in, student_id_in, CASE WHEN incident_type_in = 'lost' THEN 'lost' ELSE 'damage' END, estimated_cost_in, description_in, CURRENT_DATE + 14)
    RETURNING id INTO fine_id_val;
  END IF;

  INSERT INTO book_incidents(copy_id, book_id, borrowing_id, student_id, incident_type, description, estimated_cost, charged_fine_id, reported_by)
  VALUES(copy_id_in, book_id_val, borrowing_id_in, student_id_in, incident_type_in, description_in, COALESCE(estimated_cost_in,0), fine_id_val, auth.uid())
  RETURNING id INTO incident_id;
  RETURN incident_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION open_copy_incident(BIGINT,TEXT,TEXT,BIGINT,TEXT,NUMERIC,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION open_copy_incident(BIGINT,TEXT,TEXT,BIGINT,TEXT,NUMERIC,BOOLEAN) TO authenticated;

-- ============================================================
-- 10. updated_at triggers
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['book_copies','vendors','purchase_orders','book_incidents','notice_templates','patron_accounts','reading_lists'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- ============================================================
-- 11. Operational views
-- ============================================================
CREATE OR REPLACE VIEW copy_inventory_summary AS
SELECT
  b.id AS book_id,
  b.title,
  b.author,
  COUNT(bc.id) AS tracked_copies,
  COUNT(*) FILTER (WHERE bc.status = 'available') AS available_copies,
  COUNT(*) FILTER (WHERE bc.status = 'loaned') AS loaned_copies,
  COUNT(*) FILTER (WHERE bc.status = 'reserved') AS reserved_copies,
  COUNT(*) FILTER (WHERE bc.status = 'lost') AS lost_copies,
  COUNT(*) FILTER (WHERE bc.status IN ('damaged','repair')) AS problem_copies,
  COUNT(*) FILTER (WHERE bc.status = 'withdrawn') AS withdrawn_copies
FROM books b
LEFT JOIN book_copies bc ON bc.book_id = b.id
GROUP BY b.id, b.title, b.author;

CREATE OR REPLACE VIEW acquisitions_summary AS
SELECT
  po.id,
  po.po_number,
  po.status,
  po.order_date,
  po.expected_date,
  v.name AS vendor_name,
  COALESCE(SUM(poi.quantity),0) AS ordered_units,
  COALESCE(SUM(poi.received_quantity),0) AS received_units,
  COALESCE(SUM(poi.quantity * poi.unit_price),0) + po.shipping_amount AS total_amount
FROM purchase_orders po
LEFT JOIN vendors v ON v.id = po.vendor_id
LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
GROUP BY po.id, po.po_number, po.status, po.order_date, po.expected_date, v.name, po.shipping_amount;

ALTER VIEW copy_inventory_summary SET (security_invoker = true);
ALTER VIEW acquisitions_summary SET (security_invoker = true);

-- ============================================================
-- 12. RLS for new tables + role-aware tightening
-- ============================================================
ALTER TABLE book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE patron_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_list_items ENABLE ROW LEVEL SECURITY;

-- Staff operational access to new tables.
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['book_copies','vendors','purchase_orders','purchase_order_items','book_incidents','notice_templates'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS library_staff_read ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS library_staff_write ON %I', tbl);
    EXECUTE format('CREATE POLICY library_staff_read ON %I FOR SELECT TO authenticated USING (current_library_role() IN (''bootstrap'',''admin'',''librarian'',''assistant'',''viewer''))', tbl);
    EXECUTE format('CREATE POLICY library_staff_write ON %I FOR ALL TO authenticated USING (current_library_role() IN (''bootstrap'',''admin'',''librarian'',''assistant'')) WITH CHECK (current_library_role() IN (''bootstrap'',''admin'',''librarian'',''assistant''))', tbl);
  END LOOP;
END $$;

-- Patron-owned data policies.
DROP POLICY IF EXISTS patron_account_self ON patron_accounts;
CREATE POLICY patron_account_self ON patron_accounts FOR SELECT TO authenticated USING (user_id = auth.uid() OR current_library_role() IN ('bootstrap','admin','librarian'));
DROP POLICY IF EXISTS patron_account_staff_write ON patron_accounts;
CREATE POLICY patron_account_staff_write ON patron_accounts FOR ALL TO authenticated USING (current_library_role() IN ('bootstrap','admin','librarian')) WITH CHECK (current_library_role() IN ('bootstrap','admin','librarian'));

DROP POLICY IF EXISTS reading_lists_owner ON reading_lists;
CREATE POLICY reading_lists_owner ON reading_lists FOR ALL TO authenticated
USING (
  student_id = (SELECT pa.student_id FROM patron_accounts pa WHERE pa.user_id = auth.uid())
  OR current_library_role() IN ('bootstrap','admin','librarian','assistant')
)
WITH CHECK (
  student_id = (SELECT pa.student_id FROM patron_accounts pa WHERE pa.user_id = auth.uid())
  OR current_library_role() IN ('bootstrap','admin','librarian','assistant')
);

DROP POLICY IF EXISTS reading_list_items_owner ON reading_list_items;
CREATE POLICY reading_list_items_owner ON reading_list_items FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM reading_lists rl
    WHERE rl.id = reading_list_id
      AND (rl.student_id = (SELECT pa.student_id FROM patron_accounts pa WHERE pa.user_id = auth.uid()) OR current_library_role() IN ('bootstrap','admin','librarian','assistant'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM reading_lists rl
    WHERE rl.id = reading_list_id
      AND (rl.student_id = (SELECT pa.student_id FROM patron_accounts pa WHERE pa.user_id = auth.uid()) OR current_library_role() IN ('bootstrap','admin','librarian','assistant'))
  )
);

-- Tighten staff profile management while preserving first-user bootstrap.
DROP POLICY IF EXISTS authenticated_staff_access ON staff_profiles;
DROP POLICY IF EXISTS staff_profiles_read ON staff_profiles;
DROP POLICY IF EXISTS staff_profiles_self_or_admin ON staff_profiles;
CREATE POLICY staff_profiles_read ON staff_profiles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR current_library_role() IN ('bootstrap','admin','librarian'));
CREATE POLICY staff_profiles_self_or_admin ON staff_profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR current_library_role() IN ('bootstrap','admin'))
WITH CHECK (user_id = auth.uid() OR current_library_role() IN ('bootstrap','admin'));

-- Useful settings for new modules.
INSERT INTO settings(key,value) VALUES
 ('default_branch','ECU Main Library'),
 ('acquisition_currency','EGP'),
 ('lost_book_replacement_multiplier','1.0'),
 ('damage_fee_max_egp','500'),
 ('due_reminder_days','2')
ON CONFLICT (key) DO NOTHING;
