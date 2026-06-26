// Language selection for ELM language-tagged literals (conform-ed ADR-0019). An ELM
// langString is `{ "<lang>": "value" | ["value", …] }` (the issued and pre-issuance forms
// differ — string vs string[]), or occasionally a bare string. Selection prefers the
// requested language, then a fallback, then any available value.

export type LangString = string | Record<string, string | readonly string[]>;

function firstOf(value: string | readonly string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : value[0];
}

/** Resolve a langString to a single string, preferring `lang`, then `fallback`, then any. */
export function selectText(value: LangString | undefined, lang: string, fallback = "en"): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  const direct = firstOf(value[lang]);
  if (direct !== undefined) return direct;
  const fb = firstOf(value[fallback]);
  if (fb !== undefined) return fb;
  for (const key of Object.keys(value)) {
    const any = firstOf(value[key]);
    if (any !== undefined) return any;
  }
  return undefined;
}

/** The set of language tags a langString carries (empty for a bare string). */
export function availableLanguages(value: LangString | undefined): string[] {
  return value === undefined || typeof value === "string" ? [] : Object.keys(value);
}
