-- Convert invoice_no column from text to integer
-- This migration extracts the numeric part from existing text invoice numbers
-- and converts the column type to integer

-- Step 1: Drop existing trigger and function if they exist (will recreate for integer)
DROP TRIGGER IF EXISTS generate_invoice_no_trigger ON public.invoices;
DROP FUNCTION IF EXISTS public.generate_invoice_no();

-- Step 2: Drop existing indexes and constraints
DROP INDEX IF EXISTS invoices_invoice_no_unique_idx;
DROP INDEX IF EXISTS invoices_invoice_no_year_unique_idx;

-- Step 3: Convert column type from text to integer
-- Create a temporary column to store integer values
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS invoice_no_temp integer;

-- Copy integer values from text invoice_no
-- Extract numeric part from format BUCK-YYYY-NNNN or use direct integer conversion
UPDATE public.invoices
SET invoice_no_temp = CASE
  WHEN invoice_no::text ~ '^BUCK-' THEN 
    CAST(SPLIT_PART(invoice_no::text, '-', 3) AS INTEGER)
  WHEN invoice_no::text ~ '^[0-9]+$' THEN 
    CAST(invoice_no::text AS INTEGER)
  ELSE NULL
END
WHERE invoice_no IS NOT NULL;

-- Handle NULL values by assigning sequential numbers per year
DO $$
DECLARE
  inv_record RECORD;
  year_counter INTEGER := 1;
  current_year INTEGER;
  prev_year INTEGER := NULL;
BEGIN
  -- For invoices without invoice_no_temp, assign sequential numbers per year
  FOR inv_record IN 
    SELECT 
      id, 
      COALESCE(EXTRACT(YEAR FROM issue_date)::INTEGER, EXTRACT(YEAR FROM created_at)::INTEGER) as invoice_year
    FROM public.invoices 
    WHERE invoice_no_temp IS NULL 
    ORDER BY COALESCE(issue_date, created_at) ASC
  LOOP
    current_year := inv_record.invoice_year;
    
    -- Reset counter if year changes
    IF prev_year IS NULL OR prev_year != current_year THEN
      year_counter := 1;
      prev_year := current_year;
    END IF;
    
    UPDATE public.invoices
    SET invoice_no_temp = year_counter
    WHERE id = inv_record.id;
    
    year_counter := year_counter + 1;
  END LOOP;
END $$;

-- Drop the old column and rename the temp column
ALTER TABLE public.invoices
DROP COLUMN IF EXISTS invoice_no;

ALTER TABLE public.invoices
RENAME COLUMN invoice_no_temp TO invoice_no;

-- Step 4: Recreate the function to generate invoice numbers (as integers)
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
  
  -- Find the maximum invoice number for invoices in the same year
  SELECT COALESCE(MAX(invoice_no), 0)
  INTO next_number
  FROM public.invoices
  WHERE EXTRACT(YEAR FROM COALESCE(issue_date, created_at)) = invoice_year;
  
  -- Increment for the new invoice
  next_number := next_number + 1;
  
  -- Set the invoice number (just the integer)
  NEW.invoice_no := next_number;
  
  RETURN NEW;
END;
$$;

-- Step 5: Recreate trigger for auto-generation
CREATE TRIGGER generate_invoice_no_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.invoice_no IS NULL)
  EXECUTE FUNCTION public.generate_invoice_no();

-- Step 6: Create immutable function for year extraction (required for index)
CREATE OR REPLACE FUNCTION public.invoice_year(invoice_date date, created_date timestamp with time zone)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXTRACT(YEAR FROM COALESCE(invoice_date, created_date::date))::integer;
$$;

-- Step 7: Recreate unique constraint (per year) using immutable function
CREATE UNIQUE INDEX invoices_invoice_no_year_unique_idx 
ON public.invoices (public.invoice_year(issue_date, created_at), invoice_no)
WHERE invoice_no IS NOT NULL;

-- Step 8: Ensure NOT NULL constraint
ALTER TABLE public.invoices
ALTER COLUMN invoice_no SET NOT NULL;

-- Step 9: Update comment
COMMENT ON COLUMN public.invoices.invoice_no IS 'Auto-incremented invoice number (integer) used for invoice identification. The number resets to 1 each year. Format as BUCK-YYYY-NNNN on the frontend (e.g., BUCK-2025-0001).';

