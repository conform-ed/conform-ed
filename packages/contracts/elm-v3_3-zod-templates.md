# ELM v3.3 — Zod modelling notes (provenance & normalisations)

The `src/elm/v3_3` contracts model the European Learning Model v3.3 (ADR-0019). Per ADR-0013,
this Zod is a deliberately normalised model, not literal SHACL fidelity — the literal denominator
is the vendored SHACL (`packages/coverage/vendor/elm/shapes`), reconciled against this Zod by the
coverage map. Notes:

## Source

Property names and the class set follow the **structural SHACL shapes** (`edc-generic-no-cv` for
EDC; `loq`/`ams`/`pid` constraints) — 52 classes. The coverage reconciler joins by property **name**,
so names are faithful; value types are pragmatic (see below).

## Structure

- **Single `core.ts` module** (a deviation from the design doc's multi-file `core/` sketch):
  the ELM ontology is densely mutually-cross-linked (Agent↔Group, Organisation↔Accreditation,
  Person→Claim→AwardingProcess→Organisation…), so one module with `z.lazy` forward references is
  cleaner than fighting cross-file import cycles. The four mutually-recursive schemas
  (`Agent`, `Organisation`, `Group`, `Accreditation`) carry an explicit `: z.ZodType` annotation —
  the standard Zod-v4 fix to break TS's self-referential inference cycle.
- `edc.ts` layers the W3C VC envelope + JAdES delivery shape over the core; `loq.ts`/`ams.ts`/
  `pid.ts` re-export the core roots each plain-dataset profile is validated from.

## ELM serialisation facts (from the EU corpus, not the W3C VC base)

- **Language-tagged text is `{ "<lang>": ["value", …] }`** — a locale → `string[]` map
  (`LangStringSchema`), not OB's `string | { tag: string }`.
- **`type` is a bare class-name string/array** discriminator (`["VerifiableCredential",
"EuropeanDigitalCredential"]`), not a node object.
- **The pre-issuance delivery form omits `@context` and `issuer`** (added at issuance/sealing).
  The Zod keeps both optional; the SHACL `edc-generic-full` shape enforces `issuer` at verify-time.
- Unsigned EU examples are delivery-wrapped (`{ credential, deliveryDetails }`); the EDC is
  `.credential`. Signed examples are the JAdES JSON serialization (`{ payload, signatures }`).

## Value typing (follow-on deepening)

Values are typed where the EU corpus pins them (dates as strings, langStrings, numeric unions,
the spine references Person/Organisation/Claim/etc. via lazy refs) and kept permissive
(`z.unknown()`) for peripheral object references. Every class is a `passthroughObject`, so
unmodelled long-tail fields are preserved (round-trip holds) but currently reconcile as coverage
gaps. Deepening peripheral value types to typed refs is a follow-on pass that improves coverage L2
without changing the round-trip behaviour.

## Round-trip gate

`test/elm-v3_3.test.ts` parses the 5 unsigned EU credentials and asserts `parse(input)` deep-equals
`input` (no drops, no transforms). The 5 signed examples are JAdES-wrapped and are exercised by the
seal lane (P5), not the contract round-trip.
