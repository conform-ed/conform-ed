import { expect, test } from "bun:test";

import { LtiAgsV2_0, LtiDeepLinkingV2_0, LtiNrpsV2_0, LtiProctoringV1_0, LtiV1_3 } from "@conform-ed/contracts";
import { KnownLtiRoleSchema, LtiRoles, normalizeRole, RolesSchema } from "@conform-ed/contracts/lti";

test("LTI core launch schema accepts a normalized resource link launch", () => {
  const parsed = LtiV1_3.CoreLaunchRequestSchema.safeParse({
    messageType: "LtiResourceLinkRequest",
    version: "1.3.0",
    deploymentId: "deployment-123",
    targetLinkUri: "https://tool.example/launch",
    resourceLink: { id: "resource-123", title: "Example Resource" },
    subject: "student-123",
    context: { id: "course-123", title: "Course 123" },
    roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
    lis: { courseOfferingSourcedId: "course-123" },
    launchPresentation: { documentTarget: "iframe", locale: "en-US" },
  });

  expect(parsed.success).toBe(true);
});

test("LTI deep linking schema accepts request settings and response items", () => {
  const request = LtiDeepLinkingV2_0.DeepLinkingRequestSchema.safeParse({
    messageType: "LtiDeepLinkingRequest",
    version: "1.3.0",
    deploymentId: "deployment-123",
    subject: "student-123",
    deepLinkingSettings: {
      deepLinkReturnUrl: "https://platform.example/deep-link/return",
      acceptTypes: ["ltiResourceLink"],
      acceptPresentationDocumentTargets: ["iframe", "window"],
      acceptMediaTypes: "image/*,text/html",
      acceptMultiple: true,
      autoCreate: true,
      title: "Select content",
    },
  });

  expect(request.success).toBe(true);

  const response = LtiDeepLinkingV2_0.DeepLinkingResponseSchema.safeParse({
    messageType: "LtiDeepLinkingResponse",
    version: "1.3.0",
    contentItems: [
      {
        type: "ltiResourceLink",
        title: "Example Link",
        url: "https://tool.example/content/alpha",
      },
    ],
  });

  expect(response.success).toBe(true);
});

test("LTI deep linking validates the per-type content-item shapes", () => {
  const parsed = LtiDeepLinkingV2_0.DeepLinkingResponseSchema.safeParse({
    messageType: "LtiDeepLinkingResponse",
    version: "1.3.0",
    contentItems: [
      { type: "ltiResourceLink", title: "Launch", url: "https://tool.example/launch", custom: { unit: "3" } },
      { type: "link", url: "https://tool.example/page", thumbnail: { url: "https://tool.example/thumb.png" } },
      { type: "html", html: "<p>Embedded snippet</p>", title: "Snippet" },
      { type: "image", url: "https://tool.example/diagram.png", width: 640, height: 480 },
      {
        type: "file",
        url: "https://tool.example/handout.pdf",
        mediaType: "application/pdf",
        expiresAt: "2026-01-01T00:00:00Z",
      },
    ],
  });

  expect(parsed.success).toBe(true);
});

test("LTI deep linking rejects an html content item with no html payload", () => {
  expect(LtiDeepLinkingV2_0.ContentItemSchema.safeParse({ type: "html", title: "No body" }).success).toBe(false);
});

test("LTI deep linking rejects unknown keys on a content item (strict)", () => {
  expect(
    LtiDeepLinkingV2_0.ContentItemSchema.safeParse({
      type: "image",
      url: "https://tool.example/diagram.png",
      bogus: true,
    }).success,
  ).toBe(false);
});

test("normalizeRole classifies context, institution, system, and sub-roles", () => {
  expect(normalizeRole("http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor")).toEqual({
    namespace: "context",
    raw: "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
    role: "Instructor",
  });

  expect(normalizeRole("http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant")).toEqual({
    namespace: "context",
    raw: "http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant",
    role: "Instructor",
    subRole: "TeachingAssistant",
  });

  expect(normalizeRole("http://purl.imsglobal.org/vocab/lis/v2/institution/person#Faculty")?.namespace).toBe(
    "institution",
  );
  expect(normalizeRole("http://purl.imsglobal.org/vocab/lis/v2/system/person#SysAdmin")?.namespace).toBe("system");

  // Bare simple names are accepted for context roles only (LTI 1.1 backward compatibility).
  expect(normalizeRole("Learner")).toEqual({ namespace: "context", raw: "Learner", role: "Learner" });
});

