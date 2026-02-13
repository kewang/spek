# spek — OpenSpec Viewer

Browse [OpenSpec](https://github.com/Fission-AI/OpenSpec) specs and changes directly in VS Code. A read-only, local-only viewer with structured navigation, BDD syntax highlighting, and full-text search.

## Features

- **Dashboard** — Overview of specs count, changes count, and task completion rates
- **Specs Browser** — Alphabetical listing with detail view and revision history
- **Changes Timeline** — Active and archived changes with tabbed views (Proposal / Design / Tasks / Specs)
- **BDD Syntax Highlighting** — Visual distinction for WHEN/GIVEN, THEN, AND, MUST/SHALL keywords
- **Task Progress** — Checkbox parsing with section-grouped progress bars
- **Full-text Search** — Search across all specs and changes
- **Dark / Light Theme** — Toggle between themes; dark by default
- **Spec History** — Git-based timestamp tracking for spec revisions

## Usage

The extension activates automatically when your workspace contains an `openspec/config.yaml` file.

### Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

- **spek: Open spek** — Open the viewer panel
- **spek: Search OpenSpec** — Open search dialog

### Expected Directory Structure

```
your-repo/
└── openspec/
    ├── config.yaml
    ├── specs/
    │   └── {topic}/
    │       └── spec.md
    └── changes/
        ├── {active-change}/
        │   ├── .openspec.yaml
        │   ├── proposal.md
        │   ├── design.md
        │   ├── tasks.md
        │   └── specs/
        └── archive/
            └── {YYYY-MM-DD-desc}/
```

## Requirements

- VS Code 1.85+
- A workspace containing an `openspec/` directory

## Privacy

All data stays on your machine. No telemetry, no external requests.

## Links

- [Source Code](https://github.com/kewang/spek)
- [Report Issues](https://github.com/kewang/spek/issues)
- [OpenSpec Specification](https://github.com/Fission-AI/OpenSpec)

## License

MIT
