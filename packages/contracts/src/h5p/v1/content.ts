import { z } from "zod";
import { strictObject } from "./shared";

// Copyright information attached to media files in content.json.
export const H5pCopyrightSchema = z.object({
  license: z.string().optional(),
  author: z.string().optional(),
  year: z.string().optional(),
  source: z.string().optional(),
  title: z.string().optional(),
  version: z.string().optional(),
});

// Media file reference as stored in content.json (image, audio, video, file fields).
export const H5pMediaFileSchema = strictObject({
  path: z.string().min(1),
  mime: z.string(),
  copyright: H5pCopyrightSchema.optional(),
  // Original filename displayed in the editor
  name: z.string().optional(),
  // Width/height metadata for images
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

// Embedded H5P library reference as stored in content.json (library-type semantics fields).
// The library string uses the format "H5P.MachineName majorVersion.minorVersion".
export const H5pLibraryEmbedSchema = z.object({
  library: z.string().regex(/^[\w0-9-.]+ \d+\.\d+$/u),
  params: z.unknown(),
  subContentId: z.string().optional(),
  metadata: z.unknown().optional(),
});

// Base schema for any content.json document.
// Content structure is defined per-library by semantics.json and therefore varies widely.
// Full validation against semantics requires a semantics traversal engine — see notes in
// h5p-v1-zod-templates.md for guidance on building one on top of H5pSemanticsSchema.
export const H5pContentParamsSchema = z.record(z.string(), z.unknown());

export type H5pCopyright = z.infer<typeof H5pCopyrightSchema>;
export type H5pMediaFile = z.infer<typeof H5pMediaFileSchema>;
export type H5pLibraryEmbed = z.infer<typeof H5pLibraryEmbedSchema>;
export type H5pContentParams = z.infer<typeof H5pContentParamsSchema>;
