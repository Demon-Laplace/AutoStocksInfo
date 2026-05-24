import { ReactNode } from "react";

export type TabKey = "reports" | "news" | "holdings";

interface LayoutProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onSignOut: () => void;
  children: ReactNode;
}

const navItems: Array<{ key: TabKey; label: string }> = [
  { key: "reports", label: "日报" },
  { key: "news", label: "新闻" },
  { key: "holdings", label: "持仓" },
];

function Layout({ activeTab, onTabChange, onSignOut, children }: LayoutProps) {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Personal Intelligence</p>
          <h1>Investment Intel</h1>
        </div>
        <button className="text-button" type="button" onClick={onSignOut}>
          退出
        </button>
      </header>

      <main className="content">{children}</main>

      <nav className="bottom-nav" aria-label="主导航">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={activeTab === item.key ? "active" : ""}
            onClick={() => onTabChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default Layout;
