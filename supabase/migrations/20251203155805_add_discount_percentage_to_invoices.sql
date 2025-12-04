ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS discount_percentage integer DEFAULT 0;