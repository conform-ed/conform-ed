import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve("/home/anton/dev/conform-ed");

type FileSpec = { path: string; content: string };

function write(spec: FileSpec): void {
  const filePath = resolve(root, spec.path);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, spec.content);
}

function appPackage(name: string, withAdapters = false): string {
  return JSON.stringify(
    {
      name,
      private: true,
      type: "module",
      scripts: {
        dev: "bun --watch src/index.ts",
        build: "tsc --noEmit",
        typecheck: "tsc --noEmit",
        lint: "oxlint --config ../../.oxlintrc.jsonc .",
        format: "oxfmt --config ../../.oxfmtrc.jsonc --check .",
        test: "bun test",
      },
      dependencies: {
        "@conform-ed/contracts": "workspace:*",
        "@conform-ed/cli": "workspace:*",
        ...(withAdapters ? {} : { "@conform-ed/core": "workspace:*", "@conform-ed/reporting": "workspace:*" }),
      },
    },
    null,
    2,
  );
}

function runnerIndex(suite: string, supportsAdapters: boolean): string {
  return `import { sharedCommands } from "@conform-ed/cli";

const suiteName = "${suite}";
const command = process.argv[2] ?? "help";

function printJson(payload: unknown): void {
  console.log(JSON.stringify(payload, null, 2));
}

switch (command) {
  case "run":
    printJson({ suite: suiteName, command, status: "not_implemented" });
    break;
  case "validate-config":
    printJson({ suite: suiteName, command, valid: true });
    break;
  case "print-schema":
    printJson({ suite: suiteName, command, schema: "schemas/v1/config.schema.json" });
    break;
  case "list-targets":
    printJson({ suite: suiteName, command, targets: ["all", "smoke"] });
    break;
  ${supportsAdapters ? 'case "list-adapters":\n    printJson({ suite: suiteName, command, adapters: ["http"] });\n    break;' : ""}
  case "version":
    printJson({ suite: suiteName, command, version: "0.1.0" });
    break;
  default:
    printJson({
      suite: suiteName,
      command: "help",
      supportedCommands: ${supportsAdapters ? '[...sharedCommands, "list-adapters"]' : "sharedCommands"},
    });
}
`;
}

