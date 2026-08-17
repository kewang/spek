## ADDED Requirements

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

Two consequences follow, and each is a gap the enumeration had:

- **A token's role in the palette SHALL NOT exempt its occurrences.** A token named for a surface still
  answers to the text floor wherever it is *applied to text* — a label on a solid accent fill is text on
  a background like any other. Treating "this token is a surface" as an answer for every occurrence of
  it leaves the application's primary call to action measured by nothing, and it is the pairing that
  moves when either colour is re-authored.
- **Every property that composites a token toward the page SHALL be enumerated, not only the ones
  already listed.** Text colour, background tint and opacity were enumerated; a border alpha was not,
  and so an alpha of a text token could reach the screen at any value without being surfaced either as
  measured or as excluded.

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
