import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { extractSealedCredential, type SealedEdc } from "../src/jades";
import type { StatusResolver } from "../src/resolvers";
import { evaluateRevocation } from "../src/status";

// EDC revocation reuses the generic, injected status engine (ADR-0019 §9): structure-agnostic
// `credentialStatus` evaluation, with the actual lookup delegated to a host-supplied resolver.
const corpus = join(import.meta.dir, "../../coverage/vendor/elm/examples/edc");
const edcCredential = (): Record<string, unknown> =>
  extractSealedCredential(
    JSON.parse(readFileSync(join(corpus, "Sample-CertOfPart-signed.jsonld"), "utf8")) as SealedEdc,
  ) as Record<string, unknown>;

describe("EDC status / revocation (ADR-0019 §9 — generic engine, injected resolver)", () => {
  test("a real EU credential carries no credentialStatus → not-checked", async () => {
    const result = await evaluateRevocation(edcCredential());
    expect(result.state).toBe("not-checked");
  });

  test("credentialStatus present but no resolver → unknown (fails safe)", async () => {
    const credential = {
      ...edcCredential(),
      credentialStatus: { id: "https://issuer.example/status/1", type: "RevocationList2020Status" },
    };
    const result = await evaluateRevocation(credential);
    expect(result.state).toBe("unknown");
  });

  test("credentialStatus + injected resolver → delegated verdict (revoked)", async () => {
    const credential = {
      ...edcCredential(),
      credentialStatus: { id: "https://issuer.example/status/1", type: "RevocationList2020Status" },
    };
    const resolver: StatusResolver = {
      resolveStatus: () => Promise.resolve({ state: "revoked", reason: "listed in the issuer revocation list" }),
    };
    const result = await evaluateRevocation(credential, resolver);
    expect(result.state).toBe("revoked");
    expect(result.statusType).toBe("RevocationList2020Status");
  });
});
