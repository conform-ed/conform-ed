# CASE v1.1 Zod Implementation

This document describes the Zod schema implementation for [CASE v1.1](https://www.imsglobal.org/spec/case/v1p1) (Competency and Academic Standards Exchange).

## Specification Links

- **CASE v1.1 Base**: https://www.imsglobal.org/spec/case/v1p1
- **JSON Schema Definitions**: https://purl.imsglobal.org/spec/case/v1p1/schema/json/
- **OpenAPI3 Definitions**: https://purl.imsglobal.org/spec/case/v1p1/schema/openapi/

## Overview

CASE v1.1 defines a comprehensive data model for representing competency and academic standards frameworks. The specification includes:

- **Core Entities**: CFPackage, CFItem (competency/standard), CFAssociation (relationships), CFRubric, CFLicense
- **Collections**: CFAssociationSet, CFConceptSet, CFItemTypeSet, CFSubjectSet, CFDocumentSet
- **Integration**: IMSX Status models for API/integration scenarios
- **API Bindings**: OpenAPI3 REST operations for CRUD and retrieval

## Schema Organization

```
packages/contracts/src/case/v1_1/
├── shared.ts                                   # Core entity and shared validators
├── case_v1p1_cfassociation_jsonschema1.ts    # CFAssociation export
├── case_v1p1_cfassociationset_jsonschema1.ts # CFAssociationSet export
├── case_v1p1_cfconceptset_jsonschema1.ts     # CFConceptSet export
├── case_v1p1_cfdocument_jsonschema1.ts       # CFDocument export
├── case_v1p1_cfdocumentset_jsonschema1.ts    # CFDocumentSet export
├── case_v1p1_cfitem_jsonschema1.ts           # CFItem export
├── case_v1p1_cfitemtypeset_jsonschema1.ts    # CFItemTypeSet export
├── case_v1p1_cflicense_jsonschema1.ts        # CFLicense export
├── case_v1p1_cfpackage_jsonschema1.ts        # CFPackage export
├── case_v1p1_cfrubric_jsonschema1.ts         # CFRubric export
├── case_v1p1_cfsubjectset_jsonschema1.ts     # CFSubjectSet export
├── case_v1p1_imsx_statusinfo_jsonschema1.ts  # IMSX Status export
├── case_v1p1_openapi3_restbinding_schema.ts  # REST operation bindings
└── index.ts                                    # Barrel and namespace exports
```

## Core Schemas

### CFPackage

Root container for a competency/standards framework.

```typescript
import { CaseV1_1 } from "@conform-ed/contracts/case/v1_1";

const pkg = {
  id: "6g1568e7-0i5f-7e1g-2h4d-5f8i6e9g0d1h",
  uri: "http://example.org/cf/packages/1",
  title: "Core Competencies",
};

const result = CaseV1_1.Schemas.CFPackage.safeParse(pkg);
```

### CFItem

Represents a competency or academic standard.

```typescript
const item = {
  id: "7h2679f8-1j6g-8f2h-3i5e-6g9j7f0h1e2i",
  uri: "http://example.org/cf/items/1",
  fullStatement: "Students can analyze data",
};

const result = CaseV1_1.Schemas.CFItem.safeParse(item);
```

### CFAssociation

Represents relationships between competencies (e.g., prerequisites, composition).

```typescript
const association = {
  id: "3d8235b4-7f2c-4b8d-9e1a-2c5f3b6d7a8e",
  uri: "http://example.org/cf/associations/1",
  originNodeIdentifier: "4e9346c5-8g3d-5c9e-0f2b-3d6g4c7e8b9f",
  destinationNodeIdentifier: "5f0457d6-9h4e-6d0f-1g3c-4e7h5d8f9c0g",
  associationType: "isChildOf",
};

const result = CaseV1_1.Schemas.CFAssociation.safeParse(association);
```

### CFRubric

Scoring guide or assessment rubric.

```typescript
const rubric = {
  id: "8i378a0g-2k7h-9g3i-4j6f-7h0k8g1i2f3j",
  uri: "http://example.org/cf/rubrics/1",
  title: "Assessment Rubric",
  description: "Scoring guide for competency evaluation",
};

const result = CaseV1_1.Schemas.CFRubric.safeParse(rubric);
```

## Collections

Use collection schemas for bulk data transfer:

```typescript
// CFAssociationSet
const assocSet = {
  association: [{/* CFAssociation 1 */}, {/* CFAssociation 2 */}],
};

const result = CaseV1_1.Schemas.CFAssociationSet.safeParse(assocSet);

// CFConceptSet
const conceptSet = {
  conceptSet: [{/* CFConcept 1 */}],
};

const result = CaseV1_1.Schemas.CFConceptSet.safeParse(conceptSet);
```

## REST API Bindings

OpenAPI3 operation signatures are exposed for API client generation and introspection:

```typescript
// Get single resource
const op = CaseV1_1.RestBinding.Operations.getCFAssociation;
console.log(op.method); // "GET"
console.log(op.path); // "/cfAssociations/{id}"

// List resources
const listOp = CaseV1_1.RestBinding.Operations.listCFAssociations;
console.log(listOp.method); // "GET"
console.log(listOp.path); // "/cfAssociations"
```

Available operations:

- `getCFAssociation` / `listCFAssociations`
- `getCFConcept` / `listCFConcepts`
- `getCFItem` / `listCFItems`
- `getCFItemType` / `listCFItemTypes`
- `getCFLicense` (single only)
- `getCFPackage` (single only)
- `getCFRubric` (single only)
- `listCFSubjects`

## Validators and Shared Types

### UUID

RFC4122 compliant identifier:

```typescript
const uuid = "3d8235b4-7f2c-4b8d-9e1a-2c5f3b6d7a8e";
const result = CaseV1_1.Shared.Uuid.safeParse(uuid);
```

### DateTime

ISO8601 timestamp:

```typescript
const dt = "2024-01-15T10:30:00Z";
const result = CaseV1_1.Shared.DateTime.safeParse(dt);
```

### Link URIs

HTTP URIs for resource references:

```typescript
const uri = "http://example.org/cf/items/1";
const result = CaseV1_1.Shared.LinkUri.safeParse(uri);
```

### Extensible Vocabularies

Support standard and vendor-specific (ext:\*) extensions:

```typescript
const typeEnum = CaseV1_1.Shared.ExtensionEnum(["isChildOf", "isPartOf"]);

// Standard value
typeEnum.safeParse("isChildOf"); // ✓

// Vendor extension
typeEnum.safeParse("ext:custom-association-type"); // ✓

// Invalid
typeEnum.safeParse("unknownType"); // ✗
```

## Import Patterns

### Full namespace

```typescript
import { CaseV1_1 } from "@conform-ed/contracts/case/v1_1";

const pkg = CaseV1_1.Schemas.CFPackage;
```

### Individual schemas

```typescript
import { CFPackageSchema, CFItemSchema } from "@conform-ed/contracts/case/v1_1";

const pkg = CFPackageSchema;
const item = CFItemSchema;
```

### Subpath export

```typescript
import { CaseV1_1 } from "@conform-ed/contracts/case/v1_1";

const RestOps = CaseV1_1.RestBinding.Operations;
```

## Design Notes

### Strict validation

All entity schemas use `.strict()` to reject additional properties not defined in the spec. This ensures compatibility with strict JSON Schema validation.

### Extensibility

- Vendor-specific properties use `z.record(z.string(), z.unknown())` passthrough pattern
- Vocabulary fields use `z.union([z.enum([...]), z.string().regex(/^ext:.../)])` pattern
- This allows both strict standard conformance and flexible vendor extensions

### Shared IMSX Models

IMSX Status information is shared across multiple standards (CLR, OB, OneRoster, CASE):

```typescript
import { ImsxStatusInfoSchema } from "@conform-ed/contracts/case/v1_1";
// Same schema available in CLR v2_0, OpenBadges v3_0, OneRoster v1_2
```

## Testing

Run CASE v1.1 tests:

```bash
bun test packages/contracts/test/case-v1_1.test.ts
```

Tests cover:

- Core entity schema validation
- UUID and datetime validators
- REST binding operation structure
- Extensible vocabulary support
- Derived template exports

## Compliance

- **Specification**: CASE v1.1 JSON Schema and OpenAPI3
- **Validation Mode**: strict (additionalProperties rejected)
- **Date Format**: ISO8601 with optional timezone
- **Identifier Format**: RFC4122 UUID v4/v5
- **Extensibility**: ext:\* vendor extensions supported per spec

## Known Limitations

1. **OpenAPI2 variants**: Not implemented; OpenAPI3 only
2. **Profile/extension variants**: No profile-specific sub-schemas in this initial release
3. **Computed collections**: Collection schemas model explicit array payloads, not server-generated paging

## Future Enhancements

- Profile-specific sub-schemas (e.g., CASE-OSTP)
- Paging/filtering operation bindings from OpenAPI3
- Domain-specific vocabulary registries for extensible types
