-- 1. Drop the RLS policies that use user_id
drop policy if exists "Allow users to select own invoices" on invoices;
drop policy if exists "Allow users to insert own invoices" on invoices;

-- 2. Drop the user_id column
alter table invoices
drop column if exists user_id;
