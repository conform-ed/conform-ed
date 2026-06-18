---
title: CLI
description: Validate QTI XML files, folders, and packages from the command line.
---

conform-ed ships command-line helpers for QTI validation, run from the monorepo via Bun scripts:

- **Validate a file** — `bun run qti:validate:file <file.xml>`
- **Validate a folder** — `bun run qti:validate:folder <dir>` (against the currently supported
  normalization slice)
- **Validate a package** — `bun run qti:validate:package <dir>` (exploded QTI package rooted at
  `imsmanifest.xml`)
- **Coverage report** — `bun run qti:coverage:report` (separates root-level coverage from actual
  validation success)
- **Inventory examples** — `bun run qti:inventory:examples`

These commands sit on top of [`@conform-ed/qti-xml`](/qti/). Packaging the CLI for standalone use is
on the roadmap; this section will expand as that lands.
