ALTER TABLE invoices
ADD CONSTRAINT unique_community_period
UNIQUE (community_id, period_start);
