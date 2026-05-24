import { useMemo, useState } from "react";
import type { LegacyNewsItem } from "../lib/types";

interface NewsListProps {
  news: LegacyNewsItem[];
}

function NewsList({ news }: NewsListProps) {
  const [holding, setHolding] = useState("all");
  const [level, setLevel] = useState("all");
  const [direction, setDirection] = useState("all");

  const holdingOptions = useMemo(() => {
    const values = new Set<string>();
    news.forEach((item) => item.related_holdings?.forEach((ticker) => values.add(ticker)));
    return Array.from(values).sort();
  }, [news]);

  const filteredNews = news.filter((item) => {
    const holdingMatch = holding === "all" || item.related_holdings?.includes(holding);
    const levelMatch = level === "all" || item.impact_level === level;
    const directionMatch = direction === "all" || item.impact_direction === direction;
    return holdingMatch && levelMatch && directionMatch;
  });

  return (
    <section className="news-page">
      <div className="filter-row">
        <select value={holding} onChange={(event) => setHolding(event.target.value)}>
          <option value="all">全部持仓</option>
          {holdingOptions.map((ticker) => (
            <option key={ticker} value={ticker}>
              {ticker}
            </option>
          ))}
        </select>
        <select value={level} onChange={(event) => setLevel(event.target.value)}>
          <option value="all">全部影响</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
        <select value={direction} onChange={(event) => setDirection(event.target.value)}>
          <option value="all">全部方向</option>
          <option value="positive">正面</option>
          <option value="negative">负面</option>
          <option value="mixed">混合</option>
          <option value="neutral">中性</option>
          <option value="unknown">未知</option>
        </select>
      </div>

      {filteredNews.length === 0 ? (
        <div className="panel empty-state">当前筛选条件下没有新闻。</div>
      ) : (
        <div className="news-list">
          {filteredNews.map((item) => (
            <article key={item.id} className={`news-card impact-${item.impact_level}`}>
              <div className="card-meta">
                <span>{item.source || "未知来源"}</span>
                <span>{formatDateTime(item.published_at || item.fetched_at)}</span>
              </div>
              <h2>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              </h2>
              <div className="badge-row">
                <span className={`badge direction-${item.impact_direction}`}>
                  {directionLabel(item.impact_direction)}
                </span>
                <span className="badge">{levelLabel(item.impact_level)}</span>
                {item.related_holdings?.map((ticker) => (
                  <span key={ticker} className="badge muted-badge">
                    {ticker}
                  </span>
                ))}
              </div>
              {item.reason && <p>{item.reason}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function levelLabel(value: string) {
  return { high: "高影响", medium: "中影响", low: "低影响" }[value] ?? value;
}

function directionLabel(value: string) {
  return {
    positive: "正面",
    negative: "负面",
    mixed: "混合",
    neutral: "中性",
    unknown: "未知",
  }[value] ?? value;
}

export default NewsList;
