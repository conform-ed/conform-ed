/**
 * The Node-only surface of `@conform-ed/qti-xml`, published as the `./node` subpath.
 *
 * The package root (`./src/index.ts`) is browser-safe: no `node:` builtin reaches its
 * module graph, and the root bundle is built with `--target browser` plus a post-build
 * boundary assertion so a regression fails the build rather than a consumer's bundler.
 * Everything that genuinely needs a filesystem, a temp directory or `node:crypto` lives
 * here instead, so importing the root never drags Node builtins into a browser graph.
 *
 * What is Node-only and why:
 * - `example-inventory` — walks a directory tree (`node:fs/promises`, `node:path`) and
 *   hashes file content (`node:crypto`).
 * - `validate` — `validateQtiXmlFile` reads from disk, and `validateQtiXmlContent`
 *   resolves `xi:include` against the filesystem and anchors reported paths with
 *   `node:path`. Content validation is therefore NOT pure: both functions are Node-only,
 *   and splitting them would leave `node:fs/promises` in the browser graph anyway.
 * - `validate-package` — reads directories and streams PIF ZIPs through a temp directory
 *   (`node:fs`, `node:fs/promises`, `node:os`, `node:path`).
 *
 * Result *types* (`QtiValidationResult`, `QtiExampleInventoryReport`, …) are runtime-free
 * and stay on the root, so browser code can still describe validation output it receives
 * from a server without importing this entry.
 */

export * from "./example-inventory";
export * from "./validate";
export * from "./validate-package";
