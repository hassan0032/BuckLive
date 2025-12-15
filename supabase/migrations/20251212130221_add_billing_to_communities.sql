-- Add billing columns to communities
ALTER TABLE communities
ADD COLUMN billing_anchor_date timestamptz,
ADD COLUMN next_invoice_date timestamptz;

-- Trigger to set billing dates on new community creation
CREATE OR REPLACE FUNCTION set_community_billing_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Anchor date is creation date
  NEW.billing_anchor_date := NEW.created_at;
  -- First invoice is scheduled 24 hours after creation
  NEW.next_invoice_date := NEW.created_at + INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger definition
CREATE TRIGGER trigger_set_community_billing_dates
BEFORE INSERT ON communities
FOR EACH ROW
EXECUTE FUNCTION set_community_billing_dates();

-- Backfill existing communities
-- Anchor date: use the start of their first invoice, or created_at if no invoice exists
-- Next invoice: use the end of their last invoice (meaning next is due then), or created_at + 24h
UPDATE communities c
SET 
  billing_anchor_date = COALESCE(
    (SELECT MIN(period_start) FROM invoices WHERE community_id = c.id)::timestamptz,
    c.created_at
  ),
  next_invoice_date = COALESCE(
    (SELECT MAX(period_end) FROM invoices WHERE community_id = c.id)::timestamptz,
    c.created_at + INTERVAL '24 hours'
  );
