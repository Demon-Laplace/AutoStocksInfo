import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import Layout, { TabKey } from "./components/Layout";
import ReportList from "./components/ReportList";
import ReportView from "./components/ReportView";
import NewsList from "./components/NewsList";
import HoldingCard from "./components/HoldingCard";

export interface DailyReport {
  id: string;
  report_date: string;
  title: string;
  content_markdown: string;
  high_impact_count: number;
  medium_impact_count: number;
  low_impact_count: number;
  generated_at: string;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string | null;
  published_at: string | null;
  fetched_at: string | null;
  related_holdings: string[];
  tickers: string[];
  themes: string[];
  impact_direction: string;
  impact_level: string;
  confidence: string;
  reason: string | null;
}

export interface Holding {
  id: string;
  ticker: string;
  name: string | null;
  market: string | null;
  position_type: string | null;
  note: string | null;
  is_active: boolean;
}

export interface PriceSnapshot {
  id: string;
  ticker: string;
  snapshot_date: string;
  close: number | null;
  previous_close: number | null;
  change_pct: number | null;
  volume: number | null;
  source: string | null;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("reports");
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [prices, setPrices] = useState<PriceSnapshot[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    void loadData();
  }, [session]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId],
  );

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [reportsResult, newsResult, holdingsResult, pricesResult] = await Promise.all([
        supabase
          .from("daily_reports")
          .select("*")
          .order("report_date", { ascending: false })
          .limit(30),
        supabase
          .from("news_items")
          .select("*")
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(100),
        supabase.from("holdings").select("*").eq("is_active", true).order("ticker"),
        supabase
          .from("price_snapshots")
          .select("*")
          .order("snapshot_date", { ascending: false })
          .limit(300),
      ]);

      if (reportsResult.error) throw reportsResult.error;
      if (newsResult.error) throw newsResult.error;
      if (holdingsResult.error) throw holdingsResult.error;
      if (pricesResult.error) throw pricesResult.error;

      const nextReports = (reportsResult.data ?? []) as DailyReport[];
      setReports(nextReports);
      setNews((newsResult.data ?? []) as NewsItem[]);
      setHoldings((holdingsResult.data ?? []) as Holding[]);
      setPrices(latestPricesByTicker((pricesResult.data ?? []) as PriceSnapshot[]));
      setSelectedReportId((current) => current ?? nextReports[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取数据失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMessage("");
    setError("");
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setAuthMessage("登录链接已发送，请检查邮箱。");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setReports([]);
    setNews([]);
    setHoldings([]);
    setPrices([]);
    setSelectedReportId(null);
  }

  if (!authReady) {
    return <main className="centered">加载中...</main>;
  }

  if (!session) {
    return (
      <main className="login-page">
        <form className="login-panel" onSubmit={handleLogin}>
          <h1>Investment Intel</h1>
          <label htmlFor="email">邮箱</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <button type="submit">发送登录链接</button>
          {authMessage && <p className="success-text">{authMessage}</p>}
          {error && <p className="error-text">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab} onSignOut={handleSignOut}>
      {error && <p className="error-text">{error}</p>}
      {loading && <p className="muted">正在读取最新数据...</p>}

      {activeTab === "reports" && (
        <div className="split-view">
          <ReportList
            reports={reports}
            selectedReportId={selectedReport?.id ?? null}
            onSelect={setSelectedReportId}
          />
          <ReportView report={selectedReport} />
        </div>
      )}

      {activeTab === "news" && <NewsList news={news} />}

      {activeTab === "holdings" && <HoldingCard holdings={holdings} prices={prices} />}
    </Layout>
  );
}

function latestPricesByTicker(prices: PriceSnapshot[]) {
  const byTicker = new Map<string, PriceSnapshot>();
  for (const price of prices) {
    if (!byTicker.has(price.ticker)) {
      byTicker.set(price.ticker, price);
    }
  }
  return Array.from(byTicker.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export default App;
