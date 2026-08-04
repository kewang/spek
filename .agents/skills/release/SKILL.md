---
name: release
description: Automate spek release — update CHANGELOGs, bump versions on both the product and npm package lines, and push tag to trigger CI/CD publish. Use when the user wants to release a new version.
license: MIT
compatibility: Requires npm, git.
metadata:
  author: spek
  version: "1.4"
---

Automate the spek release process — update CHANGELOGs, bump version, create tag, and push to trigger CI/CD.

**Input**: Optionally specify a version bump type (`patch`, `minor`, `major`) or an explicit version (e.g., `0.3.0`). If omitted, ask.

**Steps**

1. **Determine version bump**

   If the user provided a bump type or version, use it. Otherwise, use **AskUserQuestion** to ask:

   Options: `patch`, `minor`, `major`

   Show the current version from root `package.json` and what each option would result in.

2. **Gather changelog content**

   Look at archived changes since the last release to identify what's new:
   - Check `openspec/changes/archive/` for changes archived after the last release
   - Check recent git commits for context
   - Draft changelog bullet points summarizing user-facing changes

   Show the draft and ask the user to confirm or edit.

3. **Update CHANGELOGs**

   Update ALL THREE changelog files:
   - `CHANGELOG.md` (root) — the superset; write it first and filter down from it
   - `packages/vscode/CHANGELOG.md`
   - `packages/intellij/CHANGELOG.md`

   Add a new version section at the top. They share one version history, but each channel's file drops the entries that don't apply to it — a Web-only change does not appear in the vscode / intellij files.

   Check whether each entry actually reaches each channel before copying it across. IntelliJ in particular reimplements the core scanning logic in Kotlin, so a fix landing in `@spekjs/core` reaches Web and VS Code but **not** IntelliJ unless `packages/intellij/` was touched too:

   ```bash
   git diff --name-only v<last-version>..HEAD | grep intellij
   ```

   A channel with nothing to report still gets a section — `npm version` bumps and publishes it at the new version either way, and a version with no notes reads as an oversight. Say what didn't apply and why (see 1.7.0 and 1.8.1).

