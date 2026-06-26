# Vendored JSON-LD `@context` documents

These are byte-for-byte copies of the canonical, published JSON-LD contexts the verifier
expands credentials against during `eddsa-rdfc-2022` Data Integrity canonicalization. They
are vendored — never fetched at verify time — so verification has no network dependency and
no remote-context injection surface (`src/document-loader.ts` serves only these and refuses
any other IRI).

| File                            | Source IRI                                                   | Retrieved  |
| ------------------------------- | ------------------------------------------------------------ | ---------- |
| `vc-data-model-v2.context.json` | `https://www.w3.org/ns/credentials/v2`                       | 2026-06-24 |
| `vc-data-model-v1.context.json` | `https://www.w3.org/2018/credentials/v1`                     | 2026-06-26 |
| `elm-edc-ap.context.json`       | `http://data.europa.eu/snb/model/context/edc-ap`             | 2026-06-26 |
| `open-badges-v3p0.context.json` | `https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json` | 2026-06-24 |
| `clr-v2p0.context.json`         | `https://purl.imsglobal.org/spec/clr/v2p0/context.json`      | 2026-06-24 |

Each is self-contained (no nested remote `@context` references). To refresh, re-download
from the source IRI and keep the filename; the `@context` URL → document mapping lives in
`src/contexts.ts`.
