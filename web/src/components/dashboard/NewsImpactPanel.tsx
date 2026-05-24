import type { NewsItem } from "../../lib/types";

interface NewsImpactPanelProps {
  ticker: string | null;
  news: NewsItem[];
}

function NewsImpactPanel({ ticker, news }: NewsImpactPanelProps) {
  return (
    <section className="panel news-impact-panel">
      <div className="section-heading">
        <h2>相关新闻</h2>
        <span>{ticker ?? "未选择"}</span>
      </div>

      {news.length === 0 ? (
        <div className="empty-state">暂无相关新闻。</div>
      ) : (
        <div className="impact-list">
          {news.slice(0, 6).map((item) => (
            <article key={item.id} className="impact-item">
              <div className="card-meta">
                <span>{item.source || "Unknown"}</span>
                <span>{formatDate(item.published_at)}</span>
              </div>
              <h3>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              </h3>
              <div className="badge-row">
                <span className={`badge direction-${item.impact_direction}`}>
                  {directionLabel(item.impact_direction)}
                </span>
                {item.impact_score != null && (
                  <span className="badge muted-badge">score {item.impact_score.toFixed(2)}</span>
                )}
                {item.related_tickers.map((relatedTicker) => (
                  <span key={relatedTicker} className="badge muted-badge">
                    {relatedTicker}
                  </span>
                ))}
              </div>
              {item.summary && <p>{item.summary}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function directionLabel(value: NewsItem["impact_direction"]) {
  return {
    positive: "正面",
    negative: "负面",
    neutral: "中性",
    unclear: "不明确",
  }[value];
}

function formatDate(value: string | null) {
  if (!value) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export default NewsImpactPanel;
