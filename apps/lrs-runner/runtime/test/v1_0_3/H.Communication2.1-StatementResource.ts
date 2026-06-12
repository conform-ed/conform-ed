/**
 * Description : This is a test suite that tests an LRS endpoint based on the testing requirements document
 * found at https://github.com/adlnet/xapi-lrs-conformance-requirements
 */

import { beforeAll, describe, expect, it } from "../bun-test.ts";
import crypto from "crypto";
import extend from "../../bun-runtime/extend-compat.ts";
import fs from "fs";
import helperImport from "../helper.ts";
import multipartParser from "../multipartParser.ts";
import requestBase from "../super-request.ts";
import { endAsync, expectAsync } from "../super-request.ts";
import type { Statement, StatementResult } from "@conform-ed/contracts/xapi/v1_0_3";
import type { RuntimeHelper, RuntimeRequestFactory } from "../harness-types.ts";
import {
  parseBody,
  createStatement,
  requireV103ActivityObject,
  requireV103CategoryActivity,
  requireV103Context,
  requireV103SubStatementObject,
} from "../typing-helpers.ts";

const helper = helperImport as RuntimeHelper;
let request: RuntimeRequestFactory = requestBase;

//Communication 2.0
/**  Matchup with Conformance Requirements Document
 * XAPI-00139 - below
 * XAPI-00140 - generic and covered by other files - An LRS implements all of the Statement, State, Agent, and Activity Profile sub-APIs
 * XAPI-00141 - covered by XAPI-00195, XAPI-00275, XAPI-00294
 */

if (process.env["OAUTH1_ENABLED"] === "true") request = helper.OAuthRequest(request);

function isValidIsoTimestamp(value: string | undefined): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

type ActivityLike = ReturnType<typeof requireV103ActivityObject>;

function requireObjectWithId(statementObject: Statement["object"], source: string) {
  if (statementObject && typeof statementObject === "object" && "id" in statementObject) {
    return statementObject as { id: string };
  }
  throw new Error(`${source} must include an object with id`);
}

function requireStatementContext(statement: Statement, source: string) {
  return requireV103Context(statement, source);
}

function requireStatementCategory(statement: Statement, source: string) {
  return requireV103CategoryActivity(requireStatementContext(statement, source), source);
}

function requireStatementRegistration(statement: Statement, source: string): string {
  const context = requireStatementContext(statement, source);
  if (!context.registration) {
    throw new Error(`${source} must include context.registration`);
  }
  return context.registration;
}

function requireStatementInstructor(statement: Statement, source: string) {
  const context = requireStatementContext(statement, source);
  if (!context.instructor) {
    throw new Error(`${source} must include context.instructor`);
  }
  return context.instructor;
}

function requireSubStatementCategory(statementObject: Statement["object"], source: string) {
  const substatement = requireV103SubStatementObject(statementObject, source);
  if (!substatement.context) {
    throw new Error(`${source} must include substatement.context`);
  }
  return requireV103CategoryActivity(substatement.context as NonNullable<Statement["context"]>, source);
}

