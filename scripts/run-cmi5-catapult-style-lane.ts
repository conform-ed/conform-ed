import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  parsePort,
  readFlagValue,
  repoRoot,
  resolveTmpArtifactPath,
  spawnReferenceAdapter,
  waitForAdapter,
  writeJson,
} from "./cmi5-lane-common";

type TestTarget = "all" | "package" | "runtime";

type ParsedArgs = {
  adapterBaseUrl: string | null;
  adapterPort: number;
  adapterToken: string;
  expectedAdapterName: string | null;
  keepAdapter: boolean;
  outputDir: string;
  readinessTimeoutMs: number;
  reportFile: string;
  testTarget: TestTarget;
};

type RunnerParsedStatus = {
  adapter?: {
    adapterName?: unknown;
    baseUrl?: unknown;
    profileVersion?: unknown;
  };
  artifacts?: {
    junitFile?: unknown;
    requirementTraceFile?: unknown;
    summaryFile?: unknown;
  };
  result?: {
    failed?: unknown;
    passed?: unknown;
    skipped?: unknown;
    status?: unknown;
  };
  status?: unknown;
};

type CatapultStyleLaneReport = {
  adapterBaseUrl: string;
  adapterReady: boolean;
  adapterStart: {
    pid: number | null;
  };
  endedAt: string;
  outputDir: string;
  reportFile: string;
  runner: {
    exitCode: number | null;
    parsedResult: unknown;
    stderr: string;
    stdout: string;
  };
  startedAt: string;
  status: "passed" | "failed";
  summary: {
    failures: number;
    packageOracleEnabled: boolean;
    runtimeOracleEnabled: boolean;
    skipped: number;
    tests: number;
  };
  testTarget: TestTarget;
};

const defaultOutputDir = resolve(repoRoot, "tmp", "agents", `cmi5-catapult-style-${Date.now()}`);

