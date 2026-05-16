-- Da gui email xac nhan thanh toan (tranh gui trung)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_confirmation_email_pending_idx
  ON public.orders (status, confirmation_email_sent_at)
  WHERE status IN ('paid', 'success')
    AND confirmation_email_sent_at IS NULL
    AND customer_email IS NOT NULL
    AND btrim(customer_email) <> '';

NOTIFY pgrst, 'reload schema';
