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

describe("Encoding Requirements (Communication 1.4)", () => {
  /**  XAPI-00015,  2.2. Formatting Requirements
   * All Strings are encoded and interpreted as UTF-8
   * This req should stay here (Communication 1.4).  This is the only place which mentions UTF-8 in the spec, other than Comm 1.3
   */
  it("All Strings are encoded and interpreted as UTF-8 (Communication 1.4.s1.b1, XAPI-00015)", async function () {
    let verbTemplate = "http://adlnet.gov/expapi/test/unicode/target/";
    let verb = verbTemplate + helper.generateUUID();
    let unicodeTemplates = [{ statement: "{{statements.unicode}}" }];

    let unicode = (helper.createFromTemplate(unicodeTemplates) as Record<string, unknown>)["statement"] as Statement;
    unicode.verb.id = verb;

    const query = helper.getUrlEncoding({ verb: verb });
    let stmtTime = Date.now();

    await endAsync(
      request(helper.getEndpointAndAuth())
        .post(helper.getEndpointStatements())
        .headers(helper.addAllHeaders({}))
        .json(unicode)
        .expect(200),
    );

    const res = await endAsync(
      request(helper.getEndpointAndAuth())
        .get(helper.getEndpointStatements() + "?" + query)
        .wait(helper.genDelay(stmtTime, "?" + query, undefined))
        .headers(helper.addAllHeaders({}))
        .expect(200),
    );

    let results = helper.parse(res.body as string, () => undefined) as {
      statements: Array<{ verb: { display: Record<string, string> } }>;
    };
    const [firstStatement] = results.statements;
    if (!firstStatement) {
      throw new Error("Expected at least one statement in the result.");
    }
    let languages = firstStatement.verb.display;
    let unicodeConformant = true;
    const unicodeDisplay = unicode.verb?.display ?? {};
    for (const key in languages) {
      if (languages[key] !== unicodeDisplay[key]) unicodeConformant = false;
    }
    expect(unicodeConformant).toBe(true);
  });
});
