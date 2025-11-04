-- Create function to generate invoice number
-- Format: BUCK-YYYY-NNNN (e.g., BUCK-2025-0001)
-- This function calculates the next invoice number for a given year
CREATE OR REPLACE FUNCTION public.generate_invoice_no()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  invoice_year INTEGER;
  next_number INTEGER;
  invoice_date DATE;
BEGIN
  -- Determine the year from issue_date or created_at
  invoice_date := COALESCE(NEW.issue_date, CURRENT_DATE);
  invoice_year := EXTRACT(YEAR FROM invoice_date)::INTEGER;
  
  -- Find the maximum invoice number for this year
  -- Format is BUCK-YYYY-NNNN, so we split by '-' and take the last part (the number)
  SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_no, '-', 3) AS INTEGER)), 0)
  INTO next_number
  FROM public.invoices
  WHERE invoice_no LIKE 'BUCK-' || invoice_year || '-%';
  
  -- Increment for the new invoice
  next_number := next_number + 1;
  
  -- Set the invoice number
  NEW.invoice_no := 'BUCK-' || invoice_year || '-' || LPAD(next_number::text, 4, '0');
  
  RETURN NEW;
END;
$$;

-- Add invoice_no column (nullable initially for backfill)
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS invoice_no text;

-- Backfill existing invoices with invoice numbers
-- Group by year and assign sequential numbers within each year
DO $$
DECLARE
  inv_record RECORD;
  year_counter INTEGER := 1;
  current_year INTEGER;
  prev_year INTEGER := NULL;
BEGIN
  -- For each existing invoice without an invoice_no, assign one sequentially
  -- Use year from issue_date if available, otherwise from created_at
  FOR inv_record IN 
    SELECT 
      id, 
      COALESCE(EXTRACT(YEAR FROM issue_date)::INTEGER, EXTRACT(YEAR FROM created_at)::INTEGER) as invoice_year
    FROM public.invoices 
    WHERE invoice_no IS NULL 
    ORDER BY COALESCE(issue_date, created_at) ASC
  LOOP
    current_year := inv_record.invoice_year;
    
    -- Reset counter if year changes
    IF prev_year IS NULL OR prev_year != current_year THEN
      year_counter := 1;
      prev_year := current_year;
    END IF;
    
    UPDATE public.invoices
    SET invoice_no = 'BUCK-' || current_year || '-' || LPAD(year_counter::text, 4, '0')
    WHERE id = inv_record.id;
    
    year_counter := year_counter + 1;
  END LOOP;
  
END $$;

-- Add unique constraint on invoice_no
CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_no_unique_idx 
ON public.invoices (invoice_no);

-- Create trigger to auto-generate invoice numbers on insert
DROP TRIGGER IF EXISTS generate_invoice_no_trigger ON public.invoices;
CREATE TRIGGER generate_invoice_no_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.invoice_no IS NULL)
  EXECUTE FUNCTION public.generate_invoice_no();

-- Make invoice_no NOT NULL after backfill
ALTER TABLE public.invoices
ALTER COLUMN invoice_no SET NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN public.invoices.invoice_no IS 'Auto-incremented invoice number used for invoice identification instead of UUID. Format: BUCK-YYYY-NNNN (e.g., BUCK-2025-0001, BUCK-2025-0002, etc.). Sequence resets each year.';

