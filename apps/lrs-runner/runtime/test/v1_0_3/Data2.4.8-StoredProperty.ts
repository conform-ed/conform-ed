/**
 * Description : This is a test suite that tests an LRS endpoint based on the testing requirements document
 * found at https://github.com/adlnet/xapi-lrs-conformance-requirements
 */

import { describe, expect, it } from "../bun-test.ts";
import helperImport from "../helper.ts";
import requestBase from "../super-request.ts";
import { endAsync } from "../super-request.ts";
import type { RuntimeHelper, RuntimeRequestFactory } from "../harness-types.ts";
import type { Statement } from "@conform-ed/contracts/xapi/v1_0_3";

const helper = helperImport as RuntimeHelper;
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

describe("Stored Property Requirements (Data 2.4.8)", () => {
  let param: string;

  /**  Matchup with Conformance Requirements Document
   * XAPI-00097 - below
   *
   * Note XAPI-00023 - below
   */

  /**  XAPI-00097, Data 2.4.8 Stored
   * An LRS MUST assign the "stored" property timestamp upon receiving a statement.
   */
  describe("An LRS MUST accept statements with the stored property (Data 2.4.8.s3.b2, XAPI-00097)", function () {
    let storedTime = new Date("July 15, 2011").toISOString();
    let template = [{ statement: "{{statements.default}}" }, { stored: storedTime }] as Record<string, string>[];
    let data = (helper.createFromTemplate(template) as Record<string, unknown>)["statement"] as Statement;
    let postId: string;
    let putId: string;

    it("using POST", async function () {
      let stmtTime = Date.now();
      const res = await endAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders())
          .json(data)
          .expect(200),
      );

      postId = (res.body as string[])[0] as string;
      let query = "?statementId=" + postId;
      const getRes = await endAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + query)
          .wait(helper.genDelay(stmtTime, query, postId))
          .headers(helper.addAllHeaders())
          .expect(200),
      );

      let result = helper.parse(getRes.body as string, () => undefined) as Record<string, unknown>;
      expect(result).toHaveProperty("stored");
      let stmtStored = result.stored;
      expect(stmtStored).not.toEqual(storedTime);
    });

    it("using PUT", async function () {
      putId = helper.generateUUID();
      param = "?statementId=" + putId;
      let stmtTime = Date.now();

      await endAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + param)
          .headers(helper.addAllHeaders())
          .json(data)
          .expect(204),
      );

      const getRes = await endAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + param)
          .wait(helper.genDelay(stmtTime, param, putId))
          .headers(helper.addAllHeaders())
          .expect(200),
      );

      let result = helper.parse(getRes.body as string, () => undefined) as Record<string, unknown>;
      expect(result).toHaveProperty("stored");
      let stmtStored = result.stored;
      expect(stmtStored).not.toEqual(storedTime);
    });
  });

  /**  XAPI-00023,  2.4 Statement Properties
   * A "stored" property is a TimeStamp, per section 4.5. An LRS assigns the “stored” property upon receipt with a valid TimeStamp.
   */
  describe("A stored property must be a TimeStamp (Data 2.4.8.s2, XAPI-00023)", function () {
    it("retrieve statements, test a stored property", async function () {
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
});
