import { supabase } from "../supabase";
import { mockDashboardData } from "../mockDashboardData";
import type {
  DashboardData,
  ImpactDirection,
  LegacyHolding,
  LegacyNewsItem,
  LegacyPriceSnapshot,
  NewsItem,
  PortfolioPosition,
  PricePoint,
  PositionType,
} from "../types";

interface StockRow {
  id: string;
  ticker: string;
  company_name: string | null;
  market: string | null;
  sector: string | null;
  currency: string | null;
}

interface PositionRow {
  id: string;
  stock_id: string | null;
  ticker: string;
  position_type: string | null;
  shares: number | null;
  average_cost: number | null;
  current_price: number | null;
  daily_change: number | null;
  total_return: number | null;
  notes: string | null;
}

interface PriceHistoryRow {
  ticker: string;
  price_date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

interface NewsRow {
  id: string;
  ticker: string | null;
  related_tickers: string[] | null;
  title: string;
  source: string | null;
  url: string;
  published_at: string | null;
  summary: string | null;
  impact_score: number | null;
  impact_direction: string | null;
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const dashboardData = await fetchStructuredDashboardData();
  if (dashboardData) {
    return dashboardData;
  }

  const legacyData = await fetchLegacyDashboardData();
  return legacyData ?? mockDashboardData;
}

async function fetchStructuredDashboardData(): Promise<DashboardData | null> {
  const [stocksResult, positionsResult, pricesResult, newsResult] = await Promise.all([
    supabase.from("stocks").select("*").order("ticker"),
    supabase.from("portfolio_positions").select("*").eq("is_active", true).order("ticker"),
    supabase.from("price_history").select("*").order("price_date", { ascending: true }).limit(5000),
    supabase
      .from("news_items")
      .select("id,ticker,related_tickers,title,source,url,published_at,summary,impact_score,impact_direction")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(200),
  ]);

  if (stocksResult.error || positionsResult.error || pricesResult.error || newsResult.error) {
    return null;
  }

  const stocks = (stocksResult.data ?? []) as StockRow[];
  const positions = (positionsResult.data ?? []) as PositionRow[];
  const prices = (pricesResult.data ?? []) as PriceHistoryRow[];
  const news = (newsResult.data ?? []) as NewsRow[];

  if (stocks.length === 0 && positions.length === 0 && prices.length === 0) {
    return null;
  }

  const stockByTicker = new Map(stocks.map((stock) => [stock.ticker, stock]));
  const normalizedPositions = positions.map((position): PortfolioPosition => {
    const stock = stockByTicker.get(position.ticker);
    return {
      id: position.id,
      stock_id: position.stock_id,
      ticker: position.ticker,
      company_name: stock?.company_name || position.ticker,
      market: stock?.market || "US",
      sector: stock?.sector ?? null,
      position_type: toPositionType(position.position_type),
      shares: Number(position.shares ?? 0),
      average_cost: toNumberOrNull(position.average_cost),
      current_price: toNumberOrNull(position.current_price),
      daily_change: toNumberOrNull(position.daily_change),
      total_return: toNumberOrNull(position.total_return),
      notes: position.notes,
    };
  });

  const pricesByTicker = groupByTicker(
    prices.flatMap((point): PricePoint[] =>
      point.close == null
        ? []
        : [
            {
              ticker: point.ticker,
              date: point.price_date,
              open: toNumberOrNull(point.open),
              high: toNumberOrNull(point.high),
              low: toNumberOrNull(point.low),
              close: Number(point.close),
              volume: toNumberOrNull(point.volume),
            },
          ],
    ),
  );

  return {
    positions: normalizedPositions,
    pricesByTicker,
    newsByTicker: groupNews(news.map(toNewsItem).filter((item) => item.ticker)),
    portfolioValue: buildPortfolioValue(normalizedPositions, pricesByTicker),
  };
}

async function fetchLegacyDashboardData(): Promise<DashboardData | null> {
  const [holdingsResult, pricesResult, newsResult] = await Promise.all([
    supabase.from("holdings").select("*").eq("is_active", true).order("ticker"),
    supabase.from("price_snapshots").select("*").order("snapshot_date", { ascending: true }).limit(2000),
    supabase
      .from("news_items")
      .select("*")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(200),
  ]);

  if (holdingsResult.error || pricesResult.error || newsResult.error) {
    return null;
  }

  const holdings = (holdingsResult.data ?? []) as LegacyHolding[];
  const priceSnapshots = (pricesResult.data ?? []) as LegacyPriceSnapshot[];
  const legacyNews = (newsResult.data ?? []) as LegacyNewsItem[];
  if (holdings.length === 0 && priceSnapshots.length === 0) {
    return null;
  }

  const latestPriceByTicker = new Map<string, LegacyPriceSnapshot>();
  for (const price of [...priceSnapshots].reverse()) {
    if (!latestPriceByTicker.has(price.ticker)) {
      latestPriceByTicker.set(price.ticker, price);
    }
  }

  const positions = holdings.map((holding): PortfolioPosition => {
    const latestPrice = latestPriceByTicker.get(holding.ticker);
    return {
      id: holding.id,
      stock_id: null,
      ticker: holding.ticker,
      company_name: holding.name || holding.ticker,
      market: holding.market || "US",
      sector: null,
      position_type: holding.position_type === "watchlist" ? "watchlist" : "holding",
      shares: 0,
      average_cost: null,
      current_price: latestPrice?.close ?? null,
      daily_change: latestPrice?.change_pct ?? null,
      total_return: null,
      notes: holding.note,
    };
  });

  const pricesByTicker = groupByTicker(
    priceSnapshots.flatMap((price): PricePoint[] =>
      price.close == null
        ? []
        : [
            {
              ticker: price.ticker,
              date: price.snapshot_date,
              open: null,
              high: null,
              low: null,
              close: price.close,
              volume: price.volume,
            },
          ],
    ),
  );

  const newsItems = legacyNews.flatMap((item): NewsItem[] => {
    const tickers = item.related_holdings?.length ? item.related_holdings : item.tickers ?? [];
    return tickers.map((ticker) => ({
      id: `${item.id}-${ticker}`,
      ticker,
      related_tickers: (item.tickers ?? []).filter((relatedTicker) => relatedTicker !== ticker),
      title: item.title,
      source: item.source,
      url: item.url,
      published_at: item.published_at || item.fetched_at,
      summary: item.reason,
      impact_score: impactLevelToScore(item.impact_level, item.impact_direction),
      impact_direction: normalizeImpactDirection(item.impact_direction),
    }));
  });

  return {
    positions,
    pricesByTicker,
    newsByTicker: groupNews(newsItems),
    portfolioValue: buildPortfolioValue(positions, pricesByTicker),
  };
}

function groupByTicker(points: PricePoint[]) {
  const grouped: Record<string, PricePoint[]> = {};
  for (const point of points) {
    grouped[point.ticker] = [...(grouped[point.ticker] ?? []), point];
  }
  return grouped;
}

function groupNews(items: NewsItem[]) {
  const grouped: Record<string, NewsItem[]> = {};
  for (const item of items) {
    grouped[item.ticker] = [...(grouped[item.ticker] ?? []), item];
  }
  return grouped;
}

function toNewsItem(row: NewsRow): NewsItem {
  return {
    id: row.id,
    ticker: row.ticker ?? "",
    related_tickers: row.related_tickers ?? [],
    title: row.title,
    source: row.source,
    url: row.url,
    published_at: row.published_at,
    summary: row.summary,
    impact_score: toNumberOrNull(row.impact_score),
    impact_direction: normalizeImpactDirection(row.impact_direction),
  };
}

function buildPortfolioValue(positions: PortfolioPosition[], pricesByTicker: Record<string, PricePoint[]>) {
  const heldPositions = positions.filter((position) => position.position_type === "holding" && position.shares > 0);
  const dateValues = new Map<string, number>();
  for (const position of heldPositions) {
    for (const point of pricesByTicker[position.ticker] ?? []) {
      dateValues.set(point.date, (dateValues.get(point.date) ?? 0) + point.close * position.shares);
    }
  }
  return Array.from(dateValues.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));
}

function toPositionType(value: string | null): PositionType {
  return value === "watchlist" ? "watchlist" : "holding";
}

function normalizeImpactDirection(value: string | null): ImpactDirection {
  if (value === "positive" || value === "negative" || value === "neutral" || value === "unclear") {
    return value;
  }
  return "unclear";
}

function impactLevelToScore(level: string, direction: string) {
  const magnitude = level === "high" ? 0.8 : level === "medium" ? 0.45 : 0.18;
  return direction === "negative" ? -magnitude : direction === "positive" ? magnitude : 0;
}

function toNumberOrNull(value: number | null) {
  return value == null ? null : Number(value);
}
