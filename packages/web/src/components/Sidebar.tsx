import { NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useResync } from "../hooks/useOpenSpec";

const links = [
  { to: "/dashboard", label: "Overview" },
  { to: "/specs", label: "Specs" },
  { to: "/changes", label: "Changes" },
];

interface SidebarProps {
  open: boolean;
  isMobile: boolean;
  onClose: () => void;
}

function ResyncButton() {
  const { resync, loading } = useResync();
  return (
    <button
      onClick={resync}
      disabled={loading}
      className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      title="Resync git timestamps"
    >
      <svg
        className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
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
      {loading ? "Syncing..." : "Resync"}
    </button>
  );
}

export function Sidebar({ open, isMobile, onClose }: SidebarProps) {
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
                  `block px-3 py-2 rounded text-sm transition-colors ${
                    isActive
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-border">
            <ResyncButton />
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside className="fixed top-14 left-0 bottom-0 w-60 bg-bg-secondary border-r border-border overflow-y-auto flex flex-col">
      <nav className="p-4 space-y-1 flex-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded text-sm transition-colors ${
                isActive
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <ResyncButton />
      </div>
    </aside>
  );
}
