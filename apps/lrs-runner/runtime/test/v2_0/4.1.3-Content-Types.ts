/**
 * Description : This is a test suite that tests an LRS endpoint based on the testing requirements document
 * found at https://github.com/adlnet/xapi-lrs-conformance-requirements
 */

import crypto from "crypto";
import fs from "fs";
import requestModule from "../super-request.ts";
import { expectAsync } from "../super-request.ts";

import helperModule from "../helper.ts";

import { beforeAll, describe, it } from "../bun-test.ts";
import { requireAttachment } from "../typing-helpers.ts";
import { createStatementV2 } from "../typing-helpers.ts";
import type { StatementV2 } from "@conform-ed/contracts/xapi/v2_0";

type AttachmentRecord = {
  contentType?: string;
  fileUrl?: string;
  length?: number;
  sha2?: string;
  [key: string]: unknown;
};

type ContentTypeStatement = {
  attachments?: AttachmentRecord[];
  [key: string]: unknown;
};

type ContentTypesHelper = {
  OAuthRequest(request: typeof requestModule): typeof requestModule;
  addAllHeaders(headers?: Record<string, string | undefined>): Record<string, string | undefined>;
  createFromTemplate(templates: Array<Record<string, unknown>>): { statement: ContentTypeStatement };
  getEndpointAndAuth(): string;
  getEndpointStatements(): string;
};

let request = requestModule;
const helper = helperModule as unknown as ContentTypesHelper;

if (process.env["OAUTH1_ENABLED"] === "true") request = helper.OAuthRequest(request);

