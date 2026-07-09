import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve("/home/anton/dev/conform-ed");

type FileSpec = { path: string; content: string };

function write(spec: FileSpec): void {
  const filePath = resolve(root, spec.path);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, spec.content);
}

function pkgJson(name: string, extraScripts: Record<string, string> = {}): string {
  return JSON.stringify(
    {
      name,
      private: true,
      type: "module",
      module: "src/index.ts",
      exports: {
        ".": "./src/index.ts",
      },
      scripts: {
        build: "tsc --noEmit",
        typecheck: "tsc --noEmit",
        lint: "oxlint --config ../../.oxlintrc.jsonc .",
        format: "oxfmt --config ../../.oxfmtrc.jsonc --check .",
        test: "bun test",
        ...extraScripts,
      },
    },
    null,
    2,
  );
}

const files: FileSpec[] = [
  // packages/contracts
  {
    path: "packages/contracts/package.json",
    content: `${pkgJson("@conform-ed/contracts")}\n`,
  },
  {
    path: "packages/contracts/tsconfig.json",
    content:
      '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": {\n    "types": ["bun"]\n  },\n  "include": ["src", "test"]\n}\n',
  },
  {
    path: "packages/contracts/src/config.ts",
    content: `import { z } from "zod";

export const SuiteNameSchema = z.enum(["lrs", "cmi5", "lti13"]);

export const RunnerConfigSchema = z.object({
  contractVersion: z.string().default("1.0.0"),
  suite: z.object({
    name: SuiteNameSchema,
    target: z.string(),
  }),
  sut: z.record(z.string(), z.unknown()).default({}),
  auth: z.record(z.string(), z.unknown()).default({}),
  selection: z.record(z.string(), z.unknown()).default({}),
  timeouts: z.record(z.string(), z.unknown()).default({}),
  artifacts: z.record(z.string(), z.unknown()).default({}),
  debug: z.record(z.string(), z.unknown()).default({}),
  adapter: z.record(z.string(), z.unknown()).nullable().default(null),
  suiteConfig: z.record(z.string(), z.unknown()).default({}),
});

export type RunnerConfig = z.infer<typeof RunnerConfigSchema>;
`,
  },
  {
    path: "packages/contracts/src/summary.ts",
    content: `import { z } from "zod";

export const RunnerSummarySchema = z.object({
  contractVersion: z.string(),
  runner: z.object({
    suite: z.string(),
    version: z.string(),
  }),
  result: z.object({
    status: z.enum(["passed", "failed", "error"]),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  }),
});

export type RunnerSummary = z.infer<typeof RunnerSummarySchema>;
`,
  },
  {
    path: "packages/contracts/src/adapter.ts",
    content: `export type AdapterCapability = {
  contractVersion: string;
  adapterName: string;
  adapterVersion: string;
  profiles: string[];
  operations: string[];
};

export type AdapterError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
`,
  },
  {
    path: "packages/contracts/src/index.ts",
    content: `export * from "./config";
export * from "./summary";
export * from "./adapter";
`,
  },
  {
    path: "packages/contracts/test/contracts.test.ts",
    content: `import { expect, test } from "bun:test";
import { RunnerConfigSchema } from "../src/config";

test("RunnerConfigSchema parses minimal config", () => {
  const parsed = RunnerConfigSchema.parse({
    suite: { name: "lrs", target: "all" },
  });

  expect(parsed.contractVersion).toBe("1.0.0");
});
`,
  },
  {
    path: "packages/contracts/README.md",
    content: `# @conform-ed/contracts

Shared runtime contracts and zod schemas for runner config and output.
`,
  },

  // packages/cli
  {
    path: "packages/cli/package.json",
    content: `${pkgJson("@conform-ed/cli")}\n`,
  },
  {
    path: "packages/cli/tsconfig.json",
    content:
      '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": {\n    "types": ["bun"]\n  },\n  "include": ["src", "test"]\n}\n',
  },
  {
    path: "packages/cli/src/commands.ts",
    content: `export const sharedCommands = [
  "run",
  "validate-config",
  "print-schema",
  "list-targets",
  "version",
] as const;
`,
  },
  {
    path: "packages/cli/src/run-command.ts",
    content: `export function runCommandStub(): Record<string, string> {
  return { status: "not_implemented" };
}
`,
  },
  {
    path: "packages/cli/src/validate-config-command.ts",
    content: `export function validateConfigStub(): { valid: true } {
  return { valid: true };
}
`,
  },
  {
    path: "packages/cli/src/print-schema-command.ts",
    content: `export function printSchemaStub(): string {
  return "schemas/v1/config.schema.json";
}
`,
  },
  {
    path: "packages/cli/src/list-targets-command.ts",
    content: `export function listTargetsStub(): string[] {
  return ["all", "smoke"];
}
`,
  },
  {
    path: "packages/cli/src/version-command.ts",
    content: `export function versionStub(): { version: string } {
  return { version: "0.1.0" };
}
`,
  },
  {
    path: "packages/cli/src/index.ts",
    content: `export * from "./commands";
export * from "./run-command";
export * from "./validate-config-command";
export * from "./print-schema-command";
export * from "./list-targets-command";
export * from "./version-command";
`,
  },
  {
    path: "packages/cli/test/cli-smoke.test.ts",
    content: `import { expect, test } from "bun:test";
import { listTargetsStub } from "../src/list-targets-command";

test("listTargetsStub returns targets", () => {
  expect(listTargetsStub().length).toBeGreaterThan(0);
});
`,
  },
  { path: "packages/cli/README.md", content: "# @conform-ed/cli\n\nShared CLI primitives.\n" },

  // packages/core
  { path: "packages/core/package.json", content: `${pkgJson("@conform-ed/core")}\n` },
  {
    path: "packages/core/tsconfig.json",
    content:
      '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": {\n    "types": ["bun"]\n  },\n  "include": ["src", "test"]\n}\n',
  },
  {
    path: "packages/core/src/runner.ts",
    content: `export type RunnerResult = { status: "passed" | "failed" | "error" };

export async function runSuiteStub(): Promise<RunnerResult> {
  return { status: "passed" };
}
`,
  },
  {
    path: "packages/core/src/healthcheck.ts",
    content: `export async function healthcheckStub(): Promise<boolean> { return true; }\n`,
  },
  {
    path: "packages/core/src/selection.ts",
    content: `export function normalizeSelection(input: string[]): string[] { return input; }\n`,
  },
  { path: "packages/core/src/timeouts.ts", content: `export function defaultTimeoutMs(): number { return 30_000; }\n` },
  {
    path: "packages/core/src/index.ts",
    content: `export * from "./runner";
export * from "./healthcheck";
export * from "./selection";
export * from "./timeouts";
`,
  },
  {
    path: "packages/core/test/core-smoke.test.ts",
    content: `import { expect, test } from "bun:test";
import { runSuiteStub } from "../src/runner";

test("runSuiteStub resolves", async () => {
  const result = await runSuiteStub();
  expect(result.status).toBe("passed");
});
`,
  },
  { path: "packages/core/README.md", content: "# @conform-ed/core\n\nShared runner orchestration primitives.\n" },

  // packages/reporting
  { path: "packages/reporting/package.json", content: `${pkgJson("@conform-ed/reporting")}\n` },
  {
    path: "packages/reporting/tsconfig.json",
    content:
      '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": {\n    "types": ["bun"]\n  },\n  "include": ["src", "test"]\n}\n',
  },
  {
    path: "packages/reporting/src/summary-writer.ts",
    content: `import { writeFileSync } from "node:fs";

export function writeSummary(path: string): void {
  writeFileSync(path, JSON.stringify({ contractVersion: "1.0.0", result: { status: "passed", passed: 0, failed: 0, skipped: 0 } }, null, 2));
}
`,
  },
  {
    path: "packages/reporting/src/junit-writer.ts",
    content: `import { writeFileSync } from "node:fs";

export function writeJunit(path: string): void {
  writeFileSync(path, '<testsuite tests="0" failures="0" skipped="0"></testsuite>\\n');
}
`,
  },
  {
    path: "packages/reporting/src/artifact-layout.ts",
    content: `export function defaultArtifactFiles(): string[] {
  return ["summary.json", "junit.xml"];
}
`,
  },
  {
    path: "packages/reporting/src/index.ts",
    content: `export * from "./summary-writer";
export * from "./junit-writer";
export * from "./artifact-layout";
`,
  },
  {
    path: "packages/reporting/test/reporting-smoke.test.ts",
    content: `import { expect, test } from "bun:test";
import { defaultArtifactFiles } from "../src/artifact-layout";

test("defaultArtifactFiles includes summary", () => {
  expect(defaultArtifactFiles()).toContain("summary.json");
});
`,
  },
  { path: "packages/reporting/README.md", content: "# @conform-ed/reporting\n\nSummary and JUnit output helpers.\n" },

  // packages/test-utils
  { path: "packages/test-utils/package.json", content: `${pkgJson("@conform-ed/test-utils")}\n` },
  {
    path: "packages/test-utils/tsconfig.json",
    content:
      '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": {\n    "types": ["bun"]\n  },\n  "include": ["src", "test"]\n}\n',
  },
  {
    path: "packages/test-utils/src/temp-dir.ts",
    content: `export function tempDir(): string { return "tmp/agents"; }\n`,
  },
  {
    path: "packages/test-utils/src/fixtures.ts",
    content: `export function fixtureName(name: string): string { return name; }\n`,
  },
  { path: "packages/test-utils/src/index.ts", content: `export * from "./temp-dir";\nexport * from "./fixtures";\n` },
  {
    path: "packages/test-utils/test/smoke.test.ts",
    content: `import { expect, test } from "bun:test";\nimport { tempDir } from "../src/temp-dir";\n\ntest("tempDir returns tmp path", () => { expect(tempDir()).toContain("tmp"); });\n`,
  },
  { path: "packages/test-utils/README.md", content: "# @conform-ed/test-utils\n\nCommon test helpers.\n" },
];

for (const file of files) {
  write(file);
}
