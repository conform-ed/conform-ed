/**
 * PID — Person Identity (ELM v3.3 application profile).
 *
 * A plain ELM dataset (no VC envelope, no seal): rooted at Person, over the ELM Core
 * (ADR-0019). NB: this is ELM "Person Identity", NOT the eIDAS/EUDI "Person Identification
 * Data" attestation — a name collision only. PID adds no new classes.
 */

export { OrganisationSchema, PersonSchema } from "./core";
