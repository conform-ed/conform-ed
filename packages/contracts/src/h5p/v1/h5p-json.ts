import { z } from "zod";
import {
  strictObject,
  H5pMachineNameSchema,
  H5pVersionRefSchema,
  H5pLicenseSchema,
  H5pAuthorSchema,
  H5pChangelogEntrySchema,
} from "./shared";

// h5p.json — the top-level package manifest inside every .h5p archive.
// Schema derived from H5PValidator::isValidRequiredH5pData in h5p-php-library.
export const H5pPackageManifestSchema = strictObject({
  // Required fields
  title: z.string().min(1).max(255),
  // ISO-639-1 language code with optional region subtag (e.g. "en", "nb", "zh-CN")
  language: z.string().regex(/^[-a-zA-Z]{1,10}$/u),
  machineName: H5pMachineNameSchema,
  mainLibrary: H5pMachineNameSchema,
  preloadedDependencies: z.array(H5pVersionRefSchema).min(1),
  embedTypes: z.array(z.enum(["iframe", "div"])).min(1),

  // Optional metadata
  contentType: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  authors: z.array(H5pAuthorSchema).optional(),
  source: z.string().url().optional(),
  license: H5pLicenseSchema.optional(),
  licenseVersion: z.string().max(10).optional(),
  licenseExtras: z.string().max(5000).optional(),
  authorComments: z.string().max(5000).optional(),
  dynamicDependencies: z.array(H5pVersionRefSchema).optional(),
  // Fixed dimensions for non-responsive content — 1–4 digits per spec
  width: z.number().int().min(1).max(9999).optional(),
  height: z.number().int().min(1).max(9999).optional(),
  metaKeywords: z.string().optional(),
  metaDescription: z.string().optional(),
  yearFrom: z.number().int().optional(),
  yearTo: z.number().int().optional(),
  defaultLanguage: z.string().max(32).optional(),
  a11yTitle: z.string().max(255).optional(),
  changes: z.array(H5pChangelogEntrySchema).optional(),
}).superRefine((data, ctx) => {
  // embedTypes must not have duplicates
  const seen = new Set<string>();
  for (const et of data.embedTypes) {
    if (seen.has(et)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["embedTypes"],
        message: `Duplicate embed type: "${et}"`,
      });
    }
    seen.add(et);
  }
  // yearTo must be >= yearFrom when both are present
  if (data.yearFrom !== undefined && data.yearTo !== undefined && data.yearTo < data.yearFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["yearTo"],
      message: "yearTo must be >= yearFrom",
    });
  }
});

export type H5pPackageManifest = z.infer<typeof H5pPackageManifestSchema>;
