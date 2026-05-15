-- Cho phep trang thai cancelled khi doi soat thu cong
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'success', 'cancelled'));

NOTIFY pgrst, 'reload schema';
