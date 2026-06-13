/**
 * A tiny indenting XML writer shared by the binding serializers (results, usage
 * data, AfA PNP). The XSDs' sequences dictate emit order; escaping covers text
 * content and attribute values.
 */

export function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}

export type AttributeValue = string | number | boolean | undefined;

function openTag(
  name: string,
  attributes: ReadonlyArray<readonly [string, AttributeValue]>,
  selfClose: boolean,
): string {
  const rendered = attributes
    .filter((entry): entry is readonly [string, string | number | boolean] => entry[1] !== undefined)
    .map(([attribute, value]) => ` ${attribute}="${escapeAttribute(String(value))}"`)
    .join("");

  return `<${name}${rendered}${selfClose ? "/" : ""}>`;
}

export class XmlWriter {
  private readonly lines: string[] = [];
  private depth = 0;

  line(text: string): void {
    this.lines.push(`${"    ".repeat(this.depth)}${text}`);
  }

  element(
    name: string,
    attributes: ReadonlyArray<readonly [string, AttributeValue]>,
    body?: (() => void) | string,
  ): void {
    if (body === undefined) {
      this.line(openTag(name, attributes, true));
      return;
    }

    if (typeof body === "string") {
      this.line(`${openTag(name, attributes, false)}${escapeText(body)}</${name}>`);
      return;
    }

    this.line(openTag(name, attributes, false));
    this.depth += 1;
    body();
    this.depth -= 1;
    this.line(`</${name}>`);
  }

  toString(): string {
    return `${this.lines.join("\n")}\n`;
  }
}