const files: FileSpec[] = [
  // runners
  { path: "apps/lrs-runner/package.json", content: `${appPackage("@conform-ed/lrs-runner")}\n` },
  {
    path: "apps/lrs-runner/tsconfig.json",
    content:
      '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": { "types": ["bun"] },\n  "include": ["src", "test"]\n}\n',
  },
  { path: "apps/lrs-runner/src/index.ts", content: runnerIndex("lrs", false) },
  { path: "apps/lrs-runner/src/targets.ts", content: 'export const lrsTargets = ["all", "smoke"] as const;\n' },
  {
    path: "apps/lrs-runner/src/run.ts",
    content:
      'export async function runLrs(): Promise<{ status: "not_implemented" }> { return { status: "not_implemented" }; }\n',
  },
  { path: "apps/lrs-runner/src/version.ts", content: 'export const lrsRunnerVersion = "0.1.0";\n' },
  {
    path: "apps/lrs-runner/test/cli.test.ts",
    content:
      'import { expect, test } from "bun:test";\n\ntest("lrs runner smoke", () => { expect(true).toBe(true); });\n',
  },
  { path: "apps/lrs-runner/README.md", content: "# lrs-runner\n\nLRS conformance runner stub.\n" },

  { path: "apps/cmi5-runner/package.json", content: `${appPackage("@conform-ed/cmi5-runner")}\n` },
  {
    path: "apps/cmi5-runner/tsconfig.json",
    content:
      '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": { "types": ["bun"] },\n  "include": ["src", "test"]\n}\n',
  },
  { path: "apps/cmi5-runner/src/index.ts", content: runnerIndex("cmi5", true) },
  {
    path: "apps/cmi5-runner/src/targets.ts",
    content: 'export const cmi5Targets = ["all", "runtime", "package"] as const;\n',
  },
  {
    path: "apps/cmi5-runner/src/run.ts",
    content:
      'export async function runCmi5(): Promise<{ status: "not_implemented" }> { return { status: "not_implemented" }; }\n',
  },
  {
    path: "apps/cmi5-runner/src/adapter-client.ts",
    content:
      `export async function fetchAdapterCapabilities(adapterUrl: string, token: string): Promise<Response> {
  return fetch(new URL("/v1/capabilities", adapterUrl), {
    headers: {
      authorization: ` +
      "`Bearer ${token}`" +
      `,
    },
  });
}
`,
  },
  { path: "apps/cmi5-runner/src/version.ts", content: 'export const cmi5RunnerVersion = "0.1.0";\n' },
  {
    path: "apps/cmi5-runner/test/cli.test.ts",
    content:
      'import { expect, test } from "bun:test";\n\ntest("cmi5 runner smoke", () => { expect(true).toBe(true); });\n',
  },
  { path: "apps/cmi5-runner/README.md", content: "# cmi5-runner\n\ncmi5 conformance/oracle runner stub.\n" },

  { path: "apps/lti13-runner/package.json", content: `${appPackage("@conform-ed/lti13-runner")}\n` },
  {
    path: "apps/lti13-runner/tsconfig.json",
    content:
      '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": { "types": ["bun"] },\n  "include": ["src", "test"]\n}\n',
  },
  { path: "apps/lti13-runner/src/index.ts", content: runnerIndex("lti13", true) },
  {
    path: "apps/lti13-runner/src/targets.ts",
    content: 'export const lti13Targets = ["core-launch", "deep-linking", "ags", "nrps"] as const;\n',
  },
  {
    path: "apps/lti13-runner/src/run.ts",
    content:
      'export async function runLti13(): Promise<{ status: "not_implemented" }> { return { status: "not_implemented" }; }\n',
  },
  {
    path: "apps/lti13-runner/src/adapter-client.ts",
    content:
      `export async function fetchAdapterCapabilities(adapterUrl: string, token: string): Promise<Response> {
  return fetch(new URL("/v1/capabilities", adapterUrl), {
    headers: {
      authorization: ` +
      "`Bearer ${token}`" +
      `,
    },
  });
}
`,
  },
  { path: "apps/lti13-runner/src/version.ts", content: 'export const lti13RunnerVersion = "0.1.0";\n' },
  {
    path: "apps/lti13-runner/test/cli.test.ts",
    content:
      'import { expect, test } from "bun:test";\n\ntest("lti13 runner smoke", () => { expect(true).toBe(true); });\n',
  },
  { path: "apps/lti13-runner/README.md", content: "# lti13-runner\n\nLTI 1.3 conformance runner stub.\n" },

  // cmi5 adapter
  {
    path: "apps/cmi5-adapter-reference/package.json",
    content: `${appPackage("@conform-ed/cmi5-adapter-reference", true)}\n`,
  },
  {
    path: "apps/cmi5-adapter-reference/tsconfig.json",
    content:
      '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": { "types": ["bun"] },\n  "include": ["src", "test"]\n}\n',
  },
  {
    path: "apps/cmi5-adapter-reference/src/auth.ts",
    content:
      `export function requireBearer(request: Request): Response | null {
  const token = process.env.ADAPTER_AUTH_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: { code: "adapter_token_missing", message: "ADAPTER_AUTH_TOKEN is not configured" } }), { status: 500, headers: { "content-type": "application/json" } });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== ` +
      "`Bearer ${token}`" +
      `) {
    return new Response(JSON.stringify({ error: { code: "unauthorized", message: "Bearer token required" } }), { status: 401, headers: { "content-type": "application/json" } });
  }

  return null;
}
`,
  },
  {
    path: "apps/cmi5-adapter-reference/src/capabilities.ts",
    content: `export const capabilities = {
  contractVersion: "1.0.0",
  adapterName: "cmi5-adapter-reference",
  adapterVersion: "0.1.0",
  profiles: ["cmi5-lms-v1"],
  operations: [
    "fixtures.provision",
    "cmi5.package.import",
    "cmi5.launch.create",
    "cmi5.registration.waive",
    "cmi5.session.abandon",
  ],
};
`,
  },
  {
    path: "apps/cmi5-adapter-reference/src/routes/health.ts",
    content: 'export function healthRoute(): Response { return Response.json({ status: "ok" }); }\n',
  },
  {
    path: "apps/cmi5-adapter-reference/src/routes/capabilities.ts",
    content:
      'import { capabilities } from "../capabilities";\n\nexport function capabilitiesRoute(): Response { return Response.json(capabilities); }\n',
  },
  {
    path: "apps/cmi5-adapter-reference/src/routes/fixtures-provision.ts",
    content:
      'export function fixturesProvisionRoute(): Response { return Response.json({ status: "not_implemented", operation: "fixtures.provision" }, { status: 501 }); }\n',
  },
  {
    path: "apps/cmi5-adapter-reference/src/routes/cmi5-package-import.ts",
    content:
      'export function packageImportRoute(): Response { return Response.json({ status: "not_implemented", operation: "cmi5.package.import" }, { status: 501 }); }\n',
  },
  {
    path: "apps/cmi5-adapter-reference/src/routes/cmi5-launch-create.ts",
    content:
      'export function launchCreateRoute(): Response { return Response.json({ status: "not_implemented", operation: "cmi5.launch.create" }, { status: 501 }); }\n',
  },
  {
    path: "apps/cmi5-adapter-reference/src/routes/cmi5-waive.ts",
    content:
      'export function waiveRoute(): Response { return Response.json({ status: "not_implemented", operation: "cmi5.registration.waive" }, { status: 501 }); }\n',
  },
  {
    path: "apps/cmi5-adapter-reference/src/routes/cmi5-abandon.ts",
    content:
      'export function abandonRoute(): Response { return Response.json({ status: "not_implemented", operation: "cmi5.session.abandon" }, { status: 501 }); }\n',
  },
  {
    path: "apps/cmi5-adapter-reference/src/index.ts",
    content: `import { requireBearer } from "./auth";
import { abandonRoute } from "./routes/cmi5-abandon";
import { launchCreateRoute } from "./routes/cmi5-launch-create";
import { packageImportRoute } from "./routes/cmi5-package-import";
import { waiveRoute } from "./routes/cmi5-waive";
import { capabilitiesRoute } from "./routes/capabilities";
import { fixturesProvisionRoute } from "./routes/fixtures-provision";
import { healthRoute } from "./routes/health";

const port = Number(process.env.PORT ?? 4500);

Bun.serve({
  port,
  routes: {
    "/health": {
      GET: () => healthRoute(),
    },
    "/v1/capabilities": {
      GET: (request) => requireBearer(request) ?? capabilitiesRoute(),
    },
    "/v1/fixtures/provision": {
      POST: (request) => requireBearer(request) ?? fixturesProvisionRoute(),
    },
    "/v1/cmi5/packages/import": {
      POST: (request) => requireBearer(request) ?? packageImportRoute(),
    },
    "/v1/cmi5/launches": {
      POST: (request) => requireBearer(request) ?? launchCreateRoute(),
    },
    "/v1/cmi5/registrations/waive": {
      POST: (request) => requireBearer(request) ?? waiveRoute(),
    },
    "/v1/cmi5/sessions/abandon": {
      POST: (request) => requireBearer(request) ?? abandonRoute(),
    },
  },
});

console.log("[cmi5-adapter-reference] listening on " + port);
`,
  },
  {
    path: "apps/cmi5-adapter-reference/test/http.test.ts",
    content:
      'import { expect, test } from "bun:test";\n\ntest("adapter test scaffold", () => { expect(true).toBe(true); });\n',
  },
  {
    path: "apps/cmi5-adapter-reference/README.md",
    content: "# cmi5-adapter-reference\n\nToken-authenticated HTTP adapter reference with stub operations.\n",
  },

  // lti adapter
  {
    path: "apps/lti13-adapter-reference/package.json",
    content: `${appPackage("@conform-ed/lti13-adapter-reference", true)}\n`,
  },
  {
    path: "apps/lti13-adapter-reference/tsconfig.json",
    content:
      '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": { "types": ["bun"] },\n  "include": ["src", "test"]\n}\n',
  },
  {
    path: "apps/lti13-adapter-reference/src/auth.ts",
    content:
      `export function requireBearer(request: Request): Response | null {
  const token = process.env.ADAPTER_AUTH_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: { code: "adapter_token_missing", message: "ADAPTER_AUTH_TOKEN is not configured" } }), { status: 500, headers: { "content-type": "application/json" } });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== ` +
      "`Bearer ${token}`" +
      `) {
    return new Response(JSON.stringify({ error: { code: "unauthorized", message: "Bearer token required" } }), { status: 401, headers: { "content-type": "application/json" } });
  }

  return null;
}
`,
  },
  {
    path: "apps/lti13-adapter-reference/src/capabilities.ts",
    content: `export const capabilities = {
  contractVersion: "1.0.0",
  adapterName: "lti13-adapter-reference",
  adapterVersion: "0.1.0",
  profiles: ["lti13-tool-v1"],
  operations: [
    "lti.registration.resolve",
    "lti.login.initiation",
    "lti.launch.create",
    "lti.deep-link.create",
    "lti.ags.line-items",
    "lti.ags.scores",
    "lti.nrps.memberships",
  ],
};
`,
  },
  {
    path: "apps/lti13-adapter-reference/src/routes/health.ts",
    content: 'export function healthRoute(): Response { return Response.json({ status: "ok" }); }\n',
  },
  {
    path: "apps/lti13-adapter-reference/src/routes/capabilities.ts",
    content:
      'import { capabilities } from "../capabilities";\n\nexport function capabilitiesRoute(): Response { return Response.json(capabilities); }\n',
  },
  {
    path: "apps/lti13-adapter-reference/src/routes/lti-registration-resolve.ts",
    content:
      'export function registrationResolveRoute(): Response { return Response.json({ status: "not_implemented", operation: "lti.registration.resolve" }, { status: 501 }); }\n',
  },
  {
    path: "apps/lti13-adapter-reference/src/routes/lti-login-initiation.ts",
    content:
      'export function loginInitiationRoute(): Response { return Response.json({ status: "not_implemented", operation: "lti.login.initiation" }, { status: 501 }); }\n',
  },
  {
    path: "apps/lti13-adapter-reference/src/routes/lti-launch-create.ts",
    content:
      'export function launchCreateRoute(): Response { return Response.json({ status: "not_implemented", operation: "lti.launch.create" }, { status: 501 }); }\n',
  },
  {
    path: "apps/lti13-adapter-reference/src/routes/lti-deep-link.ts",
    content:
      'export function deepLinkRoute(): Response { return Response.json({ status: "not_implemented", operation: "lti.deep-link.create" }, { status: 501 }); }\n',
  },
  {
    path: "apps/lti13-adapter-reference/src/routes/lti-ags-line-items.ts",
    content:
      'export function agsLineItemsRoute(): Response { return Response.json({ status: "not_implemented", operation: "lti.ags.line-items" }, { status: 501 }); }\n',
  },
  {
    path: "apps/lti13-adapter-reference/src/routes/lti-ags-scores.ts",
    content:
      'export function agsScoresRoute(): Response { return Response.json({ status: "not_implemented", operation: "lti.ags.scores" }, { status: 501 }); }\n',
  },
  {
    path: "apps/lti13-adapter-reference/src/routes/lti-nrps-memberships.ts",
    content:
      'export function nrpsMembershipsRoute(): Response { return Response.json({ status: "not_implemented", operation: "lti.nrps.memberships" }, { status: 501 }); }\n',
  },
  {
    path: "apps/lti13-adapter-reference/src/index.ts",
    content: `import { requireBearer } from "./auth";
import { agsLineItemsRoute } from "./routes/lti-ags-line-items";
import { agsScoresRoute } from "./routes/lti-ags-scores";
import { deepLinkRoute } from "./routes/lti-deep-link";
import { launchCreateRoute } from "./routes/lti-launch-create";
import { loginInitiationRoute } from "./routes/lti-login-initiation";
import { nrpsMembershipsRoute } from "./routes/lti-nrps-memberships";
import { registrationResolveRoute } from "./routes/lti-registration-resolve";
import { capabilitiesRoute } from "./routes/capabilities";
import { healthRoute } from "./routes/health";

const port = Number(process.env.PORT ?? 4600);

Bun.serve({
  port,
  routes: {
    "/health": {
      GET: () => healthRoute(),
    },
    "/v1/capabilities": {
      GET: (request) => requireBearer(request) ?? capabilitiesRoute(),
    },
    "/v1/lti/registrations/resolve": {
      POST: (request) => requireBearer(request) ?? registrationResolveRoute(),
    },
    "/v1/lti/login-initiation": {
      POST: (request) => requireBearer(request) ?? loginInitiationRoute(),
    },
    "/v1/lti/launches": {
      POST: (request) => requireBearer(request) ?? launchCreateRoute(),
    },
    "/v1/lti/deep-links": {
      POST: (request) => requireBearer(request) ?? deepLinkRoute(),
    },
    "/v1/lti/ags/line-items": {
      POST: (request) => requireBearer(request) ?? agsLineItemsRoute(),
    },
    "/v1/lti/ags/scores": {
      POST: (request) => requireBearer(request) ?? agsScoresRoute(),
    },
    "/v1/lti/nrps/memberships": {
      GET: (request) => requireBearer(request) ?? nrpsMembershipsRoute(),
    },
  },
});

console.log("[lti13-adapter-reference] listening on " + port);
`,
  },
  {
    path: "apps/lti13-adapter-reference/test/http.test.ts",
    content:
      'import { expect, test } from "bun:test";\n\ntest("adapter test scaffold", () => { expect(true).toBe(true); });\n',
  },
  {
    path: "apps/lti13-adapter-reference/README.md",
    content: "# lti13-adapter-reference\n\nToken-authenticated HTTP adapter reference with stub operations.\n",
  },
];

for (const file of files) {
  write(file);
}
