# Changelog

All notable changes will be tracked here.

## Unreleased

- Initial monorepo scaffold.

## Next

- Build OCI images with `bun build` (tree-shaken bundles) instead of shipping raw `node_modules`. Both `lrs-runner` and `cmi5-runner` images are ~47% smaller (396 MB → 209 MB, 390 MB → 207 MB). The `lrs-runner` image retains only the runtime test suite TypeScript files and the `jose` package; all other deps are bundled into `dist/cli.js`. The `cmi5-runner` image ships a single bundled `dist/index.js` (1.2 MB) with no `node_modules` at all.
