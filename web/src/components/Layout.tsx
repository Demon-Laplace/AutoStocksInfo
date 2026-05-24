import { ReactNode } from "react";

export type TabKey = "dashboard" | "reports" | "news" | "holdings";

interface LayoutProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: ReactNode;
}

const navItems: Array<{ key: TabKey; label: string }> = [
  { key: "dashboard", label: "总览" },
  { key: "reports", label: "日报" },
  { key: "news", label: "新闻" },
  { key: "holdings", label: "持仓" },
];

function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Personal Intelligence</p>
          <h1>Investment Intel</h1>
        </div>
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
