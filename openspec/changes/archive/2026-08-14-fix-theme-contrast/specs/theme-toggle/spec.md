## ADDED Requirements

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
composites it toward the page and is subject to the same floor — with inactive user interface components as the only
exception, which WCAG 1.4.3 exempts.

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
- **AND** the element is not an inactive user interface component
- **THEN** the composited result still meets at least 4.5:1 against the background behind it

## MODIFIED Requirements

### Requirement: Light theme CSS variables
The system SHALL define a complete set of light theme CSS variables that override the dark theme defaults when `[data-theme="light"]` is set on the `<html>` element. Each override SHALL satisfy "The palette is readable in every theme" — defining a variable is not on its own sufficient.

#### Scenario: Light theme applied
- **WHEN** the `<html>` element has `data-theme="light"`
- **THEN** all color CSS variables (`--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-accent`, `--color-accent-hover`, `--color-status-error`, `--color-status-success`, `--color-status-warning`) are overridden with light-appropriate values

#### Scenario: Dark theme applied
- **WHEN** the `<html>` element has `data-theme="dark"` or no `data-theme` attribute
- **THEN** the default dark theme CSS variables are used

#### Scenario: A status colour is available to both themes
- **WHEN** an error, success or warning state is conveyed by colour
- **THEN** that colour comes from `--color-status-error`, `--color-status-success` or `--color-status-warning`
- **AND** each carries its own value in the dark theme and in the light theme
