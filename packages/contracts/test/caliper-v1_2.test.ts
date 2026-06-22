import { expect, test } from "bun:test";

import { CaliperV1_2 } from "../src";

test("ActionSchema validates Caliper action vocabulary", () => {
  expect(CaliperV1_2.ActionSchema.safeParse("Viewed").success).toBe(true);
  expect(CaliperV1_2.ActionSchema.safeParse("ViewedSomethingElse").success).toBe(false);
});

test("RoleSchema validates the Caliper role vocabulary (base roles + Base#Subrole specialisations)", () => {
  expect(CaliperV1_2.RoleSchema.safeParse("Learner").success).toBe(true);
  expect(CaliperV1_2.RoleSchema.safeParse("Instructor#TeachingAssistant").success).toBe(true);
  expect(CaliperV1_2.RoleSchema.safeParse("Officer#Vice-Chair").success).toBe(true);
  expect(CaliperV1_2.RoleSchema.safeParse("SupremeOverlord").success).toBe(false);
  expect(CaliperV1_2.CALIPER_ROLES).toHaveLength(56);
});

test("PersonSchema requires top-level @context for described entity documents", () => {
  const withContext = CaliperV1_2.PersonSchema.safeParse({
    id: "https://example.edu/users/ada",
    type: "Person",
    "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
    name: "Ada Lovelace",
  });
  const withoutContext = CaliperV1_2.PersonSchema.safeParse({
    id: "https://example.edu/users/ada",
    type: "Person",
    name: "Ada Lovelace",
  });

  expect(withContext.success).toBe(true);
  expect(withoutContext.success).toBe(false);
});

test("EventSchema enforces URN UUID ids and UTC-millisecond eventTime", () => {
  const valid = CaliperV1_2.EventSchema.safeParse({
    type: "Event",
    "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
    id: "urn:uuid:87a9fdf1-2f57-4d2d-b7e9-963cb0f89f9f",
    actor: "https://example.edu/users/ada",
    action: "Viewed",
    object: "https://example.edu/resources/chapter-1",
    eventTime: "2026-01-15T12:45:00.000Z",
  });
  const badId = CaliperV1_2.EventSchema.safeParse({
    type: "Event",
    "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
    id: "https://example.edu/events/123",
    actor: "https://example.edu/users/ada",
    action: "Viewed",
    object: "https://example.edu/resources/chapter-1",
    eventTime: "2026-01-15T12:45:00.000Z",
  });
  const badTime = CaliperV1_2.EventSchema.safeParse({
    type: "Event",
    "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
    id: "urn:uuid:87a9fdf1-2f57-4d2d-b7e9-963cb0f89f9f",
    actor: "https://example.edu/users/ada",
    action: "Viewed",
    object: "https://example.edu/resources/chapter-1",
    eventTime: "2026-01-15T12:45:00+08:00",
  });

  expect(valid.success).toBe(true);
  expect(badId.success).toBe(false);
  expect(badTime.success).toBe(false);
});

test("AnnotationEventSchema enforces textual actor/action/object constraints", () => {
  const valid = CaliperV1_2.AnnotationEventSchema.safeParse({
    type: "AnnotationEvent",
    "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
    id: "urn:uuid:87a9fdf1-2f57-4d2d-b7e9-963cb0f89f9f",
    actor: {
      id: "https://example.edu/users/ada",
      type: "Person",
    },
    action: "Bookmarked",
    object: {
      id: "https://example.edu/resources/chapter-1",
      type: "DigitalResource",
    },
    generated: {
      id: "https://example.edu/annotations/1",
      type: "BookmarkAnnotation",
    },
    eventTime: "2026-01-15T12:45:00.000Z",
    profile: "AnnotationProfile",
  });

  const badAction = CaliperV1_2.AnnotationEventSchema.safeParse({
    type: "AnnotationEvent",
    "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
    id: "urn:uuid:87a9fdf1-2f57-4d2d-b7e9-963cb0f89f9f",
    actor: {
      id: "https://example.edu/users/ada",
      type: "Person",
    },
    action: "NavigatedTo",
    object: {
      id: "https://example.edu/resources/chapter-1",
      type: "DigitalResource",
    },
    eventTime: "2026-01-15T12:45:00.000Z",
  });

  const badObjectType = CaliperV1_2.AnnotationEventSchema.safeParse({
    type: "AnnotationEvent",
    "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
    id: "urn:uuid:87a9fdf1-2f57-4d2d-b7e9-963cb0f89f9f",
    actor: {
      id: "https://example.edu/users/ada",
      type: "Person",
    },
    action: "Bookmarked",
    object: {
      id: "https://example.edu/resources/chapter-1",
      type: "Assessment",
    },
    eventTime: "2026-01-15T12:45:00.000Z",
  });

  expect(valid.success).toBe(true);
  expect(badAction.success).toBe(false);
  expect(badObjectType.success).toBe(false);
});

test("MessageEventSchema accepts MarkedAsUnRead textual alias", () => {
  const parsed = CaliperV1_2.MessageEventSchema.safeParse({
    type: "MessageEvent",
    "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
    id: "urn:uuid:87a9fdf1-2f57-4d2d-b7e9-963cb0f89f9f",
    actor: {
      id: "https://example.edu/users/ada",
      type: "Person",
    },
    action: "MarkedAsUnRead",
    object: {
      id: "https://example.edu/messages/1",
      type: "Message",
    },
    eventTime: "2026-01-15T12:45:00.000Z",
    profile: "ForumProfile",
  });

  expect(parsed.success).toBe(true);
});

