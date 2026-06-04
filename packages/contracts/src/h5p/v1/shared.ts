import { z } from "zod";

export function strictObject<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}

// Machine name: alphanumeric, hyphens, dots — used in machineName fields and folder names.
// Pattern from h5p-php-library H5PValidator::isValidRequiredH5pData
export const H5pMachineNameSchema = z.string().regex(/^[\w0-9-.]{1,255}$/iu);

// Library folder name without patch: "H5P.Image-1.1", "H5P.Column-1.22"
// Patch version is intentionally excluded from folder names and dependency references per spec.
export const H5pLibraryFolderNameSchema = z.string().regex(/^[\w0-9-.]{1,255}-\d{1,5}\.\d{1,5}$/u);

// Version reference used in preloadedDependencies / dynamicDependencies / editorDependencies.
// Patch is intentionally omitted — any patch of the specified major.minor is acceptable.
export const H5pVersionRefSchema = strictObject({
  machineName: H5pMachineNameSchema,
  majorVersion: z.number().int().nonnegative().max(99999),
  minorVersion: z.number().int().nonnegative().max(99999),
});

// Standard H5P license codes as used in h5p.json and library.json.
// "U" = undisclosed/unknown (H5P default when no license is specified).
export const H5pLicenseSchema = z.enum([
  "CC BY",
  "CC BY-SA",
  "CC BY-NC",
  "CC BY-NC-SA",
  "CC BY-ND",
  "CC BY-NC-ND",
  "CC0",
  "GNU GPL",
  "PD",
  "ODC PDDL",
  "CC PDM",
  "U",
]);

export const H5pAuthorSchema = strictObject({
  name: z.string().min(1),
  role: z.string().optional(),
});

export const H5pChangelogEntrySchema = strictObject({
  date: z.string(),
  changes: z.array(z.string()),
});

// Inferred types
export type H5pMachineName = z.infer<typeof H5pMachineNameSchema>;
export type H5pLibraryFolderName = z.infer<typeof H5pLibraryFolderNameSchema>;
export type H5pVersionRef = z.infer<typeof H5pVersionRefSchema>;
export type H5pLicense = z.infer<typeof H5pLicenseSchema>;
export type H5pAuthor = z.infer<typeof H5pAuthorSchema>;
export type H5pChangelogEntry = z.infer<typeof H5pChangelogEntrySchema>;
