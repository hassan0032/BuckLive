-- Add community_name column to invoices table
-- This allows storing the historical name of the community at the time of invoice creation

alter table invoices
add column community_name text;

comment on column invoices.community_name is 'The name of the community at the time of invoice creation';
