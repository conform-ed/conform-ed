import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { selectText } from "../src/language";
import { renderEdc } from "../src/render-edc";

const corpus = join(import.meta.dir, "../../coverage/vendor/elm/examples/edc");
// The signed examples carry the issued credential (with issuer + display images) in `payload`.
const issued = (file: string): unknown =>
  JSON.parse((JSON.parse(readFileSync(join(corpus, file), "utf8")) as { payload: string }).payload);

describe("EDC Reference Renderer (ADR-0019)", () => {
  test("renders a real EU credential to semantic, accessible HTML", () => {
    const { html, viewModel } = renderEdc(issued("Sample-CertOfPart-signed.jsonld"));
    expect(viewModel.title).toBe("Certificate of Participation");
    expect(viewModel.subjectName).toBe("Ana Andromeda");
    expect(viewModel.claims.length).toBeGreaterThan(0);

    expect(html).toContain('<article class="edc-credential" lang="en">');
    expect(html).toContain("<h1>Certificate of Participation</h1>");
    expect(html).toContain("Ana Andromeda");
    expect(html).toContain("<h2>Claims</h2>");
  });

  test("lifts the issuer's pre-rendered display images as <img> with alt text", () => {
    const { html, viewModel } = renderEdc(issued("Sample-CertOfPart-signed.jsonld"));
    expect(viewModel.images.length).toBeGreaterThan(0);
    expect(viewModel.images[0]?.src.startsWith("data:image/")).toBe(true);
    expect(html).toContain("<img src=");
    expect(html).toContain("alt=");
  });

  test("renders every signed EU credential without error", () => {
    for (const file of [
      "AA-Annex1-MC-signed.jsonld",
      "Sample-JointDegree-signed.jsonld",
      "Sample-MastersDegree-signed.jsonld",
      "Sample-TranscriptOfRecords-signed.jsonld",
    ]) {
      const { html, viewModel } = renderEdc(issued(file));
      expect(html).toContain("<article");
      expect(viewModel.title).toBeDefined();
    }
  });

  test("selects language and falls back; handles both langString forms", () => {
    expect(selectText({ en: "Hello", fr: "Bonjour" }, "fr")).toBe("Bonjour");
    expect(selectText({ en: ["Hello"] }, "fr")).toBe("Hello"); // array form + fallback to en
    expect(selectText("plain", "fr")).toBe("plain");
    const { viewModel } = renderEdc(issued("Sample-CertOfPart-signed.jsonld"), { lang: "en" });
    expect(viewModel.lang).toBe("en");
  });

  test("escapes HTML in credential text (no injection)", () => {
    const malicious = {
      displayParameter: { title: { en: "<script>alert(1)</script>" } },
      credentialSubject: { hasClaim: [] },
    };
    const { html } = renderEdc(malicious);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
