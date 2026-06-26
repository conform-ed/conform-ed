// Normalized, serializable view-model of an EDC for rendering (conform-ed ADR-0019). Pure
// data — a downstream product wraps this in its own framework; the reference renderer
// (render-edc.ts) turns it into semantic HTML. Resolves langStrings to the chosen language
// and lifts the issuer's pre-rendered display images out of displayParameter.

import { availableLanguages, type LangString, selectText } from "./language";

export interface EdcClaimView {
  readonly kind: string;
  readonly title?: string;
  readonly description?: string;
}

export interface EdcImageView {
  readonly page: number;
  readonly src: string;
  readonly alt?: string;
}

export interface EdcViewModel {
  readonly lang: string;
  readonly title?: string;
  readonly subjectName?: string;
  readonly issuerName?: string;
  readonly issued?: string;
  readonly validFrom?: string;
  readonly validUntil?: string;
  readonly claims: readonly EdcClaimView[];
  readonly images: readonly EdcImageView[];
}

export interface BuildViewModelOptions {
  /** Preferred BCP-47 language; defaults to the displayParameter title's first language, else `en`. */
  readonly lang?: string;
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj | undefined => (typeof v === "object" && v !== null ? (v as Obj) : undefined);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const lstr = (v: unknown): LangString | undefined =>
  typeof v === "string" || (typeof v === "object" && v !== null) ? (v as LangString) : undefined;

function typeTag(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    const tag = v.find((t) => typeof t === "string" && t !== "VerifiableCredential");
    if (typeof tag === "string") return tag;
  }
  return "Claim";
}

/** A MediaObject → a data URI (best-effort mime; EU display pages are typically PNG). */
function imageSrc(media: Obj): string | undefined {
  const content = media["content"];
  if (typeof content !== "string") return undefined;
  return `data:image/png;base64,${content}`;
}

export function buildViewModel(credential: unknown, options: BuildViewModelOptions = {}): EdcViewModel {
  const cred = asObj(credential) ?? {};
  const dp = asObj(cred["displayParameter"]) ?? {};
  const title = lstr(dp["title"]);
  const lang = options.lang ?? availableLanguages(title)[0] ?? "en";
  const titleText = selectText(title, lang);

  const subject = asObj(cred["credentialSubject"]) ?? {};
  const fullName = selectText(lstr(subject["fullName"]), lang);
  const given = selectText(lstr(subject["givenName"]), lang);
  const family = selectText(lstr(subject["familyName"]), lang);
  const subjectName = fullName ?? ([given, family].filter(Boolean).join(" ") || undefined);

  const issuer = asObj(cred["issuer"]);
  const issuerName = issuer ? selectText(lstr(issuer["legalName"]), lang) : undefined;

  const claims: EdcClaimView[] = asArray(subject["hasClaim"]).flatMap((c): EdcClaimView[] => {
    const claim = asObj(c);
    if (claim === undefined) return [];
    const ctitle = selectText(lstr(claim["title"]), lang);
    const cdesc = selectText(lstr(claim["description"]), lang);
    return [
      {
        kind: typeTag(claim["type"]),
        ...(ctitle !== undefined ? { title: ctitle } : {}),
        ...(cdesc !== undefined ? { description: cdesc } : {}),
      },
    ];
  });

  // displayParameter.individualDisplay[] → the issuer's pre-rendered pages for `lang`.
  const images: EdcImageView[] = asArray(dp["individualDisplay"])
    .flatMap((d): EdcImageView[] => {
      const indiv = asObj(d);
      if (indiv === undefined) return [];
      return asArray(indiv["displayDetail"]).flatMap((detail): EdcImageView[] => {
        const dd = asObj(detail);
        const media = asObj(dd?.["image"]);
        const src = media ? imageSrc(media) : undefined;
        if (src === undefined) return [];
        const page = typeof dd?.["page"] === "number" ? (dd["page"] as number) : 1;
        return [{ page, src, ...(titleText !== undefined ? { alt: titleText } : {}) }];
      });
    })
    .sort((a, b) => a.page - b.page);

  return {
    lang,
    ...(titleText !== undefined ? { title: titleText } : {}),
    ...(subjectName !== undefined ? { subjectName } : {}),
    ...(issuerName !== undefined ? { issuerName } : {}),
    ...(typeof cred["issued"] === "string" ? { issued: cred["issued"] } : {}),
    ...(typeof cred["validFrom"] === "string" ? { validFrom: cred["validFrom"] } : {}),
    ...(typeof cred["validUntil"] === "string" ? { validUntil: cred["validUntil"] } : {}),
    claims,
    images,
  };
}