describe("Content Type Requirements (Communication 1.5)", () => {
  let data: Record<string, unknown>;
  let txtAtt1: Buffer,
    txtAtt2: Buffer,
    txtAtt3: Buffer,
    t1attSize: number,
    t2attSize: number,
    t1attHash: string,
    t2attHash: string,
    t3attHash: string;

  beforeAll(() => {
    txtAtt1 = fs.readFileSync("test/v1_0_3/templates/attachments/simple_text1.txt");
    txtAtt2 = fs.readFileSync("test/v1_0_3/templates/attachments/simple_text2.txt");
    txtAtt3 = fs.readFileSync("test/v1_0_3/templates/attachments/simple_text3.txt");

    let t1stats = fs.statSync("test/v1_0_3/templates/attachments/simple_text1.txt");
    let t2stats = fs.statSync("test/v1_0_3/templates/attachments/simple_text2.txt");
    t1attSize = t1stats.size;
    t2attSize = t2stats.size;
    t1attHash = crypto.createHash("SHA256").update(txtAtt1).digest("hex");
    t2attHash = crypto.createHash("SHA256").update(txtAtt2).digest("hex");
    t3attHash = crypto.createHash("SHA256").update(txtAtt3).digest("hex");
  });

  //Communication 1.5.1
  /**  Matchup with Conformance Requirements Document
   * XAPI-00127 - below
   * XAPI-00128 - below
   * XAPI-00129 - below
   */

  //Communication 1.5.2
  /**
   * XAPI-00130 - below
   * XAPI-00131 - below
   * XAPI-00132 - below
   * XAPI-00133 - below
   * XAPI-00134 - below
   * XAPI-00135 - below
   * there is no XAPI-00136
   * XAPI-00137 - removed
   * XAPI-00138 - removed
   */

  /**  XAPI-00127, Communication 1.5.1 Application/JSON
   * An LRS rejects with error code 400 Bad Request, a PUT or POST Request which does not have a "Content-Type" header with value "application/json" or "multipart/mixed"
   */
  describe('An LRS rejects with error code 400 Bad Request, a Request which uses Attachments and does not have a "Content-Type" header with value "application/json" or "multipart/mixed" (Format, Data 2.4.11, XAPI-00127)', () => {
    let data: StatementV2;
    let pictureAtt: string;
    let pattSize: number;
    let pattHash: string;
    let templates: Array<Record<string, unknown>>;

    beforeAll(() => {
      templates = [
        { statement: "{{statements.attachment}}" },
        {
          attachments: [
            {
              usageType: "http://example.com/attachment-usage/test",
              display: { "en-US": "A test attachment" },
              description: { "en-US": "A test attachment (description)" },
              contentType: "text/plain; charset=ascii",
              length: 27,
              sha2: "495395e777cd98da653df9615d09c0fd6bb2f8d4788394cd53c56a3bfdcd848a",
              fileUrl: "http://over.there.com/file.txt",
            },
          ],
        },
      ];
      data = createStatementV2(helper, templates);

      pictureAtt = fs.readFileSync("test/v1_0_3/templates/attachments/basic_image_p2.jpeg", { encoding: "hex" });
      let pstats = fs.statSync("test/v1_0_3/templates/attachments/basic_image_p2.jpeg");
      pattSize = pstats.size;
      pattHash = crypto.createHash("SHA256").update(pictureAtt).digest("hex");
    });

    it('should succeed when attachment uses "fileUrl" and request content-type is "application/json"', async () => {
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        200,
      );
    });

    it('should succeed when attachment uses "fileUrl" and request content-type is "application/json"', async () => {
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        200,
      );
    });

    it('should fail when attachment uses "fileUrl" and request content-type is "multipart/form-data"', async () => {
      let header = { "Content-Type": "multipart/form-data; boundary=-------314159265358979323846" };

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(JSON.stringify(data)),
        400,
      );
    });

    it('should succeed when attachment is raw data and request content-type is "multipart/mixed"', async () => {
      let header = { "Content-Type": "multipart/mixed; boundary=-------314159265358979323846" };

      const attachment = requireAttachment(data);
      delete attachment.fileUrl;
      attachment.contentType = "image/jpeg";
      attachment.length = pattSize;
      attachment.sha2 = pattHash;
      let dashes = "--";
      let crlf = "\r\n";
      let boundary = "-------314159265358979323846";

      let msg = dashes + boundary + crlf;
      msg += "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += dashes + boundary + crlf;
      msg += "Content-Type: image/jpeg" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg += "X-Experience-API-Hash: " + attachment.sha2 + crlf + crlf;
      msg += pictureAtt + crlf;
      msg += dashes + boundary + dashes + crlf;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        200,
      );
    });

    it('should fail when attachment is raw data and request content-type is "multipart/form-data"', async () => {
      let header = { "Content-Type": "multipart/form-data; boundary=-------314159265358979323846" };

      const attachment = requireAttachment(data);
      delete attachment.fileUrl;
      attachment.contentType = "image/jpeg";
      attachment.length = pattSize;
      attachment.sha2 = pattHash;

      let dashes = "--";
      let crlf = "\r\n";
      let boundary = "-------314159265358979323846";

      let msg = dashes + boundary + crlf;
      msg += "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += dashes + boundary + crlf;
      msg += "Content-Type: image/jpeg" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg += "X-Experience-API-Hash: " + attachment.sha2 + crlf + crlf;
      msg += pictureAtt + crlf;
      msg += dashes + boundary + dashes + crlf;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        400,
      );
    });

    it('should succeed when attachment uses "fileUrl" and request content-type is "multipart/mixed"', async () => {
      let boundary = "-------314159265358979323846";
      let header = { "Content-Type": "multipart/mixed; boundary=" + boundary };

      let data = helper.createFromTemplate(templates);
      let statement = data.statement;

      let dashes = "--";
      let crlf = "\r\n";

      let msg = dashes + boundary + crlf;
      msg += "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(statement) + crlf;
      msg += dashes + boundary + dashes + crlf;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        200,
      );
    });

    it('should succeed when no attachments are included, but request content-type is "multipart/mixed"', async () => {
      let boundary = "-------314159265358979323846";
      let header = { "Content-Type": "multipart/mixed; boundary=" + boundary };

      delete (data as Record<string, unknown>)["attachments"];

      let dashes = "--";
      let crlf = "\r\n";

      let msg = dashes + boundary + crlf;
      msg += "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += dashes + boundary + dashes + crlf;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        200,
      );
    });
  });

  /**  XAPI-00128, Communication 1.5.1 Application/JSON
   * An LRS rejects with error code 400 Bad Request, a PUT or POST Request which has excess multi-part sections that are not attachments.
   */
  describe("An LRS rejects with error code 400 Bad Request, a PUT or POST Request which has excess multi-part sections that are not attachments. (Communication 1.5.1.s1.b2, Data 2.4.11, XAPI-00128)", () => {
    it("should fail when passing statement attachments with excess multipart sections", async () => {
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
              length: 27,
              sha2: "",
            },
            {
              usageType: "http://example.com/attachment-usage/test",
              display: { "en-US": "A test attachment" },
              description: { "en-US": "A test attachment (description)" },
              contentType: "text/plain",
              length: 33,
              sha2: "",
            },
          ],
        },
      ];
      data = createStatementV2(helper, templates);

      const attachment = requireAttachment(data);
      attachment.length = t1attSize;
      attachment.sha2 = t1attHash;
      const secondAttachment = requireAttachment(data, 1);
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
      msg += "X-Experience-API-Hash: " + attachment.sha2 + crlf + crlf;
      msg += txtAtt1 + crlf;

      msg += dashes + boundary + crlf;
      msg += "Content-Type: text/plain" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg += "X-Experience-API-Hash: " + secondAttachment.sha2 + crlf + crlf;
      msg += txtAtt2 + crlf;

      msg += dashes + boundary + crlf;
      msg += "Content-Type: text/plain" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg += "X-Experience-API-Hash: " + t3attHash + crlf + crlf;
      msg += txtAtt3 + crlf;

      msg += dashes + boundary + dashes + crlf;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        400,
      );
    });
  });

  /**  XAPI-00129, Communication 1.5.1 Application/JSON
   * An LRS rejects with error code 400 Bad Request, a PUT or POST Request which is missing multi-part sections for non-fileURL attachments must be rejected.
   */
  describe('An LRS rejects with error code 400 Bad Request, a PUT or POST Request which uses Attachments, has a "Content-Type" header with value "application/json", and has a discrepancy in the number of Attachments vs. the number of fileURL members (Communication 1.5.1.s1.b2, Data 2.4.11, XAPI-00129)', () => {
    it('should fail when passing statement attachments and missing attachment"s binary', async () => {
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
              length: 27,
              sha2: "",
            },
            {
              usageType: "http://example.com/attachment-usage/test",
              display: { "en-US": "A test attachment" },
              description: { "en-US": "A test attachment (description)" },
              contentType: "text/plain",
              length: 33,
              sha2: "",
            },
          ],
        },
      ];
      data = createStatementV2(helper, templates);

      const attachment = requireAttachment(data);
      attachment.length = t1attSize;
      attachment.sha2 = t1attHash;
      const secondAttachment = requireAttachment(data, 1);
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
      msg += "X-Experience-API-Hash: " + attachment.sha2 + crlf + crlf;
      msg += txtAtt1 + crlf;
      msg += dashes + boundary + dashes + crlf;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        400,
      );
    });
  });

  /**  XAPI-00131, Communication 1.5.2 Multipart/Mixed
   * An LRS rejects with error code 400 Bad Request, a PUT or POST Request which uses Attachments, has a "Content Type" header with value "multipart/mixed", and does not have a body header named "boundary"
   */
  describe('An LRS rejects with error code 400 Bad Request, a PUT or POST Request which uses Attachments, has a "Content Type" header with value "multipart/mixed", and does not have a body header named "boundary" (Communication 1.5.2.s2.b2, Data 2.4.11, RFC 2046, XAPI-00131)', () => {
    it("should fail if boundary not provided in body", async () => {
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
              length: 27,
              sha2: "",
            },
          ],
        },
      ];
      data = createStatementV2(helper, templates);

      const attachment = requireAttachment(data);
      attachment.length = t1attSize;
      attachment.sha2 = t1attHash;

      let dashes = "--";
      let crlf = "\r\n";
      let boundary = "-------314159265358979323846";

      let msg = "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += dashes + boundary + crlf;
      msg += "Content-Type: text/plain" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg += "X-Experience-API-Hash: " + attachment.sha2 + crlf + crlf;
      msg += txtAtt1 + crlf;
      msg += dashes + boundary + dashes + crlf;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        400,
      );
    });
  });

  /**  XAPI-00130, Communication 1.5.2 Multipart/Mixed
   * An LRS rejects with error code 400 Bad Request, a PUT or POST Request which uses Attachments, has a "Content Type" header with value "multipart/mixed", and does not have a Boundary before each "Content-Type" header
   */
  describe('An LRS rejects with error code 400 Bad Request, a PUT or POST Request which uses Attachments, has a "Content Type" header with value "multipart/mixed", and does not have a Boundary before each "Content-Type" header (Communication 1.5.2.s2.b2, Data 2.4.11, RFC 2046, XAPI-00130)', () => {
    it("should fail if boundary not provided in body", async () => {
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
              length: 27,
              sha2: "",
            },
          ],
        },
      ];
      data = createStatementV2(helper, templates);

      const attachment = requireAttachment(data);
      attachment.length = t1attSize;
      attachment.sha2 = t1attHash;

      let dashes = "--";
      let crlf = "\r\n";
      let boundary = "-------314159265358979323846";

      let msg = dashes + boundary + crlf;
      msg += "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += "Content-Type: text/plain" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg += "X-Experience-API-Hash: " + attachment.sha2 + crlf + crlf;
      msg += txtAtt1 + crlf;
      msg += dashes + boundary + dashes + crlf;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        400,
      );
    });

    it("should fail if boundary not provided in header", async () => {
      let header = { "Content-Type": "multipart/mixed;" };
      let templates = [
        { statement: "{{statements.attachment}}" },
        {
          attachments: [
            {
              usageType: "http://example.com/attachment-usage/test",
              display: { "en-US": "A test attachment" },
              description: { "en-US": "A test attachment (description)" },
              contentType: "text/plain",
              length: 27,
              sha2: "",
            },
          ],
        },
      ];
      data = createStatementV2(helper, templates);

      const attachment = requireAttachment(data);
      attachment.length = t1attSize;
      attachment.sha2 = t1attHash;

      let dashes = "--";
      let crlf = "\r\n";
      let boundary = "-------314159265358979323846";

      let msg = dashes + boundary + crlf;
      msg += "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += dashes + boundary + crlf;
      msg += "Content-Type: text/plain" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg += "X-Experience-API-Hash: " + attachment.sha2 + crlf + crlf;
      msg += txtAtt1 + crlf;
      msg += dashes + boundary + dashes + crlf;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        400,
      );
    });
  });

  /**  XAPI-00134, Communication 1.5.2 Multipart/Mixed
   * An LRS rejects with error code 400 Bad Request, a PUT or POST Request which uses Attachments, has a "Content Type" header with value "multipart/mixed", and does not the first document part with a "Content-Type" header with a value of "application/json"
   */
  describe('An LRS rejects with error code 400 Bad Request, a PUT or POST Request which uses Attachments, has a "Content Type" header with value "multipart/mixed", and does not the first document part with a "Content-Type" header with a value of "application/json" (RFC 2046, Communication 1.5.2.s2.b2.b1, Data 2.4.11, XAPI-00134)', () => {
    it('should fail when attachment is raw data and first part content type is not "application/json"', async () => {
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
              length: 27,
              sha2: "",
            },
          ],
        },
      ];
      data = createStatementV2(helper, templates);

      const attachment = requireAttachment(data);
      attachment.length = t1attSize;
      attachment.sha2 = t1attHash;

      let dashes = "--";
      let crlf = "\r\n";
      let boundary = "-------314159265358979323846";

      let msg = dashes + boundary + crlf;
      msg += "Content-Type: text/plain" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += dashes + boundary + crlf;
      msg += "Content-Type: text/plain" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg += "X-Experience-API-Hash: " + attachment.sha2 + crlf + crlf;
      msg += txtAtt1 + crlf;
      msg += dashes + boundary + dashes + crlf;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        400,
      );
    });
  });

  /**  XAPI-00133, Communication 1.5.2 Multipart/Mixed
   * An LRS rejects with error code 400 Bad Request, a PUT or POST Request which uses Attachments, has a "Content Type" header with value "multipart/mixed", and does not have all of the Statements in the first document part
   */
  describe('An LRS rejects with error code 400 Bad Request, a PUT or POST Request which uses Attachments, has a "Content Type" header with value "multipart/mixed", and does not have all of the Statements in the first document part (RFC 2046, Data 2.4.11, Communication 1.5.2.s2.b2.b1, XAPI-00133)', () => {
    it("should fail when statements separated into multiple parts", async () => {
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
              length: 27,
              sha2: "",
            },
          ],
        },
      ];
      data = createStatementV2(helper, templates);

      const attachment = requireAttachment(data);
      attachment.length = t1attSize;
      attachment.sha2 = t1attHash;

      let dashes = "--";
      let crlf = "\r\n";
      let boundary = "-------314159265358979323846";

      let msg = dashes + boundary + crlf;
      msg += "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += dashes + boundary + crlf;
      msg += "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += dashes + boundary + crlf;
      msg += "Content-Type: text/plain" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg += "X-Experience-API-Hash: " + attachment.sha2 + crlf + crlf;
      msg += txtAtt1 + crlf;
      msg += dashes + boundary + dashes + crlf;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        400,
      );
    });
  });

  /**  XAPI-00132, Communication 1.5.2 Multipart/Mixed
   * An LRS rejects with error code 400 Bad Request, a PUT or POST Request which uses Attachments, has a "Content Type" header with value "multipart/mixed", and for any part except the first does not have a Header named "X-Experience-API-Hash" with a value of one of those found in a "sha2" property of a Statement in the first part of this document
   */
  describe('An LRS rejects with error code 400 Bad Request, a PUT or POST Request which uses Attachments, has a "Content Type" header with value "multipart/mixed", and for any part except the first does not have a Header named "X-Experience-API-Hash" with a value of one of those found in a "sha2" property of a Statement in the first part of this document (Communication 1.5.2.s2.b2.b3", Communication 1.5.2.s1.b4, Data 2.4.11, XAPI-00132)', () => {
    it('should fail when attachments missing header "X-Experience-API-Hash"', async () => {
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
              length: 27,
              sha2: "",
            },
          ],
        },
      ];
      data = createStatementV2(helper, templates);

      const attachment = requireAttachment(data);
      attachment.length = t1attSize;
      attachment.sha2 = t1attHash;

      let dashes = "--";
      let crlf = "\r\n";
      let boundary = "-------314159265358979323846";

      let msg = dashes + boundary + crlf;
      msg += "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += dashes + boundary + crlf;
      msg += "Content-Type: text/plain" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf + crlf;
      msg += txtAtt1 + crlf;
      msg += dashes + boundary + dashes + crlf;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        400,
      );
    });

    it('should fail when attachments header "X-Experience-API-Hash" does not match "sha2"', async () => {
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
              length: 27,
              sha2: "",
            },
          ],
        },
      ];
      data = createStatementV2(helper, templates);

      const attachment = requireAttachment(data);
      attachment.length = t1attSize;
      attachment.sha2 = t1attHash;

      let dashes = "--";
      let crlf = "\r\n";
      let boundary = "-------314159265358979323846";

      let msg = dashes + boundary + crlf;
      msg += "Content-Type: application/json" + crlf + crlf;
      msg += JSON.stringify(data) + crlf;
      msg += dashes + boundary + crlf;
      msg += "Content-Type: text/plain" + crlf;
      msg += "Content-Transfer-Encoding: binary" + crlf;
      msg +=
        "X-Experience-API-Hash: " + "b018994f8bbe0f08992a65c48c8c8c56f09e9baceaa6227ed85c90ae52b73c89" + crlf + crlf;
      msg += txtAtt1 + crlf;
      msg += dashes + boundary + dashes + crlf;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders(header))
          .body(msg),
        400,
      );
    });
  });

  /**  XAPI-00135, Communication 1.5.2 Multipart/Mixed
   * An LRS rejects with error code 400 Bad Request, a PUT or POST Request which uses Attachments, has a "Content Type" header with value "multipart/mixed", and for any part except the first does not have a Header named "Content-Transfer-Encoding" with a value of "binary"
   */
  it('An LRS rejects with error code 400 Bad Request, a PUT or POST Request which uses Attachments, has a "Content Type" header with value "multipart/mixed", and for any part except the first does not have a Header named "Content-Transfer-Encoding" with a value of "binary" (Data 2.4.11, XAPI-00135)', async () => {
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
            length: 27,
            sha2: "",
          },
        ],
      },
    ];
    data = createStatementV2(helper, templates);

    const attachment = requireAttachment(data);
    attachment.length = t1attSize;
    attachment.sha2 = t1attHash;

    let dashes = "--";
    let crlf = "\r\n";
    let boundary = "-------314159265358979323846";

    let msg = dashes + boundary + crlf;
    msg += "Content-Type: application/json" + crlf + crlf;
    msg += JSON.stringify(data) + crlf;
    msg += dashes + boundary + crlf;
    msg += "Content-Type: text/plain" + crlf;
    msg += "Content-Transfer-Encoding: base64" + crlf;
    msg += "X-Experience-API-Hash: " + attachment.sha2 + crlf + crlf;
    msg += txtAtt1 + crlf;
    msg += dashes + boundary + dashes + crlf;

    await expectAsync(
      request(helper.getEndpointAndAuth())
        .post(helper.getEndpointStatements())
        .headers(helper.addAllHeaders(header))
        .body(msg),
      400,
    );
  });
});
