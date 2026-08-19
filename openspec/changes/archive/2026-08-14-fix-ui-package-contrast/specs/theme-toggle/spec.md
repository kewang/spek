## MODIFIED Requirements

### Requirement: The palette is readable in every theme

Every colour the application applies to text SHALL meet WCAG 2 AA contrast of at least 4.5:1 against the background
it is rendered on, in **every** theme the application offers — not only the theme whose values were authored first.

The background a colour is measured against SHALL be the least favourable surface it can land on in that theme
(`--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary`) and, where the same colour is also used as a
tint behind that text, that tint composited over those surfaces. Measuring against a single nominal surface is not
sufficient: a tint of a colour moves the background toward the text, so text on a tint of itself is strictly harder
than the same text on the bare page.

A colour applied to text SHALL resolve through a token that holds a value per theme, rather than through one literal
shared by every theme. This is the half of the obligation that stays true over time: the values can be correct today
and re-broken by the next colour applied to both themes at once, and a shade tuned for one background cannot clear
the floor on the other.

A colour applied to a **graphical object that is the only carrier of its information** — a bar whose fill states
progress, an icon that states a status with no text beside it, a mark that states a section's extent — SHALL meet at
least 3:1 against what sits behind it, on the same terms. Decoration is not covered: an outline around a badge whose
own text already names the state is not the indicator.

Contrast once met SHALL NOT be undone afterwards. Opacity or alpha applied to text, or to an ancestor of text,
composites it toward the page and is subject to the same floor. Two exceptions, and no others:

- **Inactive user interface components**, which WCAG 1.4.3 exempts.
- **A transient emphasis state the reader is causing**, in which the rest of the view is dimmed while a pointer or
  focus rests on part of it. It SHALL end when the reader stops causing it, SHALL restore every dimmed element to
  full strength, and SHALL leave nothing reachable only while it is active. Any such state SHALL be named in the
  capability that defines it, together with the measurement that motivates it — the exemption is for interactions
  whose *purpose* is de-emphasis, not for a value that happens to be low.

This requirement exists because the previous specification asked the light theme to *define* its variables and said
nothing about what they may be. Every value could therefore drift to an unreadable one — an error message reached
2.76:1 and the spec diff's added lines 1.70:1 — while the specification stayed satisfied. Stating it for one theme
would reproduce the same gap in the other: the dark theme, watched the whole time, still carried `--color-text-muted`
at 3.54:1.

Hue is not required to change between themes: the obligation is contrast, not appearance.

#### Scenario: Text is readable in the dark theme

- **WHEN** the application is rendered with the dark theme active
- **THEN** every colour applied to text meets at least 4.5:1 against each of that theme's surfaces

#### Scenario: Text is readable in the light theme

- **WHEN** the application is rendered with the light theme active
- **THEN** every colour applied to text meets at least 4.5:1 against each of that theme's surfaces

#### Scenario: Text sitting on a tint of its own colour

- **WHEN** a colour is used both as text and as the tint filling the background directly behind that text
- **THEN** the text meets at least 4.5:1 against that tint composited over each of the theme's surfaces

#### Scenario: A colour applied to text is theme-scoped

- **WHEN** a colour is applied to text
- **THEN** it resolves through a token whose value is defined per theme
- **AND** it is not one literal value shared by every theme

#### Scenario: A graphic that carries information on its own

- **WHEN** a graphical object is the only thing stating what it states, in either theme
- **THEN** it meets at least 3:1 against what sits behind it

#### Scenario: Opacity does not undo the contrast

- **WHEN** text, or an ancestor of text, carries opacity or alpha
- **AND** the element is neither an inactive user interface component nor a transient reader-caused emphasis state
- **THEN** the composited result still meets at least 4.5:1 against the background behind it

#### Scenario: A transient emphasis state is exempt and stated

- **WHEN** a view dims part of itself while the reader holds a pointer or focus on another part
- **THEN** the dimmed elements return to full strength once the reader stops
- **AND** nothing was reachable only while they were dimmed
- **AND** the capability defining that view states the exemption and the measurement behind it
