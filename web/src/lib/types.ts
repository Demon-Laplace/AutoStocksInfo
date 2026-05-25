export type PositionType = "holding" | "watchlist";

export type ImpactDirection = "positive" | "negative" | "neutral" | "unclear";

export type TimeRange = "1W" | "1M" | "6M" | "1Y" | "MAX";

export interface Stock {
  id: string;
  ticker: string;
  company_name: string;
  market: string;
  sector: string | null;
  currency: string;
}

export interface PortfolioPosition {
  id: string;
  stock_id: string | null;
  ticker: string;
  company_name: string;
  market: string;
  sector: string | null;
  position_type: PositionType;
  shares: number;
  average_cost: number | null;
  current_price: number | null;
  daily_change: number | null;
  total_return: number | null;
  notes: string | null;
  pe_ratio: number | null;
  options_trend: string | null;
  rsi: number | null;
}

export interface PricePoint {
  ticker: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
  pe_ratio: number | null;
  options_trend: string | null;
  rsi: number | null;
}

export interface NewsItem {
  id: string;
  ticker: string;
  related_tickers: string[];
  title: string;
  source: string | null;
  url: string;
  published_at: string | null;
  summary: string | null;
  impact_score: number | null;
  impact_direction: ImpactDirection;
}

export interface AnalysisNote {
  id: string;
  ticker: string;
  title: string;
  content: string;
  created_at: string;
  tags: string[];
}

export interface PortfolioValuePoint {
  date: string;
  value: number;
}

export interface DashboardData {
  positions: PortfolioPosition[];
  pricesByTicker: Record<string, PricePoint[]>;
  newsByTicker: Record<string, NewsItem[]>;
  portfolioValue: PortfolioValuePoint[];
}

export interface DailyReport {
  id: string;
  report_date: string;
  title: string;
  content_markdown: string;
  high_impact_count: number;
  medium_impact_count: number;
  low_impact_count: number;
  generated_at: string;
}

export interface LegacyNewsItem {
  id: string;
  title: string;
  url: string;
  source: string | null;
  published_at: string | null;
  fetched_at: string | null;
  related_holdings: string[];
  tickers: string[];
  themes: string[];
  impact_direction: string;
  impact_level: string;
  confidence: string;
  reason: string | null;
}

export interface LegacyHolding {
  id: string;
  ticker: string;
  name: string | null;
  market: string | null;
  position_type: string | null;
  weight: number | null;
  note: string | null;
  is_active: boolean;
}

export interface LegacyPriceSnapshot {
  id: string;
  ticker: string;
  snapshot_date: string;
  close: number | null;
  previous_close: number | null;
  change_pct: number | null;
  volume: number | null;
  source: string | null;
  pe_ratio?: number | null;
  options_trend?: string | null;
  rsi?: number | null;
}
