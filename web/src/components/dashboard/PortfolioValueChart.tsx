import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PortfolioValuePoint } from "../../lib/types";

interface PortfolioValueChartProps {
  data: PortfolioValuePoint[];
}

function PortfolioValueChart({ data }: PortfolioValueChartProps) {
  return (
    <section className="panel portfolio-chart-panel">
      <div className="section-heading">
        <h2>组合资产变化</h2>
        <span>{data.length ? formatCurrency(data[data.length - 1].value) : "-"}</span>
      </div>

      <div className="portfolio-value-chart">
        {data.length === 0 ? (
          <div className="empty-state">暂无组合资产历史。</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), "Value"]}
                labelFormatter={(label) => String(label)}
              />
              <Line type="monotone" dataKey="value" stroke="#0f5e9c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default PortfolioValueChart;
