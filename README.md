# conform-ed

conform-ed is an open-source monorepo for standards conformance tooling.

## Scope

- xapi LRS conformance runner
- xapi cmi5 conformance/oracle runner
- LTI 1.3 conformance runner
- Reference adapter services for cmi5 and LTI 1.3
- Shared contracts, schemas, reporting, and CI workflows
- QTI 2.x / 3.0 (Question & Test Interoperability)
- cmi5 (Quartz course structure and keyword extension)
- Caliper Analytics (https://github.com/1EdTech/caliper-spec)
- IMS Common Cartridge (CC) + Thin CC
- CLR 2.0 (Comprehensive Learner Record) / CLR Standard
- LTI 1.3 / LTI Advantage (core launch, deep linking, AGS, NRPS, proctoring)
- Open Badges 3.0 (1EdTech) (https://github.com/1EdTech/openbadges-specification, https://github.com/1EdTech/digital-credentials-public-validator and https://github.com/1EdTech/openbadges-validator-core)
- OneRoster 1.2 (1EdTech) (https://www.imsglobal.org/spec/oneroster/v1p2/)
- h5p
- CASE (https://github.com/1EdTech/OpenCASE)
- Verifiable Credentials Data Model 2.0 (W3C) (https://www.w3.org/TR/vc-data-model-2.0/)

### Standards under consideration

- Accessibility (WCAG 2.1 Level AA, WCAG 2.2)
- SCORM 1.2/2004
- EDC / Europass

## Implemented Zod Schemas

Comprehensive Zod validators for the following standards are available in `packages/contracts`:

- **Caliper Analytics v1.2** — Learning event and entity analytics model (https://www.imsglobal.org/spec/caliper/v1p2/impl/)
- **CASE v1.1** — Competency and Academic Standards Exchange (https://www.imsglobal.org/spec/case/v1p1)
- **CAT v1.0** — Computer Adaptive Testing REST API (https://www.imsglobal.org/spec/cat/v1p0/impl/)
- **CLR v2.0** — Comprehensive Learner Record (https://www.imsglobal.org/spec/clr/v2p0)
- **Common Cartridge v1.3 & v1.4** — IMS Common Cartridge packaging (https://www.imsglobal.org/cc/)
- **Open Badges v3.0** — 1EdTech Verifiable Credentials for achievement (https://www.imsglobal.org/spec/ob/v3p0/)
- **OneRoster v1.2** — Rostering, gradebook, and resource APIs (https://www.imsglobal.org/spec/oneroster/v1p2/)
- **QTI v2.1, v2.2, v3.0.1** — Question & Test Interoperability (https://www.imsglobal.org/spec/qti/)
- **cmi5 Quartz** — Course structure XML and keyword extension
- **xAPI** — 1.0.3 and IEEE 2.0 statement/data/transport contracts
- **LTI 1.3 + companions** — Core launch, Deep Linking 2.0, AGS 2.0, NRPS 2.0, and Proctoring 1.0
- **VC Data Model v2.0** — W3C Verifiable Credentials foundation (https://www.w3.org/TR/vc-data-model-2.0/)

Import patterns and usage examples are documented in `packages/contracts/<standard>-zod-templates.md` files.

## Stack

- Bun workspaces
- Turbo
- TypeScript Native (`tsgo`)
- `oxlint` + `oxfmt`
- Podman for local container workflows

## Release Strategy

First release train is OCI-only.

- Primary registry: GHCR
- npm publishing: npmjs

## Quickstart

```bash
bun install
bun run validate
```

See `docs/development/getting-started.md` for details.
