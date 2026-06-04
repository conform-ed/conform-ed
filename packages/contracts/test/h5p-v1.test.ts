import { expect, test } from "bun:test";
import { H5pV1 } from "@conform-ed/contracts";

// --- PackageManifest (h5p.json) ---

test("H5P PackageManifest accepts a minimal valid h5p.json", () => {
  const result = H5pV1.Schemas.PackageManifest.safeParse({
    title: "My H5P Content",
    language: "en",
    machineName: "H5P.CoursePresentation",
    mainLibrary: "H5P.CoursePresentation",
    preloadedDependencies: [{ machineName: "H5P.CoursePresentation", majorVersion: 1, minorVersion: 27 }],
    embedTypes: ["iframe"],
  });
  expect(result.success).toBe(true);
});

test("H5P PackageManifest accepts all optional fields", () => {
  const result = H5pV1.Schemas.PackageManifest.safeParse({
    title: "Interactive Video",
    language: "en-US",
    machineName: "H5P.InteractiveVideo",
    mainLibrary: "H5P.InteractiveVideo",
    preloadedDependencies: [
      { machineName: "H5P.InteractiveVideo", majorVersion: 1, minorVersion: 28 },
      { machineName: "H5P.Video", majorVersion: 1, minorVersion: 6 },
    ],
    embedTypes: ["iframe", "div"],
    contentType: "Interactive Video",
    description: "An interactive video content type",
    author: "H5P Community",
    authors: [{ name: "Jane Doe", role: "Author" }],
    license: "CC BY",
    licenseVersion: "4.0",
    licenseExtras: "Attribution required",
    yearFrom: 2020,
    yearTo: 2024,
    defaultLanguage: "en",
    a11yTitle: "Interactive Video",
    changes: [{ date: "01-01-24 00:00:00", changes: ["Initial release"] }],
  });
  expect(result.success).toBe(true);
});

test("H5P PackageManifest rejects missing required title", () => {
  const result = H5pV1.Schemas.PackageManifest.safeParse({
    language: "en",
    machineName: "H5P.Image",
    mainLibrary: "H5P.Image",
    preloadedDependencies: [{ machineName: "H5P.Image", majorVersion: 1, minorVersion: 1 }],
    embedTypes: ["div"],
  });
  expect(result.success).toBe(false);
});

test("H5P PackageManifest rejects invalid machine name", () => {
  const result = H5pV1.Schemas.PackageManifest.safeParse({
    title: "Test",
    language: "en",
    machineName: "invalid machine name!",
    mainLibrary: "H5P.Image",
    preloadedDependencies: [{ machineName: "H5P.Image", majorVersion: 1, minorVersion: 1 }],
    embedTypes: ["div"],
  });
  expect(result.success).toBe(false);
});

test("H5P PackageManifest rejects invalid embed type", () => {
  const result = H5pV1.Schemas.PackageManifest.safeParse({
    title: "Test",
    language: "en",
    machineName: "H5P.Image",
    mainLibrary: "H5P.Image",
    preloadedDependencies: [{ machineName: "H5P.Image", majorVersion: 1, minorVersion: 1 }],
    embedTypes: ["flash"],
  });
  expect(result.success).toBe(false);
});

test("H5P PackageManifest rejects yearTo < yearFrom", () => {
  const result = H5pV1.Schemas.PackageManifest.safeParse({
    title: "Test",
    language: "en",
    machineName: "H5P.Image",
    mainLibrary: "H5P.Image",
    preloadedDependencies: [{ machineName: "H5P.Image", majorVersion: 1, minorVersion: 1 }],
    embedTypes: ["div"],
    yearFrom: 2024,
    yearTo: 2020,
  });
  expect(result.success).toBe(false);
});

test("H5P PackageManifest rejects duplicate embed types", () => {
  const result = H5pV1.Schemas.PackageManifest.safeParse({
    title: "Test",
    language: "en",
    machineName: "H5P.Image",
    mainLibrary: "H5P.Image",
    preloadedDependencies: [{ machineName: "H5P.Image", majorVersion: 1, minorVersion: 1 }],
    embedTypes: ["iframe", "iframe"],
  });
  expect(result.success).toBe(false);
});

// --- LibraryManifest (library.json) ---

test("H5P LibraryManifest accepts a minimal valid library.json", () => {
  const result = H5pV1.Schemas.LibraryManifest.safeParse({
    title: "Image",
    machineName: "H5P.Image",
    majorVersion: 1,
    minorVersion: 1,
    patchVersion: 33,
    runnable: 0,
  });
  expect(result.success).toBe(true);
});

test("H5P LibraryManifest accepts a runnable library with full fields", () => {
  const result = H5pV1.Schemas.LibraryManifest.safeParse({
    title: "True/False Question",
    machineName: "H5P.TrueFalse",
    majorVersion: 1,
    minorVersion: 8,
    patchVersion: 24,
    runnable: 1,
    description: "True/False question content type",
    author: "H5P Community",
    license: "MIT",
    preloadedJs: [{ path: "h5p-true-false.js" }],
    preloadedCss: [{ path: "h5p-true-false.css" }],
    preloadedDependencies: [
      { machineName: "H5P.Question", majorVersion: 1, minorVersion: 5 },
      { machineName: "H5P.JoubelUI", majorVersion: 1, minorVersion: 3 },
    ],
    embedTypes: ["iframe"],
    w: 640,
    h: 480,
    fullscreen: 0,
    contentType: "Question",
    coreApi: { majorVersion: 1, minorVersion: 28 },
    metadataSettings: { disable: 0, disableExtraTitleField: 0 },
  });
  expect(result.success).toBe(true);
});

