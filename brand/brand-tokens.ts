/**
 * conform-ed brand tokens
 * The accent (teal) carries the "it conforms / it checks out" meaning.
 * Use `teal` on light surfaces and `tealBright` on dark surfaces.
 */
export const conformedBrand = {
  ink: "#0E1726", // primary dark — brackets, wordmark, dark backgrounds
  paper: "#F7FAF9", // off-white — marks on dark surfaces
  teal: "#14B8A6", // accent on light backgrounds (the check)
  tealBright: "#2DD4BF", // accent on dark backgrounds (the check)
  mute: "#8A94A0", // secondary text / captions
} as const;

export type ConformedBrandToken = keyof typeof conformedBrand;
