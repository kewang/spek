import { NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";

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
        <aside className="fixed top-14 left-0 bottom-0 w-60 bg-bg-secondary border-r border-border overflow-y-auto z-30">
          <nav className="p-4 space-y-1">
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
        </aside>
      </>
    );
  }

  return (
    <aside className="fixed top-14 left-0 bottom-0 w-60 bg-bg-secondary border-r border-border overflow-y-auto">
      <nav className="p-4 space-y-1">
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
    </aside>
  );
}
