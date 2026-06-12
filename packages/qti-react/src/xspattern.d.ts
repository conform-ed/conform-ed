/**
 * Ambient typing for xspattern 3.1.0: the package ships dist/xspattern.d.ts and a
 * top-level "types" field, but its "exports" map has no "types" condition, so
 * modern resolution cannot see them. Mirrors the shipped declarations verbatim;
 * delete once upstream adds the condition (https://github.com/bwrrp/xspattern.js).
 */
declare module "xspattern" {
  export type MatchFn = (str: string) => boolean;
  export type Options = { language: "xsd" | "xpath" };
  export function compile(pattern: string, options?: Options): MatchFn;
}
