-- Tach knowledge (FAQ/hien phap) khoi don hang ban hang

-- 1) Doi ten bang cu: orders (noi dung markdown) -> knowledge
ALTER TABLE IF EXISTS public.orders RENAME TO knowledge;

-- Doi ten index/constraint neu ton tai (bo qua loi neu da doi)
DO $$ BEGIN
  ALTER INDEX IF EXISTS orders_category_idx RENAME TO knowledge_category_idx;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- 2) Bang don hang ban hang THAT
CREATE TABLE IF NOT EXISTS public.orders (
  id BIGSERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL DEFAULT 'Khách',
  customer_phone TEXT,
  customer_email TEXT,
  amount NUMERIC(14, 0) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success')),
  payment_code TEXT,
  transfer_content TEXT,
  product_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders (status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 3) RLS anon cho knowledge (neu chua co policy tu bang orders cu)
DROP POLICY IF EXISTS brain_orders_select_anon ON public.knowledge;
DROP POLICY IF EXISTS brain_orders_insert_anon ON public.knowledge;
DROP POLICY IF EXISTS brain_orders_update_anon ON public.knowledge;
DROP POLICY IF EXISTS brain_orders_delete_anon ON public.knowledge;

CREATE POLICY brain_knowledge_select_anon ON public.knowledge FOR SELECT TO anon USING (true);
CREATE POLICY brain_knowledge_insert_anon ON public.knowledge FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY brain_knowledge_update_anon ON public.knowledge FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY brain_knowledge_delete_anon ON public.knowledge FOR DELETE TO anon USING (true);

-- 4) RLS anon cho sales orders
DROP POLICY IF EXISTS brain_sales_orders_select_anon ON public.orders;
DROP POLICY IF EXISTS brain_sales_orders_insert_anon ON public.orders;
DROP POLICY IF EXISTS brain_sales_orders_update_anon ON public.orders;

CREATE POLICY brain_sales_orders_select_anon ON public.orders FOR SELECT TO anon USING (true);
CREATE POLICY brain_sales_orders_insert_anon ON public.orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY brain_sales_orders_update_anon ON public.orders FOR UPDATE TO anon USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
