export * from "./shared";
export * from "./textual_requirements";
export * from "./caliper_v1p2_bootcamp_schema";
export * from "./validate-event";

import {
  ActionSchema,
  AgentSchema,
  AssessmentEventSchema,
  CaliperV1P2ConformanceMetadata,
  CaliperV1P2JsonSchemaEntryPoints,
  EnvelopeSchema,
  EventSchema,
  MetricSchema,
  PersonSchema,
  ProfileSchema,
  SessionSchema,
  SoftwareApplicationSchema,
  StatusSchema,
  SystemIdentifierSchema,
} from "./caliper_v1p2_bootcamp_schema";

export const Caliper12DerivedZodTemplates = {
  envelope: EnvelopeSchema,
  event: EventSchema,
  assessmentEvent: AssessmentEventSchema,
  person: PersonSchema,
  softwareApplication: SoftwareApplicationSchema,
  session: SessionSchema,
  systemIdentifier: SystemIdentifierSchema,
  actionVocabulary: ActionSchema,
  profileVocabulary: ProfileSchema,
  metricVocabulary: MetricSchema,
  statusVocabulary: StatusSchema,
  agent: AgentSchema,
  jsonSchemaEntryPoints: CaliperV1P2JsonSchemaEntryPoints,
  conformance: CaliperV1P2ConformanceMetadata,
} as const;