describe("Statement Resource Requirements (Communication 2.1)", () => {
  let data;
  let txtAtt1: Buffer, txtAtt2: Buffer, t1attSize: number, t2attSize: number, t1attHash: string, t2attHash: string;

  /**  XAPI-00139, Communication 2.0 Resources
   * An LRS has a Statement API with endpoint "base IRI"+"/statements"
   */
  describe('An LRS has a Statement Resource with endpoint "base IRI"+"/statements" (Communication 2.1, XAPI-00139)', function () {
    it('should allow "/statements" POST', async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let data = createStatement(helper, templates);

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        200,
      );
    });

    it('should allow "/statements" PUT', async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let data = createStatement(helper, templates);
      data.id = helper.generateUUID();

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it('should allow "/statements" GET', async function () {
      let query = helper.getUrlEncoding({ verb: "http://adlnet.gov/expapi/non/existent" });
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  //Communication 2.1.1 PUT Statements
  /**  Matchup with Conformance Requirements Document
   * XAPI-00142 - below
   * XAPI-00143 - below
   * XAPI-00144 - below
   * XAPI-00145 - below
   */

  /**  XAPI-00143, Communication 2.1.1 PUT Statements
   * An LRS's Statement API upon processing a valid PUT request successfully returns code 204 No Content
   */
  describe("An LRS's Statement Resource upon processing a successful PUT request returns code 204 No Content (Communication 2.1.1.s1, XAPI-00143)", function () {
    it("should persist statement and return status 204", async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let data = createStatement(helper, templates);
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

  /** XAPI-00144, Communication 2.1.1 PUT Statements
   * An LRS's Statement API accepts PUT requests only if it contains a "statementId" parameter, returning 204 No Content
   */
  /**  XAPI-00145, Communication 2.1.1 PUT Statements
   * An LRS's Statement API rejects a PUT request which does not have a "statementId" parameter, returning 400 Bad Request
   */
  describe('An LRS\'s Statement Resource accepts PUT requests only if it contains a "statementId" parameter (Multiplicity, Communication 2.1.1.s1.table1.row1, XAPI-00144, XAPI-00145)', function () {
    it('should persist statement using "statementId" parameter', async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let data = createStatement(helper, templates);
      data.id = helper.generateUUID();

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );
    });

    it('should fail without using "statementId" parameter', async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let data = createStatement(helper, templates);
      data.id = helper.generateUUID();

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        400,
      );
    });
  });

  /**  XAPI-00142, Communication 2.1.1 PUT Statements
   * An LRS cannot modify a Statement in the event it receives a Statement with statementID equal to a Statement in the LRS already.  To test: Send one statement with a particular statement ID. Send a second statement with the same statement ID but everything else different. Retrieve the statement before the second statement and after and both retrieved statements MUST match.
   */
  describe("An LRS cannot modify a Statement, state, or Object in the event it receives a Statement with statementID equal to a Statement in the LRS already. (Communication 2.1.1.s2.b2, XAPI-00142)", function () {
    it('should not update statement with matching "statementId" on PUT', async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let data = createStatement(helper, templates);
      data.id = helper.generateUUID();
      let query = "?statementId=" + data.id;

      let modified = extend(true, {}, data);
      modified.verb.id = "different value";
      let stmtTime = Date.now();

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(data),
        204,
      );

      await endAsync(
        request(helper.getEndpointAndAuth())
          .put(helper.getEndpointStatements() + "?statementId=" + data.id)
          .headers(helper.addAllHeaders({}))
          .json(modified),
      );

      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?statementId=" + data.id)
          .wait(helper.genDelay(stmtTime, query, data.id))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const statement = parseBody<Statement>(helper, res.body);
      expect(statement.verb.id).toEqual(data.verb.id);
    });

    it('should not update statement with matching "statementId" on POST', async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let data = createStatement(helper, templates);
      data.id = helper.generateUUID();
      let query = "?statementId=" + data.id;
      let modified = extend(true, {}, data);
      modified.verb.id = "different value";
      let stmtTime = Date.now();

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        200,
      );

      await endAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(modified),
      );

      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?statementId=" + data.id)
          .wait(helper.genDelay(stmtTime, query, data.id))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const statement = parseBody<Statement>(helper, res.body);
      expect(statement.verb.id).toEqual(data.verb.id);
    });
  });

  //Communication 2.1.2 POST Statements
  /**  Matchup with Conformance Requirements Document
   * XAPI-00146 - below
   * XAPI-00147 - below
   * XAPI-00148 - in H.Communication1.3-AlternateRequestSyntax.js
   */

  /**  XAPI-00147, Communication 2.1.2 POST Statements
   * An LRS's Statement API accepts POST requests
   */
  describe("An LRS's Statement Resource accepts POST requests (Communication 2.1.2.s1, XAPI-00147)", function () {
    it('should persist statement using "POST"', async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let data = createStatement(helper, templates);

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        200,
      );
    });
  });

  /**  XAPI-00146, Communication 2.1.2 POST Statements
   * An LRS's Statement API upon processing a successful POST request returns code 200 OK and all Statement UUIDs within the POST
   */
  describe("An LRS's Statement Resource upon processing a successful POST request returns code 200 OK and all Statement UUIDs within the POST **Implicit** (Communication 2.1.2.s1, XAPI-00146)", function () {
    it('should persist statement using "POST" and return array of IDs', async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let data = createStatement(helper, templates);
      data.id = helper.generateUUID();

      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        200,
      );

      expect(Array.isArray(res.body)).toBe(true);
      const body = res.body as string[];
      expect(body.length).toBeGreaterThan(0);
    });
  });

  //Communication 2.1.3 GET Statements
  /**  Matchup with Conformance Requirements Document
   * XAPI-00149 - below
   * XAPI-00150 - below
   * XAPI-00151 - below
   * XAPI-00152 - removed per spec call 2/8/17
   * XAPI-00153 - below
   * XAPI-00154 - below
   * XAPI-00155 - below
   * XAPI-00156 - below
   * XAPI-00157 - below
   * XAPI-00158 - below
   * XAPI-00159 - below
   * XAPI-00160 - below
   * XAPI-00161 - below
   * XAPI-00162 - below
   * XAPI-00163 - below
   * XAPI-00164 - below
   * XAPI-00165 - below
   * XAPI-00166 - below
   * XAPI-00167 - below
   * XAPI-00168 - below
   * XAPI-00169 - below
   * XAPI-00170 - below
   * XAPI-00171 - below
   * XAPI-00172 - below
   * XAPI-00173 - below
   * XAPI-00174 - below
   * XAPI-00175 - below
   * XAPI-00176 - below
   * XAPI-00177 - below
   * XAPI-00178 - below
   * XAPI-00179 - below
   * XAPI-00180 - below
   * XAPI-00181 - below
   */

  /**  XAPI-00159, Communication 2.1.3 GET Statements
   * An LRS's Statement API accepts GET requests
   */
  describe("LRS's Statement Resource accepts GET requests (Communication 2.1.3.s1, XAPI-00159)", function () {
    it("should return using GET", async function () {
      await expectAsync(
        request(helper.getEndpointAndAuth()).get(helper.getEndpointStatements()).headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00156, Communication 2.1.3 GET Statements
   * An LRS's Statement API upon processing a successful GET request with a "statementId" parameter, returns code 200 OK and a single Statement with the corresponding "id".
   */
  describe('An LRS\'s Statement Resource upon processing a successful GET request with a "statementId" parameter, returns code 200 OK and a single Statement with the corresponding "id".  (Communication 2.1.3.s1, XAPI-00156)', function () {
    let id: string, stmtTime: number;

    beforeAll(async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let data = createStatement(helper, templates);
      data.id = helper.generateUUID();
      id = data.id;

      stmtTime = Date.now();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        200,
      );
    });

    it('should retrieve statement using "statementId"', async function () {
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?statementId=" + id)
          .wait(helper.genDelay(stmtTime, "?statementId=" + id, id))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const statement = parseBody<Statement>(helper, res.body);
      expect(statement.id).toEqual(id);
    });
  });

  /**  XAPI-00155, Communication 2.1.3 GET Statements
 * An LRS's Statement API upon processing a successful GET request with a
"voidedStatementId" parameter, returns code 200 OK and a single Statement with the corresponding "id".
 */
  describe('An LRS\'s Statement Resource upon processing a successful GET request with a "voidedStatementId" parameter, returns code 200 OK and a single Statement with the corresponding "id".  (Communication 2.1.3.s1, XAPI-00155)', function () {
    let voidedId = helper.generateUUID();
    let stmtTime: number;

    beforeAll(async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let voided = createStatement(helper, templates);
      voided.id = voidedId;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(voided),
        200,
      );
    });

    beforeAll(async function () {
      let templates = [{ statement: "{{statements.voiding}}" }];
      let voiding = createStatement(helper, templates);
      requireObjectWithId(voiding.object, "voided statement setup").id = voidedId;

      stmtTime = Date.now();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(voiding),
        200,
      );
    });

    it('should return a voided statement when using GET "voidedStatementId"', async function () {
      let query = helper.getUrlEncoding({ voidedStatementId: voidedId });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const statement = parseBody<Statement>(helper, res.body);
      expect(statement.id).toEqual(voidedId);
    });
  });

  /**  XAPI-00154, Communication 2.1.3 GET Statements
 * An LRS's Statement API upon processing a successful GET request with neither a "statementId" nor a "voidedStatementId" parameter, returns code 200 OK and a
StatementResult Object.
 */
  describe('An LRS\'s Statement Resource upon processing a successful GET request with neither a "statementId" nor a "voidedStatementId" parameter, returns code 200 OK and a StatementResult Object.  (Communication 2.1.3.s1, XAPI-00154)', function () {
    let statement: Statement, substatement: Statement, stmtTime: number;
    beforeAll(async function () {
      let templates = [
        { statement: "{{statements.context}}" },
        { context: "{{contexts.category}}" },
        {
          instructor: {
            objectType: "Agent",
            name: "xAPI mbox",
            mbox: "mailto:pri@adlnet.gov",
          },
        },
      ];
      let data = helper.createFromTemplate(templates) as { statement: Statement };
      statement = data.statement;
      requireStatementCategory(statement, "statement result setup category").id =
        "http://www.example.com/test/array/statements/pri";

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(statement),
        200,
      );
    });

    beforeAll(async function () {
      let templates = [
        { statement: "{{statements.object_substatement}}" },
        { object: "{{substatements.context}}" },
        { context: "{{contexts.category}}" },
        {
          instructor: {
            objectType: "Agent",
            name: "xAPI mbox",
            mbox: "mailto:sub@adlnet.gov",
          },
        },
      ];
      let data = helper.createFromTemplate(templates) as { statement: Statement };
      substatement = data.statement;
      requireSubStatementCategory(substatement.object, "statement result setup substatement category").id =
        "http://www.example.com/test/array/statements/sub";
      stmtTime = Date.now();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(substatement),
        200,
      );
    });

    it('should return StatementResult using GET without "statementId" or "voidedStatementId"', async function () {
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements())
          .wait(helper.genDelay(stmtTime, undefined, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
    });

    it('should return StatementResult using GET with "agent"', async function () {
      let templates = [{ agent: "{{agents.default}}" }];
      let data = helper.createFromTemplate(templates);

      let query = helper.getUrlEncoding(data);
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
    });

    it('should return StatementResult using GET with "verb"', async function () {
      let query = helper.getUrlEncoding({ verb: statement.verb.id });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
    });

    it('should return StatementResult using GET with "activity"', async function () {
      let query = helper.getUrlEncoding({ activity: requireObjectWithId(statement.object, "get activity query").id });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
    });

    it('should return StatementResult using GET with "registration"', async function () {
      let query = helper.getUrlEncoding({
        registration: requireStatementRegistration(statement, "get registration query"),
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
    });

    it('should return StatementResult using GET with "related_activities"', async function () {
      let query = helper.getUrlEncoding({
        activity: requireStatementCategory(statement, "get related_activities query").id,
        related_activities: true,
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
    });

    it('should return StatementResult using GET with "related_agents"', async function () {
      let query = helper.getUrlEncoding({
        agent: requireStatementInstructor(statement, "get related_agents query"),
        related_agents: true,
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
    });

    it('should return StatementResult using GET with "since"', async function () {
      let query = helper.getUrlEncoding({ since: "2012-06-01T19:09:13.245Z" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
    });

    it('should return StatementResult using GET with "until"', async function () {
      let query = helper.getUrlEncoding({ until: "2012-06-01T19:09:13.245Z" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
    });

    it('should return StatementResult using GET with "limit"', async function () {
      let query = helper.getUrlEncoding({ limit: 1 });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
    });

    it('should return StatementResult using GET with "ascending"', async function () {
      let query = helper.getUrlEncoding({ ascending: true });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
    });

    it('should return StatementResult using GET with "format"', async function () {
      let query = helper.getUrlEncoding({ format: "ids" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const results = parseBody<StatementResult>(helper, res.body);
      expect(results).toHaveProperty("statements");
    });

    it('should return multipart response format StatementResult using GET with "attachments" parameter as true', async function () {
      let query = helper.getUrlEncoding({ attachments: true });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      expect(res.headers).toHaveProperty("content-type");
      const contentType = res.headers["content-type"] as string;
      let boundary = multipartParser.getBoundary(contentType);
      expect(boundary).toBeTruthy();
      let parsed = multipartParser.parseMultipart(boundary, res.body as string);
      expect(parsed).toBeTruthy();
      const firstPart = parsed[0];
      if (!firstPart) {
        throw new Error("Expected at least one multipart section.");
      }
      const results = parseBody<StatementResult>(helper, firstPart.body);
      expect(results).toHaveProperty("statements");
    });

    it('should not return multipart response format using GET with "attachments" parameter as false', async function () {
      let query = helper.getUrlEncoding({ attachments: false });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const results = parseBody<StatementResult>(helper, res.body);
      expect(results).toHaveProperty("statements");
    });
  });

  /**  XAPI-00158, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "statementId" as a parameter
   */
  describe('An LRS\'s Statement Resource can process a GET request with "statementId" as a parameter (Communication 2.1.3.s1.table1.row1, XAPI-00158)', function () {
    it('should process using GET with "statementId"', async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let data = createStatement(helper, templates);
      data.id = helper.generateUUID();
      let query = "?statementId=" + data.id;
      let stmtTime = Date.now();

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        200,
      );

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + query)
          .wait(helper.genDelay(stmtTime, query, data.id))
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00157, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "voidedStatementId" as a parameter
   */
  describe('An LRS\'s Statement Resource can process a GET request with "voidedStatementId" as a parameter  (Communication 2.1.3.s1.table1.row2, XAPI-00157)', function () {
    let voidedId = helper.generateUUID();
    let stmtTime: number;

    beforeAll(async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let voided = createStatement(helper, templates);
      voided.id = voidedId;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(voided),
        200,
      );
    });

    beforeAll(async function () {
      let templates = [{ statement: "{{statements.voiding}}" }];
      let voiding = createStatement(helper, templates);
      requireObjectWithId(voiding.object, "voided request invalid combo setup").id = voidedId;
      stmtTime = Date.now();

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(voiding),
        200,
      );
    });

    it('should process using GET with "voidedStatementId"', async function () {
      let query = helper.getUrlEncoding({ voidedStatementId: voidedId });
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00181, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "agent" as a parameter. The Statement API MUST return 200 OK, StatementResult Object with exact match agent result if the agent parameter is set with a valid Agent IFI
   */
  describe('An LRS\'s Statement Resource can process a GET request with "agent" as a parameter  (**Implicit**, Communication 2.1.3.s1.table1.row3, XAPI-00181)', function () {
    it('should process using GET with "agent"', async function () {
      let templates = [{ agent: "{{agents.default}}" }];
      let data = helper.createFromTemplate(templates);

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00180, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "verb" as a parameter. The Statement API MUST return 200 OK, StatementResult Object with exact match verb results if the verb parameter is set with a valid Verb IRI
   */
  describe('An LRS\'s Statement Resource can process a GET request with "verb" as a parameter  (**Implicit**, Communication 2.1.3.s1.table1.row4, XAPI-00180)', function () {
    it('should process using GET with "verb"', async function () {
      let query = helper.getUrlEncoding({ verb: "http://adlnet.gov/expapi/non/existent" });
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00179, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "activity" as a parameter. The Statement API MUST return 200 OK, StatementResult Object with exact match activity results if the activity parameter is set with a valid activity IRI
   */
  describe('An LRS\'s Statement Resource can process a GET request with "activity" as a parameter  (**Implicit**, Communication 2.1.3.s1.table1.row5, XAPI-00179)', function () {
    it('should process using GET with "activity"', async function () {
      let query = helper.getUrlEncoding({ activity: "http://www.example.com/meetings/occurances/12345" });
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00178, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "registration" as a parameter. The Statement API MUST return 200 OK, StatementResult Object with exact match registration results if the registration parameter is set with a valid registration UUID
   */
  describe('An LRS\'s Statement Resource can process a GET request with "registration" as a parameter  (**Implicit**, Communication 2.1.3.s1.table1.row6, XAPI-00178)', function () {
    it('should process using GET with "registration"', async function () {
      let query = helper.getUrlEncoding({ registration: helper.generateUUID() });
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00177, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "related_activities" as a parameter. The Statement API MUST return 200 OK, StatementResult Object with exact match activity results if the activity parameter is set with a valid Verb IRI unless the related_activities parameter is set to true. If set to true it MUST return 200 OK, StatementResult Object with activity ID matches in the Statement Object, and Context Objects and SubStatement Objects.
   */
  describe('An LRS\'s Statement Resource can process a GET request with "related_activities" as a parameter  (**Implicit**, Communication 2.1.3.s1.table1.row7)', function () {
    let statement: Statement, stmtTime: number;

    beforeAll(async function () {
      let templates = [
        { statement: "{{statements.context}}" },
        { context: "{{contexts.category}}" },
        {
          instructor: {
            objectType: "Agent",
            name: "xAPI mbox",
            mbox: "mailto:pri@adlnet.gov",
          },
        },
      ];
      let data = helper.createFromTemplate(templates) as { statement: Statement };
      statement = data.statement;
      requireStatementCategory(statement, "related activities setup").id =
        "http://www.example.com/test/array/statements/pri";
      stmtTime = Date.now();

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(statement),
        200,
      );
    });

    it('should process using GET with "related_activities"', async function () {
      let query = helper.getUrlEncoding({
        activity: requireStatementCategory(statement, "related activities query").id,
        related_activities: true,
      });
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00176. Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "related_agents" as a parameter. The Statement API MUST return 200 OK, StatementResult Object with exact match agent results if the agent parameter is set with a valid Agent or Identified Group JSON Object unless the related_agents parameter is set to true. If set to true it MUST return 200 OK, StatementResult Object with agent matches in the Actor, Object, authority, instructor, team, or any of these properties in a contained SubStatement
   */
  describe('An LRS\'s Statement Resource can process a GET request with "related_agents" as a parameter  (**Implicit**, Communication 2.1.3.s1.table1.row8, XAPI-00176)', function () {
    let statement: Statement, stmtTime: number;

    beforeAll(async function () {
      let templates = [
        { statement: "{{statements.context}}" },
        { context: "{{contexts.category}}" },
        {
          instructor: {
            objectType: "Agent",
            name: "xAPI mbox",
            mbox: "mailto:pri@adlnet.gov",
          },
        },
      ];
      let data = helper.createFromTemplate(templates) as { statement: Statement };
      statement = data.statement;
      requireStatementCategory(statement, "related agents setup").id =
        "http://www.example.com/test/array/statements/pri";
      stmtTime = Date.now();

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(statement),
        200,
      );
    });

    it('should process using GET with "related_agents"', async function () {
      let query = helper.getUrlEncoding({
        agent: requireStatementInstructor(statement, "related agents query"),
        related_agents: true,
      });
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00175, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "since" as a parameter. The Statement API MUST return 200 OK, StatementResult Object containing all statements which have a stored timestamp after the since parameter timestamp in the query.
   */
  describe('An LRS\'s Statement Resource can process a GET request with "since" as a parameter  (**Implicit**, Communication 2.1.3.s1.table1.row9, XAPI-00175)', function () {
    it('should process using GET with "since"', async function () {
      let query = helper.getUrlEncoding({ since: "2012-06-01T19:09:13.245Z" });
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00174, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "until" as a parameter. The Statement API MUST return 200 OK, StatementResult Object containing all statements which have a stored timestamp at or before the specified until parameter timestamp.
   */
  describe('An LRS\'s Statement Resource can process a GET request with "until" as a parameter  (**Implicit**, Communication 2.1.3.s1.table1.row10, XAPI-00174)', function () {
    it('should process using GET with "until"', async function () {
      let query = helper.getUrlEncoding({ until: "2012-06-01T19:09:13.245Z" });
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00173, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "limit" as a parameter. The Statement API MUST return 200 OK, StatementResult Object with only the number of results set by the integer in the limit parameter. If the limit parameter is not present, the limit is defaulted to 0 which returns all results up to the server limit.
   */
  describe('An LRS\'s Statement Resource can process a GET request with "limit" as a parameter  (**Implicit**, Communication 2.1.3.s1.table1.row11, XAPI-00173)', function () {
    it('should process using GET with "limit"', async function () {
      let query = helper.getUrlEncoding({ limit: 1 });
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00172, Communication 2.1.3 GET Statements
   * If the "Accept-Language" header is present as part of the GET request to the Statement API and the "format" parameter is set to "canonical", the LRS MUST apply this data to choose the matching language in the response.
   */
  describe('If the "Accept-Language" header is present as part of the GET request to the Statement API and the "format" parameter is set to "canonical", the LRS MUST apply this data to choose the matching language in the response. (Communication 2.1.3.s1.table1.row11, XAPI-00172)', function () {
    let statement: Statement;
    let statementID: string;
    beforeAll(async function () {
      let templates = [
        { statement: "{{statements.context}}" },
        { context: "{{contexts.category}}" },
        {
          instructor: {
            objectType: "Agent",
            name: "xAPI mbox",
            mbox: "mailto:pri@adlnet.gov",
          },
        },
      ];
      let data = helper.createFromTemplate(templates) as { statement: Statement };
      statement = data.statement;
      requireStatementCategory(statement, "accept-language setup").id =
        "http://www.example.com/test/array/statements/pri";
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(statement),
        200,
      );

      statementID = (res.body as string[])[0] as string;
    });

    it("should apply this data to choose the matching language in the response", async function () {
      let query = helper.getUrlEncoding({
        statementId: statementID,
        format: "canonical",
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(Date.now(), undefined, statementID))
          .headers(helper.addAllHeaders({ "Accept-Language": "en-GB" })),
        200,
      );

      const statement = parseBody<Statement>(helper, res.body);
      expect(statement.verb.display).not.toHaveProperty("en-US");
      const category = requireStatementCategory(statement, "accept-language canonical assertion");
      expect(category.definition?.description ?? {}).not.toHaveProperty("en-US");
      expect(category.definition?.name ?? {}).not.toHaveProperty("en-US");
    });

    it("should NOT apply this data to choose the matching language in the response when format is not set ", async function () {
      let query = helper.getUrlEncoding({
        statementId: statementID,
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(Date.now(), undefined, statementID))
          .headers(helper.addAllHeaders({ "Accept-Language": "en-GB" })),
        200,
      );

      const statement = parseBody<Statement>(helper, res.body);
      expect(statement.verb.display).toHaveProperty("en-US");
      const category = requireStatementCategory(statement, "accept-language exact assertion");
      expect(category.definition?.description ?? {}).toHaveProperty("en-US");
      expect(category.definition?.name ?? {}).toHaveProperty("en-US");
      expect(statement.verb.display).toHaveProperty("en-GB");
      expect(category.definition?.description ?? {}).toHaveProperty("en-GB");
      expect(category.definition?.name ?? {}).toHaveProperty("en-GB");
    });
  });

  /**  XAPI-00168, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "format" as a parameter. The Statement API MUST return 200 OK, StatementResult Object with results in the requested format or in “exact” if the “format” parameter is absent.
   */
  /**  XAPI-00169, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "format" as a parameter. The Statement API MUST return 200 OK, StatementResult Object with results in the requested format. If “canonical”, return Activity Objects and Verbs populated with the canonical definition of the Activity Objects and Display of the Verbs as determined by the LRS, returning only one language.
   */
  /**  XAPI-00170, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "format" as a parameter. The Statement API MUST return 200 OK, StatementResult Object with results in the requested format. If “exact”, return Agent, Activity, Verb and Group Objects populated exactly as they were when the Statement was received.
   */
  /**  XAPI-00171, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "format" as a parameter. The Statement API MUST return 200 OK, StatementResult Object with results in the requested format. If “ids”, only include identifiers for Agent, Activity, Verb, Group Objects, and members of Anonymous groups.
   */
  describe('An LRS\'s Statement Resource can process a GET request with "format" as a parameter  (**Implicit**, Communication 2.1.3.s1.table1.row12)', function () {
    let agent: Statement["actor"],
      activity: ActivityLike,
      group: Statement["actor"],
      verb1: Statement["verb"],
      verb2: Statement["verb"],
      id: string,
      stmtTime: number;
    beforeAll(async function () {
      let templates = [
        { statement: "{{statements.object_substatement}}" },
        { object: "{{statements.unicode}}" },
        { actor: "{{groups.default}}" },
      ];
      let data = createStatement(helper, templates);
      agent = data.actor;
      if (!agent.mbox) {
        throw new Error("format setup actor must include mbox");
      }
      agent.mbox = "mailto:agent" + helper.generateUUID() + "@adlnet.gov";
      verb1 = data.verb;
      const substatement = requireV103SubStatementObject(data.object, "format setup substatement");
      group = substatement.actor;
      if (!group.mbox) {
        throw new Error("format setup group actor must include mbox");
      }
      group.mbox = "mailto:group" + helper.generateUUID() + "@adlnet.gov";
      verb2 = substatement.verb;
      const subActivity = requireV103ActivityObject(substatement.object, "format setup substatement activity");
      subActivity.id = "http://www.example.com/unicode/" + helper.generateUUID();
      activity = subActivity;
      stmtTime = Date.now();
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        200,
      );

      id = (res.body as string[])[0] as string;
    });
    // XAPI-00168
    it('should process using GET with "format" absent (XAPI-00168)', async function () {
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements())
          .wait(helper.genDelay(stmtTime, "?statementId=" + id, id))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      const stmts = result.statements;
      expect(Array.isArray(stmts)).toBe(true);
      stmts.forEach(function (stmt: Statement) {
        if (stmt.id === id) {
          const stmtSubstatement = requireV103SubStatementObject(stmt.object, "format absent assertion");
          expect(stmt.actor).toEqual(agent);
          expect(stmt.verb).toEqual(verb1);
          expect(stmtSubstatement.actor).toEqual(group);
          expect(requireV103ActivityObject(stmtSubstatement.object, "format absent activity assertion")).toEqual(
            activity,
          );
          expect(stmtSubstatement.verb).toEqual(verb2);
        }
      });
    });
    // XAPI-00169
    it('should process using GET with "format" canonical (XAPI-00169)', async function () {
      let query = helper.getUrlEncoding({ format: "canonical" });

      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({ "Accept-Language": "en-GB" }))
          .wait(helper.genDelay(stmtTime, "?statementId=" + id, id)),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      const stmts = result.statements;
      expect(Array.isArray(stmts)).toBe(true);
      stmts.forEach(function (stmt: Statement) {
        if (stmt.id === id) {
          const stmtSubstatement = requireV103SubStatementObject(stmt.object, "format canonical assertion");
          const stmtSubActivity = requireV103ActivityObject(
            stmtSubstatement.object,
            "format canonical activity assertion",
          );

          expect(stmt.actor.mbox).toEqual(agent.mbox);
          expect(stmt.actor.objectType).toEqual(agent.objectType);
          expect(stmt.verb.id).toEqual(verb1.id);
          expect(stmt.verb.display?.["en-GB"]).toEqual(verb1.display?.["en-GB"]);
          expect(Object.keys(stmt.verb.display ?? {})).toEqual(["en-GB"]);

          expect(stmtSubstatement.verb.id).toEqual(verb2.id);
          expect(stmtSubstatement.verb.display?.["en-GB"]).toEqual(verb2.display?.["en-GB"]);
          expect(Object.keys(stmtSubstatement.verb.display ?? {})).toEqual(["en-GB"]);

          expect(stmtSubActivity.id).toEqual(activity.id);
          expect(stmtSubActivity.definition?.name?.["en-GB"]).toEqual(activity.definition?.name?.["en-GB"]);
          expect(stmtSubActivity.definition?.description?.["en-GB"]).toEqual(
            activity.definition?.description?.["en-GB"],
          );
          expect(Object.keys(stmtSubActivity.definition?.name ?? {})).toEqual(["en-GB"]);
          expect(Object.keys(stmtSubActivity.definition?.description ?? {})).toEqual(["en-GB"]);

          expect(stmtSubstatement.actor.mbox).toEqual(group.mbox);
          expect(stmtSubstatement.actor.objectType).toEqual(group.objectType);
        }
      });
    });
    // XAPI-00170
    it('should process using GET with "format" exact (XAPI-00170)', async function () {
      let query = helper.getUrlEncoding({ format: "exact" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?statementId=" + id, id))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      const stmts = result.statements;
      expect(Array.isArray(stmts)).toBe(true);
      stmts.forEach(function (stmt: Statement) {
        if (stmt.id === id) {
          const stmtSubstatement = requireV103SubStatementObject(stmt.object, "format exact assertion");
          expect(stmt.actor).toEqual(agent);
          expect(stmt.verb).toEqual(verb1);
          expect(stmtSubstatement.actor).toEqual(group);
          expect(stmtSubstatement.verb).toEqual(verb2);
          expect(requireV103ActivityObject(stmtSubstatement.object, "format exact activity assertion")).toEqual(
            activity,
          );
        }
      });
    });
    // XAPI-00171
    it('should process using GET with "format" ids (XAPI-00171)', async function () {
      let query = helper.getUrlEncoding({ format: "ids" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?statementId=" + id, id))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      const stmts = result.statements;
      expect(Array.isArray(stmts)).toBe(true);
      stmts.forEach(function (stmt: Statement) {
        if (stmt.id === id) {
          const stmtSubstatement = requireV103SubStatementObject(stmt.object, "format ids assertion");
          const stmtSubActivity = requireV103ActivityObject(stmtSubstatement.object, "format ids activity assertion");
          expect(Object.keys(stmt.actor).length).toBeGreaterThanOrEqual(1);
          expect(Object.keys(stmt.actor).length).toBeLessThanOrEqual(2);
          expect(Object.keys(stmtSubstatement.actor).length).toEqual(2);
          expect(Object.keys(stmtSubActivity).length).toEqual(1);
          /*  Removed since spec 1.0.3 is SHOULD*
                                expect(Object.keys(stmt.verb).length).toEqual(1);
                                expect(Object.keys(stmt.object.verb).length).toEqual(1);
                                */
          expect(stmt.actor.mbox).toEqual(agent.mbox as string | undefined);
          if (stmt.actor.objectType && agent.objectType) {
            expect(stmt.actor.objectType).toEqual(agent.objectType);
          }
          expect(stmt.verb.id).toEqual(verb1.id as string);
          expect(stmtSubstatement.actor.mbox).toEqual(group.mbox as string | undefined);
          expect(stmtSubstatement.actor.objectType).toEqual(group.objectType as "Agent" | "Group" | undefined);
          expect(stmtSubActivity.id).toEqual(activity.id as string);
          expect(stmtSubstatement.verb.id).toEqual(verb2.id as string);
        }
      });
    });
  });

  /**  XAPI-00167, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "attachments" as a parameter. The Statement API MUST return 200 OK, StatementResult Object and use the multipart response format and include all attachments if the attachment parameter is set to true
   */
  describe('An LRS\'s Statement Resource can process a GET request with "attachments" as a parameter  (**Implicit**, Communication 2.1.3.s1.table1.row13, XAPI-00167)', function () {
    let stmtTime: number, stmtId: string;

    beforeAll(async function () {
      let header = { "Content-Type": "multipart/mixed; boundary=-------314159265358979323846" };
      let templates = [
        { statement: "{{statements.attachment}}" },
        {
          attachments: [
            {
              usageType: "http://example.com/attachment-usage/test",
              display: { "en-US": "A test attachment" },
              contentType: "text/plain",
              length: 0,
              sha2: "",
              description: { "en-US": "A test attachment (description)" },
            },
            {
              usageType: "http://example.com/attachment-usage/test",
              display: { "en-US": "A test attachment" },
              contentType: "text/plain",
              length: 0,
              sha2: "",
              description: { "en-US": "A test attachment (description)" },
            },
          ],
        },
      ];
      data = createStatement(helper, templates);

      txtAtt1 = fs.readFileSync("test/v1_0_3/templates/attachments/simple_text1.txt");
      let t1stats = fs.statSync("test/v1_0_3/templates/attachments/simple_text1.txt");
      t1attSize = t1stats.size;
      t1attHash = crypto.createHash("SHA256").update(txtAtt1).digest("hex");

      txtAtt2 = fs.readFileSync("test/v1_0_3/templates/attachments/simple_text2.txt");
      let t2stats = fs.statSync("test/v1_0_3/templates/attachments/simple_text2.txt");
      t2attSize = t2stats.size;
      t2attHash = crypto.createHash("SHA256").update(txtAtt2).digest("hex");

      const attachments = data.attachments ?? [];
      const firstAttachment = attachments[0];
      const secondAttachment = attachments[1];
      if (!firstAttachment || !secondAttachment) {
        throw new Error("Expected two attachments in attachment template data");
      }
      firstAttachment.length = t1attSize;
      firstAttachment.sha2 = t1attHash;
      secondAttachment.length = t2attSize;
      secondAttachment.sha2 = t2attHash;

      let dashes = "--";
      let crlf = "\r\n";
      let boundary = "-------314159265358979323846";

      let msg = dashes + boundary + crlf;
      msg += "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += dashes + boundary + crlf;
      msg += "Content-Type: text/plain" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg += "X-Experience-API-Hash: " + firstAttachment.sha2 + crlf + crlf;
      msg += txtAtt1 + crlf;
      msg += dashes + boundary + crlf;
      msg += "Content-Type: text/plain" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg += "X-Experience-API-Hash: " + secondAttachment.sha2 + crlf + crlf;
      msg += txtAtt2 + crlf;
      msg += dashes + boundary + dashes + crlf;

      stmtTime = Date.now();
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        200,
      );
      stmtId = parseBody<string[]>(helper, res.body)[0] as string;
    });

    it('should process using GET with "attachments"', async function () {
      let query = helper.getUrlEncoding({ attachments: true, statementId: stmtId });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, stmtId))
          .headers(helper.addAllHeaders({})),
        200,
      );
      expect(res.headers["content-type"]).toContain("multipart/mixed");
      // Find the boundary
      let b = (res.headers["content-type"] as string).split(";");
      const boundaryPart = b[1];
      if (!boundaryPart) {
        throw new Error("Missing multipart boundary segment.");
      }
      let boundary: string;
      let quotes = boundaryPart.match(/"/g);
      if (quotes) {
        const matchedBoundary = boundaryPart.trim().match(/"([^"]+)"/);
        if (!matchedBoundary || !matchedBoundary[1]) {
          throw new Error("Failed to parse quoted multipart boundary.");
        }
        boundary = matchedBoundary[1];
      } else {
        let temp = boundaryPart.trim();
        boundary = temp.substring(temp.indexOf("=") + 1);
      }
      // Verify we have the statement we asked for
      // Use boundary to get the first part of response, excluding "--"
      let x = (res.body as string).split(boundary);
      const firstPart = x[1];
      if (!firstPart) {
        throw new Error("Missing first multipart section.");
      }
      const bodyStart = firstPart.indexOf("{");
      const bodyEnd = firstPart.lastIndexOf("}") + 1;
      if (bodyStart < 0 || bodyEnd <= bodyStart) {
        throw new Error("Failed to extract statement JSON from multipart body.");
      }
      let c = firstPart.substring(bodyStart, bodyEnd);
      let result = parseBody<Statement>(helper, c);
      expect(result).toHaveProperty("id");
      expect(result.id).toEqual(stmtId);
      // Create an array of global matches of the pattern, the length of which is equal to the number of times that pattern appears in the given string
      let regex1 = new RegExp(t1attHash as string, "g");
      let regex2 = new RegExp(t2attHash as string, "g");
      let match1 = ((res.body as string).match(regex1) || []).length;
      let match2 = ((res.body as string).match(regex2) || []).length;
      // Compare that number to 2 the number of times it is expected for a given has to appear in the response, once in the attachments property, and once along with the attachment
      expect(match1).toEqual(2);
      expect(match2).toEqual(2);
    });
  });

  /**  XAPI-00165, Communication 2.1.3 GET Statements
 * An LRS's Statement API, upon receiving a GET request,
MUST have a "Content-Type" header
 */
  describe('An LRSs Statement Resource, upon receiving a GET request, MUST have a "Content-Type" header(**Implicit**, Communication 2.1.3.s1.table1.row14, XAPI-00165)', function () {
    it("should contain the content-type header", async function () {
      let query = helper.getUrlEncoding({ ascending: true });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      expect(res.headers).toHaveProperty("content-type");
    });
  });

  /**  XAPI-00166, Communication 2.1.3 GET Statements
   * An LRS's Statement API can process a GET request with "ascending" as a parameter The Statement API MUST return 200 OK, StatementResult Object with results in ascending order of stored time if the ascending parameter is set to true.
   */
  describe('An LRS\'s Statement Resource can process a GET request with "ascending" as a parameter  (**Implicit**, Communication 2.1.3.s1.table1.row14, XAPI-00166)', function () {
    it('should process using GET with "ascending"', async function () {
      let query = helper.getUrlEncoding({ ascending: true });
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00151, Communication 2.1.3 GET Statements
   * An LRS's Statement API rejects a GET request with both "statementId" and anything other than "attachments" or "format" as parameters with error code 400 Bad Request.
   */
  describe('An LRS\'s Statement Resource rejects with error code 400 a GET request with both "statementId" and anything other than "attachments" or "format" as parameters (Communication 2.1.3.s2.b2, XAPI-00151)', function () {
    let id: string;
    let stmtTime: number;
    beforeAll(async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let data = createStatement(helper, templates);
      data.id = helper.generateUUID();
      id = data.id;
      stmtTime = Date.now();

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        200,
      );
    });

    it('should fail when using "statementId" with "agent"', async function () {
      let templates = [{ agent: "{{agents.default}}" }];
      let data = helper.createFromTemplate(templates);
      data.statementId = id;

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, id))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "statementId" with "verb"', async function () {
      let data = {
        statementId: id,
        verb: "http://adlnet.gov/expapi/non/existent",
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, id))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "statementId" with "activity"', async function () {
      let data = {
        statementId: id,
        activity: "http://www.example.com/meetings/occurances/12345",
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, id))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "statementId" with "registration"', async function () {
      let data = {
        statementId: id,
        registration: helper.generateUUID(),
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, id))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "statementId" with "related_activities"', async function () {
      let data = {
        statementId: id,
        related_activities: true,
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, id))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "statementId" with "related_agents"', async function () {
      let data = {
        statementId: id,
        related_agents: true,
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, id))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "statementId" with "since"', async function () {
      let data = {
        statementId: id,
        since: "2012-06-01T19:09:13.245Z",
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, id))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "statementId" with "until"', async function () {
      let data = {
        statementId: id,
        until: "2012-06-01T19:09:13.245Z",
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, id))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "statementId" with "limit"', async function () {
      let data = {
        statementId: id,
        limit: 1,
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, id))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "statementId" with "ascending"', async function () {
      let data = {
        statementId: id,
        ascending: true,
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, id))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should pass when using "statementId" with "format"', async function () {
      let data = {
        statementId: id,
        format: "ids",
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, id))
          .headers(helper.addAllHeaders({})),
        200,
      );
    });

    it('should pass when using "statementId" with "attachments"', async function () {
      let data = {
        statementId: id,
        attachments: true,
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, id))
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00150, Communication 2.1.3 GET Statements
   * An LRS's Statement API rejects a GET request with both "voidedStatementId" and anything other than "attachments" or "format" as parameters with error code 400 Bad Request.
   */
  describe('An LRS\'s Statement Resource rejects with error code 400 a GET request with both "voidedStatementId" and anything other than "attachments" or "format" as parameters (Communication 2.1.3.s2.b2, XAPI-00150)', function () {
    let voidedId = helper.generateUUID();
    let stmtTime: number;
    beforeAll(async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let voided = createStatement(helper, templates);
      voided.id = voidedId;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(voided),
        200,
      );
    });

    beforeAll(async function () {
      let templates = [{ statement: "{{statements.voiding}}" }];
      let voiding = createStatement(helper, templates);
      requireObjectWithId(voiding.object, "voiding statement setup for format tests").id = voidedId;

      stmtTime = Date.now();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(voiding),
        200,
      );
    });

    it('should fail when using "voidedStatementId" with "agent"', async function () {
      let templates = [{ agent: "{{agents.default}}" }];
      let data = helper.createFromTemplate(templates);
      data.statementId = voidedId;

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "voidedStatementId" with "verb"', async function () {
      let data = {
        statementId: voidedId,
        verb: "http://adlnet.gov/expapi/non/existent",
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "voidedStatementId" with "activity"', async function () {
      let data = {
        statementId: voidedId,
        activity: "http://www.example.com/meetings/occurances/12345",
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "voidedStatementId" with "registration"', async function () {
      let data = {
        statementId: voidedId,
        registration: helper.generateUUID(),
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "voidedStatementId" with "related_activities"', async function () {
      let data = {
        statementId: voidedId,
        related_activities: true,
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "voidedStatementId" with "related_agents"', async function () {
      let data = {
        statementId: voidedId,
        related_agents: true,
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "voidedStatementId" with "since"', async function () {
      let data = {
        statementId: voidedId,
        since: "2012-06-01T19:09:13.245Z",
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "voidedStatementId" with "until"', async function () {
      let data = {
        statementId: voidedId,
        until: "2012-06-01T19:09:13.245Z",
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "voidedStatementId" with "limit"', async function () {
      let data = {
        statementId: voidedId,
        limit: 1,
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should fail when using "voidedStatementId" with "ascending"', async function () {
      let data = {
        statementId: voidedId,
        ascending: true,
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        400,
      );
    });

    it('should pass when using "voidedStatementId" with "format"', async function () {
      let data = {
        voidedStatementId: voidedId,
        format: "ids",
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        200,
      );
    });

    it('should pass when using "voidedStatementId" with "attachments"', async function () {
      let data = {
        voidedStatementId: voidedId,
        attachments: true,
      };

      let query = helper.getUrlEncoding(data);
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        200,
      );
    });
  });

  /**  XAPI-00149, Communication 2.1.3 GET Statements
   * The LRS will NOT reject a GET request which returns an empty "statements" property. Send a GET request which will not return any results and check that a 200 Ok and an empty StatementResult Object is returned.
   */
  describe('The LRS will NOT reject a GET request which returns an empty "statements" property (**Implicit**, Communication 2.1.3.s2.b4, XAPI-00149)', function () {
    it("should return empty array list", async function () {
      let query = helper.getUrlEncoding({ verb: "http://adlnet.gov/expapi/non/existent" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      let result = helper.parse(res.body as string, () => undefined) as Record<string, unknown>;
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
      expect(result.statements).toHaveLength(0);
    });
  });

  /**  XAPI-00153, Communication 2.1.3 GET Statements
   * An LRS's Statement API upon processing a GET request, returns a header with name "X-Experience-API-Consistent-Through" regardless of the code returned.
   */
  describe('An LRS\'s Statement Resource upon processing a GET request, returns a header with name "X-Experience-API-Consistent-Through" regardless of the code returned. (Communication 2.1.3.s2.b5, XAPI-00153)', function () {
    it('should return "X-Experience-API-Consistent-Through" using GET', async function () {
      const res = await expectAsync(
        request(helper.getEndpointAndAuth()).get(helper.getEndpointStatements()).headers(helper.addAllHeaders({})),
        200,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });

    it('should return "X-Experience-API-Consistent-Through" misusing GET (status code 400)', async function () {
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?LIMIT=1")
          .headers(helper.addAllHeaders({})),
        400,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "agent"', async function () {
      let templates = [{ agent: "{{agents.default}}" }];
      let data = helper.createFromTemplate(templates);

      let query = helper.getUrlEncoding(data);
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "verb"', async function () {
      let query = helper.getUrlEncoding({ verb: "http://adlnet.gov/expapi/non/existent" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "activity"', async function () {
      let query = helper.getUrlEncoding({ activity: "http://www.example.com/meetings/occurances/12345" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "registration"', async function () {
      let query = helper.getUrlEncoding({ registration: helper.generateUUID() });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "related_activities"', async function () {
      let query = helper.getUrlEncoding({ related_activities: true });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "related_agents"', async function () {
      let query = helper.getUrlEncoding({ related_agents: true });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "since"', async function () {
      let query = helper.getUrlEncoding({ since: "2012-06-01T19:09:13.245Z" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "until"', async function () {
      let query = helper.getUrlEncoding({ until: "2012-06-01T19:09:13.245Z" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "limit"', async function () {
      let query = helper.getUrlEncoding({ limit: 1 });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "ascending"', async function () {
      let query = helper.getUrlEncoding({ ascending: true });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "format"', async function () {
      let query = helper.getUrlEncoding({ format: "ids" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "attachments"', async function () {
      let query = helper.getUrlEncoding({ attachments: true });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .headers(helper.addAllHeaders({})),
        200,
      );

      let through = res.headers["x-experience-api-consistent-through"];
      expect(through).toBeTruthy();
    });
  });

  /**  XAPI-00160, Communication 2.1.3 GET Statements
   * An LRS's "X-Experience-API-Consistent-Through" header is an ISO 8601 combined date and time
   */
  describe('An LRS\'s "X-Experience-API-Consistent-Through" header is an ISO 8601 combined date and time (Type, Communication 2.1.3.s2.b5).', function () {
    let statement: Statement, stmtTime: number;
    beforeAll(async function () {
      let templates = [
        { statement: "{{statements.context}}" },
        { context: "{{contexts.category}}" },
        {
          instructor: {
            objectType: "Agent",
            name: "xAPI mbox",
            mbox: "mailto:pri@adlnet.gov",
          },
        },
      ];
      let data = helper.createFromTemplate(templates) as { statement: Statement };
      statement = data.statement;
      requireStatementCategory(statement, "consistent-through setup").id =
        "http://www.example.com/test/array/statements/pri";

      stmtTime = Date.now();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(statement),
        200,
      );
    });

    it('should return valid "X-Experience-API-Consistent-Through" using GET', async function () {
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements())
          .wait(helper.genDelay(stmtTime, undefined, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let value = res.headers["x-experience-api-consistent-through"];
      expect(value).toBeTruthy();
      expect(isValidIsoTimestamp(value)).toBe(true);
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "agent"', async function () {
      let templates = [{ agent: "{{agents.default}}" }];
      let data = helper.createFromTemplate(templates);

      let query = helper.getUrlEncoding(data);
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let value = res.headers["x-experience-api-consistent-through"];
      expect(value).toBeTruthy();
      expect(isValidIsoTimestamp(value)).toBe(true);
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "verb"', async function () {
      let query = helper.getUrlEncoding({ verb: "http://adlnet.gov/expapi/non/existent" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let value = res.headers["x-experience-api-consistent-through"];
      expect(value).toBeTruthy();
      expect(isValidIsoTimestamp(value)).toBe(true);
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "activity"', async function () {
      let query = helper.getUrlEncoding({ activity: "http://www.example.com/meetings/occurances/12345" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let value = res.headers["x-experience-api-consistent-through"];
      expect(value).toBeTruthy();
      expect(isValidIsoTimestamp(value)).toBe(true);
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "registration"', async function () {
      let query = helper.getUrlEncoding({ registration: helper.generateUUID() });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let value = res.headers["x-experience-api-consistent-through"];
      expect(value).toBeTruthy();
      expect(isValidIsoTimestamp(value)).toBe(true);
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "related_activities"', async function () {
      let query = helper.getUrlEncoding({
        activity: requireStatementCategory(statement, "consistent-through related_activities query").id,
        related_activities: true,
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let value = res.headers["x-experience-api-consistent-through"];
      expect(value).toBeTruthy();
      expect(isValidIsoTimestamp(value)).toBe(true);
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "related_agents"', async function () {
      let query = helper.getUrlEncoding({
        agent: requireStatementInstructor(statement, "consistent-through related_agents query"),
        related_agents: true,
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let value = res.headers["x-experience-api-consistent-through"];
      expect(value).toBeTruthy();
      expect(isValidIsoTimestamp(value)).toBe(true);
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "since"', async function () {
      let query = helper.getUrlEncoding({ since: "2012-06-01T19:09:13.245Z" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let value = res.headers["x-experience-api-consistent-through"];
      expect(value).toBeTruthy();
      expect(isValidIsoTimestamp(value)).toBe(true);
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "until"', async function () {
      let query = helper.getUrlEncoding({ until: "2012-06-01T19:09:13.245Z" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let value = res.headers["x-experience-api-consistent-through"];
      expect(value).toBeTruthy();
      expect(isValidIsoTimestamp(value)).toBe(true);
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "limit"', async function () {
      let query = helper.getUrlEncoding({ limit: 1 });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let value = res.headers["x-experience-api-consistent-through"];
      expect(value).toBeTruthy();
      expect(isValidIsoTimestamp(value)).toBe(true);
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "ascending"', async function () {
      let query = helper.getUrlEncoding({ ascending: true });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let value = res.headers["x-experience-api-consistent-through"];
      expect(value).toBeTruthy();
      expect(isValidIsoTimestamp(value)).toBe(true);
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "format"', async function () {
      let query = helper.getUrlEncoding({ format: "ids" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let value = res.headers["x-experience-api-consistent-through"];
      expect(value).toBeTruthy();
      expect(isValidIsoTimestamp(value)).toBe(true);
    });

    it('should return "X-Experience-API-Consistent-Through" using GET with "attachments"', async function () {
      let query = helper.getUrlEncoding({ attachments: true });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let value = res.headers["x-experience-api-consistent-through"];
      expect(value).toBeTruthy();
      expect(isValidIsoTimestamp(value)).toBe(true);
    });
  });

  /**  XAPI-00161, Communication 2.1.3 GET Statements
   * An LRS's Statement API not return attachment data and only return application/json if the "attachment" parameter set to "false"
   */
  describe('An LRSs Statement Resource does not return attachment data and only returns application/json if the "attachment" parameter set to "false" (Communication 2.1.3.s1.b1, XAPI-00161)', function () {
    let statementId: string | null = null;
    let stmtTime: number | null = null;

    beforeAll(async function () {
      let header = { "Content-Type": "multipart/mixed; boundary=-------314159265358979323846" };
      let templates = [
        { statement: "{{statements.attachment}}" },
        {
          attachments: [
            {
              usageType: "http://example.com/attachment-usage/test",
              display: { "en-US": "A test attachment" },
              description: { "en-US": "A test attachment (description)" },
              contentType: "text/plain",
              length: 0,
              sha2: "",
              fileUrl: "http://over.there.com/file.txt",
            },
          ],
        },
      ];
      data = createStatement(helper, templates);
      txtAtt1 = fs.readFileSync("test/v1_0_3/templates/attachments/simple_text1.txt");
      let t1stats = fs.statSync("test/v1_0_3/templates/attachments/simple_text1.txt");
      t1attSize = t1stats.size;
      t1attHash = crypto.createHash("SHA256").update(txtAtt1).digest("hex");
      const attachments = data.attachments ?? [];
      const firstAttachment = attachments[0];
      if (!firstAttachment) {
        throw new Error("Expected one attachment in attachment template data");
      }
      firstAttachment.length = t1attSize;
      firstAttachment.sha2 = t1attHash;
      let dashes = "--";
      let crlf = "\r\n";
      let boundary = "-------314159265358979323846";
      let msg = dashes + boundary + crlf;
      msg += "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += dashes + boundary + crlf;
      msg += "Content-Type: text/plain" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg += "X-Experience-API-Hash: " + firstAttachment.sha2 + crlf + crlf;
      msg += txtAtt1 + crlf;
      msg += dashes + boundary + dashes + crlf;
      stmtTime = Date.now();
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        200,
      );

      let body = JSON.parse(res.body as string);
      statementId = body[0];
    });

    it('should NOT return the attachment if "attachments" is missing', async function () {
      let query = "?statementId=" + statementId;
      const res = await endAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + query)
          .wait(helper.genDelay(stmtTime ?? Date.now(), query, statementId ?? undefined))
          .headers(helper.addAllHeaders())
          .expect(200),
      );

      expect(res.headers["content-type"]).toMatch(/^application\/json/);
    });

    it('should NOT return the attachment if "attachments" is false', async function () {
      let query = "?statementId=" + statementId + "&attachments=false";

      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + query)
          .wait(helper.genDelay(stmtTime ?? Date.now(), query, statementId ?? undefined))
          .headers(helper.addAllHeaders()),
        200,
      );

      expect(res.headers["content-type"]).toMatch(/^application\/json/);
    });

    it('should return the attachment when "attachment" is true', async function () {
      let query = "?statementId=" + statementId + "&attachments=true";
      const res = await endAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + query)
          .wait(helper.genDelay(stmtTime ?? Date.now(), query, statementId ?? undefined))
          .headers(helper.addAllHeaders())
          .expect(200),
      );

      const contentType = res.headers["content-type"] as string;
      const type = contentType.split(";")[0] ?? "";
      expect(type).toEqual("multipart/mixed");
      const boundary = (contentType.split(";")[1] ?? "").replace(" boundary=", "");
      const body = (res.body as string).split("--" + boundary);
      let idx = -1;
      for (const part of body) {
        idx = Math.max(part.indexOf("here is a simple attachment"), idx);
      }
      expect(idx).not.toEqual(-1);
    });
  });

  /**  XAPI-00163, Communication 2.1.3 GET Statements
   * An LRS's Statement API, upon processing a successful GET request, can only return a Voided Statement if that Statement is specified in the voidedStatementId parameter of that request
   */
  describe("An LRS's Statement Resource, upon processing a successful GET request, can only return a Voided Statement if that Statement is specified in the voidedStatementId parameter of that request (Communication 2.1.4.s1.b1, XAPI-00163)", function () {
    let voidedId = helper.generateUUID();
    let stmtTime: number;

    beforeAll(async function () {
      let templates = [{ statement: "{{statements.default}}" }];
      let voided = createStatement(helper, templates);
      voided.id = voidedId;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(voided),
        200,
      );
    });

    beforeAll(async function () {
      let templates = [{ statement: "{{statements.voiding}}" }];
      let voiding = createStatement(helper, templates);
      requireObjectWithId(voiding.object, "voided retrieval guard setup").id = voidedId;
      stmtTime = Date.now();

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(voiding),
        200,
      );
    });

    it('should not return a voided statement if using GET "statementId"', async function () {
      let query = helper.getUrlEncoding({ statementId: voidedId });
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, voidedId))
          .headers(helper.addAllHeaders({})),
        404,
      );
    });
  });

  /**  XAPI-00162, Communication 2.1.3 GET Statements
   * An LRS's Statement API processes a successful GET request using a parameter (such as stored time) which includes a voided statement and unvoided statements targeting the voided statement. The API must return 200 Ok and the statement result object, containing statements which target a voided statement, but not the voided statement itself.
   */
  describe("An LRS's Statement Resource, upon processing a successful GET request wishing to return a Voided Statement still returns Statements which target it (Communication 2.1.4.s1.b2, XAPI-00162)", function () {
    let verbTemplate = "http://adlnet.gov/expapi/test/voided/target/";
    let verb = verbTemplate + helper.generateUUID();
    let voidedId = helper.generateUUID();
    let voidingId = helper.generateUUID();
    let statementRefId = helper.generateUUID();
    let sinceVoidingTime: string, untilVoidingTime: string;
    let stmtTime: number, prevStmtTime: number;

    beforeAll(async function () {
      // console.log(new Date(Date.now() - helper.getTimeMargin()).toISOString() + ' Ed Before');
      sinceVoidingTime = new Date(Date.now() - helper.getTimeMargin() - 4000).toISOString();
      let voidedTemplates = [{ statement: "{{statements.default}}" }];
      let voided = createStatement(helper, voidedTemplates);
      voided.id = voidedId;
      voided.verb.id = verb;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(voided),
        200,
      );
    });

    beforeAll(async function () {
      // console.log(new Date(Date.now() - helper.getTimeMargin()).toISOString() + ' Ing Before');
      let voidingTemplates = [{ statement: "{{statements.voiding}}" }];
      let voiding = createStatement(helper, voidingTemplates);
      voiding.id = voidingId;
      requireObjectWithId(voiding.object, "voiding target setup").id = voidedId;

      prevStmtTime = Date.now();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .wait(helper.genDelay(Date.now(), "?statementId=" + voidedId, voidedId))
          .headers(helper.addAllHeaders({}))
          .json(voiding),
        200,
      );
    });

    beforeAll(async function () {
      // console.log(new Date(Date.now() - helper.getTimeMargin()).toISOString() + ' Ref Before');
      let statementRefTemplates = [{ statement: "{{statements.object_statementref}}" }];
      let statementRef = createStatement(helper, statementRefTemplates);
      statementRef.id = statementRefId;
      requireObjectWithId(statementRef.object, "voiding statementref target setup").id = voidedId;
      statementRef.verb.id = verb;

      stmtTime = Date.now();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .wait(helper.genDelay(prevStmtTime, "?statementId=" + voidingId, voidingId))
          .headers(helper.addAllHeaders({}))
          .json(statementRef),
        200,
      );
    });

    beforeAll(async function () {
      // console.log(new Date(Date.now() - helper.getTimeMargin()).toISOString() + ' Final Before');
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements())
          .wait(helper.genDelay(stmtTime, "?statementId=" + statementRefId, statementRefId))
          .headers(helper.addAllHeaders({})),
        200,
      );

      untilVoidingTime = new Date(Date.now() - helper.getTimeMargin() + 4000).toISOString();
    });

    // reworded the test to be more generic, shouldn't have to stay in here
    it('should only return statements stored after designated "since" timestamp when using "since" parameter', async function () {
      // Need to use statementRefId verb b/c initial voided statement comes before voidingTime
      // console.log(new Date(Date.now() - helper.getTimeMargin()).toISOString() + ' Since');
      let query = helper.getUrlEncoding({
        verb: verb,
        since: sinceVoidingTime,
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const results = parseBody<StatementResult>(helper, res.body);
      expect(results).toHaveProperty("statements");
      // console.log(results.statements.length);
      const ids: Array<string | undefined> = [];
      results.statements.forEach(function (stmt: Statement) {
        ids.push(stmt.id);
      });
      // console.log(ids);
      expect(ids).toContain(statementRefId);
      expect(ids).toContain(voidingId);
      expect(ids).not.toContain(voidedId);
    });

    // reworded the test to be more generic, shouldn't have to stay in here
    it('should only return statements stored at or before designated "before" timestamp when using "until" parameter', async function () {
      let query = helper.getUrlEncoding({
        verb: verb,
        until: untilVoidingTime,
      });
      const res = await endAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({}))
          .expect(200),
      );

      try {
        const results = parseBody<StatementResult>(helper, res.body);
        expect(results).toHaveProperty("statements");
        const ids: Array<string | undefined> = [];
        results.statements.forEach(function (stmt: Statement) {
          ids.push(stmt.id);
        });
        expect(ids).toContain(statementRefId);
        expect(ids).toContain(voidingId);
        expect(ids).not.toContain(voidedId);
      } catch (e) {
        if (e instanceof Error) {
          if (e.message.length > 400) {
            e.message = "expected results to have property 'statements' containing " + voidingId;
          }
          throw e;
        }
        throw e;
      }
    });

    // reworded the test to be more generic, shouldn't have to stay in here
    it('should return the number of statements listed in "limit" parameter', async function () {
      // console.log(new Date(Date.now() - helper.getTimeMargin()).toISOString() + ' Limit');
      let query = helper.getUrlEncoding({
        verb: verb,
        limit: 1,
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const results = parseBody<StatementResult>(helper, res.body);
      expect(results).toHaveProperty("statements");
      expect(results.statements).toHaveLength(1);
      expect(results.statements[0]).toHaveProperty("id");
      expect(results.statements[0]?.id).toEqual(statementRefId);
    });

    // i think this can be removed
    it('should return StatementRef and voiding statement when not using "since", "until", "limit"', async function () {
      // console.log(new Date(Date.now() - helper.getTimeMargin()).toISOString() + ' None');
      let query = helper.getUrlEncoding({
        verb: verb,
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const results = parseBody<StatementResult>(helper, res.body);
      expect(results).toHaveProperty("statements");
      expect(results.statements).toHaveLength(2);
      expect(results.statements[0]).toHaveProperty("id");
      expect(results.statements[0]?.id).toEqual(statementRefId);
      expect(results.statements[1]).toHaveProperty("id");
      expect(results.statements[1]?.id).toEqual(voidingId);
      // let pt = new Date(prevStmtTime - helper.getTimeMargin()).toISOString();
      // let st = new Date(stmtTime - helper.getTimeMargin()).toISOString();
      // console.log(sinceVoidingTime +'\n'+ pt +'\n'+ st +'\n'+ untilVoidingTime);
    });
  });

  /**  XAPI-00164, Communication 2.1.3 GET Statements
   * The Statements within the "statements" property will correspond to the filtering criterion sent in with the GET request
   */
  describe('The Statements within the "statements" property will correspond to the filtering criterion sent in with the GET request (Communication 2.1.3.s1, XAPI-00164)', function () {
    let statement: Statement, substatement: Statement, stmtTime: number;
    beforeAll(async function () {
      let templates = [
        { statement: "{{statements.context}}" },
        { context: "{{contexts.category}}" },
        {
          instructor: {
            objectType: "Agent",
            name: "xAPI mbox",
            mbox: "mailto:pri@adlnet.gov",
          },
        },
      ];
      let data = helper.createFromTemplate(templates) as { statement: Statement };
      statement = data.statement;

      //randomize data to prevent old results from breaking assertion logic
      requireStatementCategory(statement, "filtering randomize category").id += helper.generateUUID();
      statement.verb.id += helper.generateUUID();
      statement.actor.mbox = "mailto:" + helper.generateUUID() + "@adlnet.gov";
      requireStatementContext(statement, "filtering randomize registration").registration = helper.generateUUID();
      const instructor = requireStatementInstructor(statement, "filtering randomize instructor");
      if (!instructor.mbox) {
        throw new Error("filtering randomize instructor must include mbox");
      }
      instructor.mbox = "mailto:" + helper.generateUUID() + "@adlnet.gov";
      requireObjectWithId(statement.object, "filtering randomize activity object").id += helper.generateUUID();

      requireStatementCategory(statement, "filtering set category").id =
        "http://www.example.com/test/array/statements/pri";

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(statement),
        200,
      );
    });

    beforeAll(async function () {
      let templates = [
        { statement: "{{statements.object_substatement}}" },
        { object: "{{substatements.context}}" },
        { context: "{{contexts.category}}" },
        {
          instructor: {
            objectType: "Agent",
            name: "xAPI mbox",
            mbox: "mailto:sub@adlnet.gov",
          },
        },
      ];
      let data = helper.createFromTemplate(templates) as { statement: Statement };
      substatement = data.statement;

      //randomize data to prevent old results from breaking assertion logic
      substatement.verb.id += helper.generateUUID();
      substatement.actor.mbox = "mailto:" + helper.generateUUID() + "@adlnet.gov";

      const nestedSubstatement = requireV103SubStatementObject(substatement.object, "filtering substatement randomize");
      nestedSubstatement.verb.id += helper.generateUUID();
      nestedSubstatement.actor.mbox = "mailto:" + helper.generateUUID() + "@adlnet.gov";
      requireV103ActivityObject(nestedSubstatement.object, "filtering substatement randomize activity").id +=
        helper.generateUUID();

      requireSubStatementCategory(substatement.object, "filtering substatement set category").id =
        "http://www.example.com/test/array/statements/sub";
      stmtTime = Date.now();
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(substatement),
        200,
      );
    });

    it('should return StatementResult with statements as array using GET with "agent"', async function () {
      let templates = [{ agent: statement.actor }];
      let data = helper.createFromTemplate(templates);

      let query = helper.getUrlEncoding(data);
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let result = helper.parse(res.body as string, () => undefined) as Record<string, unknown>;
      const statements = result.statements as Array<{ actor?: { mbox?: string } }>;
      expect(statements.every((statementItem) => statementItem.actor?.mbox === statement.actor.mbox)).toBe(true);
    });

    it('should return StatementResult with statements as array using GET with "verb"', async function () {
      let query = helper.getUrlEncoding({ verb: statement.verb.id });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let result = helper.parse(res.body as string, () => undefined) as Record<string, unknown>;
      const statements = result.statements as Array<{ verb?: { id?: string } }>;
      expect(statements.every((statementItem) => statementItem.verb?.id === statement.verb.id)).toBe(true);
    });

    it('should return StatementResult with statements as array using GET with "activity"', async function () {
      let query = helper.getUrlEncoding({
        activity: requireObjectWithId(statement.object, "filtering activity query").id,
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let result = helper.parse(res.body as string, () => undefined) as Record<string, unknown>;
      const statements = result.statements as Array<{ object?: { id?: string } }>;
      expect(
        statements.every(
          (statementItem) =>
            statementItem.object?.id === requireObjectWithId(statement.object, "filtering activity compare").id,
        ),
      ).toBe(true);
    });

    it('should return StatementResult with statements as array using GET with "registration"', async function () {
      let query = helper.getUrlEncoding({
        registration: requireStatementRegistration(statement, "filtering registration query"),
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let result = helper.parse(res.body as string, () => undefined) as Record<string, unknown>;
      const statements = result.statements as Array<{ context?: { registration?: string } }>;
      expect(
        statements.every(
          (statementItem) =>
            statementItem.context?.registration ===
            requireStatementRegistration(statement, "filtering registration compare"),
        ),
      ).toBe(true);
    });

    it('should return StatementResult with statements as array using GET with "related_activities"', async function () {
      let query = helper.getUrlEncoding({
        activity: requireStatementCategory(statement, "filtering related_activities query").id,
        related_activities: true,
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
      expect(
        result.statements.every((s: Statement) =>
          helper.deepSearchObject(s, requireStatementCategory(statement, "filtering related_activities compare").id),
        ),
      ).toBe(true);
    });

    it('should return StatementResult with statements as array using GET with "related_agents"', async function () {
      let query = helper.getUrlEncoding({
        agent: requireStatementInstructor(statement, "filtering related_agents query"),
        related_agents: true,
      });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
      expect(
        result.statements.every((s: Statement) =>
          helper.deepSearchObject(s, requireStatementInstructor(statement, "filtering related_agents compare").mbox),
        ),
      ).toBe(true);
    });

    it('should return StatementResult with statements as array using GET with "since"', async function () {
      let query = helper.getUrlEncoding({ since: "2012-06-01T19:09:13.245Z" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
      expect(
        result.statements.every((s: Statement) => new Date(s.stored ?? 0) >= new Date("2012-06-01T19:09:13.245Z")),
      ).toBe(true);
    });

    it('should return StatementResult with statements as array using GET with "until"', async function () {
      let query = helper.getUrlEncoding({ until: "2012-06-01T19:09:13.245Z" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
      expect(
        result.statements.every((s: Statement) => new Date(s.stored ?? 0) <= new Date("2012-06-01T19:09:13.245Z")),
      ).toBe(true);
    });

    it('should return StatementResult with statements as array using GET with "limit"', async function () {
      let query = helper.getUrlEncoding({ limit: 1 });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
      expect(result.statements).toHaveLength(1);
    });

    it('should return StatementResult with statements as array using GET with "ascending"', async function () {
      let query = helper.getUrlEncoding({ ascending: true });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      const result = parseBody<StatementResult>(helper, res.body);
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
      expect(
        result.statements.every(
          (s: Statement, i: number, arr: Statement[]) =>
            i === arr.length - 1 || new Date(s.stored ?? 0) <= new Date(arr[i + 1]?.stored ?? 0),
        ),
      ).toBe(true);
    });

    //I think there is another test that covers the formatting requirements
    it('should return StatementResult with statements as array using GET with "format"', async function () {
      let query = helper.getUrlEncoding({ format: "ids" });
      const res = await expectAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({})),
        200,
      );

      let result = helper.parse(res.body as string, () => undefined) as Record<string, unknown>;
      expect(result).toHaveProperty("statements");
      expect(Array.isArray(result.statements)).toBe(true);
    });

    it('should return StatementResult with statements as array using GET with "attachments"', async function () {
      let header = { "Content-Type": "multipart/mixed; boundary=-------314159265358979323846" };
      let templates = [
        { statement: "{{statements.attachment}}" },
        {
          attachments: [
            {
              usageType: "http://example.com/attachment-usage/test",
              display: { "en-US": "A test attachment" },
              description: { "en-US": "A test attachment (description)" },
              contentType: "text/plain",
              length: 0,
              sha2: "",
              fileUrl: "http://over.there.com/file.txt",
            },
          ],
        },
      ];
      data = createStatement(helper, templates);

      txtAtt1 = fs.readFileSync("test/v1_0_3/templates/attachments/simple_text1.txt");
      let t1stats = fs.statSync("test/v1_0_3/templates/attachments/simple_text1.txt");
      t1attSize = t1stats.size;
      t1attHash = crypto.createHash("SHA256").update(txtAtt1).digest("hex");

      const attachments = data.attachments ?? [];
      const firstAttachment = attachments[0];
      if (!firstAttachment) {
        throw new Error("Expected one attachment in attachment template data");
      }
      firstAttachment.length = t1attSize;
      firstAttachment.sha2 = t1attHash;

      let dashes = "--";
      let crlf = "\r\n";
      let boundary = "-------314159265358979323846";

      let msg = dashes + boundary + crlf;
      msg += "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += dashes + boundary + crlf;
      msg += "Content-Type: text/plain" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg += "X-Experience-API-Hash: " + firstAttachment.sha2 + crlf + crlf;
      msg += txtAtt1 + crlf;
      msg += dashes + boundary + dashes + crlf;

      let query = helper.getUrlEncoding({ attachments: true });
      let stmtTime = Date.now();

      await endAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg)
          .expect(200),
      );

      const res = await endAsync(
        request(helper.getEndpointAndAuth())
          .get(helper.getEndpointStatements() + "?" + query)
          .wait(helper.genDelay(stmtTime, "?" + query, undefined))
          .headers(helper.addAllHeaders({}))
          .expect(200),
      );

      const responseBoundary = multipartParser.getBoundary(res.headers["content-type"] as string);
      expect(responseBoundary).toBeTruthy();
      let parsed = multipartParser.parseMultipart(responseBoundary as string, res.body as string);
      expect(parsed).toBeTruthy();
      const firstPart = parsed[0];
      if (!firstPart) {
        throw new Error("Expected at least one multipart section.");
      }
      const results = parseBody<StatementResult>(helper, firstPart.body);
      expect(results).toHaveProperty("statements");
    });
  });
});
