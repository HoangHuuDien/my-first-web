-- Cho phep trang /admin (anon key) doc/ghi 3 bang brain core
-- Chi dung cho noi dung van hanh; neu can bao mat hon hay them Auth sau.

CREATE POLICY brain_products_select_anon ON public.products
  FOR SELECT TO anon USING (true);

CREATE POLICY brain_products_insert_anon ON public.products
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY brain_products_update_anon ON public.products
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY brain_products_delete_anon ON public.products
  FOR DELETE TO anon USING (true);

CREATE POLICY brain_customers_select_anon ON public.customers
  FOR SELECT TO anon USING (true);

CREATE POLICY brain_customers_insert_anon ON public.customers
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY brain_customers_update_anon ON public.customers
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY brain_customers_delete_anon ON public.customers
  FOR DELETE TO anon USING (true);

CREATE POLICY brain_orders_select_anon ON public.orders
  FOR SELECT TO anon USING (true);

CREATE POLICY brain_orders_insert_anon ON public.orders
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY brain_orders_update_anon ON public.orders
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY brain_orders_delete_anon ON public.orders
  FOR DELETE TO anon USING (true);

NOTIFY pgrst, 'reload schema';
