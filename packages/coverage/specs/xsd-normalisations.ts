/**
 * Shared `specRef` overrides for the XSD-family maps (conform-ed ADR-0013).
 *
 * The XSD walker keys the literal information model by the schema's own names, while
 * conform-ed's Zod names a handful of *unnamed* or *foreign-named* XSD constructs of its
 * own accord. The structural reconciliation matches purely by property name, so these
 * cannot align and would otherwise show as false `silentGaps` / `extensions`. Each
 * override below documents one such rename; {@link applySpecRefOverrides} absorbs the
 * matching residue keys into `residues.normalisations` so the residue lists keep only
 * genuine signal. They are shared because the same three renames recur across CC 1.3 /
 * 1.4 and QTI — each map opts in by listing the ones that apply to it.
 */

import type { SpecRefOverride } from "../src/source";

/**
 * `xs:any` — a nameless wildcard the XSD walker deliberately emits no item for (it is an
 * open extension point, not a named node) — is modelled by conform-ed as a named
 * `extensions` field. There is therefore no literal item to pair; the Zod `extensions`
 * property is the only side, recorded as a documented rename rather than an extension.
 */
export const XS_ANY_EXTENSIONS: SpecRefOverride = {
  note: "XSD `xs:any` open-content wildcard → conform-ed `extensions` (an unnamed wildcard has no literal name to join).",
  modelledSegment: "extensions",
};

/**
 * An XSD `simpleContent` element carries its text in an unnamed text node alongside its
 * attributes; conform-ed names that text `value`. Like `xs:any`, the literal leaves it
 * unnamed, so only the Zod `value` property exists to absorb.
 */
export const SIMPLE_CONTENT_VALUE: SpecRefOverride = {
  note: "XSD `simpleContent` text node → conform-ed `value` (the literal leaves the text node unnamed).",
  modelledSegment: "value",
};

/**
 * The foreign `xml:base` attribute (local name `base` once the namespace is stripped) is
 * modelled by conform-ed as `xmlBase`. This is a rename of a *named* construct, so it has
 * a literal side: the `/base` items are modelled (flipped to `yes`), not gaps.
 *
 * Opt in **only where conform-ed actually models it** — QTI 2.1 / 2.2 name no `xmlBase`,
 * so their `/base` items are genuine silent gaps and must stay.
 */
export const XML_BASE: SpecRefOverride = {
  note: "Foreign `xml:base` attribute (local name `base`) → conform-ed `xmlBase` (a named rename; the literal items are modelled).",
  modelledSegment: "xmlBase",
  literalSegment: "base",
};

/**
 * The foreign `xml:lang` attribute (local name `lang` once the namespace is stripped) is
 * modelled by conform-ed as `xmlLang` on the nodes that do not also carry the plain `lang`
 * field. A named rename of a *named* construct, like {@link XML_BASE}: the `/lang` items are
 * modelled (flipped to `yes`), not gaps.
 */
export const XML_LANG: SpecRefOverride = {
  note: "Foreign `xml:lang` attribute (local name `lang`) → conform-ed `xmlLang` (a named rename; the literal items are modelled).",
  modelledSegment: "xmlLang",
  literalSegment: "lang",
};
