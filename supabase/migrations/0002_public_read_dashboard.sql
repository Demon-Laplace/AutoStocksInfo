grant select on public.holdings to anon;
grant select on public.related_assets to anon;
grant select on public.news_items to anon;
grant select on public.sec_filings to anon;
grant select on public.daily_reports to anon;
grant select on public.price_snapshots to anon;

create policy "Public can read holdings"
on public.holdings for select
to anon
using (true);

create policy "Public can read related assets"
on public.related_assets for select
to anon
using (true);

create policy "Public can read news items"
on public.news_items for select
to anon
using (true);

create policy "Public can read sec filings"
on public.sec_filings for select
to anon
using (true);

create policy "Public can read daily reports"
on public.daily_reports for select
to anon
using (true);

create policy "Public can read price snapshots"
on public.price_snapshots for select
to anon
using (true);
