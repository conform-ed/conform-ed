import { z } from "zod";
import { strictObject, H5pMachineNameSchema, H5pVersionRefSchema } from "./shared";

const filePathSchema = strictObject({ path: z.string().min(1) });

const runnableFlag = z.union([z.literal(0), z.literal(1)]);

// library.json — required in every H5P library directory.
// Controls loading, dependencies, embedding, and editor capabilities.
export const H5pLibraryManifestSchema = strictObject({
  // Required fields
  title: z.string().min(1),
  machineName: H5pMachineNameSchema,
  majorVersion: z.number().int().nonnegative().max(99999),
  minorVersion: z.number().int().nonnegative().max(99999),
  patchVersion: z.number().int().nonnegative().max(99999),
  // 1 = standalone runnable content type, 0 = helper library only
  runnable: runnableFlag,

  // Optional fields
  description: z.string().optional(),
  author: z.string().optional(),
  // library.json accepts any SPDX license string (e.g. "MIT", "Apache-2.0").
  // Unlike h5p.json which restricts to H5P's enumerated content licenses.
  license: z.string().max(32).optional(),

  // JavaScript and CSS assets to preload
  preloadedJs: z.array(filePathSchema).optional(),
  preloadedCss: z.array(filePathSchema).optional(),

  // Runtime dependencies (patch version excluded per spec)
  preloadedDependencies: z.array(H5pVersionRefSchema).optional(),
  // Loaded on-demand during execution
  dynamicDependencies: z.array(H5pVersionRefSchema).optional(),
  // Required only when the H5P editor is in use
  editorDependencies: z.array(H5pVersionRefSchema).optional(),

  // Embedding dimensions — required for iframe embed type
  w: z.number().int().positive().optional(),
  h: z.number().int().positive().optional(),
  embedTypes: z.array(z.enum(["iframe", "div"])).optional(),
  // 1 = supports fullscreen mode
  fullscreen: runnableFlag.optional(),

  contentType: z.string().optional(),

  // Minimum H5P core API version this library requires
  coreApi: strictObject({
    majorVersion: z.number().int().nonnegative(),
    minorVersion: z.number().int().nonnegative(),
  }).optional(),

  metadataSettings: strictObject({
    disable: runnableFlag.optional(),
    disableExtraTitleField: runnableFlag.optional(),
  }).optional(),
}).superRefine((data, ctx) => {
  // iframe embedding requires explicit dimensions
  if (data.runnable === 1 && data.embedTypes?.includes("iframe")) {
    if (data.w === undefined || data.h === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["w"],
        message: 'Runnable libraries with embedType "iframe" should declare w and h dimensions',
      });
    }
  }
});

export type H5pLibraryManifest = z.infer<typeof H5pLibraryManifestSchema>;
