
-- Update invoice_no to community-based sequential numbering
-- This migration keeps invoice_no as integer but generates sequences per community
-- Frontend will combine community code with invoice_no for display (e.g., SCQP-0001)
-- Step 1: Drop existing sequence and default
ALTER TABLE public.invoices ALTER COLUMN invoice_no DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.invoice_no_seq CASCADE;
-- Step 2: Drop the old unique index (global invoice_no)
DROP INDEX IF EXISTS invoices_invoice_no_unique_idx;
-- Step 3: Create composite unique constraint (community_id + invoice_no)
-- This allows multiple communities to have invoice_no = 1, 2, 3, etc.
CREATE UNIQUE INDEX invoices_community_invoice_no_unique_idx 
ON public.invoices (community_id, invoice_no);
-- Step 4: Create function to generate next invoice number for a community
-- Returns an integer (just the sequence number, not CODE-NNNN format)
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
-- Step 5: Update comment
COMMENT ON COLUMN public.invoices.invoice_no IS 'Sequential invoice number per community (1, 2, 3...). Frontend combines with community code for display (e.g., SCQP-0001).';
-- Step 6: Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.generate_next_invoice_no(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_invoice_no(uuid) TO service_role;
