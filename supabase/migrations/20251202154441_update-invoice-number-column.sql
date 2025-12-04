-- Add trigger-based invoice_no generation, using existing generate_next_invoice_no()

-- Ensure we replace any previous version of the function before using it
DROP FUNCTION IF EXISTS public.generate_next_invoice_no(uuid);

-- Recreate generate_next_invoice_no with the expected logic
CREATE OR REPLACE FUNCTION public.generate_next_invoice_no(p_community_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_invoice_no integer;
  v_next_invoice_no integer;
BEGIN
  -- Verify community exists
  IF NOT EXISTS (SELECT 1 FROM public.communities WHERE id = p_community_id) THEN
    RAISE EXCEPTION 'Community not found';
  END IF;
  
  -- Get the highest invoice number for this community
  SELECT COALESCE(MAX(invoice_no), 0) INTO v_last_invoice_no
  FROM public.invoices
  WHERE community_id = p_community_id;
  
  -- Increment by 1
  v_next_invoice_no := v_last_invoice_no + 1;
  
  RETURN v_next_invoice_no;
END;
$$;

-- Trigger function to automatically assign invoice_no on insert
CREATE OR REPLACE FUNCTION public.set_invoice_no_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_invoice_no integer;
BEGIN
  -- If invoice_no is already provided, respect it
  IF NEW.invoice_no IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Community is required to generate an invoice number
  IF NEW.community_id IS NULL THEN
    RAISE EXCEPTION 'community_id is required to generate invoice number';
  END IF;

  v_next_invoice_no := public.generate_next_invoice_no(NEW.community_id);
  NEW.invoice_no := v_next_invoice_no;

  RETURN NEW;
END;
$$;

-- Create / replace trigger to use the trigger function
DROP TRIGGER IF EXISTS set_invoice_no_before_insert ON public.invoices;
CREATE TRIGGER set_invoice_no_before_insert
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_invoice_no_on_insert();


