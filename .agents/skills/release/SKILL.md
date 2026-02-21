---
name: release
description: Automate spek release — update CHANGELOGs, bump version, and push tag to trigger CI/CD publish. Use when the user wants to release a new version.
license: MIT
compatibility: Requires npm, git.
metadata:
  author: spek
  version: "1.0"
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

   Update BOTH changelog files (they must stay in sync per project convention):
   - `CHANGELOG.md` (root)
   - `packages/vscode/CHANGELOG.md`

   Add a new version section at the top with the changelog content.

4. **Commit changelog updates**

   ```bash
   git add CHANGELOG.md packages/vscode/CHANGELOG.md
   git commit -m "Update CHANGELOG for v<version>"
   ```

5. **Rebuild demo page**

   Rebuild `docs/demo.html` so it reflects the latest code and openspec content:

   ```bash
   npm run build:demo
   ```

   Stage the updated demo file:

   ```bash
   git add docs/demo.html
   git commit -m "Rebuild demo for v<version>"
   ```

6. **Run npm version**

   ```bash
   npm version <type-or-version> --no-git-tag-version
   ```

   Wait — the `version` lifecycle script in package.json auto-syncs to `packages/vscode/package.json`.

   Actually, use the standard flow which auto-commits and tags:
   ```bash
   npm version <type-or-version>
   ```

   This will:
   - Bump root `package.json` version
   - Run `version` script (syncs `packages/vscode/package.json` + git add)
   - Create git commit with version
   - Create `v<version>` git tag

7. **Push to trigger CI/CD**

   Ask the user for confirmation before pushing:
   > "Ready to push v<version> to origin? This will trigger the CI/CD pipeline to publish to VS Code Marketplace."

   ```bash
   git push --follow-tags
   ```

8. **Show summary**

   Display:
   - New version number
   - Changelog content
   - Git tag created
   - CI/CD status: "Pushed. GitHub Actions will publish to VS Code Marketplace."
   - Remind: "Monitor the workflow at: https://github.com/<owner>/<repo>/actions"

**Guardrails**
- ALWAYS update both CHANGELOGs (root + vscode) — they must be identical
- ALWAYS confirm with user before `git push`
- If there are uncommitted changes, warn and ask to stash or commit first
- If the working tree is dirty after changelog update, stage only changelog files
- Do NOT push without explicit user confirmation
