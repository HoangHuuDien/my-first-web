-- Theo doi email 2/3 trong chuoi nurture (Email 1 gui ngay tu client)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sequence_email_2_sent_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sequence_email_3_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_sequence_pending_email2_idx
  ON public.orders (created_at)
  WHERE status = 'pending'
    AND sequence_email_2_sent_at IS NULL
    AND customer_email IS NOT NULL
    AND btrim(customer_email) <> '';

CREATE INDEX IF NOT EXISTS orders_sequence_pending_email3_idx
  ON public.orders (sequence_email_2_sent_at)
  WHERE status = 'pending'
    AND sequence_email_2_sent_at IS NOT NULL
    AND sequence_email_3_sent_at IS NULL
    AND customer_email IS NOT NULL
    AND btrim(customer_email) <> '';

NOTIFY pgrst, 'reload schema';
