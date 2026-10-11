-- Core schema. Money is stored in integer cents, credits in whole credits (1 credit = $1).

create table zip_centroids (
  zip text primary key,
  place text not null,
  state text not null,
  lat double precision not null,
  lng double precision not null
);

create table categories (
  slug text primary key,
  name text not null,
  serves_label text not null,
  keywords text[] not null,
  lead_fee_credits int not null check (lead_fee_credits > 0),
  questions jsonb not null default '[]'::jsonb,
  sort int not null default 0
);

create table users (
  id text primary key,
  role text not null check (role in ('client', 'pro', 'admin')),
  first_name text not null,
  last_initial text not null default '',
  display_name text not null,
  zip text references zip_centroids (zip),
  created_at timestamptz not null default now()
);

-- Private contact details. Opened to the other side of a job only after hire.
create table user_contacts (
  user_id text primary key references users (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null
);

create table pro_profiles (
  user_id text primary key references users (id) on delete cascade,
  business_name text not null,
  owner_name text not null,
  home_zip text not null references zip_centroids (zip),
  radius_mi int not null check (radius_mi > 0),
  category_slugs text[] not null,
  verified boolean not null default false,
  reply_minutes int not null check (reply_minutes > 0),
  next_available_days int not null default 1 check (next_available_days >= 0),
  accepting_leads boolean not null default true,
  credits int not null default 0 check (credits >= 0),
  review_count int not null default 0,
  rating_sum int not null default 0,
  years_in_business int not null default 1,
  bio text not null default ''
);

create table promotions (
  id serial primary key,
  pro_id text not null references users (id),
  category_slug text not null references categories (slug),
  status text not null check (status in ('active', 'paused')),
  created_at timestamptz not null default now()
);

create table intake_runs (
  id serial primary key,
  client_id text not null references users (id),
  note text not null,
  path text not null check (path in ('live', 'replay', 'rules')),
  model text,
  duration_ms int not null,
  tool_calls jsonb not null default '[]'::jsonb,
  output jsonb not null,
  fallback_reason text,
  cost_usd numeric(10, 6),
  created_at timestamptz not null default now()
);

create table service_requests (
  id serial primary key,
  client_id text not null references users (id),
  category_slug text not null references categories (slug),
  zip text not null references zip_centroids (zip),
  timing text not null check (timing in ('asap', 'this_week', 'next_two_weeks', 'flexible')),
  budget_cents int check (budget_cents is null or budget_cents > 0),
  title text not null,
  details text not null default '',
  answers jsonb not null default '[]'::jsonb,
  note text not null default '',
  status text not null default 'open' check (status in ('open', 'hired', 'closed')),
  intake_run_id int references intake_runs (id),
  created_at timestamptz not null default now()
);

create table leads (
  id serial primary key,
  request_id int not null references service_requests (id),
  pro_id text not null references users (id),
  rank int not null,
  score numeric(6, 4) not null,
  reasons jsonb not null,
  sponsored boolean not null default false,
  promotion_id int references promotions (id),
  fee_credits int not null,
  status text not null default 'new' check (status in ('new', 'viewed', 'quoted', 'hired', 'not_selected')),
  created_at timestamptz not null default now(),
  unique (request_id, pro_id)
);

create table quotes (
  id serial primary key,
  lead_id int not null unique references leads (id),
  request_id int not null references service_requests (id),
  pro_id text not null references users (id),
  price_cents int not null check (price_cents > 0),
  price_type text not null check (price_type in ('fixed', 'estimate')),
  available_at timestamptz not null,
  message text not null,            -- contact details masked
  message_original text not null,   -- column privilege: hidden from the app role, read through quote_message()
  fee_credits int not null default 0,
  created_at timestamptz not null default now()
);

create table jobs (
  id serial primary key,
  request_id int not null unique references service_requests (id),
  quote_id int not null unique references quotes (id),
  client_id text not null references users (id),
  pro_id text not null references users (id),
  price_cents int not null,
  fee_cents int not null,
  status text not null default 'booked' check (status in ('booked', 'scheduled', 'in_progress', 'done')),
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create table job_events (
  id serial primary key,
  job_id int not null references jobs (id),
  actor_id text not null references users (id),
  kind text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table ledger_transactions (
  id serial primary key,
  kind text not null check (kind in ('credit_purchase', 'lead_fee', 'payment_hold', 'payout_release')),
  job_id int references jobs (id),
  pro_id text references users (id),
  client_id text references users (id),
  memo text not null default '',
  created_at timestamptz not null default now()
);

create table ledger_entries (
  id serial primary key,
  transaction_id int not null references ledger_transactions (id),
  account text not null,
  amount_cents bigint not null check (amount_cents <> 0)
);

create table reviews (
  id serial primary key,
  job_id int unique references jobs (id),
  client_id text references users (id),
  pro_id text not null references users (id),
  rating int not null check (rating between 1 and 5),
  body text not null default '',
  author_label text not null default '',
  source text not null default 'platform' check (source in ('platform', 'imported')),
  created_at timestamptz not null default now()
);

create table notifications (
  id serial primary key,
  user_id text not null references users (id),
  kind text not null,
  title text not null,
  body text not null default '',
  href text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index on leads (pro_id);
create index on leads (request_id);
create index on quotes (request_id);
create index on jobs (client_id);
create index on jobs (pro_id);
create index on notifications (user_id, created_at desc);
create index on ledger_entries (transaction_id);
create index on reviews (pro_id, created_at desc);
