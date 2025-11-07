-- Add community_id foreign key to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS community_id uuid;

ALTER TABLE public.invoices
ADD CONSTRAINT invoices_community_id_fkey
FOREIGN KEY (community_id)
REFERENCES public.communities (id)
ON DELETE SET NULL;