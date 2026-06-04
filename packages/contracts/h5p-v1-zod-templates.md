# H5P v1 Zod Templates

## Specification Sources

| Source                      | URL                                                             |
| --------------------------- | --------------------------------------------------------------- |
| H5P Developer Specification | https://h5p.org/documentation/developers/h5p-specification      |
| JSON File Descriptions      | https://h5p.org/documentation/developers/json-file-descriptions |
| Semantics Reference         | https://h5p.org/documentation/developers/semantics              |
| PHP Reference Library       | https://github.com/h5p/h5p-php-library                          |
| NodeJS Reference Library    | https://github.com/Lumieducation/h5p-nodejs-library             |

## Scope

This bundle covers the four JSON schemas that make up the H5P package format:

| File             | Schema                     | Description                                             |
| ---------------- | -------------------------- | ------------------------------------------------------- |
| `h5p.json`       | `H5pPackageManifestSchema` | Top-level package manifest in every `.h5p` archive      |
| `library.json`   | `H5pLibraryManifestSchema` | Library directory manifest (runnable or helper library) |
| `semantics.json` | `H5pSemanticsSchema`       | Editor form schema — array of typed field descriptors   |
| `content.json`   | `H5pContentParamsSchema`   | Permissive base (`z.record`) for per-library content    |

Not in scope: ZIP extraction, file whitelist checking, content validation against semantics.

## Dependency Decision: Why No External Library

| Library                            | Licence                          | Verdict                                                      |
| ---------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| `h5p/h5p-php-library`              | GPL-3.0 (HTML purification code) | Cannot use — GPL is viral                                    |
| `Lumieducation/h5p-nodejs-library` | MIT (JS parts)                   | Wrong abstraction — it's a full HTTP server, not a validator |

We implement our own Zod schemas, referencing both libraries for validation logic and regex patterns.

## Design Decisions

### Machine name validation

Pattern from `H5PValidator::isValidRequiredH5pData` in h5p-php-library:

```
/^[\w0-9\-\.]{1,255}$/i
```

Used on every `machineName` field and in the library folder name schema.

### Patch version excluded from version references

H5P dependency declarations (`preloadedDependencies`, `dynamicDependencies`, `editorDependencies`) use only `{ machineName, majorVersion, minorVersion }`. Any patch release of a matching major.minor is acceptable. `H5pVersionRefSchema` reflects this: it has no `patchVersion` field.

`H5pLibraryManifestSchema` does include `patchVersion` because the library itself must declare its full three-part version.

### `runnable` and `fullscreen` are integers, not booleans

The H5P spec defines these as `0` or `1`, not `true`/`false`. `z.union([z.literal(0), z.literal(1)])` is used in `H5pLibraryManifestSchema` to match this exactly.

### Semantics: recursive type handling

`semantics.json` defines a recursive schema: `group` contains `fields: SemanticsField[]` and `list` contains `field: SemanticsField`. This is handled with the `z.lazy()` / let-then-assign pattern (same approach as cmi5 `Block`/`Au` schemas):

```typescript
let h5pSemanticsFieldSchemaInternal: z.ZodType<H5pSemanticsField>;

const groupFieldSchema = z.object({
  ...baseFieldShape,
  type: z.literal("group"),
  fields: z.lazy(() => z.array(h5pSemanticsFieldSchemaInternal)),
  ...
});

h5pSemanticsFieldSchemaInternal = z.union([textFieldSchema, ..., groupFieldSchema, listFieldSchema]);
```

TypeScript-side recursive interfaces are declared manually to avoid circular inference, then the Zod schema is cast to `z.ZodType<H5pSemanticsField>`.

### Semantics: non-strict objects

Leaf field schemas (`textFieldSchema`, `numberFieldSchema`, etc.) use `z.object(...)` (not `strictObject()`) because:

1. H5P has a large ecosystem of third-party widgets that add arbitrary extra properties to field definitions.
2. The spec acknowledges extension properties on field objects.

Only `H5pVersionRefSchema` and `H5pMediaFileSchema` use `strictObject()` since their shapes are fully specified.

### Content params: permissive base

`content.json` structure is defined per-library by its `semantics.json`. There is no universal content schema. `H5pContentParamsSchema` is `z.record(z.string(), z.unknown())` — structurally valid JSON objects.

**Future work**: A `validateContentAgainstSemantics(content, semantics)` function could be built on top of `H5pSemanticsSchema` to perform deep structural validation. This requires a semantics traversal engine (walk the semantics field tree, validate each content value against its corresponding field schema). Out of scope for this bundle.

### License codes

Standard H5P license codes from the editor UI:
`CC BY`, `CC BY-SA`, `CC BY-NC`, `CC BY-NC-SA`, `CC BY-ND`, `CC BY-NC-ND`, `CC0`, `GNU GPL`, `PD`, `ODC PDDL`, `CC PDM`, `U`

`"U"` means undisclosed/unknown — the H5P default when no license is specified.

## Validation Logic Derived from PHP Validator

The following regex patterns are taken directly from `H5PValidator` in h5p-php-library:

| Field           | Pattern                                            |
| --------------- | -------------------------------------------------- |
| `machineName`   | `/^[\w0-9\-\.]{1,255}$/i`                          |
| `title`         | 1–255 characters                                   |
| `language`      | `/^[-a-zA-Z]{1,10}$/` (ISO-639-1 + region subtags) |
| version numbers | 1–5 digit integers                                 |
| embed types     | only `"iframe"` or `"div"` allowed                 |

Additional cross-field validations (implemented via `.superRefine()`):

- `embedTypes` must not contain duplicates
- `yearTo` must be ≥ `yearFrom` when both are present
- Runnable iframe libraries without declared `w`/`h` emit a validation issue

## File Whitelist (Not Validated by This Bundle)

Per the H5P spec, only whitelisted file types are allowed in `.h5p` archives. This is a runtime/extraction concern rather than a JSON schema concern. For reference:

**Content files**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.tif`, `.tiff`, `.svg`, `.mp3`, `.wav`, `.m4a`, `.mp4`, `.ogg`, `.webm`, `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.json`

**Library files**: All of the above, plus `.js`, `.css`, `.xml`

**Prohibited**: `.html`, `.htm`, any executable format
