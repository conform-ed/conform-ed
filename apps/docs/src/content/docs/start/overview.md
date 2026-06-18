---
title: What is conform-ed?
description: An overview of conform-ed — the two jobs it does, and which tool fits which job.
---

**conform-ed** is open-source tooling for building and verifying conformance to the common
standards of digital education. It exists to do two jobs:

## Build conformant data

Produce data that is correct against a published specification, with types and validation you can
rely on:

- **[`@conform-ed/contracts`](/contracts/)** — runtime [Zod](https://zod.dev) validators and
  inferred TypeScript types for ~13 standards (xAPI, cmi5, LTI 1.3, QTI, Common Cartridge,
  OneRoster, CASE, CLR, Open Badges, Caliper, CAT, VC Data Model, h5p).
- **[QTI delivery runtime](/qti/)** — a headless, accessible engine for delivering and scoring QTI 3
  assessments in the browser.
- **[Common Cartridge](/common-cartridge/)** — read and write IMS Common Cartridge packages.

## Verify conformance

Prove that an implementation actually conforms — yours or a third party's:

- **[Conformance runners](/runners/)** — container images that exercise an xAPI LRS, a cmi5 course,
  or an LTI 1.3 tool/platform and emit a pass/fail report.
- **[CLI](/cli/)** — validate QTI XML files, folders, and packages from the command line.
- **[Coverage map](/coverage/)** — a machine-readable map of how much of each published spec is
  modelled, measured against the literal schema.

## Who it's for

conform-ed is built for **engineers** integrating or certifying ed-tech systems. It does not ship a
product UI; the QTI reference skins, runner images, and contracts are building blocks you compose
into your own platform.

## How it ships

- **npm** — libraries are published under the `@conform-ed/*` scope.
- **GHCR** — runner and adapter images are published to `ghcr.io/conform-ed/<image>`.

Everything releases together under a single version. See [Getting started](/start/getting-started/).
