/**
 * Description : This is a test suite that tests an LRS endpoint based on the testing requirements document
 * found at https://github.com/adlnet/xapi-lrs-conformance-requirements
 */

import { describe, expect, it } from "../bun-test.ts";
import helperImport from "../helper.ts";
import requestBase from "../super-request.ts";
import { expectAsync, endAsync } from "../super-request.ts";
import templatingSelectionImport from "../templatingSelection.ts";
import { createStatement } from "../typing-helpers.ts";
import type { RuntimeHelper, RuntimeRequestFactory, RuntimeTemplatingSelection } from "../harness-types.ts";

const helper = helperImport as RuntimeHelper;
const templatingSelection = templatingSelectionImport as RuntimeTemplatingSelection;
let request: RuntimeRequestFactory = requestBase;

if (process.env["OAUTH1_ENABLED"] === "true") request = helper.OAuthRequest(request);

function parseMillisecondsFromIso(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  if (Number.isNaN(Date.parse(value))) {
    return null;
  }

  const fractionMatch = /\.(\d+)/.exec(value);
  if (!fractionMatch || !fractionMatch[1]) {
    return null;
  }

  const milliseconds = Number.parseInt(fractionMatch[1].slice(0, 3).padEnd(3, "0"), 10);
  return Number.isNaN(milliseconds) ? null : milliseconds;
}

