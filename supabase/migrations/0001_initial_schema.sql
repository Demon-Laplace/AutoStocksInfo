create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  name text,
  market text default 'US',
  position_type text default 'holding',
  weight numeric,
  note text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint holdings_position_type_check check (position_type in ('holding', 'watchlist', 'related')),
  constraint holdings_user_ticker_unique unique (user_id, ticker)
);

create table public.related_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_ticker text not null,
  related_name text not null,
  related_ticker text,
  relation_type text,
  importance integer default 3,
  note text,
  created_at timestamptz default now()
);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  source text,
  published_at timestamptz,
  fetched_at timestamptz default now(),
  content_hash text not null,
  summary text,
  raw_excerpt text,
  tickers text[] default '{}',
  related_holdings text[] default '{}',
  themes text[] default '{}',
  impact_direction text default 'unknown',
  impact_level text default 'low',
  confidence text default 'low',
  reason text,
  created_at timestamptz default now(),
  constraint news_items_impact_direction_check check (impact_direction in ('positive', 'negative', 'mixed', 'neutral', 'unknown')),
  constraint news_items_impact_level_check check (impact_level in ('low', 'medium', 'high')),
  constraint news_items_confidence_check check (confidence in ('low', 'medium', 'high')),
  constraint news_items_user_hash_unique unique (user_id, content_hash)
);

create table public.sec_filings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  company_name text,
  cik text,
  filing_type text not null,
  accession_number text,
  filed_at date,
  report_url text,
  summary text,
  impact_direction text default 'unknown',
  impact_level text default 'low',
  reason text,
  created_at timestamptz default now(),
  constraint sec_filings_impact_direction_check check (impact_direction in ('positive', 'negative', 'mixed', 'neutral', 'unknown')),
  constraint sec_filings_impact_level_check check (impact_level in ('low', 'medium', 'high')),
  constraint sec_filings_user_ticker_accession_unique unique (user_id, ticker, accession_number)
);

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  title text not null,
  content_markdown text not null,
  high_impact_count integer default 0,
  medium_impact_count integer default 0,
  low_impact_count integer default 0,
  generated_at timestamptz default now(),
  created_at timestamptz default now(),
  constraint daily_reports_user_date_unique unique (user_id, report_date)
);

create table public.price_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  snapshot_date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  previous_close numeric,
  change_pct numeric,
  volume numeric,
  source text,
  created_at timestamptz default now(),
  constraint price_snapshots_user_ticker_date_unique unique (user_id, ticker, snapshot_date)
);

create trigger holdings_set_updated_at
before update on public.holdings
for each row
execute function public.set_updated_at();

create index holdings_user_id_idx on public.holdings (user_id);
create index holdings_ticker_idx on public.holdings (ticker);

create index related_assets_user_id_idx on public.related_assets (user_id);
create index related_assets_holding_ticker_idx on public.related_assets (holding_ticker);
create index related_assets_related_ticker_idx on public.related_assets (related_ticker);

create index news_items_user_id_idx on public.news_items (user_id);
create index news_items_published_at_idx on public.news_items (published_at desc);
create index news_items_tickers_gin_idx on public.news_items using gin (tickers);
create index news_items_related_holdings_gin_idx on public.news_items using gin (related_holdings);
create index news_items_themes_gin_idx on public.news_items using gin (themes);

create index sec_filings_user_id_idx on public.sec_filings (user_id);
create index sec_filings_ticker_idx on public.sec_filings (ticker);
create index sec_filings_filed_at_idx on public.sec_filings (filed_at desc);

create index daily_reports_user_id_idx on public.daily_reports (user_id);
create index daily_reports_report_date_idx on public.daily_reports (report_date desc);

create index price_snapshots_user_id_idx on public.price_snapshots (user_id);
create index price_snapshots_ticker_date_idx on public.price_snapshots (ticker, snapshot_date desc);

alter table public.holdings enable row level security;
alter table public.related_assets enable row level security;
alter table public.news_items enable row level security;
alter table public.sec_filings enable row level security;
alter table public.daily_reports enable row level security;
alter table public.price_snapshots enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.holdings to authenticated;
grant select, insert, update, delete on public.related_assets to authenticated;
grant select, insert, update, delete on public.news_items to authenticated;
grant select, insert, update, delete on public.sec_filings to authenticated;
grant select, insert, update, delete on public.daily_reports to authenticated;
grant select, insert, update, delete on public.price_snapshots to authenticated;

create policy "Users can select own holdings"
on public.holdings for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own holdings"
on public.holdings for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own holdings"
on public.holdings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own holdings"
on public.holdings for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own related assets"
on public.related_assets for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own related assets"
on public.related_assets for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own related assets"
on public.related_assets for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own related assets"
on public.related_assets for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own news items"
on public.news_items for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own news items"
on public.news_items for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own news items"
on public.news_items for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own news items"
on public.news_items for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own sec filings"
on public.sec_filings for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own sec filings"
on public.sec_filings for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own sec filings"
on public.sec_filings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own sec filings"
on public.sec_filings for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own daily reports"
on public.daily_reports for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own daily reports"
on public.daily_reports for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own daily reports"
on public.daily_reports for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own daily reports"
on public.daily_reports for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own price snapshots"
on public.price_snapshots for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own price snapshots"
on public.price_snapshots for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own price snapshots"
on public.price_snapshots for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own price snapshots"
on public.price_snapshots for delete
to authenticated
using (auth.uid() = user_id);
