-- ============================================================================
-- HCPS — create the two tables the importer writes to. Run this ONE file in
-- Supabase → SQL Editor (paste, Run). It ONLY creates tables (no functions), so
-- it can't hit the "cannot change name of input parameter" error that blocked the
-- earlier files. Safe to run repeatedly.
--
-- After running this, the Import contacts button stores every email and address
-- directly (the app no longer depends on a database function for the import).
-- ============================================================================

create table if not exists dealer_contacts (
  dealer_id uuid references dealers(id) on delete cascade,
  email text,
  name  text,
  title text,
  role  text,
  phone text,
  primary key (dealer_id, email)
);
create index if not exists dealer_contacts_email_idx on dealer_contacts(lower(btrim(email)));

create table if not exists dealer_addresses (
  dealer_id uuid references dealers(id) on delete cascade,
  addr_key  text,
  address   text,
  city      text,
  state     text,
  zip       text,
  label     text,
  pri       int default 1,
  primary key (dealer_id, addr_key)
);
create index if not exists dealer_addresses_dealer_idx on dealer_addresses(dealer_id);

-- Private: only the server (service role) reads/writes these; the anon key can't.
alter table dealer_contacts  enable row level security;
alter table dealer_addresses enable row level security;

-- Let ANY on-file contact email register for the portal (matches dealers.email OR a
-- stored contact). Drops any old version first so it always installs cleanly.
do $$ declare r record; begin
  for r in select oid::regprocedure as sig from pg_proc where proname='dealer_by_email' loop
    execute 'drop function '||r.sig;
  end loop;
end $$;
create function dealer_by_email(p_email text) returns uuid language plpgsql stable as $$
declare v uuid; e text := lower(btrim(coalesce(p_email,'')));
begin
  if e = '' then return null; end if;
  select id into v from dealers where lower(btrim(email)) = e
    order by (status is distinct from 'prospect') desc, updated_at desc nulls last limit 1;
  if v is not null then return v; end if;
  select dealer_id into v from dealer_contacts where lower(btrim(email)) = e limit 1;
  return v;
end $$;

do $$ begin raise notice '✅ Tables ready. Now go to Dealer Manager → Import contacts and re-import your list.'; end $$;
