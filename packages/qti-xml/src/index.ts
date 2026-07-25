/**
 * The browser-safe surface of `@conform-ed/qti-xml`: root detection, schema selection,
 * XML parsing, normalization and every serializer. No module reachable from here imports
 * a `node:` builtin — the bundle is built with `--target browser` and a post-build
 * boundary assertion enforces it.
 *
 * Filesystem-bound entry points (file/folder/package validation, the example inventory)
 * live on the `./node` subpath — see ./node.ts.
 */

export * from "./normalize";
export * from "./parse-xml";
export * from "./root-detection";
export * from "./schema-selection";
export * from "./types";
export * from "./serialize-result";
export * from "./serialize-pnp";
export * from "./serialize-usage-data";
export * from "./serialize-asi";
export * from "./serialize-manifest";
export * from "./serialize-document";
export * from "./cc-qti";
export * from "./xml-writer";
