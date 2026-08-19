## Purpose

Provide dark and light theme switching, synchronised with the host environment (IDE or system preference).
## Requirements
### Requirement: Theme state management
The system SHALL provide a ThemeContext that manages the current theme ("dark" or "light") and exposes a toggle function. The theme state MUST be persisted in localStorage under the key `spek:theme`.

#### Scenario: Initialize from localStorage
- **WHEN** the application loads and localStorage contains a saved theme preference
- **THEN** the system applies the saved theme

#### Scenario: Initialize from system preference
- **WHEN** the application loads and no theme is saved in localStorage
- **AND** the user's system preference is light mode (`prefers-color-scheme: light`)
- **THEN** the system applies the light theme

#### Scenario: Initialize default
- **WHEN** the application loads and no theme is saved and no system preference is detected
- **THEN** the system applies the dark theme as default

#### Scenario: Toggle theme
- **WHEN** the user triggers the theme toggle
- **THEN** the current theme switches (dark → light or light → dark)
- **AND** the new preference is saved to localStorage
- **AND** the `data-theme` attribute on `<html>` is updated

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

### Requirement: Theme toggle button
The system SHALL display a theme toggle button in the header. The button MUST show a sun icon when in dark mode (indicating "switch to light") and a moon icon when in light mode (indicating "switch to dark").

#### Scenario: Display toggle in header
- **WHEN** any page within the Layout is rendered
- **THEN** a theme toggle button is visible in the header area

#### Scenario: Icon reflects current theme
- **WHEN** the current theme is dark
- **THEN** the toggle button displays a sun icon
- **WHEN** the current theme is light
- **THEN** the toggle button displays a moon icon

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

### Requirement: The palette obligation is verified by mechanism, not by a token's usual role

The check that enforces the palette obligation SHALL maintain an **enumeration of the mechanisms by
which a colour reaches the screen**, and for every mechanism it enumerates SHALL decide each occurrence
one of two ways: measured against the floor it answers to, or declared as owing nothing, with the reason
stated. An occurrence of an enumerated mechanism that is neither SHALL fail the check.

The enumeration SHALL be stated where the check is, so that what it does not cover is visible rather
than absent — it is not, and cannot be made, the complete set of ways CSS can colour something. A
mechanism the application begins to use SHALL be added to the enumeration or declared as outside it. A
verification that quietly enumerates only the mechanisms someone thought of reports a palette as
conforming on the strength of the cases it happened to look at.

Declaring a mechanism outside the enumeration SHALL rest on how the application uses it, and SHALL
therefore be revisited when that use changes. It is available while the mechanism carries nothing the
reader depends on; it ceases to be available once the application states meaning through it, and the
mechanism SHALL then be enumerated. A declaration is not a permanent property of the mechanism: SVG
presentation attributes were outside the enumeration on the strength of one decorative occurrence, and
stayed outside while a diagram came to state its dependencies, its declared/derived distinction and its
not-declared-by-this-schema mark entirely through them — so the check reported a conforming palette while
every line in that diagram sat at 1.13:1.

Three consequences follow, and each is a gap the enumeration had:

- **A token's role in the palette SHALL NOT exempt its occurrences.** A token named for a surface still
  answers to the text floor wherever it is *applied to text* — a label on a solid accent fill is text on
  a background like any other. Treating "this token is a surface" as an answer for every occurrence of
  it leaves the application's primary call to action measured by nothing, and it is the pairing that
  moves when either colour is re-authored.
- **Every property that composites a token toward the page SHALL be enumerated, not only the ones
  already listed.** Text colour, background tint and opacity were enumerated; a border alpha was not,
  and so an alpha of a text token could reach the screen at any value without being surfaced either as
  measured or as excluded.
- **An exclusion SHALL be re-decided when the use that justified it changes.** An exclusion is a claim
  about what the application does with a mechanism, and the application goes on being written. Left as a
  standing fact, it is the one entry in the enumeration that gets quieter as it gets wronger: the check
  keeps passing, and it keeps passing *because* of the sentence that has stopped being true.

Declaring an occurrence as owing nothing SHALL state why, so the declaration can be argued with. The
substantive rule is unchanged — decoration owes nothing, an indicator owes 3:1, text owes 4.5:1 — and
this requirement is only that the check can see the occurrence in order to apply it.

#### Scenario: A surface token applied to text is measured

- **WHEN** a token defined as a surface colour is applied to text drawn on a solid fill of another token
- **THEN** the pairing is measured against the text floor in every theme, rather than treated as accounted
  for by that token being a surface

#### Scenario: An alpha of a token reaching the screen through a border is surfaced

- **WHEN** a token is composited toward the page through a border alpha
- **THEN** the occurrence is either measured against the floor it answers to or declared as owing nothing
  with its reason, and is not passed over because the property is not a text colour, a background tint or
  an opacity

#### Scenario: An unaccounted occurrence of an enumerated mechanism fails the check

- **WHEN** the application applies a colour through an enumerated mechanism and that occurrence is neither
  measured nor declared
- **THEN** the check fails, rather than reporting the palette as conforming

#### Scenario: The enumeration states its own limits

- **WHEN** the check is read to learn what it covers
- **THEN** the mechanisms it enumerates are stated with it, together with the ones it does not cover, so a
  mechanism the application begins to use can be recognised as unenumerated

#### Scenario: A mechanism that begins to carry meaning is enumerated

- **WHEN** the application states something a reader depends on through a mechanism the check declares as
  outside its enumeration
- **THEN** the mechanism is enumerated and its occurrences are each measured or declared, rather than the
  exclusion continuing to stand on the use that no longer describes the application

