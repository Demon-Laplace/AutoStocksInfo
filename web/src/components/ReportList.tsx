import type { DailyReport } from "../App";

interface ReportListProps {
  reports: DailyReport[];
  selectedReportId: string | null;
  onSelect: (reportId: string) => void;
}

function ReportList({ reports, selectedReportId, onSelect }: ReportListProps) {
  if (reports.length === 0) {
    return <section className="panel empty-state">暂无日报。</section>;
  }

  return (
    <section className="report-list" aria-label="日报列表">
      {reports.map((report) => (
        <button
          key={report.id}
          type="button"
          className={report.id === selectedReportId ? "report-list-item selected" : "report-list-item"}
          onClick={() => onSelect(report.id)}
        >
          <span>{formatDate(report.report_date)}</span>
          <small>
            高 {report.high_impact_count} / 中 {report.medium_impact_count} / 低{" "}
            {report.low_impact_count}
          </small>
        </button>
      ))}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

export default ReportList;
