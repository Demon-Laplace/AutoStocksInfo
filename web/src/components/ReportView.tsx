import ReactMarkdown from "react-markdown";
import type { DailyReport } from "../lib/types";

interface ReportViewProps {
  report: DailyReport | null;
}

function ReportView({ report }: ReportViewProps) {
  if (!report) {
    return <section className="panel empty-state">选择一份日报查看内容。</section>;
  }

  return (
    <article className="report-view">
      <ReactMarkdown>{report.content_markdown}</ReactMarkdown>
    </article>
  );
}

export default ReportView;