test("H5P LibraryManifest rejects invalid machineName", () => {
  const result = H5pV1.Schemas.LibraryManifest.safeParse({
    title: "Bad Library",
    machineName: "bad name with spaces",
    majorVersion: 1,
    minorVersion: 0,
    patchVersion: 0,
    runnable: 0,
  });
  expect(result.success).toBe(false);
});

// --- Shared schemas ---

test("H5P VersionRef rejects patch version (not part of the schema)", () => {
  // The schema only allows machineName, majorVersion, minorVersion
  const result = H5pV1.Shared.VersionRef.safeParse({
    machineName: "H5P.Image",
    majorVersion: 1,
    minorVersion: 1,
    patchVersion: 33,
  });
  // strictObject rejects extra fields
  expect(result.success).toBe(false);
});

test("H5P LibraryFolderName validates correct folder name", () => {
  expect(H5pV1.Shared.LibraryFolderName.safeParse("H5P.Image-1.1").success).toBe(true);
  expect(H5pV1.Shared.LibraryFolderName.safeParse("H5P.Column-1.22").success).toBe(true);
  expect(H5pV1.Shared.LibraryFolderName.safeParse("H5P.InteractiveVideo-1.28").success).toBe(true);
});

test("H5P LibraryFolderName rejects folder names with patch version", () => {
  expect(H5pV1.Shared.LibraryFolderName.safeParse("H5P.Image-1.1.33").success).toBe(false);
});

// --- Semantics (semantics.json) ---

test("H5P Semantics accepts a simple text field", () => {
  const result = H5pV1.Schemas.SemanticsField.safeParse({
    name: "question",
    type: "text",
    label: "Question",
    importance: "high",
    maxLength: 500,
  });
  expect(result.success).toBe(true);
});

test("H5P Semantics accepts a boolean field", () => {
  const result = H5pV1.Schemas.SemanticsField.safeParse({
    name: "enableRetry",
    type: "boolean",
    label: "Enable Retry",
    default: true,
    optional: true,
  });
  expect(result.success).toBe(true);
});

test("H5P Semantics accepts a select field with options", () => {
  const result = H5pV1.Schemas.SemanticsField.safeParse({
    name: "correct",
    type: "select",
    label: "Correct Answer",
    options: [
      { value: "true", label: "True" },
      { value: "false", label: "False" },
    ],
  });
  expect(result.success).toBe(true);
});

test("H5P Semantics accepts a group with nested fields", () => {
  const result = H5pV1.Schemas.SemanticsField.safeParse({
    name: "behaviour",
    type: "group",
    label: "Behavioural settings",
    expanded: true,
    fields: [
      { name: "enableRetry", type: "boolean", label: "Enable retry button" },
      { name: "enableSolutionsButton", type: "boolean", label: "Enable solution button" },
      { name: "autoCheck", type: "boolean", label: "Auto-check" },
    ],
  });
  expect(result.success).toBe(true);
});

test("H5P Semantics accepts a list field containing a group", () => {
  const result = H5pV1.Schemas.SemanticsField.safeParse({
    name: "alternatives",
    type: "list",
    label: "Answer Alternatives",
    min: 2,
    entity: "alternative",
    field: {
      name: "alternative",
      type: "group",
      fields: [
        { name: "text", type: "html", label: "Text", importance: "high" },
        { name: "correct", type: "boolean", label: "Correct" },
      ],
    },
  });
  expect(result.success).toBe(true);
});

test("H5P Semantics accepts deeply nested groups (3 levels)", () => {
  const result = H5pV1.Schemas.Semantics.safeParse([
    {
      name: "outer",
      type: "group",
      fields: [
        {
          name: "middle",
          type: "group",
          fields: [{ name: "inner", type: "text", label: "Inner text" }],
        },
      ],
    },
  ]);
  expect(result.success).toBe(true);
});

test("H5P Semantics accepts library field with options", () => {
  const result = H5pV1.Schemas.SemanticsField.safeParse({
    name: "content",
    type: "library",
    label: "Content",
    options: ["H5P.Image 1.1", "H5P.Video 1.6", "H5P.Audio 1.5"],
  });
  expect(result.success).toBe(true);
});

test("H5P Semantics accepts an image field", () => {
  const result = H5pV1.Schemas.SemanticsField.safeParse({
    name: "file",
    type: "image",
    label: "Image",
    importance: "high",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/svg+xml"],
  });
  expect(result.success).toBe(true);
});

test("H5P Semantics rejects unknown field type", () => {
  const result = H5pV1.Schemas.SemanticsField.safeParse({
    name: "bad",
    type: "richtext",
    label: "Bad Type",
  });
  expect(result.success).toBe(false);
});

test("H5P Semantics rejects field without name", () => {
  const result = H5pV1.Schemas.SemanticsField.safeParse({
    type: "text",
    label: "No name",
  });
  expect(result.success).toBe(false);
});

// --- MediaFile (content.json sub-structure) ---

test("H5P MediaFile accepts a valid image file reference", () => {
  const result = H5pV1.Schemas.MediaFile.safeParse({
    path: "images/my-photo.jpg",
    mime: "image/jpeg",
    copyright: { license: "CC BY", author: "John Doe", year: "2024" },
    width: 1920,
    height: 1080,
  });
  expect(result.success).toBe(true);
});

test("H5P LibraryEmbed accepts a valid embedded library reference", () => {
  const result = H5pV1.Schemas.LibraryEmbed.safeParse({
    library: "H5P.Image 1.1",
    params: { file: { path: "images/img.jpg", mime: "image/jpeg" }, alt: "A photo" },
    subContentId: "abc123",
  });
  expect(result.success).toBe(true);
});
