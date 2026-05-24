import type { PortfolioPosition } from "../../lib/types";

interface PortfolioSummaryProps {
  positions: PortfolioPosition[];
}

function PortfolioSummary({ positions }: PortfolioSummaryProps) {
  const holdings = positions.filter((position) => position.position_type === "holding");
  const totalValue = holdings.reduce(
    (sum, position) => sum + (position.current_price ?? 0) * position.shares,
    0,
  );
  const dailyChangeValue = holdings.reduce(
    (sum, position) =>
      sum + ((position.current_price ?? 0) * position.shares * (position.daily_change ?? 0)) / 100,
    0,
  );
  const pnlPositions = holdings.filter((position) => position.average_cost != null);
  const totalCost = pnlPositions.reduce(
    (sum, position) => sum + (position.average_cost ?? 0) * position.shares,
    0,
  );
  const pnlValue = pnlPositions.reduce(
    (sum, position) => sum + (position.current_price ?? 0) * position.shares,
    0,
  );
  const totalPnl = pnlValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;

  return (
    <section className="summary-grid" aria-label="组合概览">
      <SummaryItem label="总资产" value={formatCurrency(totalValue)} />
      <SummaryItem
        label="今日涨跌"
        value={formatSignedCurrency(dailyChangeValue)}
        tone={dailyChangeValue >= 0 ? "up" : "down"}
      />
      <SummaryItem
        label="总盈亏"
        value={`${formatSignedCurrency(totalPnl)}${totalPnlPct == null ? "" : ` (${formatPercent(totalPnlPct)})`}`}
        tone={totalPnl >= 0 ? "up" : "down"}
      />
    </section>
  );
}

interface SummaryItemProps {
  label: string;
  value: string;
  tone?: "up" | "down";
}

function SummaryItem({ label, value, tone }: SummaryItemProps) {
  return (
    <article className="summary-item">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </article>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedCurrency(value: number) {
  const formatted = formatCurrency(Math.abs(value));
  return `${value >= 0 ? "+" : "-"}${formatted}`;
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default PortfolioSummary;
