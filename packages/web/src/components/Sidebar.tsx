import { NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useRefreshData } from "../hooks/useOpenSpec";
import { useLiveStatus } from "../contexts/RefreshContext";

const links = [
  {
    to: "/dashboard",
    label: "Overview",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm-10 9a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zm10-2a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" />
      </svg>
    ),
  },
  {
    to: "/specs",
    label: "Specs",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    to: "/changes",
    label: "Changes",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    to: "/graph",
    label: "Graph",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    ),
  },
  {
    to: "/schemas",
    label: "Schemas",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h6v4H4V5zm10 10h6v4h-6v-4z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 9v5a3 3 0 003 3h4" />
      </svg>
    ),
  },
  {
    to: "/timeline",
    label: "Timeline",
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h10M4 12h16M4 17h7" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4v16" />
      </svg>
    ),
  },
];

interface SidebarProps {
  open: boolean;
  isMobile: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggle: () => void;
}

function RefreshButton({ collapsed }: { collapsed: boolean }) {
  const { refreshData, loading } = useRefreshData();
  return (
    <button
      onClick={refreshData}
      disabled={loading}
      className={`w-full flex items-center gap-2 rounded text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${collapsed ? "justify-center px-2 py-2" : "px-3 py-2"}`}
      title="Refresh"
      // 收合時圖示是這顆按鈕的全部 affordance，無障礙名稱不能只靠被隱藏的文字
      aria-label="Refresh"
    >
      <svg
        className={`w-4 h-4 shrink-0 ${loading ? "animate-spin" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      {!collapsed && (loading ? "Refreshing..." : "Refresh")}
    </button>
  );
}

/**
 * 只在 live-update 管道確實斷掉時出聲。常駐的「正常」指示燈是純噪音，
 * 而且會鈍化真正出事時的訊號，所以 live / unsupported 一律不顯示。
 */
function LiveStatusNotice({ collapsed }: { collapsed: boolean }) {
  const liveStatus = useLiveStatus();
  if (liveStatus !== "offline") return null;

  return (
    <div
      className={`flex items-center gap-2 rounded text-xs text-amber-400/90 ${collapsed ? "justify-center px-2 py-2" : "px-3 py-2"}`}
      title="Live updates offline — press Refresh to see the latest content"
      role="status"
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v3.75m0 3.75h.008M10.34 3.94l-8.02 13.9A1.5 1.5 0 003.62 20.1h16.76a1.5 1.5 0 001.3-2.26l-8.02-13.9a1.5 1.5 0 00-2.6 0z"
        />
      </svg>
      {!collapsed && <span className="leading-snug">Live updates offline</span>}
    </div>
  );
}

function ToggleButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2 rounded text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer ${collapsed ? "justify-center px-2 py-2" : "px-3 py-2"}`}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {collapsed ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
        )}
      </svg>
      {!collapsed && (collapsed ? "Expand" : "Collapse")}
    </button>
  );
}

export function Sidebar({ open, isMobile, collapsed, onClose, onToggle }: SidebarProps) {
  const location = useLocation();

  // 路由變化時自動關閉行動版 sidebar
  useEffect(() => {
    if (isMobile) onClose();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isMobile) {
    if (!open) return null;
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-20"
          onClick={onClose}
        />
        {/* Sidebar overlay */}
        <aside className="fixed top-14 left-0 bottom-0 w-60 bg-bg-secondary border-r border-border overflow-y-auto z-30 flex flex-col">
          <nav className="p-4 space-y-1 flex-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                    isActive
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                  }`
                }
              >
                {link.icon}
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-border space-y-1">
            <RefreshButton collapsed={false} />
            <LiveStatusNotice collapsed={false} />
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside className={`fixed top-14 left-0 bottom-0 bg-bg-secondary border-r border-border overflow-y-auto flex flex-col transition-all duration-200 ${collapsed ? "w-14" : "w-60"}`}>
      <nav className={`flex-1 space-y-1 ${collapsed ? "p-2" : "p-4"}`}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            title={collapsed ? link.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded text-sm transition-colors ${
                collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
              } ${
                isActive
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
              }`
            }
          >
            {link.icon}
            {!collapsed && link.label}
          </NavLink>
        ))}
      </nav>
      <div className={`border-t border-border space-y-1 ${collapsed ? "p-2" : "p-4"}`}>
        <ToggleButton collapsed={collapsed} onToggle={onToggle} />
        <RefreshButton collapsed={collapsed} />
        <LiveStatusNotice collapsed={collapsed} />
      </div>
    </aside>
  );
}
