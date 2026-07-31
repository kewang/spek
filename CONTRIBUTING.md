# Contributing to spek

Thanks for your interest in improving **spek** — a lightweight, read-only viewer for
[OpenSpec](https://github.com/Fission-AI/OpenSpec) content. Contributions of all sizes are
welcome, from typo fixes to new features across the Web, VS Code, and IntelliJ surfaces.

This guide covers everything you need to get productive. If anything here is unclear or out of
date, please open an issue — improving the contributor experience counts as a contribution too.

## Code of Conduct

This project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are
expected to uphold it. Please report unacceptable behavior to **cpckewang@gmail.com**.

## Ways to contribute

- **Report a bug** — open a [bug report](https://github.com/spekhq/spek/issues/new/choose).
- **Request a feature** — open a [feature request](https://github.com/spekhq/spek/issues/new/choose).
- **Ask a question or float an idea** — open an
  [issue](https://github.com/spekhq/spek/issues/new/choose) (pick a blank issue for open questions).
- **Send a pull request** — see [Submitting a pull request](#submitting-a-pull-request) below.
- **Report a security vulnerability** — do **not** open a public issue; follow
  [SECURITY.md](SECURITY.md).

## Getting started

### Prerequisites

- **Node.js 22** — the version is pinned in [`.nvmrc`](.nvmrc) (`nvm use` picks it up).
- **Java 17+** — only needed if you build the IntelliJ plugin.

### Setup

```bash
git clone https://github.com/spekhq/spek.git
cd spek
npm install          # installs all workspace dependencies
npm run dev          # Vite (5173) + Express (3001) — open http://localhost:5173
```

### Useful commands

```bash
npm run build          # Build core + ui + web
npm run build:core     # Build @spekjs/core only
npm run build:webview  # Build webview assets for the VS Code extension
npm run build:vscode   # Build the VS Code extension
npm run build:intellij # Build IntelliJ webview assets
npm run build:demo     # Build the standalone demo (docs/demo.html)
npm run type-check     # TypeScript type check
npm test               # Run the test suites (core + ui + web)
```

Packaging the VS Code extension and IntelliJ plugin is documented in
[`CLAUDE.md`](CLAUDE.md) and the [README](README.md#development).

## Project layout

spek is an npm-workspaces monorepo:

| Package | What it is |
| --- | --- |
| `packages/core` (`@spekjs/core`) | Pure Node.js logic: scanner, tasks parser, types. Published to npm. |
| `packages/ui` (`@spekjs/ui`) | Reusable presentational components (`SpecGraph`, `ChangeTimeline`). Published to npm. |
| `packages/web` (`@spekjs/web`) | Express API server + React SPA. |
| `packages/vscode` (`spek-vscode`) | VS Code extension (Webview Panel). |
| `packages/intellij` (`spek-intellij`) | IntelliJ Platform plugin (Kotlin + JCEF). |

The core scanning/reading logic lives once in `@spekjs/core` and is re-implemented in Kotlin under
`packages/intellij/.../core/` for the IntelliJ server. When you change behavior in one, check
whether the other needs to match.

## How we track changes: OpenSpec

spek uses **OpenSpec to plan its own development** — yes, spek renders its own `openspec/`
directory, so the project dogfoods the format it exists to view. For **non-trivial** changes
(new features, behavior changes, anything worth a design discussion) we create an OpenSpec
change — a proposal, design notes, tasks, and spec deltas — before implementing.

You're **not required** to author OpenSpec artifacts to contribute. A focused bug fix or docs
tweak can go straight to a pull request. If you're planning something larger, opening an issue
first lets us agree on the approach (and, if appropriate, an OpenSpec change)
before you invest the work. Existing changes live under `openspec/changes/` if you'd like a
reference — several were authored by external contributors.

## Coding conventions

- **Code is written in English** — identifiers, symbols, filenames.
- **Write OpenSpec artifacts and docs in English.** The `openspec/` change and spec documents are
  spek's canonical, English-language record — and they're what the
  [live demo](https://spekhq.github.io/spek/demo.html) showcases. Author proposals, designs, tasks,
  and spec deltas in English.
- **Write comments in English too.** Some existing code still has Traditional Chinese comments — no
  need to translate those wholesale, but write new comments in English.
- **Preserve existing line endings.** This repo has mixed line endings and no `.gitattributes`.
  Configure your editor so it does **not** reformat an entire file's line endings when you touch
  a few lines — a whole-file CRLF↔LF flip produces an unreviewable diff and will be sent back.
- Match the style of the surrounding code: its naming, comment density, and idioms.

## Submitting a pull request

1. **Fork** the repo and create a branch from `master`.
2. Make your change. Keep the PR focused — one logical change per PR is easier to review.
3. **Run the checks locally:**
   ```bash
   npm test
   npm run type-check
   ```
4. **Fill out the pull request template** — it prompts for the affected surface, a summary, and a
   short checklist.
5. Open the PR against `spekhq/spek:master` and link any related issue (`Fixes #123`).

### What maintainers handle for you

- **Version bumps and `CHANGELOG.md`.** You don't need to edit any `CHANGELOG.md` or bump versions
  in your PR — maintainers own the release process and will add changelog entries on merge.
- **Releases and publishing** to npm / VS Code Marketplace / JetBrains Marketplace.

### Review

Maintainers review for **correctness** and whether the change does what it claims. We won't hold a
PR against undocumented internal conventions — if a convention matters, it belongs in this file, so
tell us if you hit one that isn't written down.

**If a PR grows, we may ask you to split it.** One logical change per PR reviews and lands faster —
if a branch ends up carrying several unrelated things, we'll ask for the pieces to go out
separately (this has happened before, and the smaller pieces merged sooner). Flagging the split
yourself — "happy to peel out X if you'd rather review a thinner PR" — is always welcome.

**Small fixes may be applied on merge, with credit.** When a reviewed PR only needs a nit or a
mechanical touch-up, we may merge it and make the fix in a follow-up commit on `master` rather than
holding the merge for another round-trip. When we do, you're credited — an `@mention` in the README
or release notes, or a `Co-authored-by:` trailer. Prefer to make the change yourself? Say so on the
PR and we'll wait for you.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE) that covers this project.
