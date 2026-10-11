-- Row-level security. Every app request runs as the non-superuser role app_user inside one short
-- transaction with app.user_id set (see lib/db/scoped.ts). Policies decide which rows each person sees.

create role app_user nologin;
grant usage on schema public to app_user;

-- Helpers. SECURITY DEFINER so policies can look across tables without recursive policy checks.
create function app_uid() returns text language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')
$$;

create function app_is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from users where id = app_uid() and role = 'admin')
$$;

create function request_client(req int) returns text language sql stable security definer set search_path = public as $$
  select client_id from service_requests where id = req
$$;

create function pro_has_lead(req int) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from leads where request_id = req and pro_id = app_uid())
$$;

create function is_job_party(job int) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from jobs where id = job and (client_id = app_uid() or pro_id = app_uid()))
$$;

create function hired_counterparty(other text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from jobs
    where (client_id = app_uid() and pro_id = other) or (pro_id = app_uid() and client_id = other)
  )
$$;

create function lead_owner(lead int) returns text language sql stable security definer set search_path = public as $$
  select pro_id from leads where id = lead
$$;

create function ledger_tx_visible(tx int) returns boolean language sql stable security definer set search_path = public as $$
  select app_is_admin() or exists (
    select 1 from ledger_transactions t where t.id = tx and (t.pro_id = app_uid() or t.client_id = app_uid())
  )
$$;

create function job_reviewable(job int, pro text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from jobs where id = job and client_id = app_uid() and pro_id = pro and status = 'done'
  )
$$;

-- The pro's own message, unmasked, for the pro and for the client once hired; masked text otherwise.
create function quote_message(q int) returns text language sql stable security definer set search_path = public as $$
  select case
    when qt.pro_id = app_uid() or app_is_admin()
      or exists (select 1 from jobs j where j.quote_id = qt.id and j.client_id = app_uid())
    then qt.message_original else qt.message end
  from quotes qt where qt.id = q
    and (qt.pro_id = app_uid() or app_is_admin() or request_client(qt.request_id) = app_uid())
$$;

-- Tables everyone can read
alter table zip_centroids enable row level security;
create policy zip_read on zip_centroids for select to app_user using (true);
alter table categories enable row level security;
create policy categories_read on categories for select to app_user using (true);
alter table users enable row level security;
create policy users_read on users for select to app_user using (true);
alter table pro_profiles enable row level security;
create policy pro_profiles_read on pro_profiles for select to app_user using (true);
alter table reviews enable row level security;
create policy reviews_read on reviews for select to app_user using (true);
create policy reviews_insert on reviews for insert to app_user
  with check (client_id = app_uid() and source = 'platform' and job_reviewable(job_id, pro_id));

-- Contact details: yourself, admin, or the other side of a hired job
alter table user_contacts enable row level security;
create policy contacts_read on user_contacts for select to app_user
  using (user_id = app_uid() or app_is_admin() or hired_counterparty(user_id));

alter table promotions enable row level security;
create policy promotions_read on promotions for select to app_user using (true);
create policy promotions_admin on promotions for update to app_user using (app_is_admin()) with check (app_is_admin());

alter table intake_runs enable row level security;
create policy intake_runs_read on intake_runs for select to app_user using (client_id = app_uid() or app_is_admin());
create policy intake_runs_insert on intake_runs for insert to app_user with check (client_id = app_uid());

alter table service_requests enable row level security;
create policy requests_read on service_requests for select to app_user
  using (client_id = app_uid() or pro_has_lead(id) or app_is_admin());
create policy requests_insert on service_requests for insert to app_user with check (client_id = app_uid());
create policy requests_update on service_requests for update to app_user
  using (client_id = app_uid()) with check (client_id = app_uid());

alter table leads enable row level security;
create policy leads_read on leads for select to app_user
  using (pro_id = app_uid() or request_client(request_id) = app_uid() or app_is_admin());
create policy leads_insert on leads for insert to app_user with check (request_client(request_id) = app_uid());
create policy leads_update on leads for update to app_user
  using (pro_id = app_uid() or request_client(request_id) = app_uid())
  with check (pro_id = app_uid() or request_client(request_id) = app_uid());

alter table quotes enable row level security;
create policy quotes_read on quotes for select to app_user
  using (pro_id = app_uid() or request_client(request_id) = app_uid() or app_is_admin());
create policy quotes_insert on quotes for insert to app_user
  with check (pro_id = app_uid() and lead_owner(lead_id) = app_uid());

alter table jobs enable row level security;
create policy jobs_read on jobs for select to app_user using (client_id = app_uid() or pro_id = app_uid() or app_is_admin());
create policy jobs_insert on jobs for insert to app_user
  with check (client_id = app_uid() and request_client(request_id) = app_uid());
create policy jobs_update on jobs for update to app_user using (pro_id = app_uid()) with check (pro_id = app_uid());

alter table job_events enable row level security;
create policy job_events_read on job_events for select to app_user using (is_job_party(job_id) or app_is_admin());
create policy job_events_insert on job_events for insert to app_user with check (actor_id = app_uid() and is_job_party(job_id));

alter table ledger_transactions enable row level security;
create policy ledger_tx_read on ledger_transactions for select to app_user
  using (pro_id = app_uid() or client_id = app_uid() or app_is_admin());