test("ViewEventSchema restricts target entity type to Frame", () => {
  const valid = CaliperV1_2.ViewEventSchema.safeParse({
    type: "ViewEvent",
    "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
    id: "urn:uuid:87a9fdf1-2f57-4d2d-b7e9-963cb0f89f9f",
    actor: {
      id: "https://example.edu/users/ada",
      type: "Person",
    },
    action: "Viewed",
    object: {
      id: "https://example.edu/resources/chapter-1",
      type: "Page",
    },
    target: {
      id: "https://example.edu/resources/chapter-1#fragment",
      type: "Frame",
    },
    eventTime: "2026-01-15T12:45:00.000Z",
  });
  const invalidTarget = CaliperV1_2.ViewEventSchema.safeParse({
    type: "ViewEvent",
    "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
    id: "urn:uuid:87a9fdf1-2f57-4d2d-b7e9-963cb0f89f9f",
    actor: {
      id: "https://example.edu/users/ada",
      type: "Person",
    },
    action: "Viewed",
    object: {
      id: "https://example.edu/resources/chapter-1",
      type: "Page",
    },
    target: {
      id: "https://example.edu/resources/chapter-1#fragment",
      type: "MediaLocation",
    },
    eventTime: "2026-01-15T12:45:00.000Z",
  });

  expect(valid.success).toBe(true);
  expect(invalidTarget.success).toBe(false);
});

test("EnvelopeSchema enforces required fields and disallows custom top-level properties", () => {
  const valid = CaliperV1_2.EnvelopeSchema.safeParse({
    sensor: "https://example.edu/sensors/lms",
    dataVersion: "http://purl.imsglobal.org/ctx/caliper/v1p2",
    sendTime: "2026-01-15T12:50:00.000Z",
    data: [
      {
        type: "ViewEvent",
        "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
        id: "urn:uuid:87a9fdf1-2f57-4d2d-b7e9-963cb0f89f9f",
        actor: "https://example.edu/users/ada",
        action: "Viewed",
        object: "https://example.edu/resources/chapter-1",
        eventTime: "2026-01-15T12:45:00.000Z",
      },
    ],
  });
  const missingRequired = CaliperV1_2.EnvelopeSchema.safeParse({
    sensor: "https://example.edu/sensors/lms",
    dataVersion: "http://purl.imsglobal.org/ctx/caliper/v1p2",
    data: [],
  });
  const extraProperty = CaliperV1_2.EnvelopeSchema.safeParse({
    sensor: "https://example.edu/sensors/lms",
    dataVersion: "http://purl.imsglobal.org/ctx/caliper/v1p2",
    sendTime: "2026-01-15T12:50:00.000Z",
    data: [
      {
        type: "ViewEvent",
        "@context": "http://purl.imsglobal.org/ctx/caliper/v1p2",
        id: "urn:uuid:87a9fdf1-2f57-4d2d-b7e9-963cb0f89f9f",
        actor: "https://example.edu/users/ada",
        action: "Viewed",
        object: "https://example.edu/resources/chapter-1",
        eventTime: "2026-01-15T12:45:00.000Z",
      },
    ],
    custom: true,
  });

  expect(valid.success).toBe(true);
  expect(missingRequired.success).toBe(false);
  expect(extraProperty.success).toBe(false);
});

test("TextPositionSelectorSchema requires type/start/end", () => {
  const valid = CaliperV1_2.TextPositionSelectorSchema.safeParse({
    type: "TextPositionSelector",
    start: 12,
    end: 24,
  });
  const invalid = CaliperV1_2.TextPositionSelectorSchema.safeParse({
    start: 12,
    end: 24,
  });

  expect(valid.success).toBe(true);
  expect(invalid.success).toBe(false);
});

test("SystemIdentifierSchema validates required identifier fields", () => {
  const valid = CaliperV1_2.SystemIdentifierSchema.safeParse({
    type: "SystemIdentifier",
    identifier: "user-123",
    identifierType: "LtiUserId",
  });
  const invalid = CaliperV1_2.SystemIdentifierSchema.safeParse({
    type: "SystemIdentifier",
    identifier: "user-123",
  });

  expect(valid.success).toBe(true);
  expect(invalid.success).toBe(false);
});

test("Caliper12DerivedZodTemplates exposes key Caliper entry points and conformance metadata", () => {
  expect(CaliperV1_2.Caliper12DerivedZodTemplates.envelope).toBe(CaliperV1_2.EnvelopeSchema);
  expect(CaliperV1_2.Caliper12DerivedZodTemplates.event).toBe(CaliperV1_2.EventSchema);
  expect(CaliperV1_2.Caliper12DerivedZodTemplates.person).toBe(CaliperV1_2.PersonSchema);
  expect(CaliperV1_2.Caliper12DerivedZodTemplates.systemIdentifier).toBe(CaliperV1_2.SystemIdentifierSchema);
  expect(CaliperV1_2.Caliper12DerivedZodTemplates.jsonSchemaEntryPoints.Action).toBe(CaliperV1_2.ActionSchema);
  const annotationRule =
    CaliperV1_2.Caliper12DerivedZodTemplates.conformance.supportedTextualEventRules["AnnotationEvent"];
  expect(annotationRule).toBeDefined();
  expect(annotationRule?.profile).toBe("AnnotationProfile");
});
