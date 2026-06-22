/**
 * W3C Verifiable Credentials Data Model 2.0 — {@link SpecSource} (conform-ed ADR-0013; curated
 * denominator from ADR-0017). Reconciles the VCDM core model — the **foundation** Open Badges 3.0
 * and CLR 2.0 build on — against the `VcDataModel20` Zod contracts.
 *
 * VCDM 2.0 is a **prose + JSON-LD** specification: the data model is normative text plus the
 * `https://www.w3.org/ns/credentials/v2` `@context`, with no normative validation schema (the
 * model is deliberately JSON-LD-extensible). So — the ADR-0017 case — the denominators are
 * hand-authored JSON Schemas under `vendor/vc-data-model/v2_0/curated/`, walked by
 * `walkers/curated.ts` under its provenance gate and reconciled against conform-ed's
 * `VerifiableCredentialSchema` / `VerifiablePresentationSchema` (modelled as passthrough objects,
 * matching the open JSON-LD model). Two documents are modelled, sharing one `$defs` block (the
 * two curated files carry a byte-identical `$defs` so the definition keys dedupe to one set):
 *
 *  - `VerifiableCredential` — @context / id / type / issuer / validity period / credentialSubject
 *    + the securing & service objects (proof, credentialSchema/Status, refreshService, termsOfUse,
 *    evidence).
 *  - `VerifiablePresentation` — @context / type / holder / verifiableCredential / proof.
 *
 * The many `one-or-many` fields (proof, credentialSubject, the service objects, verifiableCredential)
 * are modelled as `oneOf[single, array]` to mirror conform-ed's `oneOrMany` union, so the L2 join
 * resolves both forms and reconciles with no silent gaps. Same JSON binding on both sides, so no
 * `nameNormalizer` / alias / override is needed. **No value-sets**: VCDM is JSON-LD-open with no
 * closed enumerations in the core model (the `type` membership and `@context` first-entry rules are
 * `refine`/literal invariants, recorded in the conformance catalogue, not enumerated vocabularies).
 *
 * Out of scope: the securing-mechanism cryptographic suites (Data Integrity / JOSE-COSE proof
 * verification) and the JSON-LD `@context` term semantics — those are separate specifications.
 */

import { join } from "node:path";

import { VerifiableCredentialSchema, VerifiablePresentationSchema } from "@conform-ed/contracts/vc-data-model/v2_0";

import type { SpecSource } from "../../src/source";
import type { ConformanceRequirement } from "../../src/types";

const vendor = (file: string): string => join(import.meta.dir, "..", "..", "vendor", "vc-data-model", "v2_0", file);

/**
 * Conformance catalogue, curated from the W3C VC Data Model 2.0 Recommendation. The data model
 * defines no certification profiles, so requirements are grouped by the document they constrain —
 * `credential` and `presentation` — each anchoring to the reconciled curated item(s) it governs.
 * The credential keys live under `def:VerifiableCredential` (the shared definition both documents
 * reference), the presentation keys under `def:VerifiablePresentation`.
 */
const SPEC = "W3C Verifiable Credentials Data Model 2.0 — https://www.w3.org/TR/vc-data-model-2.0/";

const conformance: readonly ConformanceRequirement[] = [
  {
    key: "vc:2.0:conf:credential/VC-1",
    profile: "credential",
    reqId: "VC-1",
    level: "MUST",
    statement:
      "A verifiable credential MUST have a @context whose first value is https://www.w3.org/ns/credentials/v2, a type that includes VerifiableCredential, an issuer, a validFrom, and a credentialSubject.",
    constrains: [
      "vc:2.0:def:VerifiableCredential/@context",
      "vc:2.0:def:VerifiableCredential/type",
      "vc:2.0:def:VerifiableCredential/issuer",
      "vc:2.0:def:VerifiableCredential/validFrom",
      "vc:2.0:def:VerifiableCredential/credentialSubject",
    ],
    source: SPEC,
  },
  {
    key: "vc:2.0:conf:credential/VC-2",
    profile: "credential",
    reqId: "VC-2",
    level: "MUST",
    statement:
      "An id, when present, MUST be a single URL; validUntil, when present, MUST be an XMLSchema dateTime; a credentialSubject identifies the subject via an optional id.",
    constrains: [
      "vc:2.0:def:VerifiableCredential/id",
      "vc:2.0:def:VerifiableCredential/validUntil",
      "vc:2.0:def:CredentialSubject/id",
    ],
    source: SPEC,
  },
  {
    key: "vc:2.0:conf:credential/VC-3",
    profile: "credential",
    reqId: "VC-3",
    level: "MUST",
    statement:
      "Each credentialSchema, credentialStatus, refreshService, termsOfUse and evidence entry MUST carry a type (and an id where the property requires one).",
    constrains: [
      "vc:2.0:def:CredentialSchema/type",
      "vc:2.0:def:CredentialStatus/type",
      "vc:2.0:def:RefreshService/type",
      "vc:2.0:def:TermsOfUse/type",
      "vc:2.0:def:Evidence/type",
    ],
    source: SPEC,
  },
  {
    key: "vc:2.0:conf:credential/VC-4",
    profile: "credential",
    reqId: "VC-4",
    level: "MUST",
    statement:
      "A credential secured with an embedded proof MUST carry a proof with a type (the Data Integrity / Data Model securing mechanism).",
    constrains: ["vc:2.0:def:VerifiableCredential/proof", "vc:2.0:def:Proof/type"],
    source: "W3C VC Data Model 2.0 §securing-mechanisms — https://www.w3.org/TR/vc-data-model-2.0/",
  },
  {
    key: "vc:2.0:conf:presentation/VP-1",
    profile: "presentation",
    reqId: "VP-1",
    level: "MUST",
    statement:
      "A verifiable presentation MUST have a @context whose first value is https://www.w3.org/ns/credentials/v2 and a type that includes VerifiablePresentation; it MAY declare a holder and enclose verifiableCredential(s).",
    constrains: [
      "vc:2.0:def:VerifiablePresentation/@context",
      "vc:2.0:def:VerifiablePresentation/type",
      "vc:2.0:def:VerifiablePresentation/holder",
      "vc:2.0:def:VerifiablePresentation/verifiableCredential",
    ],
    source: SPEC,
  },
];

export const vcDataModelV2_0: SpecSource = {
  spec: "vc",
  version: "2.0",
  bindings: [
    // Curated denominators (ADR-0017): VCDM 2.0 publishes no validation schema (prose + JSON-LD).
    // The two files carry a byte-identical $defs block, so their definition keys dedupe to one set.
    {
      binding: "VerifiableCredential",
      schemaPath: vendor("curated/verifiable-credential.schema.json"),
      language: "curated",
      zod: VerifiableCredentialSchema,
    },
    {
      binding: "VerifiablePresentation",
      schemaPath: vendor("curated/verifiable-presentation.schema.json"),
      language: "curated",
      zod: VerifiablePresentationSchema,
    },
  ],
  conformance,
};
