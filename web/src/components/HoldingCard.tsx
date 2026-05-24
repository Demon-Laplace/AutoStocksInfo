import type { Holding, PriceSnapshot } from "../App";

interface HoldingCardProps {
  holdings: Holding[];
  prices: PriceSnapshot[];
}

function HoldingCard({ holdings, prices }: HoldingCardProps) {
  const priceByTicker = new Map(prices.map((price) => [price.ticker, price]));
  const sortedHoldings = [...holdings].sort((a, b) => {
    const typeOrder = typeRank(a.position_type) - typeRank(b.position_type);
    return typeOrder || a.ticker.localeCompare(b.ticker);
  });

  if (sortedHoldings.length === 0) {
    return <section className="panel empty-state">暂无持仓数据。</section>;
  }

  return (
    <section className="holding-grid">
      {sortedHoldings.map((holding) => {
        const price = priceByTicker.get(holding.ticker);
        return (
          <article key={holding.id} className="holding-card">
            <div className="holding-card-header">
              <div>
                <h2>{holding.ticker}</h2>
                <p>{holding.name || holding.market || "未命名资产"}</p>
              </div>
              <span className="badge muted-badge">{holding.position_type || "holding"}</span>
            </div>
            {price ? (
              <div className="price-row">
                <span>收盘 {formatNumber(price.close)}</span>
                <strong className={Number(price.change_pct) >= 0 ? "up" : "down"}>
                  {formatPct(price.change_pct)}
                </strong>
              </div>
            ) : (
              <p className="muted">暂无价格快照。</p>
            )}
            {holding.note && <p className="note">{holding.note}</p>}
          </article>
        );
      })}
    </section>
  );
}

function typeRank(value: string | null) {
  if (value === "holding") return 0;
  if (value === "watchlist") return 1;
  return 2;
}

function formatNumber(value: number | null) {
  return typeof value === "number" ? value.toFixed(2) : "N/A";
}

function formatPct(value: number | null) {
  return typeof value === "number" ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "N/A";
}

export default HoldingCard;
