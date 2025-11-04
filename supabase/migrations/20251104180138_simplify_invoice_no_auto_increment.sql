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

-- Step 5: Fix any duplicate invoice_no values by assigning new sequential numbers
DO $$
DECLARE
  inv_record RECORD;
  new_invoice_no INTEGER;
  max_invoice_no INTEGER;
BEGIN
  -- Get the current maximum invoice_no
  SELECT COALESCE(MAX(invoice_no), 0) INTO max_invoice_no FROM public.invoices;
  
  -- Find and fix duplicates by assigning new sequential numbers
  FOR inv_record IN 
    SELECT id, invoice_no
    FROM public.invoices
    WHERE id IN (
      SELECT id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (PARTITION BY invoice_no ORDER BY created_at ASC) as rn
        FROM public.invoices
        WHERE invoice_no IS NOT NULL
      ) sub
      WHERE rn > 1
    )
    ORDER BY created_at ASC
  LOOP
    max_invoice_no := max_invoice_no + 1;
    UPDATE public.invoices
    SET invoice_no = max_invoice_no
    WHERE id = inv_record.id;
  END LOOP;
END $$;

-- Step 6: Set the sequence to the current max invoice_no + 1 (if any invoices exist)
DO $$
DECLARE
  max_invoice_no INTEGER;
BEGIN
  SELECT COALESCE(MAX(invoice_no), 0) INTO max_invoice_no FROM public.invoices;
  IF max_invoice_no > 0 THEN
    PERFORM setval('public.invoice_no_seq', max_invoice_no, true);
  END IF;
END $$;

-- Step 7: Set default value for invoice_no to use sequence
ALTER TABLE public.invoices
ALTER COLUMN invoice_no SET DEFAULT nextval('public.invoice_no_seq');

-- Step 8: Create simple unique constraint on invoice_no
CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_no_unique_idx 
ON public.invoices (invoice_no);

-- Step 9: Update comment
COMMENT ON COLUMN public.invoices.invoice_no IS 'Auto-incremented invoice number (integer) used for invoice identification. Format as BUCK-YYYY-NNNN on the frontend (e.g., BUCK-2025-0001).';

