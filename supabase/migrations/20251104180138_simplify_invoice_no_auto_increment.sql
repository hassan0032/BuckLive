-- Simplify invoice_no to simple auto-incrementing integer
-- Remove all trigger logic and year-based constraints

-- Step 1: Drop trigger and function
DROP TRIGGER IF EXISTS generate_invoice_no_trigger ON public.invoices;
DROP FUNCTION IF EXISTS public.generate_invoice_no();

-- Step 2: Drop year-based unique index
DROP INDEX IF EXISTS invoices_invoice_no_year_unique_idx;

-- Step 3: Drop the invoice_year function if it exists
DROP FUNCTION IF EXISTS public.invoice_year(date, timestamp with time zone);

-- Step 4: Create simple sequence for auto-increment
CREATE SEQUENCE IF NOT EXISTS public.invoice_no_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Step 5: Delete existing invoices
DELETE FROM public.invoices;

-- Step 6: Reset sequence to start from 1
SELECT setval('public.invoice_no_seq', 1, false);

-- Step 7: Set default value for invoice_no to use sequence
ALTER TABLE public.invoices
ALTER COLUMN invoice_no SET DEFAULT nextval('public.invoice_no_seq');

-- Step 8: Create simple unique constraint on invoice_no
CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_no_unique_idx 
ON public.invoices (invoice_no);

-- Step 9: Update comment
COMMENT ON COLUMN public.invoices.invoice_no IS 'Auto-incremented invoice number (integer) used for invoice identification. Format as BUCK-YYYY-NNNN on the frontend (e.g., BUCK-2025-0001).';

