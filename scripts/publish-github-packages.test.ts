import { describe, expect, test } from "bun:test";

import {
  type Manifest,
  type VersionContext,
  maxCore,
  nextPatch,
  pinSiblingDeps,
  targetVersion,
} from "./publish-github-packages";

const devCtx: VersionContext = {
  isReleaseTag: false,
  refName: "",
  devBaseFloor: "0.1.3",
  devPreId: "1782043909.418e917",
};

const releaseCtx: VersionContext = {
  isReleaseTag: true,
  refName: "0.1.3",
  devBaseFloor: null,
  devPreId: "ignored",
};

describe("targetVersion", () => {
  test("release-parity uses the tag verbatim", () => {
    expect(targetVersion("0.0.0", releaseCtx)).toBe("0.1.3");
  });

  test("dev channel anchors above the latest release, regardless of the 0.0.0 placeholder", () => {
    expect(targetVersion("0.0.0", devCtx)).toBe("0.1.3-dev.1782043909.418e917");
  });

  test("dev channel never sorts below the latest release", () => {
    const v = targetVersion("0.0.0", devCtx);
    // nextPatch(latest 0.1.2) == 0.1.3, so the dev pre-release is strictly above the 0.1.2 release.
    expect(Bun.semver.order(v, "0.1.2")).toBe(1);
    expect(Bun.semver.order(v, "0.1.3")).toBe(-1);
  });

  test("falls back to the package.json base when no release tags are reachable", () => {
    expect(targetVersion("0.0.0", { ...devCtx, devBaseFloor: null })).toBe("0.0.0-dev.1782043909.418e917");
  });
});

describe("pinSiblingDeps", () => {
  const version = "0.1.3-dev.1782043909.418e917";

  test("pins same-scope peerDependencies to the exact version (the 0.1.2 back-fill bug)", () => {
    // pci-math-entry's real shape: a same-scope *peer* on qti-react. Left as a `>=` range, a dev
    // consumer silently back-fills the latest release of qti-react, mixing dev + release siblings.
    const pkg: Manifest = {
      name: "@conform-ed/pci-math-entry",
      version: "0.0.0",
      peerDependencies: { "@conform-ed/qti-react": ">=0.0.12" },
    };
    pinSiblingDeps(pkg, "@conform-ed/", version);
    expect((pkg.peerDependencies as Record<string, string>)["@conform-ed/qti-react"]).toBe(version);

    // The pinned peer must satisfy itself — proving the dev build now resolves the dev sibling, not
    // a back-filled release (a `>=0.0.12` range does NOT match this pre-release under SemVer).
    expect(Bun.semver.satisfies(version, version)).toBe(true);
    expect(Bun.semver.satisfies(version, ">=0.0.12")).toBe(false);
  });

  test("pins runtime + optional same-scope deps, leaves foreign-scope deps untouched", () => {
    const pkg: Manifest = {
      name: "@conform-ed/common-cartridge",
      version: "0.0.0",
      dependencies: { "@conform-ed/contracts": "workspace:*", zod: ">=4.4.0" },
      optionalDependencies: { "@conform-ed/qti-xml": "^0.1.0" },
      peerDependencies: { react: ">=19" },
    };
    pinSiblingDeps(pkg, "@conform-ed/", version);
    expect((pkg.dependencies as Record<string, string>)["@conform-ed/contracts"]).toBe(version);
    expect((pkg.dependencies as Record<string, string>).zod).toBe(">=4.4.0");
    expect((pkg.optionalDependencies as Record<string, string>)["@conform-ed/qti-xml"]).toBe(version);
    // External peers (react, zod) are a different scope and MUST stay ranges.
    expect((pkg.peerDependencies as Record<string, string>).react).toBe(">=19");
  });
});

describe("semver helpers", () => {
  test("nextPatch bumps the patch component", () => {
    expect(nextPatch("0.1.2")).toBe("0.1.3");
  });

  test("maxCore returns the greater of two cores", () => {
    expect(maxCore("0.0.0", "0.1.3")).toBe("0.1.3");
    expect(maxCore("0.2.0", "0.1.9")).toBe("0.2.0");
  });
});
