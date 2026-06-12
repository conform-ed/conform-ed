import type {
  Activity as ActivityV103,
  Statement as StatementV103,
  SubStatement as SubStatementV103,
} from "@conform-ed/contracts/xapi/v1_0_3";
import type { Activity as ActivityV20, StatementV2, SubStatementV2 } from "@conform-ed/contracts/xapi/v2_0";

type ParseHelper = {
  parse(input: string, done: (error?: unknown) => void): unknown;
};

type ActivityLike = {
  id: string;
  objectType?: string;
};

type ContextLike = {
  contextActivities?: {
    category?: ActivityLike | Array<ActivityLike>;
  };
};

export function parseBody<T>(helper: ParseHelper, body: unknown): T {
  if (typeof body === "string") {
    return helper.parse(body, () => undefined) as T;
  }
  return body as T;
}

export function requireV103Context(statement: StatementV103, source: string): NonNullable<StatementV103["context"]> {
  if (!statement.context) {
    throw new Error(`${source} must include context`);
  }
  return statement.context;
}

function firstActivityOrThrow(category: ActivityLike | Array<ActivityLike> | undefined, source: string): ActivityLike {
  if (Array.isArray(category)) {
    const first = category[0];
    if (first) {
      return first;
    }
  } else if (category) {
    return category;
  }

  throw new Error(
    `${source} must include contextActivities.category as a single Activity or a non-empty array of Activities`,
  );
}

export function requireV103CategoryActivity(
  context: NonNullable<StatementV103["context"]>,
  source: string,
): NonNullable<ActivityV103[]>[number] {
  const category = firstActivityOrThrow((context as ContextLike).contextActivities?.category, source);
  return category as NonNullable<ActivityV103[]>[number];
}

export function requireV103ActivityObject(object: StatementV103["object"], source: string): ActivityV103 {
  if ("id" in object && (object.objectType === undefined || object.objectType === "Activity")) {
    return object as ActivityV103;
  }
  throw new Error(`${source} must use an Activity object`);
}

export function requireV103SubStatementObject(object: StatementV103["object"], source: string): SubStatementV103 {
  if ("verb" in object && "actor" in object && "object" in object) {
    return object as SubStatementV103;
  }
  throw new Error(`${source} must use a SubStatement object`);
}

export function requireV20Context(statement: StatementV2, source: string): NonNullable<StatementV2["context"]> {
  if (!statement.context) {
    throw new Error(`${source} must include context`);
  }
  return statement.context;
}

export function requireV20CategoryActivity(
  context: NonNullable<StatementV2["context"]>,
  source: string,
): NonNullable<ActivityV20[]>[number] {
  const category = firstActivityOrThrow((context as ContextLike).contextActivities?.category, source);
  return category as NonNullable<ActivityV20[]>[number];
}

export function requireV20ActivityObject(object: StatementV2["object"], source: string): ActivityV20 {
  if ("id" in object && (object.objectType === undefined || object.objectType === "Activity")) {
    return object as ActivityV20;
  }
  throw new Error(`${source} must use an Activity object`);
}

export function requireV20SubStatementObject(object: StatementV2["object"], source: string): SubStatementV2 {
  if ("verb" in object && "actor" in object && "object" in object) {
    return object as SubStatementV2;
  }
  throw new Error(`${source} must use a SubStatement object`);
}

// ── Template helpers ──────────────────────────────────────────────
// Eliminate the repeated pattern:
//   let data = helper.createFromTemplate(templates);
//   data = data.statement;
// by returning .statement directly, with proper typing.

type TemplateHelper = {
  createFromTemplate(templates: Array<Record<string, unknown>>): Record<string, unknown>;
};

type TemplateInput = Array<Record<string, string>> | Array<Record<string, unknown>>;

/** Returns `.statement` from the template result, typed as a v1 Statement. */
export function createStatement(tHelper: TemplateHelper, templates: TemplateInput): StatementV103 {
  const result = tHelper.createFromTemplate(templates as Array<Record<string, unknown>>);
  return result["statement"] as StatementV103;
}

/** Returns `.statement` from the template result, typed as a v2 Statement. */
export function createStatementV2(tHelper: TemplateHelper, templates: TemplateInput): StatementV2 {
  const result = tHelper.createFromTemplate(templates as Array<Record<string, unknown>>);
  return result["statement"] as StatementV2;
}

/** Returns a specific key from the template result with a generic cast. */
export function createTemplateKey<T>(tHelper: TemplateHelper, templates: TemplateInput, key: string): T {
  const result = tHelper.createFromTemplate(templates as Array<Record<string, unknown>>);
  return result[key] as T;
}

/** Returns the raw template result, typed generically. */
export function createTemplateObject<T extends Record<string, unknown>>(
  tHelper: TemplateHelper,
  templates: TemplateInput,
): T {
  return tHelper.createFromTemplate(templates as Array<Record<string, unknown>>) as T;
}

/** An attachment of a fixture statement by position; fixtures that lack it are test bugs. */
export function requireAttachment(statement: { attachments?: unknown }, index = 0): Record<string, unknown> {
  const attachments = statement.attachments as Array<Record<string, unknown>> | undefined;
  const attachment = attachments?.[index];

  if (!attachment) {
    throw new Error(`Test fixture statement must include an attachment at position ${index}.`);
  }

  return attachment;
}
