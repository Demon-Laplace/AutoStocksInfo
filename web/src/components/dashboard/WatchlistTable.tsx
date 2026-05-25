import type { PortfolioPosition } from "../../lib/types";

interface WatchlistTableProps {
  positions: PortfolioPosition[];
  selectedTicker: string | null;
  onSelect: (ticker: string) => void;
}

function WatchlistTable({ positions, selectedTicker, onSelect }: WatchlistTableProps) {
  const sortedPositions = [...positions].sort((left, right) => {
    if (left.position_type !== right.position_type) {
      return left.position_type === "holding" ? -1 : 1;
    }
    return left.ticker.localeCompare(right.ticker);
  });

  if (sortedPositions.length === 0) {
    return <section className="panel empty-state">暂无持仓或观察股票。</section>;
  }

  return (
    <section className="panel watchlist-panel">
      <div className="section-heading">
        <h2>持仓与观察</h2>
        <span>{sortedPositions.length} stocks</span>
      </div>

      <div className="watchlist-table-wrap">
        <table className="watchlist-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Type</th>
              <th>Shares</th>
              <th>Avg</th>
              <th>Price</th>
              <th>Day</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedPositions.map((position) => (
              <tr key={position.id} className={selectedTicker === position.ticker ? "selected" : ""}>
                <td>
                  <button type="button" className="ticker-button" onClick={() => onSelect(position.ticker)}>
                    {position.ticker}
                  </button>
                </td>
                <td>{position.position_type === "holding" ? "持仓" : "观察"}</td>
                <td>{position.shares || "-"}</td>
                <td>{formatCurrency(position.average_cost)}</td>
                <td>{formatCurrency(position.current_price)}</td>
                <td className={toneClass(position.daily_change)}>{formatPercent(position.daily_change)}</td>
                <td className={toneClass(position.total_return)}>{formatPercent(position.total_return)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="watchlist-cards">
        {sortedPositions.map((position) => (
          <button
            key={position.id}
            type="button"
            className={`watchlist-card ${selectedTicker === position.ticker ? "selected" : ""}`}
            onClick={() => onSelect(position.ticker)}
          >
            <span>
              <strong>{position.ticker}</strong>
              <small>{position.company_name}</small>
            </span>
            <span>
              <strong>{formatCurrency(position.current_price)}</strong>
              <small className={toneClass(position.daily_change)}>{formatPercent(position.daily_change)}</small>
            </span>
            <span className="watchlist-card-note">{position.notes || position.sector || position.market}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function toneClass(value: number | null) {
  if (value == null || value === 0) return "";
  return value > 0 ? "up" : "down";
}

function formatCurrency(value: number | null) {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value == null) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default WatchlistTable;
