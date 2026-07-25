# @conform-ed/qti-xml

QTI XML intake, inventory, and validation helpers for the versioned contracts package.

## Two entry points

| Import                     | Contains                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@conform-ed/qti-xml`      | The **browser-safe** surface: root detection, schema selection, XML parsing, normalization, every serializer, and all result types.                            |
| `@conform-ed/qti-xml/node` | The **Node-only** surface: `validateQtiXmlFile` / `validateQtiXmlContent`, `validateQtiPackagePath` / `validateQtiPackageArchive`, `buildQtiExampleInventory`. |

Nothing reachable from the root imports a `node:` builtin — the root bundle is built with
`--target browser` and a post-build assertion (`scripts/assert-bundle-boundaries.ts`) fails the
build if one creeps back in. Validation needs a filesystem (it reads files, resolves `xi:include`
against them, and streams PIF ZIPs through a temp directory), so it lives on `./node`.

This package deliberately keeps the fixture strategy conservative:

- it works against user-provided paths such as `/path/to/qti-examples`
- it does not vendor the official example XML corpus into the repo
- tests should prefer synthetic fixtures or generated metadata over copied upstream examples

Current supported XML -> normalized-contract validation roots:

- QTI 2.2 `assessmentItem`
- QTI 2.2 `manifest`
- QTI 3.0.1 `qti-assessment-item`
- QTI 3.0.1 `qti-assessment-test`
- QTI 3.0.1 `assessmentResult`

Current inventory/CLI entry points:

- `bun run qti:inventory:examples -- --root /path/to/qti-examples`
- `bun run qti:validate:file -- path/to/file.xml`
- `bun run qti:validate:folder -- path/to/folder`
- `bun run qti:validate:package -- path/to/exploded-package`
- `bun run qti:coverage:report -- --root /path/to/qti-examples`
