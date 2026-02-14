import { NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useResync } from "../hooks/useOpenSpec";

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
];

interface SidebarProps {
  open: boolean;
  isMobile: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggle: () => void;
}

function ResyncButton({ collapsed }: { collapsed: boolean }) {
  const { resync, loading } = useResync();
  return (
    <button
      onClick={resync}
      disabled={loading}
      className={`w-full flex items-center gap-2 rounded text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${collapsed ? "justify-center px-2 py-2" : "px-3 py-2"}`}
      title="Resync git timestamps"
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
      {!collapsed && (loading ? "Syncing..." : "Resync")}
    </button>
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
          <div className="p-4 border-t border-border">
            <ResyncButton collapsed={false} />
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
        <ResyncButton collapsed={collapsed} />
      </div>
    </aside>
  );
}
