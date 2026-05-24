create table if not exists public.stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  company_name text not null,
  market text not null default 'US',
  sector text,
  currency text not null default 'USD',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint stocks_user_ticker_unique unique (user_id, ticker)
);

create table if not exists public.portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stock_id uuid references public.stocks(id) on delete cascade,
  ticker text not null,
  position_type text not null default 'watchlist',
  shares numeric not null default 0,
  average_cost numeric,
  current_price numeric,
  daily_change numeric,
  total_return numeric,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint portfolio_positions_position_type_check check (position_type in ('holding', 'watchlist')),
  constraint portfolio_positions_user_ticker_unique unique (user_id, ticker)
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stock_id uuid references public.stocks(id) on delete cascade,
  ticker text not null,
  price_date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric not null,
  adjusted_close numeric,
  volume numeric,
  source text,
  created_at timestamptz default now(),
  constraint price_history_user_ticker_date_unique unique (user_id, ticker, price_date)
);

create table if not exists public.stock_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stock_id uuid references public.stocks(id) on delete cascade,
  ticker text not null,
  related_stock_id uuid references public.stocks(id) on delete set null,
  related_ticker text,
  relation_type text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.analysis_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stock_id uuid references public.stocks(id) on delete cascade,
  ticker text not null,
  note_date date not null default current_date,
  title text not null,
  thesis text,
  content text not null,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.news_items add column if not exists ticker text;
alter table public.news_items add column if not exists related_tickers text[] default '{}';
alter table public.news_items add column if not exists impact_score numeric;
alter table public.news_items drop constraint if exists news_items_impact_direction_check;
alter table public.news_items
  add constraint news_items_impact_direction_check
  check (impact_direction in ('positive', 'negative', 'neutral', 'unclear', 'mixed', 'unknown'));

drop trigger if exists stocks_set_updated_at on public.stocks;
create trigger stocks_set_updated_at
before update on public.stocks
for each row
execute function public.set_updated_at();

drop trigger if exists portfolio_positions_set_updated_at on public.portfolio_positions;
create trigger portfolio_positions_set_updated_at
before update on public.portfolio_positions
for each row
execute function public.set_updated_at();

drop trigger if exists analysis_notes_set_updated_at on public.analysis_notes;
create trigger analysis_notes_set_updated_at
before update on public.analysis_notes
for each row
execute function public.set_updated_at();

create index if not exists stocks_user_id_idx on public.stocks (user_id);
create index if not exists stocks_ticker_idx on public.stocks (ticker);

create index if not exists portfolio_positions_user_id_idx on public.portfolio_positions (user_id);
create index if not exists portfolio_positions_ticker_idx on public.portfolio_positions (ticker);

create index if not exists price_history_user_id_idx on public.price_history (user_id);
create index if not exists price_history_ticker_date_idx on public.price_history (ticker, price_date desc);

create index if not exists stock_relations_user_id_idx on public.stock_relations (user_id);
create index if not exists stock_relations_ticker_idx on public.stock_relations (ticker);
create index if not exists stock_relations_related_ticker_idx on public.stock_relations (related_ticker);

create index if not exists analysis_notes_user_id_idx on public.analysis_notes (user_id);
create index if not exists analysis_notes_ticker_date_idx on public.analysis_notes (ticker, note_date desc);

create index if not exists news_items_ticker_idx on public.news_items (ticker);
create index if not exists news_items_related_tickers_gin_idx on public.news_items using gin (related_tickers);

alter table public.stocks enable row level security;
alter table public.portfolio_positions enable row level security;
alter table public.price_history enable row level security;
alter table public.stock_relations enable row level security;
alter table public.analysis_notes enable row level security;

grant select, insert, update, delete on public.stocks to authenticated;
grant select, insert, update, delete on public.portfolio_positions to authenticated;
grant select, insert, update, delete on public.price_history to authenticated;
grant select, insert, update, delete on public.stock_relations to authenticated;
grant select, insert, update, delete on public.analysis_notes to authenticated;

create policy "Users can select own stocks"
on public.stocks for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own stocks"
on public.stocks for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own stocks"
on public.stocks for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own stocks"
on public.stocks for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own portfolio positions"
on public.portfolio_positions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own portfolio positions"
on public.portfolio_positions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own portfolio positions"
on public.portfolio_positions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own portfolio positions"
on public.portfolio_positions for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own price history"
on public.price_history for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own price history"
on public.price_history for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own price history"
on public.price_history for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own price history"
on public.price_history for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own stock relations"
on public.stock_relations for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own stock relations"
on public.stock_relations for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own stock relations"
on public.stock_relations for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own stock relations"
on public.stock_relations for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own analysis notes"
on public.analysis_notes for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own analysis notes"
on public.analysis_notes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own analysis notes"
on public.analysis_notes for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own analysis notes"
on public.analysis_notes for delete
to authenticated
using (auth.uid() = user_id);