4. **Credit external contributors in BOTH READMEs**

   A credit has to land in four separate files — two CHANGELOGs, two READMEs — and **nothing checks that they agree**. v1.8.1 shipped with the credit missing from the CHANGELOG entry and from both READMEs; each was found and patched separately, after the tag.

   Find who contributed since the last release:

   ```bash
   git log v<last-version>..HEAD --format='%an <%ae>' | sort -u
   ```

   Any author other than the maintainer is an external contribution — confirm the handle with `gh pr view <n> --json author` (the commit's email is often a `users.noreply.github.com` alias, not the handle).

   For each one, add the credit to **both** files:
   - `README.md` — under `## Contributors`
   - `README.zh-TW.md` — under `## 貢獻者`

   Follow the shape already in each file: `- [@handle](https://github.com/handle) (Name)` with one sub-bullet per contribution, appending a sub-bullet if the handle is already listed. Match each file's own typography — `README.zh-TW.md` uses full-width parentheses（）and `——` dashes.

   The same credit belongs in the CHANGELOG entry (step 3) and the GitHub Release notes (step 12). Word it as a `Thanks to [@handle](https://github.com/handle) (Name)` clause, matching the existing entries.

5. **Release the npm package line (`@spekjs/core` / `@spekjs/ui`)**

   These are **separate version lines** from the product line above, with their own CHANGELOGs. They
   are no longer published from your machine — CI publishes each one when a version bump reaches
   `master` (`.github/workflows/npm-publish.yml`). Your job here is the part CI cannot do: deciding
   the increment.

   For each package, check whether it changed since its own last release:

   ```bash
   for pkg in core ui; do
     last=$(git tag -l "${pkg}-v*" --sort=-v:refname | head -1)
     echo "== @spekjs/$pkg  (last released: ${last:-none})"
     git log --oneline "${last}..HEAD" -- "packages/$pkg/src"
   done
   ```

   No commits for a package → **that package is not released**. Say so explicitly. Unlike the three
   product CHANGELOGs, an unchanged package gets no version and no section at all; inventing one
   would publish an identical tarball under a new number.

   For each package that did change, **decide the increment from what the changes did**, not from
   their commit prefixes. Read the `## Impact` section of every change archived since that tag —
   project convention requires anything affecting registry consumers (a new public export, a
   behavior change, additive-so-minor-not-patch) to be recorded there for exactly this moment.

   > Commit prefixes get this wrong about half the time in this repository. `@spekjs/core` 1.3.0
   > came from a single `fix(core,ui):` commit that added the `./graph-node-id` export subpath, and
   > 1.4.0 from three `fix:` / `test:` commits that changed `TaskItem.text`'s semantics for
   > consumers. A `fix: → patch` rule would have published 1.2.1 and 1.3.1. A published version
   > cannot be withdrawn — an under-bump is corrected only by publishing again.

   Then, for each package being released:
   - Update `packages/<pkg>/CHANGELOG.md`. Its readers are API consumers, so write about the API
     surface, not about spek's UI. These entries do **not** go in the three product CHANGELOGs.
   - Bump `version` in `packages/<pkg>/package.json`.
   - Commit as `chore(npm): publish @spekjs/<pkg>@X.Y.Z` (one commit may cover both packages — see
     `2e65a11`).

   When that commit reaches `master`, CI publishes it and creates the `core-vX.Y.Z` / `ui-vX.Y.Z`
   tag. Do **not** run `npm publish` locally, and do **not** create those tags by hand.

6. **Update plugin.xml change-notes**

   Update `packages/intellij/src/main/resources/META-INF/plugin.xml` — replace the `<change-notes>` block with the new version's changelog content in HTML format:

   ```xml
   <change-notes><![CDATA[
       <p><b><version></b></p>
       <ul>
           <li>...</li>
       </ul>
   ]]></change-notes>
   ```

   Only include the latest version's changes (not cumulative history).

7. **Commit changelog updates**

   ```bash
   git add CHANGELOG.md packages/vscode/CHANGELOG.md packages/intellij/CHANGELOG.md packages/intellij/src/main/resources/META-INF/plugin.xml
   git commit -m "Update CHANGELOG for v<version>"
   ```

   If step 4 touched the READMEs, commit them too — **before** `npm version`, so the credit is inside the release rather than trailing the tag:

   ```bash
   git add README.md README.zh-TW.md
   git commit -m "docs(readme): credit @<handle> for <what>"
   ```

8. **Rebuild demo page**

   Rebuild `docs/demo.html` and badges so they reflect the latest code and openspec content:

   ```bash
   npm run build:demo
   npm run build:badges
   ```

   Stage the updated files:

   ```bash
   git add docs/demo.html docs/badges/
   git commit -m "Rebuild demo for v<version>"
   ```

9. **Run npm version**

   ```bash
   npm version <type-or-version> --no-git-tag-version
   ```

   Wait — the `version` lifecycle script in package.json auto-syncs to `packages/vscode/package.json` and `packages/intellij/gradle.properties`.

   Actually, use the standard flow which auto-commits and tags:
   ```bash
   npm version <type-or-version>
   ```

   This will:
   - Bump root `package.json` version
   - Run `version` script (syncs `packages/vscode/package.json` + `packages/intellij/gradle.properties` + git add)
   - Create git commit with version
   - Create `v<version>` git tag

10. **Push to trigger CI/CD**

   Ask the user for confirmation before pushing:
   > "Ready to push v<version> to origin? This will trigger the CI/CD pipelines to publish to VS Code Marketplace and JetBrains Marketplace."

   ```bash
   git push --follow-tags
   ```

11. **Update `v1` major version tag**

   After push, update the `v1` floating tag to point to the new release commit:

   ```bash
   git tag -fa v1 -m "Update v1 tag to v<version>"
   git push origin v1 --force
   ```

   This follows the GitHub Action versioning convention — users referencing `spekhq/spek@v1` will automatically get the latest release.

12. **Create GitHub Release**

    Create a GitHub Release with Marketplace publishing:

    ```bash
    gh release create v<version> --title "v<version>" --notes "<changelog content>"
    ```

    The release will be published to the GitHub Actions Marketplace (action.yml with branding is auto-detected by GitHub).

13. **Show summary**

   Display:
   - New version number
   - Changelog content
   - Git tag created
   - CI/CD status: "Pushed. GitHub Actions will publish to VS Code Marketplace and JetBrains Marketplace."
   - GitHub Release: "Release created. Action published to GitHub Actions Marketplace."
   - Remind: "Monitor the workflows at: https://github.com/<owner>/<repo>/actions"

**Guardrails**
- ALWAYS update all three CHANGELOGs (root + vscode + intellij). They share one version history but are NOT identical — each drops entries irrelevant to its channel (see CLAUDE.md). A channel with nothing to report still gets a section saying so, because `npm version` publishes it at the new version regardless.
- A credit for an external contribution goes in FOUR places — root CHANGELOG, the channel's CHANGELOG, `README.md`, `README.zh-TW.md` — plus the GitHub Release notes. Nothing verifies they agree; a missing one is only ever caught by a human reading the file.
- The npm package line (step 5) follows the OPPOSITE rule from the three product CHANGELOGs: a package whose `src/` did not change since its last `core-v*` / `ui-v*` tag gets **no** version and **no** CHANGELOG section. Bumping it anyway republishes an identical tarball under a new number.
- NEVER derive an `@spekjs/*` version increment from commit prefixes. Read the archived changes' `## Impact`. Two of the last four core releases would have been under-bumped by a `fix: → patch` rule, and a published version cannot be withdrawn.
- NEVER run `npm publish` locally and NEVER hand-create a `core-v*` / `ui-v*` tag. CI does both, from the version bump alone (`.github/workflows/npm-publish.yml`). Publishing by hand skips the gates the workflow runs first, and a hand-made tag makes the next release's "what changed since" diff lie.
- ALWAYS confirm with user before `git push`
- If there are uncommitted changes, warn and ask to stash or commit first
- If the working tree is dirty after changelog update, stage only changelog files
- Do NOT push without explicit user confirmation
