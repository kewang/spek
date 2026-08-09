import { Link } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * A link that also acts as the click target for its whole card.
 *
 * **Requires the card to be `relative`** — the stretch is an `::after` pseudo-element absolutely
 * positioned to `inset-0`, so it covers the nearest positioned ancestor.
 *
 * The obvious shape — wrapping the whole row in a `<Link>` — is invalid HTML the moment the row
 * contains a link of its own, and it makes that inner link unreachable. So the row stays a plain
 * container, the title carries the navigation, and anything that must remain clickable sits above
 * the overlay with `relative z-10` (see `SchemaBadge`).
 *
 * A component rather than three copies of the incantation: the changes list and both dashboard lists
 * need it, and the technique is invisible enough that hand-copied versions drift silently — a change
 * to the overlay in one place would leave the others only partly clickable, with nothing to catch it
 * but manual QA.
 */
export function StretchedLink({
  to,
  className = "",
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={`${className} after:absolute after:inset-0 after:content-['']`}>
      {children}
    </Link>
  );
}
