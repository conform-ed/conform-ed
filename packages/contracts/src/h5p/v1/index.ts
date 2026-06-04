export {
  H5pMachineNameSchema,
  H5pLibraryFolderNameSchema,
  H5pVersionRefSchema,
  H5pLicenseSchema,
  H5pAuthorSchema,
  H5pChangelogEntrySchema,
} from "./shared";
export type {
  H5pMachineName,
  H5pLibraryFolderName,
  H5pVersionRef,
  H5pLicense,
  H5pAuthor,
  H5pChangelogEntry,
} from "./shared";

export { H5pPackageManifestSchema } from "./h5p-json";
export type { H5pPackageManifest } from "./h5p-json";

export { H5pLibraryManifestSchema } from "./library-json";
export type { H5pLibraryManifest } from "./library-json";

export { H5pSemanticsFieldSchema, H5pSemanticsSchema } from "./semantics";
export type {
  H5pFieldBase,
  H5pTextField,
  H5pHtmlField,
  H5pNumberField,
  H5pBooleanField,
  H5pImageField,
  H5pAudioField,
  H5pVideoField,
  H5pFileField,
  H5pSelectField,
  H5pLibraryField,
  H5pGroupField,
  H5pListField,
  H5pTableField,
  H5pSemanticsField,
  H5pSemantics,
} from "./semantics";

export { H5pCopyrightSchema, H5pMediaFileSchema, H5pLibraryEmbedSchema, H5pContentParamsSchema } from "./content";
export type { H5pCopyright, H5pMediaFile, H5pLibraryEmbed, H5pContentParams } from "./content";

import { H5pPackageManifestSchema } from "./h5p-json";
import { H5pLibraryManifestSchema } from "./library-json";
import { H5pSemanticsFieldSchema, H5pSemanticsSchema } from "./semantics";
import { H5pCopyrightSchema, H5pMediaFileSchema, H5pLibraryEmbedSchema, H5pContentParamsSchema } from "./content";
import {
  H5pMachineNameSchema,
  H5pLibraryFolderNameSchema,
  H5pVersionRefSchema,
  H5pLicenseSchema,
  H5pAuthorSchema,
  H5pChangelogEntrySchema,
} from "./shared";

export namespace H5pV1 {
  export namespace Schemas {
    export const PackageManifest = H5pPackageManifestSchema;
    export const LibraryManifest = H5pLibraryManifestSchema;
    export const SemanticsField = H5pSemanticsFieldSchema;
    export const Semantics = H5pSemanticsSchema;
    export const Copyright = H5pCopyrightSchema;
    export const MediaFile = H5pMediaFileSchema;
    export const LibraryEmbed = H5pLibraryEmbedSchema;
    export const ContentParams = H5pContentParamsSchema;
  }

  export namespace Shared {
    export const MachineName = H5pMachineNameSchema;
    export const LibraryFolderName = H5pLibraryFolderNameSchema;
    export const VersionRef = H5pVersionRefSchema;
    export const License = H5pLicenseSchema;
    export const Author = H5pAuthorSchema;
    export const ChangelogEntry = H5pChangelogEntrySchema;
  }
}

export type H5pV1Schemas = typeof H5pV1.Schemas;

export const H5pV1DerivedZodTemplates = {
  description: "H5P package and library Zod schemas for h5p.json, library.json, semantics.json, and content.json",
  specLinks: {
    specification: "https://h5p.org/documentation/developers/h5p-specification",
    jsonFiles: "https://h5p.org/documentation/developers/json-file-descriptions",
    semantics: "https://h5p.org/documentation/developers/semantics",
    phpLibrary: "https://github.com/h5p/h5p-php-library",
  },
  scope:
    "h5p.json (PackageManifest), library.json (LibraryManifest), semantics.json (SemanticsField array), content.json base types",
  coreSchemas: ["H5pPackageManifestSchema", "H5pLibraryManifestSchema", "H5pSemanticsSchema"],
  notes: [
    "content.json structure varies per library — H5pContentParamsSchema is a permissive base (z.record). Full content validation requires semantics traversal.",
    "Patch version intentionally excluded from H5pVersionRefSchema — any patch of the specified major.minor is acceptable per spec.",
    "runnable and fullscreen are 0|1 integers, not booleans, matching the H5P spec.",
    "PHP reference library (h5p-php-library) is GPL-3.0; NodeJS reference (Lumieducation/h5p-nodejs-library) is a full server framework. Neither is taken as a dependency.",
    "Validation regex patterns for machineName and library folder names are derived from H5PValidator in h5p-php-library.",
  ],
} as const;

export const DerivedZodTemplates = H5pV1DerivedZodTemplates;

// Convenience aliases so that `H5pV1.Schemas.*` and `H5pV1.Shared.*` work
// when consumers import via `export * as H5pV1 from "./h5p/v1"`.
export const Schemas = H5pV1.Schemas;
export const Shared = H5pV1.Shared;