test("normalizeRole returns null for extension and unrecognised roles", () => {
  expect(normalizeRole("https://vendor.example/roles#Custom")).toBeNull();
  expect(normalizeRole("Banana")).toBeNull();
  expect(normalizeRole("")).toBeNull();
});

test("RolesSchema accepts extension URIs and simple context names; KnownLtiRoleSchema does not", () => {
  // A launch roles array stays permissive: vendor-extension URIs and back-compat simple names pass.
  expect(RolesSchema.safeParse(["Learner", "https://vendor.example/roles#Custom"]).success).toBe(true);
  // The strict recogniser rejects the extension role but accepts a published one.
  expect(KnownLtiRoleSchema.safeParse("https://vendor.example/roles#Custom").success).toBe(false);
  expect(KnownLtiRoleSchema.safeParse("http://purl.imsglobal.org/vocab/lis/v2/membership#Mentor").success).toBe(true);
});

test("LtiRoles bundle exposes the published vocabulary and normalizer", () => {
  expect(LtiRoles.context.core).toContain("Instructor");
  expect(LtiRoles.system).toContain("SysAdmin");
  expect(LtiRoles.normalize).toBe(normalizeRole);
});

test("LTI AGS schema accepts endpoint, line item, score, and result shapes", () => {
  expect(
    LtiAgsV2_0.EndpointSchema.safeParse({
      scope: ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem"],
      lineitems: "https://platform.example/lineitems",
    }).success,
  ).toBe(true);

  expect(
    LtiAgsV2_0.LineItemSchema.safeParse({
      id: "https://platform.example/lineitems/1",
      label: "Example Grade",
      scoreMaximum: 100,
      resourceLinkId: "resource-123",
    }).success,
  ).toBe(true);

  expect(
    LtiAgsV2_0.ScoreSchema.safeParse({
      userId: "student-123",
      scoreGiven: 85,
      scoreMaximum: 100,
      activityProgress: "InProgress",
      gradingProgress: "Pending",
    }).success,
  ).toBe(true);

  expect(
    LtiAgsV2_0.ResultSchema.safeParse({
      userId: "student-123",
      resultScore: 85,
      resultMaximum: 100,
    }).success,
  ).toBe(true);
});

test("LTI NRPS schema accepts names/roles service and membership container shapes", () => {
  expect(
    LtiNrpsV2_0.NamesRoleServiceSchema.safeParse({
      contextMembershipsUrl: "https://platform.example/context/2923/memberships",
      serviceVersions: ["2.0"],
    }).success,
  ).toBe(true);

  expect(
    LtiNrpsV2_0.MembershipContainerSchema.safeParse({
      id: "https://platform.example/context/2923/memberships",
      context: {
        id: "2923-abc",
        title: "CPS 435 Learning Analytics",
      },
      members: [
        {
          status: "Active",
          name: "Jane Q. Public",
          email: "jane@example.com",
          userId: "0ae836b9-7fc9-4060-006f-27b2066ac545",
          roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"],
        },
      ],
    }).success,
  ).toBe(true);
});

test("LTI proctoring schema accepts start and end assessment messages", () => {
  expect(
    LtiProctoringV1_0.StartProctoringMessageSchema.safeParse({
      messageType: "StartProctoringMessage",
      version: "1.3.0",
      deploymentId: "deployment-123",
      targetLinkUri: "https://tool.example/proctoring",
      resourceLink: { id: "resource-123" },
      subject: "student-123",
      attemptNumber: 2,
      startAssessmentUrl: "https://platform.example/assessment/start",
      sessionData: "session-demo-123",
      roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
    }).success,
  ).toBe(true);

  expect(
    LtiProctoringV1_0.EndAssessmentMessageSchema.safeParse({
      messageType: "EndAssessmentMessage",
      version: "1.3.0",
      deploymentId: "deployment-123",
      targetLinkUri: "https://tool.example/proctoring",
      subject: "student-123",
      attemptNumber: 2,
      roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
    }).success,
  ).toBe(true);
});
