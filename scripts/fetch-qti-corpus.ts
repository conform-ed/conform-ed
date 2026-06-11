/**
 * Materializes the official 1EdTech qti-examples corpus at a pinned commit into
 * tmp/qti-examples (never committed — tmp/** is gitignored). The corpus lanes
 * (qti-corpus.local.test.ts and friends) skip when the corpus is absent; this script
 * is what makes them run, locally or in the scheduled CI corpus lane. Idempotent:
 * re-running against an up-to-date checkout is a no-op. The pin matters — the floor
 * tests assert exact counts over this exact corpus revision.
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const corpusRepository = "https://github.com/1EdTech/qti-examples.git";
const corpusCommit = "49814742f47031d3c03d27667993d980e9896b31";

const repoRoot = resolve(import.meta.dir, "..");
const args = process.argv.slice(2);
const flagIndex = args.indexOf("--root");
const targetPath = resolve(flagIndex === -1 ? resolve(repoRoot, "tmp/qti-examples") : (args[flagIndex + 1] ?? ""));

function run(command: string[]): void {
  const proc = Bun.spawnSync(command, { stdout: "inherit", stderr: "inherit" });

  if (proc.exitCode !== 0) {
    throw new Error(`Command failed (${proc.exitCode}): ${command.join(" ")}`);
  }
}

function capture(command: string[]): string | null {
  const proc = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" });

  return proc.exitCode === 0 ? proc.stdout.toString().trim() : null;
}

async function main(): Promise<number> {
  if (existsSync(resolve(targetPath, ".git"))) {
    if (capture(["git", "-C", targetPath, "rev-parse", "HEAD"]) === corpusCommit) {
      console.log(`Corpus already at pin ${corpusCommit.slice(0, 12)}: ${targetPath}`);
      return 0;
    }

    console.log(`Corpus present but not at pin — fetching ${corpusCommit.slice(0, 12)}…`);
    run(["git", "-C", targetPath, "fetch", "--depth", "1", corpusRepository, corpusCommit]);
    run(["git", "-C", targetPath, "checkout", "--detach", corpusCommit]);
    console.log(`Corpus pinned at ${corpusCommit.slice(0, 12)}: ${targetPath}`);
    return 0;
  }

  if (existsSync(targetPath)) {
    console.error(`Refusing to touch ${targetPath}: it exists but is not a git checkout. Remove it and re-run.`);
    return 1;
  }

  console.log(`Fetching corpus at ${corpusCommit.slice(0, 12)} into ${targetPath}…`);
  await mkdir(targetPath, { recursive: true });
  run(["git", "init", "--quiet", targetPath]);
  run(["git", "-C", targetPath, "fetch", "--depth", "1", corpusRepository, corpusCommit]);
  run(["git", "-C", targetPath, "checkout", "--detach", corpusCommit]);
  console.log(`Corpus pinned at ${corpusCommit.slice(0, 12)}: ${targetPath}`);

  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
