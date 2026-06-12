/**
 * Runtime view types for the headless core. These are structural views of the
 * `@conform-ed/contracts` QTI 3.0.1 shapes — the runtime validates items with the
 * contract schemas, but works against these narrowed types because several contract
 * schemas are `z.lazy` (statically `any`). No React or Mantine here.
 */

/** One field of a record response; fields keep their runtime type (PCI JSON typing). */
export type ResponseFieldValue = string | number | boolean | null;

/** A record-cardinality response: named, individually-typed fields (PCI contracts). */
export type ResponseRecordValue = Readonly<Record<string, ResponseFieldValue>>;

/** A candidate response for one interaction, keyed in state by `responseIdentifier`. */
export type ResponseValue = string | readonly string[] | ResponseRecordValue | null;

/** Narrow a ResponseValue to its record variant. */
export function isResponseRecord(value: ResponseValue): value is ResponseRecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type Cardinality = "single" | "multiple" | "ordered" | "record";

export interface CorrectResponseView {
  readonly values: ReadonlyArray<{ readonly value: string }>;
}

export interface MapEntryView {
  readonly mapKey: string;
  readonly mappedValue: number;
  readonly caseSensitive?: boolean;
}

export interface MappingView {
  readonly mapEntries: readonly MapEntryView[];
  readonly lowerBound?: number;
  readonly upperBound?: number;
  readonly defaultValue?: number;
}

/** One scored area for point responses (QTI `areaMapEntry`). */
export interface AreaMapEntryView {
  readonly shape: string;
  readonly coords: readonly number[];
  readonly mappedValue: number;
}

export interface AreaMappingView {
  readonly areaMapEntries: readonly AreaMapEntryView[];
  readonly lowerBound?: number;
  readonly upperBound?: number;
  readonly defaultValue?: number;
}

export interface ResponseDeclarationView {
  readonly identifier: string;
  readonly cardinality: Cardinality;
  readonly baseType?: string;
  readonly defaultValue?: { readonly values: ReadonlyArray<{ readonly value: string | number | boolean }> };
  readonly correctResponse?: CorrectResponseView;
  readonly mapping?: MappingView;
  readonly areaMapping?: AreaMappingView;
}

/** The scored outcome for one response variable. */
export interface ScoreResult {
  readonly identifier: string;
  readonly score: number;
  readonly maxScore: number;
  readonly correct: boolean;
}
