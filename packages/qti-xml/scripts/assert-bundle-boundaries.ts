/**
 * Post-build guard for the browser/Node entry split.
 *
 * `bun build --target browser` does NOT fail on a `node:` import — it silently substitutes
 * a browser shim (verified empirically: a `node:path` import bundles clean under
 * `--target browser` and only leaves a `// node:path` marker in the output). So the target
 * alone cannot enforce the boundary, and this assertion does it instead: the root bundle
 * must carry no trace of a Node builtin, and the `./node` bundle must carry them (it is
 * the only reason that entry exists).
 *
 * Also pinned: the root bundle must not reference `fast-xml-validator`. That package was
 * dropped precisely because its dependency tree (detailed-xml-validator →
 * @nodable/flexible-xml-parser) relies on Node's `Buffer` global and breaks browser
 * bundles — see src/parse-xml.ts for the full rationale.
 */

const distDirectory = new URL("../dist/", import.meta.url);

const failures: string[] = [];

async function readBundle(name: string): Promise<string> {
  const file = Bun.file(new URL(name, distDirectory));

  if (!(await file.exists())) {
    failures.push(`${name} is missing — did the build step run?`);
    return "";
  }

  return file.text();
}

const rootBundle = await readBundle("index.js");
const nodeBundle = await readBundle("node.js");

const nodeBuiltinPattern = /node:[a-z/]+/gu;

const rootBuiltins = [...new Set(rootBundle.match(nodeBuiltinPattern) ?? [])].sort();
if (rootBuiltins.length > 0) {
  failures.push(
    `dist/index.js references Node builtins (${rootBuiltins.join(", ")}). The package root is the ` +
      `browser surface: move the offending module behind the ./node subpath (src/node.ts).`,
  );
}

if (rootBundle.includes("fast-xml-validator")) {
  failures.push(
    "dist/index.js references fast-xml-validator, whose dependency tree breaks browser bundles. " +
      "Use fast-xml-parser's XMLValidator instead (see src/parse-xml.ts).",
  );
}

// A fresh, non-global regex: `nodeBuiltinPattern` is sticky-stateful across `test` calls.
if (nodeBundle.length > 0 && !/node:[a-z/]+/u.test(nodeBundle)) {
  failures.push(
    "dist/node.js references no Node builtins. Either the ./node entry lost its filesystem " +
      "surface, or the split is no longer needed and this guard should be revisited.",
  );
}

if (failures.length > 0) {
  console.error("Bundle boundary assertions failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`Bundle boundaries OK: dist/index.js is browser-safe, dist/node.js carries the Node surface.`);