create policy ledger_tx_insert on ledger_transactions for insert to app_user with check (
  (kind = 'payment_hold' and client_id = app_uid() and is_job_party(job_id))
  or (kind = 'payout_release' and pro_id = app_uid() and is_job_party(job_id))
);
alter table ledger_entries enable row level security;
create policy ledger_entries_read on ledger_entries for select to app_user using (ledger_tx_visible(transaction_id));
create policy ledger_entries_insert on ledger_entries for insert to app_user with check (ledger_tx_visible(transaction_id));

alter table notifications enable row level security;
create policy notifications_read on notifications for select to app_user using (user_id = app_uid());
create policy notifications_insert on notifications for insert to app_user with check (app_uid() is not null);
create policy notifications_update on notifications for update to app_user using (user_id = app_uid()) with check (user_id = app_uid());

-- Table privileges for the app role
grant select on zip_centroids, categories, users, user_contacts, pro_profiles, promotions, intake_runs,
  service_requests, leads, jobs, job_events, ledger_transactions, ledger_entries, reviews, notifications to app_user;
grant select (id, lead_id, request_id, pro_id, price_cents, price_type, available_at, message, fee_credits, created_at)
  on quotes to app_user;
grant insert on intake_runs, service_requests, leads, quotes, jobs, job_events, ledger_transactions,
  ledger_entries, reviews, notifications to app_user;
grant update (status) on service_requests, leads to app_user;
grant update (status, scheduled_for, done_at) on jobs to app_user;
grant update (status) on promotions to app_user;
grant update (read_at) on notifications to app_user;
grant usage on all sequences in schema public to app_user;

-- Quoting spends the lead fee from the pro's prepaid credits, atomically, and books it in the ledger.
create function quote_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare
  l leads%rowtype;
  req_status text;
  tx_id int;
begin
  select * into l from leads where id = new.lead_id;
  if l.id is null or l.pro_id <> new.pro_id then
    raise exception 'lead not found for this pro' using errcode = 'P0002';
  end if;
  if l.status not in ('new', 'viewed') then
    raise exception 'lead already %', l.status using errcode = 'P0001';
  end if;
  select status into req_status from service_requests where id = l.request_id;
  if req_status <> 'open' then
    raise exception 'request is no longer open' using errcode = 'P0001';
  end if;
  new.request_id := l.request_id;
  new.fee_credits := l.fee_credits;
  update pro_profiles set credits = credits - l.fee_credits
    where user_id = new.pro_id and credits >= l.fee_credits;
  if not found then
    raise exception 'not enough credits for the % credit lead fee', l.fee_credits using errcode = 'P0001';
  end if;
  insert into ledger_transactions (kind, pro_id, memo, created_at)
    values ('lead_fee', new.pro_id, 'Lead fee for request #' || l.request_id, new.created_at)
    returning id into tx_id;
  insert into ledger_entries (transaction_id, account, amount_cents) values
    (tx_id, 'pro_credit_balance', -l.fee_credits * 100),
    (tx_id, 'platform_lead_fees', l.fee_credits * 100);
  update leads set status = 'quoted' where id = l.id;
  return new;
end $$;
create trigger quotes_spend_credits before insert on quotes for each row execute function quote_before_insert();

-- Prepaid credits: a pro buys credits (simulated test-mode card), booked in the ledger.
create function buy_credits(n int, at timestamptz default now()) returns int language plpgsql security definer set search_path = public as $$
declare
  tx_id int;
  balance int;
begin
  if n <= 0 or n > 1000 then raise exception 'credit amount out of range' using errcode = 'P0001'; end if;
  update pro_profiles set credits = credits + n where user_id = app_uid() returning credits into balance;
  if balance is null then raise exception 'only pros can buy credits' using errcode = 'P0001'; end if;
  insert into ledger_transactions (kind, pro_id, memo, created_at)
    values ('credit_purchase', app_uid(), n || ' credits (test mode)', at) returning id into tx_id;
  insert into ledger_entries (transaction_id, account, amount_cents) values
    (tx_id, 'pro_test_card', -n * 100),
    (tx_id, 'pro_credit_balance', n * 100);
  return balance;
end $$;

-- Job status can only move forward one step at a time.
create function job_before_update() returns trigger language plpgsql as $$
begin
  if new.status <> old.status and not (
    (old.status = 'booked' and new.status = 'scheduled')
    or (old.status = 'scheduled' and new.status = 'in_progress')
    or (old.status = 'in_progress' and new.status = 'done')
  ) then
    raise exception 'illegal job status change % -> %', old.status, new.status using errcode = 'P0001';
  end if;
  if old.status = 'done' then
    raise exception 'job is already done' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger jobs_status_guard before update on jobs for each row execute function job_before_update();

-- Reviews keep the pro's score current for the next match.
create function review_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update pro_profiles p set
    review_count = s.n, rating_sum = s.total
  from (select count(*)::int as n, coalesce(sum(rating), 0)::int as total from reviews where pro_id = new.pro_id) s
  where p.user_id = new.pro_id;
  return null;
end $$;
create trigger reviews_refresh_score after insert on reviews for each row execute function review_after_insert();

-- Every ledger transaction must balance to zero, checked at commit.
create function ledger_balance_check() returns trigger language plpgsql security definer set search_path = public as $$
declare
  total bigint;
  n int;
begin
  select coalesce(sum(amount_cents), 0), count(*) into total, n from ledger_entries where transaction_id = new.transaction_id;
  if total <> 0 or n < 2 then
    raise exception 'ledger transaction % does not balance (sum %, % entries)', new.transaction_id, total, n using errcode = 'P0001';
  end if;
  return null;
end $$;
create constraint trigger ledger_entries_balance after insert or update on ledger_entries
  deferrable initially deferred for each row execute function ledger_balance_check();
