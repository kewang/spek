import { NavLink } from "react-router-dom";

const links = [
  { to: "/dashboard", label: "Overview" },
  { to: "/specs", label: "Specs" },
  { to: "/changes", label: "Changes" },
];

export function Sidebar() {
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
