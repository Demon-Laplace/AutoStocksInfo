import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import type { LegacyHolding, LegacyPriceSnapshot } from "../lib/types";

export interface HoldingDraft {
  id: string | null;
  ticker: string;
  name: string;
  market: string;
  position_type: "holding" | "watchlist" | "related";
  weight: string;
  note: string;
  is_active: boolean;
}

interface HoldingCardProps {
  holdings: LegacyHolding[];
  prices: LegacyPriceSnapshot[];
  session: Session | null;
  authLoading: boolean;
  saving: boolean;
  authError: string;
  message: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onSave: (draft: HoldingDraft) => Promise<void>;
}

const emptyDraft: HoldingDraft = {
  id: null,
  ticker: "",
  name: "",
  market: "US",
  position_type: "holding",
  weight: "",
  note: "",
  is_active: true,
};

function HoldingCard({
  holdings,
  prices,
  session,
  authLoading,
  saving,
  authError,
  message,
  onLogin,
  onLogout,
  onSave,
}: HoldingCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState<HoldingDraft>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const priceByTicker = new Map(prices.map((price) => [price.ticker, price]));
  const sortedHoldings = useMemo(
    () =>
      [...holdings].sort((a, b) => {
        const typeOrder = typeRank(a.position_type) - typeRank(b.position_type);
        return typeOrder || a.ticker.localeCompare(b.ticker);
      }),
    [holdings],
  );

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin(email, password);
    setPassword("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(draft);
  }

  function startCreate() {
    setDraft(emptyDraft);
    setShowForm(true);
  }

  function startEdit(holding: LegacyHolding) {
    setDraft({
      id: holding.id,
      ticker: holding.ticker,
      name: holding.name ?? "",
      market: holding.market ?? "US",
      position_type: toPositionType(holding.position_type),
      weight: holding.weight == null ? "" : String(holding.weight),
      note: holding.note ?? "",
      is_active: holding.is_active,
    });
    setShowForm(true);
  }

  const hasHoldings = sortedHoldings.length > 0;

  return (
    <section className="holdings-page">
      <div className="panel holdings-toolbar">
        {session ? (
          <>
            <div>
              <strong>{session.user.email}</strong>
              <p className="muted">已登录，可新增和修改自己的持仓。</p>
            </div>
            <div className="toolbar-actions">
              <button type="button" className="text-button primary-button" onClick={startCreate}>
                新增持仓
              </button>
              <button type="button" className="text-button" onClick={onLogout} disabled={authLoading}>
                退出
              </button>
            </div>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              邮箱
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              密码
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button type="submit" className="text-button primary-button" disabled={authLoading}>
              {authLoading ? "登录中..." : "密码登录"}
            </button>
          </form>
        )}
      </div>

      {authError && <p className="error-text">{authError}</p>}
      {message && <p className="success-text">{message}</p>}

      {showForm && session && (
        <form className="panel holding-form" onSubmit={handleSave}>
          <div className="form-grid">
            <label>
              Ticker
              <input
                value={draft.ticker}
                onChange={(event) => setDraft({ ...draft, ticker: event.target.value.toUpperCase() })}
                disabled={Boolean(draft.id)}
                required
              />
            </label>
            <label>
              名称
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label>
              市场
              <input
                value={draft.market}
                onChange={(event) => setDraft({ ...draft, market: event.target.value })}
              />
            </label>
            <label>
              类型
              <select
                value={draft.position_type}
                onChange={(event) =>
                  setDraft({ ...draft, position_type: event.target.value as HoldingDraft["position_type"] })
                }
              >
                <option value="holding">持仓</option>
                <option value="watchlist">观察</option>
                <option value="related">相关</option>
              </select>
            </label>
            <label>
              权重
              <input
                type="number"
                step="0.01"
                value={draft.weight}
                onChange={(event) => setDraft({ ...draft, weight: event.target.value })}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
              />
              启用
            </label>
          </div>
          <label>
            备注
            <textarea
              value={draft.note}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            />
          </label>
          <div className="toolbar-actions">
            <button type="submit" className="text-button primary-button" disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </button>
            <button type="button" className="text-button" onClick={() => setShowForm(false)}>
              取消
            </button>
          </div>
        </form>
      )}

      {!hasHoldings ? (
        <div className="panel empty-state">暂无持仓数据。</div>
      ) : (
        <div className="holding-grid">
          {sortedHoldings.map((holding) => {
            const price = priceByTicker.get(holding.ticker);
            return (
              <article key={holding.id} className="holding-card">
                <div className="holding-card-header">
                  <div>
                    <h2>{holding.ticker}</h2>
                    <p>{holding.name || holding.market || "未命名资产"}</p>
                  </div>
                  <div className="holding-actions">
                    <span className="badge muted-badge">{holding.position_type || "holding"}</span>
                    {session && (
                      <button type="button" className="text-button" onClick={() => startEdit(holding)}>
                        编辑
                      </button>
                    )}
                  </div>
                </div>
                {price ? (
                  <div className="price-row">
                    <span>收盘 {formatNumber(price.close)}</span>
                    <strong className={Number(price.change_pct) >= 0 ? "up" : "down"}>
                      {formatPct(price.change_pct)}
                    </strong>
                  </div>
                ) : (
                  <p className="muted">暂无价格快照。</p>
                )}
                {holding.weight != null && <p className="note">权重 {formatWeight(holding.weight)}</p>}
                {holding.note && <p className="note">{holding.note}</p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function toPositionType(value: string | null): HoldingDraft["position_type"] {
  if (value === "watchlist" || value === "related") {
    return value;
  }
  return "holding";
}

function formatWeight(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function typeRank(value: string | null) {
  if (value === "holding") return 0;
  if (value === "watchlist") return 1;
  return 2;
}

function formatNumber(value: number | null) {
  return typeof value === "number" ? value.toFixed(2) : "N/A";
}

function formatPct(value: number | null) {
  return typeof value === "number" ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "N/A";
}

export default HoldingCard;
