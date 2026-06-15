# Common Cartridge conformance fixtures

Real-world Common Cartridge exports used to gate the CC decompose
(`@conform-ed/common-cartridge`) and the CC QTI 1.2.1 → QTI 3 bridge
(`@conform-ed/qti-xml`) against authentic cartridges, not just hand-authored ones.

## Provenance

Vendored from **[instructure/common-cartridge-viewer](https://github.com/instructure/common-cartridge-viewer)**
(`public/test-cartridges/`), which is **MIT-licensed** (© 2018 Instructure, Inc.) — so these
files are redistributable here, unlike Canvas/TopKit sample exports (AGPL, never committed).

- Source commit: `3a4e1da4215a5de646e6230ed092647822168563`
- License: MIT (see the upstream `LICENSE`).

## Files

| File                       | CC version | Contents                                                                                             | Exercises                                                      |
| -------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `all-question-types.imscc` | 1.3        | one CC QTI `assessment` (multiple_choice, true_false, multiple_response, essay) + associated content | the QTI 1.2.1 → QTI 3 **bridge** (every item must re-validate) |
| `single-page.imscc`        | 1.3        | a `webcontent` page + a learning-application-resource                                                | **decompose** version/title/org-tree/resource classification   |

`all-question-types` is upstream an unpacked directory; it is re-zipped here into a single
`.imscc` (with `imsmanifest.xml` at the archive root). `single-page.imscc` is copied verbatim.

Note: the upstream corpus contains no `cc.fib.v0p1` / `cc.pattern_match.v0p1` items (Canvas keeps
fill-in-blank in its non-CC variant), so those two profiles are covered by hand-authored fixtures
in `packages/qti-xml/test/cc-qti.test.ts`.
