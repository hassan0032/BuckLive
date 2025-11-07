-- Add community_id foreign key to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS community_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_community_id_fkey'
      AND table_name = 'invoices'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.invoices
    ADD CONSTRAINT invoices_community_id_fkey
    FOREIGN KEY (community_id)
    REFERENCES public.communities (id)
    ON DELETE SET NULL;
  END IF;
END;
$$;