function parseTestTarget(rawValue: string, flag: string): TestTarget {
  if (rawValue === "all" || rawValue === "runtime" || rawValue === "package") {
    return rawValue;
  }

  throw new Error(`${flag} must be one of: runtime, package, all.`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    adapterBaseUrl: null,
    adapterPort: 4500,
    adapterToken: "conform-ed-cmi5-external-token",
    expectedAdapterName: null,
    keepAdapter: false,
    outputDir: defaultOutputDir,
    readinessTimeoutMs: 20_000,
    reportFile: resolve(defaultOutputDir, "catapult-style-lane-report.json"),
    testTarget: "all",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--adapter-port":
        parsed.adapterPort = parsePort(readFlagValue(argv, index, arg), arg);
        index += 1;
        break;
      case "--adapter-base-url":
        parsed.adapterBaseUrl = readFlagValue(argv, index, arg);
        index += 1;
        break;
      case "--adapter-token":
        parsed.adapterToken = readFlagValue(argv, index, arg);
        index += 1;
        break;
      case "--expected-adapter-name":
        parsed.expectedAdapterName = readFlagValue(argv, index, arg);
        index += 1;
        break;
      case "--output-dir":
        parsed.outputDir = resolveTmpArtifactPath(readFlagValue(argv, index, arg), arg);
        index += 1;
        break;
      case "--report-file":
        parsed.reportFile = resolveTmpArtifactPath(readFlagValue(argv, index, arg), arg);
        index += 1;
        break;
      case "--readiness-timeout-ms": {
        const rawValue = readFlagValue(argv, index, arg);
        const parsedTimeout = Number.parseInt(rawValue, 10);
        if (!Number.isInteger(parsedTimeout) || parsedTimeout < 1000) {
          throw new Error("--readiness-timeout-ms must be an integer >= 1000.");
        }
        parsed.readinessTimeoutMs = parsedTimeout;
        index += 1;
        break;
      }
      case "--target":
        parsed.testTarget = parseTestTarget(readFlagValue(argv, index, arg), arg);
        index += 1;
        break;
      case "--keep-adapter":
        parsed.keepAdapter = true;
        break;
      case "--help":
        console.log(
          `Usage: bun run scripts/run-cmi5-catapult-style-lane.ts [options]\n\nOptions:\n  --target <runtime|package|all>  Which cmi5 target to execute. Default: all\n  --adapter-port <port>           Adapter port when launching the reference adapter (default: 4500)\n  --adapter-base-url <url>        Use an already running external adapter URL\n  --adapter-token <token>         Adapter bearer token\n  --expected-adapter-name <name>  Require runner output adapter.adapterName to match\n  --output-dir <path>             Artifact directory under repo (default: tmp/agents/...)\n  --report-file <path>            Report file path under repo\n  --readiness-timeout-ms <ms>     Adapter readiness timeout\n  --keep-adapter                  Keep spawned reference adapter process running after lane\n  --help                          Show help\n`,
        );
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  mkdirSync(args.outputDir, { recursive: true });

  const configPath = resolve(args.outputDir, `cmi5.catapult-style.${args.testTarget}.config.json`);
  const runnerArtifactsDir = resolve(args.outputDir, "runner-artifacts");
  const adapterBaseUrl = args.adapterBaseUrl ?? `http://127.0.0.1:${args.adapterPort}`;

  const configPayload = {
    contractVersion: "1.0.0",
    suite: { name: "cmi5", target: args.testTarget },
    sut: {
      publicUrls: {
        api: "http://127.0.0.1:4301",
        runtime: "http://127.0.0.1:4312",
        lrs: "http://127.0.0.1:4311/xapi",
      },
    },
    adapter: {
      kind: "http",
      baseUrl: adapterBaseUrl,
      auth: {
        mode: "bearer",
        tokenFromEnv: "CONFORM_ED_ADAPTER_TOKEN",
      },
    },
    artifacts: {
      outputDir: runnerArtifactsDir,
    },
  };
  writeJson(configPath, configPayload);

  const adapterProcess =
    args.adapterBaseUrl === null ? spawnReferenceAdapter(args.adapterPort, args.adapterToken) : null;

  const adapterReady = await waitForAdapter(adapterBaseUrl, args.readinessTimeoutMs);

  let runnerStdout = "";
  let runnerStderr = "";
  let runnerExitCode: number | null = null;
  let parsedResult: unknown = null;

  if (adapterReady) {
    const runnerResult = spawnSync("bun", ["dist/index.js", "run", "--config", configPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        CONFORM_ED_ADAPTER_TOKEN: args.adapterToken,
      },
      encoding: "utf8",
    });

    runnerStdout = runnerResult.stdout ?? "";
    runnerStderr = runnerResult.stderr ?? "";
    runnerExitCode = runnerResult.status;

    try {
      parsedResult = JSON.parse(runnerStdout);
    } catch {
      parsedResult = null;
    }
  }

  if (!args.keepAdapter && adapterProcess) {
    adapterProcess.kill("SIGTERM");
  }

  const parsedStatus =
    parsedResult && typeof parsedResult === "object" ? ((parsedResult as RunnerParsedStatus).status ?? null) : null;
  const parsedAdapterName =
    parsedResult && typeof parsedResult === "object"
      ? ((parsedResult as RunnerParsedStatus).adapter?.adapterName ?? null)
      : null;
  const parsedResultStatus =
    parsedResult && typeof parsedResult === "object"
      ? ((parsedResult as RunnerParsedStatus).result?.status ?? null)
      : null;
  const adapterNameMatched =
    args.expectedAdapterName === null ||
    (typeof parsedAdapterName === "string" && parsedAdapterName === args.expectedAdapterName);

  const status: "passed" | "failed" =
    adapterReady &&
    runnerExitCode === 0 &&
    parsedStatus === "completed" &&
    parsedResultStatus === "passed" &&
    adapterNameMatched
      ? "passed"
      : "failed";

  const parsedResultObject =
    parsedResult && typeof parsedResult === "object" ? (parsedResult as RunnerParsedStatus) : null;
  const passedCount = asNumber(parsedResultObject?.result?.passed);
  const failedCount = asNumber(parsedResultObject?.result?.failed);
  const skippedCount = asNumber(parsedResultObject?.result?.skipped);
  const testsCount = passedCount + failedCount + skippedCount;

  const report: CatapultStyleLaneReport = {
    adapterBaseUrl,
    adapterReady,
    adapterStart: {
      pid: adapterProcess?.pid ?? null,
    },
    endedAt: new Date().toISOString(),
    outputDir: args.outputDir,
    reportFile: args.reportFile,
    runner: {
      exitCode: runnerExitCode,
      parsedResult,
      stderr: runnerStderr,
      stdout: runnerStdout,
    },
    startedAt,
    status,
    summary: {
      failures: failedCount,
      packageOracleEnabled: args.testTarget === "package" || args.testTarget === "all",
      runtimeOracleEnabled: args.testTarget === "runtime" || args.testTarget === "all",
      skipped: skippedCount,
      tests: testsCount,
    },
    testTarget: args.testTarget,
  };

  writeJson(args.reportFile, report);
  console.log(JSON.stringify(report, null, 2));

  if (status !== "passed") {
    process.exitCode = 1;
  }
}

await run();
