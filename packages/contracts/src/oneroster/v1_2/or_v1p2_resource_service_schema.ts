import { z } from "zod";

import {
  DateTimeSchema,
  EntityStatusSchema,
  extensibleEnum,
  MetadataSchema,
  SourcedIdSchema,
  strictObject,
} from "./shared";

export const ResourceRoleSchema = extensibleEnum([
  "administrator",
  "aide",
  "guardian",
  "parent",
  "proctor",
  "relative",
  "student",
  "teacher",
]);

// The OneRoster resource importance vocabulary (primary | secondary).
export const ResourceImportanceSchema = z.enum(["primary", "secondary"]);

export const ResourceSchema = strictObject({
  sourcedId: SourcedIdSchema,
  status: EntityStatusSchema,
  dateLastModified: DateTimeSchema,
  metadata: MetadataSchema.optional(),
  title: z.string().optional(),
  roles: z.array(ResourceRoleSchema).optional(),
  importance: ResourceImportanceSchema.optional(),
  vendorResourceId: z.string(),
  vendorId: z.string().optional(),
  applicationId: z.string().optional(),
});

export const ResourceSetSchema = strictObject({
  resources: z.array(ResourceSchema).optional(),
});

export const SingleResourceSchema = strictObject({
  resource: ResourceSchema,
});
// Inferred types from exported Zod validators.
export type ResourceRole = z.infer<typeof ResourceRoleSchema>;
export type Resource = z.infer<typeof ResourceSchema>;
export type ResourceSet = z.infer<typeof ResourceSetSchema>;
export type SingleResource = z.infer<typeof SingleResourceSchema>;
