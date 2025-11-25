-- 0. Drop code column if it exists (safe cleanup)
alter table communities drop column if exists code cascade;

-- 1. Add code column with check constraint for 4 uppercase letters
alter table communities
add column code char(4)
check (code ~ '^[A-Z]{4}$');

-- 2. Create or replace function to generate a unique 4-character code
create or replace function gen_unique_code_for_communities()
returns trigger as $$
declare
    chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ'; -- letters only
    prefix text;
    result text;
    full_code text;
    i int;
begin
    -- Determine prefix based on membership_tier
    if lower(NEW.membership_tier) = 'silver' then
        prefix := 'SC';
    elsif lower(NEW.membership_tier) = 'gold' then
        prefix := 'GC';
    else
        prefix := 'XX';
    end if;

    loop
        -- Generate last 2 random letters
        result := '';
        for i in 1..2 loop
            result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        end loop;

        full_code := prefix || result;

        -- Check uniqueness
        if not exists (select 1 from communities where code = full_code) then
            exit; -- unique code found
        end if;
    end loop;

    NEW.code := full_code;
    return NEW;
end;
$$ language plpgsql;

-- 3. Drop trigger if it already exists
drop trigger if exists communities_code_trigger on communities;

-- 4. Create trigger to auto-generate unique code before insert
create trigger communities_code_trigger
before insert on communities
for each row
execute function gen_unique_code_for_communities();
