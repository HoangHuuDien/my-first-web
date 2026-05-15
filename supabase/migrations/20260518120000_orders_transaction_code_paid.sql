-- Ma giao dich duy nhat + trang thai paid (xac nhan tu dong SePay)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS transaction_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_transaction_code_unique
  ON public.orders (transaction_code)
  WHERE transaction_code IS NOT NULL AND btrim(transaction_code) <> '';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'success', 'paid', 'cancelled'));

NOTIFY pgrst, 'reload schema';
