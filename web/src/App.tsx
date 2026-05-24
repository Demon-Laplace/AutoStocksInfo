import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { fetchDashboardData } from "./lib/queries/dashboard";
import type {
  DailyReport,
  DashboardData,
  LegacyHolding,
  LegacyNewsItem,
  LegacyPriceSnapshot,
} from "./lib/types";
import Layout from "./components/Layout";
import type { TabKey } from "./components/Layout";
import ReportList from "./components/ReportList";
import ReportView from "./components/ReportView";
import NewsList from "./components/NewsList";
import HoldingCard from "./components/HoldingCard";
import type { HoldingDraft } from "./components/HoldingCard";
import DashboardPage from "./components/dashboard/DashboardPage";

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [news, setNews] = useState<LegacyNewsItem[]>([]);
  const [holdings, setHoldings] = useState<LegacyHolding[]>([]);
  const [prices, setPrices] = useState<LegacyPriceSnapshot[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [holdingSaving, setHoldingSaving] = useState(false);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [holdingMessage, setHoldingMessage] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        void loadData();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
          .gte("published_at", recentNewsStartIso())
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(100),
        supabase.from("holdings").select("*").eq("is_active", true).order("ticker"),
        supabase
          .from("price_snapshots")
          .select("*")
          .order("snapshot_date", { ascending: false })
          .limit(300),
      ]);
      const nextDashboardData = await fetchDashboardData();

      if (reportsResult.error) throw reportsResult.error;
      if (newsResult.error) throw newsResult.error;
      if (holdingsResult.error) throw holdingsResult.error;
      if (pricesResult.error) throw pricesResult.error;

      const nextReports = (reportsResult.data ?? []) as DailyReport[];
      setDashboardData(nextDashboardData);
      setReports(nextReports);
      setNews((newsResult.data ?? []) as LegacyNewsItem[]);
      setHoldings((holdingsResult.data ?? []) as LegacyHolding[]);
      setPrices(latestPricesByTicker((pricesResult.data ?? []) as LegacyPriceSnapshot[]));
      setSelectedReportId((current) => current ?? nextReports[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取数据失败");
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    setAuthLoading(true);
    setAuthError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      await loadData();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    setAuthLoading(true);
    setAuthError("");
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setHoldingMessage("");
      await loadData();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "退出登录失败");
    } finally {
      setAuthLoading(false);
    }
  }

  async function saveHolding(draft: HoldingDraft) {
    if (!session?.user.id) {
      setAuthError("请先使用邮箱和密码登录。");
      return;
    }

    const ticker = draft.ticker.trim().toUpperCase();
    if (!ticker) {
      setAuthError("Ticker 不能为空。");
      return;
    }

    setHoldingSaving(true);
    setAuthError("");
    setHoldingMessage("");
    try {
      const payload = {
        ticker,
        name: emptyToNull(draft.name),
        market: emptyToNull(draft.market) ?? "US",
        position_type: draft.position_type,
        weight: parseWeight(draft.weight),
        note: emptyToNull(draft.note),
        is_active: draft.is_active,
      };

      const result = draft.id
        ? await supabase
            .from("holdings")
            .update(payload)
            .eq("id", draft.id)
            .eq("user_id", session.user.id)
            .select()
            .single()
        : await supabase
            .from("holdings")
            .insert({ ...payload, user_id: session.user.id })
            .select()
            .single();

      if (result.error) throw result.error;

      setHoldingMessage("持仓已保存。");
      await loadData();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "保存持仓失败");
    } finally {
      setHoldingSaving(false);
    }
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {error && <p className="error-text">{error}</p>}
      {loading && <p className="muted">正在读取最新数据...</p>}

      {activeTab === "dashboard" && (
        <DashboardPage data={dashboardData} onManageHoldings={() => setActiveTab("holdings")} />
      )}

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

      {activeTab === "holdings" && (
        <HoldingCard
          holdings={holdings}
          prices={prices}
          session={session}
          authLoading={authLoading}
          saving={holdingSaving}
          authError={authError}
          message={holdingMessage}
          onLogin={signIn}
          onLogout={signOut}
          onSave={saveHolding}
        />
      )}
    </Layout>
  );
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseWeight(value: string) {
  if (value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("权重必须是有效数字。");
  }
  return parsed;
}

function recentNewsStartIso() {
  const start = new Date();
  start.setDate(start.getDate() - 2);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function latestPricesByTicker(prices: LegacyPriceSnapshot[]) {
  const byTicker = new Map<string, LegacyPriceSnapshot>();
  for (const price of prices) {
    if (!byTicker.has(price.ticker)) {
      byTicker.set(price.ticker, price);
    }
  }
  return Array.from(byTicker.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export default App;
