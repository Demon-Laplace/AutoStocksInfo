import { useEffect, useMemo, useState } from "react";
import type { DashboardData, TimeRange } from "../../lib/types";
import PortfolioSummary from "./PortfolioSummary";
import PortfolioValueChart from "./PortfolioValueChart";
import StockPriceChart from "./StockPriceChart";
import StockIndicatorsPanel from "./StockIndicatorsPanel";
import WatchlistTable from "./WatchlistTable";
import NewsImpactPanel from "./NewsImpactPanel";

interface DashboardPageProps {
  data: DashboardData | null;
  onManageHoldings: () => void;
}

function DashboardPage({ data, onManageHoldings }: DashboardPageProps) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>("1M");

  useEffect(() => {
    if (data?.positions.length && !data.positions.some((position) => position.ticker === selectedTicker)) {
      setSelectedTicker(data.positions[0].ticker);
    }
  }, [data?.positions, selectedTicker]);

  const selectedPosition = useMemo(
    () => data?.positions.find((position) => position.ticker === selectedTicker) ?? null,
    [data?.positions, selectedTicker],
  );
  const selectedPrices = selectedTicker && data ? data.pricesByTicker[selectedTicker] ?? [] : [];
  const selectedNews = selectedTicker && data ? data.newsByTicker[selectedTicker] ?? [] : [];

  if (!data) {
    return <section className="panel empty-state">正在读取 dashboard 数据...</section>;
  }

  return (
    <section className="dashboard-page">
      <div className="dashboard-toolbar">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h2>投资总览</h2>
        </div>
        <button type="button" className="text-button primary-button" onClick={onManageHoldings}>
          管理持仓
        </button>
      </div>

      <PortfolioSummary positions={data.positions} />

      <div className="dashboard-grid">
        <div className="dashboard-left">
          <WatchlistTable
            positions={data.positions}
            selectedTicker={selectedTicker}
            onSelect={setSelectedTicker}
          />
          <PortfolioValueChart data={data.portfolioValue} />
        </div>

        <div className="dashboard-right">
          <StockPriceChart
            ticker={selectedPosition?.ticker ?? selectedTicker}
            points={selectedPrices}
            range={range}
            onRangeChange={setRange}
          />
          <StockIndicatorsPanel
            ticker={selectedPosition?.ticker ?? selectedTicker}
            position={selectedPosition}
            prices={selectedPrices}
            news={selectedNews}
          />
          <NewsImpactPanel ticker={selectedTicker} news={selectedNews} />
        </div>
      </div>
    </section>
  );
}

export default DashboardPage;
