import type { NewsItem, PortfolioPosition, PricePoint } from "../../lib/types";

interface StockIndicatorsPanelProps {
  ticker: string | null;
  position: PortfolioPosition | null;
  prices: PricePoint[];
  news: NewsItem[];
}

function StockIndicatorsPanel({ ticker, position, prices, news }: StockIndicatorsPanelProps) {
  const sentiment = calculateSentiment(news);
  const technical = calculateTechnicalSignal(position?.rsi ?? null, prices);
  const optionsTrend = formatOptionsTrend(position?.options_trend ?? null) ?? inferOptionsTrend(news);

  return (
    <section className="panel stock-indicators-panel">
      <div className="section-heading">
        <h2>市场指标</h2>
        <span>{ticker ?? "未选择"}</span>
      </div>

      <div className="stock-indicator-grid">
        <MetricItem
          label="市场情绪指数"
          value={sentiment.value == null ? "-" : String(sentiment.value)}
          detail={sentiment.label}
          tone={sentiment.tone}
        />
        <MetricItem label="市盈率" value={formatPeRatio(position?.pe_ratio ?? null)} detail="P/E" />
        <MetricItem label="期权趋势" value={optionsTrend ?? "-"} detail={optionsTrend ? "近期期权" : "暂无数据"} />
        <MetricItem
          label="技术区间"
          value={technical.label}
          detail={technical.rsi == null ? "RSI -" : `RSI ${technical.rsi.toFixed(1)}`}
          tone={technical.tone}
        />
      </div>
    </section>
  );
}

interface MetricItemProps {
  label: string;
  value: string;
  detail: string;
  tone?: "up" | "down";
}

function MetricItem({ label, value, detail, tone }: MetricItemProps) {
  return (
    <article className="stock-indicator-item">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function calculateSentiment(news: NewsItem[]) {
  const scores = news.map(newsScore).filter((score): score is number => score != null);
  if (scores.length === 0) {
    return { value: null, label: "暂无数据", tone: undefined };
  }

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const value = Math.round((clamp(average, -1, 1) + 1) * 50);
  if (value >= 65) {
    return { value, label: "偏乐观", tone: "up" as const };
  }
  if (value <= 35) {
    return { value, label: "偏谨慎", tone: "down" as const };
  }
  return { value, label: "中性", tone: undefined };
}

function newsScore(item: NewsItem) {
  if (item.impact_score != null) return clamp(item.impact_score, -1, 1);
  if (item.impact_direction === "positive") return 0.35;
  if (item.impact_direction === "negative") return -0.35;
  if (item.impact_direction === "neutral") return 0;
  return null;
}

function calculateTechnicalSignal(storedRsi: number | null, prices: PricePoint[]) {
  const rsi = storedRsi ?? calculateRsi(prices);
  if (rsi == null) {
    return { rsi: null, label: "数据不足", tone: undefined };
  }
  if (rsi >= 70) {
    return { rsi, label: "超买", tone: "down" as const };
  }
  if (rsi <= 30) {
    return { rsi, label: "超卖", tone: "up" as const };
  }
  return { rsi, label: "中性", tone: undefined };
}

function calculateRsi(prices: PricePoint[], period = 14) {
  if (prices.length < period + 1) return null;
  const closes = prices.map((point) => point.close);
  let gains = 0;
  let losses = 0;

  for (let index = closes.length - period; index < closes.length; index += 1) {
    const change = closes[index] - closes[index - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;
  if (averageGain === 0 && averageLoss === 0) return 50;
  if (averageLoss === 0) return 100;
  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function formatPeRatio(value: number | null) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "-";
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function formatOptionsTrend(value: string | null) {
  if (!value) return null;
  const lowerValue = value.toLowerCase();
  const ratioText = value.includes(";") ? value.split(";").slice(1).join(";").trim() : "";

  let label = "期权趋势不明确";
  if (lowerValue.includes("call activity leading")) {
    label = "看涨期权更活跃";
  } else if (lowerValue.includes("put activity leading")) {
    label = "看跌期权更活跃";
  } else if (lowerValue.includes("balanced")) {
    label = "看涨/看跌相对均衡";
  }

  return ratioText ? `${label} (${ratioText})` : label;
}

function inferOptionsTrend(news: NewsItem[]) {
  const optionNews = news.filter((item) => hasOptionSignal(`${item.title} ${item.summary ?? ""}`));
  if (optionNews.length === 0) return null;

  const optionScores = optionNews.map(newsScore).filter((score): score is number => score != null);
  const positiveCount = optionScores.filter((score) => score > 0).length;
  const negativeCount = optionScores.filter((score) => score < 0).length;
  if (positiveCount > negativeCount) return "期权相关新闻偏正面";
  if (negativeCount > positiveCount) return "期权相关新闻偏负面";
  return "期权相关新闻偏中性";
}

function hasOptionSignal(value: string) {
  return /options?|calls?|puts?|期权|看涨|看跌/i.test(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default StockIndicatorsPanel;
