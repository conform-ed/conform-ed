---
title: Design decisions
description: Architecture Decision Records (ADRs) for conform-ed — the why behind the design.
sidebar:
  order: 0
---

conform-ed records significant, hard-to-reverse design choices as **Architecture Decision
Records**. Each ADR captures the context, the decision, and the alternatives that were rejected.

| ADR      | Decision                                                                                                                              | Status                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| ADR-0001 | [Headless QTI runtime core with injected skins](/decisions/0001-headless-qti-runtime-core-and-skins/)                                 | accepted                                                       |
| ADR-0002 | [QTI 3 scope: the 1EdTech Delivery conformance ladder](/decisions/0002-qti3-conformance-ladder-scope/)                                | accepted                                                       |
| ADR-0003 | [Capability gate: unsupported content is reported, never silently dropped](/decisions/0003-capability-gate-no-silent-drops/)          | accepted                                                       |
| ADR-0004 | [Staged response-processing interpreter, spec-strict by default](/decisions/0004-staged-rp-interpreter-spec-strict/)                  | accepted                                                       |
| ADR-0005 | [assessmentTest semantics live here, as a headless test controller](/decisions/0005-headless-test-controller/)                        | accepted                                                       |
| ADR-0006 | [PCI hosting is an opt-in trust boundary with an injectable module registry](/decisions/0006-pci-host-opt-in-trust-boundary/)         | accepted                                                       |
| ADR-0006 | [QTI Results Reporting: views in qti-react, the binding in qti-xml](/decisions/0006-results-reporting/)                               | accepted                                                       |
| ADR-0007 | [PCI loading: install model now, hash-pinned catalog as a policy layer later](/decisions/0007-pci-loading-install-model/)             | accepted                                                       |
| ADR-0008 | [PNP/AfA and the catalog subsystem: activation in pnp, presentation in the runtime](/decisions/0008-pnp-catalog-subsystem/)           | accepted                                                       |
| ADR-0009 | [Full-spec completion: every binding reads, every registered root normalizes](/decisions/0009-full-spec-completion/)                  | accepted                                                       |
| ADR-0010 | [ASI export serializers: every readable binding now writes, gated by a corpus round trip](/decisions/0010-asi-export-serializers/)    | accepted                                                       |
| ADR-0011 | [Official-XSD conformance hardening lane](/decisions/0011-xsd-conformance-hardening/)                                                 | accepted                                                       |
| ADR-0012 | [Generic PCI delivery: hash-pinned module catalog + state persistence](/decisions/0012-generic-pci-hash-pinned-catalog-and-state/)    | accepted (2026-06-16) — conform-ed side **built** (2026-06-16) |
| ADR-0013 | [Spec Coverage Map: literal-schema denominator, Zod provenance, conformance catalog](/decisions/0013-spec-coverage-map/)              | accepted (2026-06-17)                                          |
| ADR-0014 | [Docs site: Astro Starlight, monorepo source deployed to a dedicated org-pages repo](/decisions/0014-docs-site-platform-and-hosting/) | accepted (2026-06-18)                                          |
