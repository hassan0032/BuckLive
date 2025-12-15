-- Drop community_manager_email and community_manager_name columns from invoices table
alter table invoices
drop column community_manager_email;
alter table invoices
drop column community_manager_name;

-- Add community_tier column to invoices table
alter table invoices
add column community_tier text;

comment on column invoices.community_tier is 'The membership tier (silver/gold) of the community at the time of invoice creation';

update invoices
set
  community_name = c.name,
  community_code = c.code,
  community_tier = c.membership_tier
from communities c
where invoices.community_id = c.id;