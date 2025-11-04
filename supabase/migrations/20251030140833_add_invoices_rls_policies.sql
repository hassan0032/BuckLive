-- Enable RLS and add owner-based policies for invoices

-- Ensure table exists (idempotent safety)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) THEN
    RAISE EXCEPTION 'Table public.invoices does not exist. Run table creation migration first.';
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to keep migration idempotent on re-run
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'Allow users to select own invoices'
  ) THEN
    DROP POLICY "Allow users to select own invoices" ON public.invoices;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'Allow users to insert own invoices'
  ) THEN
    DROP POLICY "Allow users to insert own invoices" ON public.invoices;
  END IF;
END $$;

-- Allow users to read their own invoices
CREATE POLICY "Allow users to select own invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow users to insert invoices only for themselves (client-side first-login logic)
CREATE POLICY "Allow users to insert own invoices"
ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Note: No UPDATE/DELETE policies are created, effectively disallowing them for non-service roles.


