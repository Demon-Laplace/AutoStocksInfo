import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SingleValueData,
  type Time,
} from "lightweight-charts";
import type { PricePoint, TimeRange } from "../../lib/types";
import TimeRangeSelector from "./TimeRangeSelector";

interface StockPriceChartProps {
  ticker: string | null;
  points: PricePoint[];
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
}

interface HoverValue {
  date: string;
  price: number;
}

function StockPriceChart({ ticker, points, range, onRangeChange }: StockPriceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const [hoverValue, setHoverValue] = useState<HoverValue | null>(null);

  const visiblePoints = useMemo(() => filterPoints(points, range), [points, range]);
  const first = visiblePoints[0]?.close ?? null;
  const last = visiblePoints[visiblePoints.length - 1]?.close ?? null;
  const changePct = first && last ? ((last - first) / first) * 100 : null;
  const isPositive = (changePct ?? 0) >= 0;
  const lineColor = isPositive ? "#146c2e" : "#9b2117";
  const topColor = isPositive ? "rgba(20, 108, 46, 0.22)" : "rgba(155, 33, 23, 0.2)";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const chart = createChart(container, {
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#667085",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      grid: {
        vertLines: { color: "transparent" },
        horzLines: { color: "#eef1f4" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: false,
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor,
      bottomColor: "rgba(255, 255, 255, 0)",
      lineWidth: 2,
      priceLineVisible: false,
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !seriesRef.current) {
        setHoverValue(null);
        return;
      }
      const data = param.seriesData.get(seriesRef.current);
      const price = getPriceFromSeriesData(data);
      setHoverValue(price == null ? null : { date: String(param.time), price });
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const observer = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: Math.floor(entry.contentRect.width) });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const chartData: SingleValueData<Time>[] = visiblePoints.map((point) => ({
      time: point.date as Time,
      value: point.close,
    }));
    series.setData(chartData);
    series.applyOptions({
      lineColor,
      topColor,
      bottomColor: "rgba(255, 255, 255, 0)",
    });
    chart.timeScale().fitContent();
  }, [lineColor, topColor, visiblePoints]);

  return (
    <section className="panel stock-chart-panel">
      <div className="stock-chart-header">
        <div>
          <span className="eyebrow">Price</span>
          <h2>{ticker ?? "选择股票"}</h2>
        </div>
        <div className="chart-readout">
          <strong>{formatCurrency(hoverValue?.price ?? last)}</strong>
          <span className={isPositive ? "up" : "down"}>{formatPercent(changePct)}</span>
          {hoverValue && <small>{hoverValue.date}</small>}
        </div>
      </div>

      <div className="stock-chart-canvas" ref={containerRef}>
        {visiblePoints.length === 0 && <div className="empty-state">暂无价格历史。</div>}
      </div>

      <TimeRangeSelector value={range} onChange={onRangeChange} />
    </section>
  );
}

function filterPoints(points: PricePoint[], range: TimeRange) {
  if (range === "MAX") return points;
  const daysByRange: Record<Exclude<TimeRange, "MAX">, number> = {
    "1W": 7,
    "1M": 31,
    "6M": 183,
    "1Y": 365,
  };
  const latest = points[points.length - 1]?.date;
  if (!latest) return [];
  const start = new Date(latest);
  start.setDate(start.getDate() - daysByRange[range]);
  return points.filter((point) => new Date(point.date) >= start);
}

function getPriceFromSeriesData(data: unknown) {
  if (typeof data !== "object" || data === null) return null;
  if ("value" in data && typeof data.value === "number") return data.value;
  if ("close" in data && typeof data.close === "number") return data.close;
  return null;
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

export default StockPriceChart;
