import type { DashboardData, ImpactDirection, NewsItem, PortfolioPosition, PricePoint } from "./types";

const tickers = [
  { ticker: "AAPL", company_name: "Apple", market: "NASDAQ", sector: "Consumer Technology" },
  { ticker: "MSFT", company_name: "Microsoft", market: "NASDAQ", sector: "Cloud Software" },
  { ticker: "NVDA", company_name: "NVIDIA", market: "NASDAQ", sector: "Semiconductors" },
  { ticker: "ASML", company_name: "ASML", market: "NASDAQ", sector: "Semiconductor Equipment" },
  { ticker: "TSLA", company_name: "Tesla", market: "NASDAQ", sector: "EV" },
] as const;

export const mockDashboardData: DashboardData = {
  positions: tickers.map((stock, index): PortfolioPosition => {
    const price = 135 + index * 42;
    const shares = index === 0 ? 12 : index === 2 ? 6 : 0;
    const averageCost = shares > 0 ? price * 0.84 : null;
    return {
      id: `mock-position-${stock.ticker}`,
      stock_id: `mock-stock-${stock.ticker}`,
      ticker: stock.ticker,
      company_name: stock.company_name,
      market: stock.market,
      sector: stock.sector,
      position_type: shares > 0 ? "holding" : "watchlist",
      shares,
      average_cost: averageCost,
      current_price: price,
      daily_change: index % 2 === 0 ? 1.2 + index * 0.4 : -0.8 - index * 0.2,
      total_return: averageCost ? ((price - averageCost) / averageCost) * 100 : null,
      notes: index === 0 ? "核心消费科技持仓，关注服务收入和回购。" : "观察估值、增长和行业周期。",
    };
  }),
  pricesByTicker: Object.fromEntries(
    tickers.map((stock, index) => [stock.ticker, buildPriceHistory(stock.ticker, 95 + index * 35, index)]),
  ),
  newsByTicker: Object.fromEntries(tickers.map((stock, index) => [stock.ticker, buildNews(stock.ticker, index)])),
  portfolioValue: buildPortfolioValue(),
};

function buildPriceHistory(ticker: string, base: number, offset: number): PricePoint[] {
  const points: PricePoint[] = [];
  const today = new Date();
  for (let index = 360; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const drift = (360 - index) * (0.05 + offset * 0.012);
    const wave = Math.sin((360 - index + offset * 9) / 17) * (4 + offset);
    const close = round(base + drift + wave);
    points.push({
      ticker,
      date: date.toISOString().slice(0, 10),
      open: round(close * 0.995),
      high: round(close * 1.012),
      low: round(close * 0.988),
      close,
      volume: 3_000_000 + offset * 500_000 + index * 1_000,
    });
  }
  return points;
}

function buildNews(ticker: string, offset: number): NewsItem[] {
  const directions: ImpactDirection[] = ["positive", "neutral", "negative"];
  return [0, 1, 2].map((index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const direction = directions[(index + offset) % directions.length];
    return {
      id: `mock-news-${ticker}-${index}`,
      ticker,
      related_tickers: index === 0 ? ["NVDA", "MSFT"].filter((item) => item !== ticker) : [],
      title: `${ticker} ${index === 0 ? "quarterly update" : index === 1 ? "sector read-through" : "valuation note"}`,
      source: index === 0 ? "Mock Wire" : "Research Feed",
      url: "https://example.com",
      published_at: date.toISOString(),
      summary:
        direction === "positive"
          ? "营收或行业需求信号偏强，短期情绪改善。"
          : direction === "negative"
            ? "成本、监管或估值压力上升，需要继续观察。"
            : "信息偏中性，更多是行业背景更新。",
      impact_score: direction === "positive" ? 0.68 : direction === "negative" ? -0.42 : 0.08,
      impact_direction: direction,
    };
  });
}

function buildPortfolioValue() {
  const points = [];
  const today = new Date();
  for (let index = 120; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    points.push({
      date: date.toISOString().slice(0, 10),
      value: round(15000 + (120 - index) * 42 + Math.sin(index / 8) * 420),
    });
  }
  return points;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
