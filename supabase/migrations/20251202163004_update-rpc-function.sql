-- Add trigger-based invoice_no generation with optimized inline logic

-- Drop the standalone function since we're inlining it
DROP FUNCTION IF EXISTS public.generate_next_invoice_no(uuid);

-- Optimized trigger function with inline invoice number generation
CREATE OR REPLACE FUNCTION public.set_invoice_no_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_invoice_no integer;
BEGIN

  -- Community is required to generate an invoice number
  IF NEW.community_id IS NULL THEN
    RAISE EXCEPTION 'community_id is required to generate invoice number';
  END IF;

  -- Verify community exists
  IF NOT EXISTS (SELECT 1 FROM public.communities WHERE id = NEW.community_id) THEN
    RAISE EXCEPTION 'Community not found';
  END IF;
  
  -- Get the highest invoice number for this community and increment
  SELECT COALESCE(MAX(invoice_no), 0) + 1 INTO v_last_invoice_no
  FROM public.invoices
  WHERE community_id = NEW.community_id;
  
  NEW.invoice_no := v_last_invoice_no;

  RETURN NEW;
END;
$$;

-- Create / replace trigger to use the optimized trigger function
DROP TRIGGER IF EXISTS set_invoice_no_before_insert ON public.invoices;
CREATE TRIGGER set_invoice_no_before_insert
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_invoice_no_on_insert();