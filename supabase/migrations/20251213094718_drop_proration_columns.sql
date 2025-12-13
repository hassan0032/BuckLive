-- Drop unused proration columns from invoices table
ALTER TABLE invoices 
DROP COLUMN IF EXISTS is_prorated,
DROP COLUMN IF EXISTS prorated_days,
DROP COLUMN IF EXISTS full_year_amount_cents;