describe("Special Data Types and Rules (Data 4.0)", () => {
  //Data 4.1
  /**  Matchup with Conformance Requirements Document
   * XAPI-00118 - in extensions.js
   * XAPI-00119 - below and in extensions.js
   * XAPI-00120 - in extensions.js
   */
  templatingSelection.createTemplate("extensions.ts");

  /**  XAPI-00119, Data 4.1 Extensions
   * An Extension can be null, an empty string, objects with nothing in them. The LRS accepts with 200 if a PUT or 204 if a POST an otherwise valid statement which has any extension value including null, an empty string, or an empty object.
   * Tests for other emptys and PUT
   */
  describe("An Extension can be null, an empty string, objects with nothing in them when using PUT. (Format, Data 4.1, XAPI-00119)", () => {
    let NULL_VALUE = { extensions: { "http://example.com/ex": null } },
      EMPTY_STRING_VALUE = { extensions: { "http://example.com/ex": "" } },
      EMPTY_OBJECT_VALUE = { extensions: { "http://example.com/ex": {} } },
      VALID_EXTENSION_EMPTY = { extensions: {} };

    it("statement activity extensions can be empty object", async () => {
      let template = [
          { statement: "{{statements.object_activity}}" },
          { object: "{{activities.no_extensions}}" },
          { definition: VALID_EXTENSION_EMPTY },
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement activity extension values can be empty string", async () => {
      let template = [
          { statement: "{{statements.object_activity}}" },
          { object: "{{activities.no_extensions}}" },
          { definition: EMPTY_STRING_VALUE },
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement activity extension values can be null", async () => {
      let template = [
          { statement: "{{statements.object_activity}}" },
          { object: "{{activities.no_extensions}}" },
          { definition: NULL_VALUE },
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement activity extensions can be empty object", async () => {
      let template = [
          { statement: "{{statements.object_activity}}" },
          { object: "{{activities.no_extensions}}" },
          { definition: EMPTY_OBJECT_VALUE },
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement result extensions can be empty object", async () => {
      let template = [
          { statement: "{{statements.result}}" },
          { result: "{{results.no_extensions}}" },
          VALID_EXTENSION_EMPTY,
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement result extension values can be empty string", async () => {
      let template = [
          { statement: "{{statements.result}}" },
          { result: "{{results.no_extensions}}" },
          EMPTY_STRING_VALUE,
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement result extension values can be null", async () => {
      let template = [{ statement: "{{statements.result}}" }, { result: "{{results.no_extensions}}" }, NULL_VALUE],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement result extension values can be empty object", async () => {
      let template = [
          { statement: "{{statements.result}}" },
          { result: "{{results.no_extensions}}" },
          EMPTY_OBJECT_VALUE,
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement context extensions can be empty object", async () => {
      let template = [
          { statement: "{{statements.context}}" },
          { context: "{{contexts.no_extensions}}" },
          VALID_EXTENSION_EMPTY,
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement context extension values can be empty string", async () => {
      let template = [
          { statement: "{{statements.context}}" },
          { context: "{{contexts.no_extensions}}" },
          EMPTY_STRING_VALUE,
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement context extension values can be null", async () => {
      let template = [{ statement: "{{statements.context}}" }, { context: "{{contexts.no_extensions}}" }, NULL_VALUE],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement context extension values can be empty object", async () => {
      let template = [
          { statement: "{{statements.context}}" },
          { context: "{{contexts.no_extensions}}" },
          EMPTY_OBJECT_VALUE,
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement substatement activity extensions can be empty object", async () => {
      let template = [
          { statement: "{{statements.object_substatement}}" },
          { object: "{{substatements.activity}}" },
          { object: "{{activities.no_extensions}}" },
          { definition: VALID_EXTENSION_EMPTY },
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement substatement activity extension values can be empty string", async () => {
      let template = [
          { statement: "{{statements.object_substatement}}" },
          { object: "{{substatements.activity}}" },
          { object: "{{activities.no_extensions}}" },
          { definition: EMPTY_STRING_VALUE },
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement substatement activity extension values can be null", async () => {
      let template = [
          { statement: "{{statements.object_substatement}}" },
          { object: "{{substatements.activity}}" },
          { object: "{{activities.no_extensions}}" },
          { definition: NULL_VALUE },
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement substatement activity extension values can be empty object", async () => {
      let template = [
          { statement: "{{statements.object_substatement}}" },
          { object: "{{substatements.activity}}" },
          { object: "{{activities.no_extensions}}" },
          { definition: EMPTY_OBJECT_VALUE },
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement substatement result extensions can be empty object", async () => {
      let template = [
          { statement: "{{statements.object_substatement}}" },
          { object: "{{substatements.result}}" },
          { result: "{{results.no_extensions}}" },
          VALID_EXTENSION_EMPTY,
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement substatement result extension values can be empty string", async () => {
      let template = [
          { statement: "{{statements.object_substatement}}" },
          { object: "{{substatements.result}}" },
          { result: "{{results.no_extensions}}" },
          EMPTY_STRING_VALUE,
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement substatement result extension values can be null", async () => {
      let template = [
          { statement: "{{statements.object_substatement}}" },
          { object: "{{substatements.activity}}" },
          { object: "{{activities.no_extensions}}" },
          { definition: NULL_VALUE },
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement substatement result extension values can be empty object", async () => {
      let template = [
          { statement: "{{statements.object_substatement}}" },
          { object: "{{substatements.result}}" },
          { result: "{{results.no_extensions}}" },
          EMPTY_OBJECT_VALUE,
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement substatement context extensions can be empty object", async () => {
      let template = [
          { statement: "{{statements.object_substatement}}" },
          { object: "{{substatements.context}}" },
          { context: "{{contexts.no_extensions}}" },
          VALID_EXTENSION_EMPTY,
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement substatement context extension values can be empty string", async () => {
      let template = [
          { statement: "{{statements.object_substatement}}" },
          { object: "{{substatements.context}}" },
          { context: "{{contexts.no_extensions}}" },
          EMPTY_STRING_VALUE,
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement substatement context extension values can be null", async () => {
      let template = [
          { statement: "{{statements.object_substatement}}" },
          { object: "{{substatements.context}}" },
          { context: "{{contexts.no_extensions}}" },
          NULL_VALUE,
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it("statement substatement context extension values can be empty object", async () => {
      let template = [
          { statement: "{{statements.object_substatement}}" },
          { object: "{{substatements.context}}" },
          { context: "{{contexts.no_extensions}}" },
          EMPTY_OBJECT_VALUE,
        ],
        data = createStatement(helper, template);
      data.id = helper.generateUUID();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });
  });

  //Data 4.2
  /**  Matchup with Conformance Requirements Document
   * XAPI-00121 - in languages.js
   */
  templatingSelection.createTemplate("languages.ts");

  //Data 4.5
  /**  Matchup with Conformance Requirements Document
   * XAPI-00122 - below
   * XAPI-00123 - in timestamps.js
   */
  templatingSelection.createTemplate("timestamps.ts");

  /**  XAPI-00122, Data 4.5 ISO 8601 Timestamps
   * A Timestamp MUST preserve precision to at least milliseconds (3 decimal points beyond seconds). The LRS accepts a statement with a valid timestamp which has more than 3 decimal points beyond seconds and when recalled it returns at least 3 decimals points beyond seconds.
   */
  describe("A Timestamp MUST preserve precision to at least milliseconds, 3 decimal points beyond seconds. (Data 4.5.s1.b3, XAPI-00122)", () => {
    it("retrieve statements, test a timestamp property", async () => {
      const res = await endAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements())
          .headers(helper.addAllHeaders())
          .expect(200),
      );

      let result = helper.parse(res.body as string, () => undefined) as Record<string, unknown>;
      let stmts = result.statements as Array<Record<string, unknown>>;
      let milliChecker = (num: number) => {
        const indexedStatement = stmts[num];
        expect(indexedStatement).toHaveProperty("timestamp");
        const milliseconds = parseMillisecondsFromIso(indexedStatement?.timestamp);
        expect(milliseconds).not.toEqual(null);
        //precision to milliseconds
        if ((milliseconds as number) % 10 > 0) {
          expect((milliseconds as number) % 10).toBeGreaterThan(0);
        } else {
          if (++num < stmts.length) {
            milliChecker(num);
          } else {
            expect((milliseconds as number) % 10).toBeGreaterThan(0);
          }
        }
      };
      milliChecker(0);
    });

    it("retrieve statements, test a stored property", async () => {
      const res = await endAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements())
          .headers(helper.addAllHeaders())
          .expect(200),
      );

      let result = helper.parse(res.body as string, () => undefined) as Record<string, unknown>;
      let stmts = result.statements as Array<Record<string, unknown>>;
      let milliChecker = (num: number) => {
        const indexedStatement = stmts[num];
        expect(indexedStatement).toHaveProperty("stored");
        const milliseconds = parseMillisecondsFromIso(indexedStatement?.stored);
        expect(milliseconds).not.toEqual(null);
        //precision to milliseconds
        if ((milliseconds as number) % 10 > 0) {
          expect((milliseconds as number) % 10).toBeGreaterThan(0);
        } else {
          if (++num < stmts.length) {
            milliChecker(num);
          } else {
            expect((milliseconds as number) % 10).toBeGreaterThan(0);
          }
        }
      };
      milliChecker(0);
    });
  });

  //Data 4.6
  /**  Matchup with Conformance Requirements Document
   * XAPI-00124 - in durations.js
   */
  templatingSelection.createTemplate("durations.ts");
});
