alter table public.price_snapshots add column if not exists pe_ratio numeric;
alter table public.price_snapshots add column if not exists options_trend text;
alter table public.price_snapshots add column if not exists rsi numeric;

alter table public.price_history add column if not exists pe_ratio numeric;
alter table public.price_history add column if not exists options_trend text;
alter table public.price_history add column if not exists rsi numeric;
