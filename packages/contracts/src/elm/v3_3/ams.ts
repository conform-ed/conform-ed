/**
 * AMS — Accreditation Metadata Schema (ELM v3.3 application profile).
 *
 * A plain ELM dataset (no VC envelope, no seal): rooted at Accreditation, over the ELM
 * Core (ADR-0019). AMS adds no new classes — only the root from which an accreditation
 * dataset is validated.
 */

export { AccreditationSchema, OrganisationSchema } from "./core";
