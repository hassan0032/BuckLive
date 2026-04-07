-- Add explicit contract lifecycle dates for communities.
ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS activation_date timestamptz,
ADD COLUMN IF NOT EXISTS renewal_date timestamptz;

-- Backfill activation date from created_at.
UPDATE public.communities
SET activation_date = created_at
WHERE activation_date IS NULL;

-- Backfill renewal date from activation date.
UPDATE public.communities
SET renewal_date = activation_date + INTERVAL '1 year'
WHERE renewal_date IS NULL;

-- Keep activation and renewal dates aligned.
CREATE OR REPLACE FUNCTION public.set_community_contract_dates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.activation_date IS NULL THEN
    NEW.activation_date := COALESCE(NEW.created_at, timezone('utc', now()));
  END IF;

  NEW.renewal_date := NEW.activation_date + INTERVAL '1 year';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_community_activation_date ON public.communities;
DROP TRIGGER IF EXISTS trg_set_community_contract_dates ON public.communities;
CREATE TRIGGER trg_set_community_contract_dates
BEFORE INSERT OR UPDATE OF activation_date ON public.communities
FOR EACH ROW
EXECUTE FUNCTION public.set_community_contract_dates();

ALTER TABLE public.communities
ALTER COLUMN activation_date SET NOT NULL;

ALTER TABLE public.communities
ALTER COLUMN renewal_date SET NOT NULL;
