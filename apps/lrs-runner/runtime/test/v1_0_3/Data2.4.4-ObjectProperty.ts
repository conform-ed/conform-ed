/**
 * Description : This is a test suite that tests an LRS endpoint based on the testing requirements document
 * found at https://github.com/adlnet/xapi-lrs-conformance-requirements
 */

import helperImport from "../helper.ts";
import requestBase from "../super-request.ts";
import { expectAsync } from "../super-request.ts";
import templatingSelectionImport from "../templatingSelection.ts";
import type { Statement } from "@conform-ed/contracts/xapi/v1_0_3";

import { describe, it } from "../bun-test.ts";
import { createStatement } from "../typing-helpers.ts";
import type { RuntimeHelper, RuntimeRequestFactory, RuntimeTemplatingSelection } from "../harness-types.ts";
const helper = helperImport as RuntimeHelper;
const templatingSelection = templatingSelectionImport as RuntimeTemplatingSelection;
let request: RuntimeRequestFactory = requestBase;

if (process.env["OAUTH1_ENABLED"] === "true") request = helper.OAuthRequest(request);

describe("Object Property Requirements (Data 2.4.4)", () => {
  let correctResponsesPattern: Statement,
    choice: Statement,
    fillin: Statement,
    scale: Statement,
    source: Statement,
    target: Statement,
    numeric: Statement,
    other: Statement,
    steps: Statement,
    seq: Statement,
    tf: Statement;

  //Data 2.4.4 object
  /**  Matchup with Conformance Requirements Document
   * XAPI-00046 - in objects.js
   */
  templatingSelection.createTemplate("objects.ts");

  //Data 2.4.4.1 when objectType is activity
  /**  Matchup with Conformance Requirements Document
   * XAPI-00047 - in activities.js
   * XAPI-00048 - in activities.js
   * XAPI-00049 - in activities.js
   * XAPI-00050 - in activities.js
   * XAPI-00051 - in activities.js
   * XAPI-00052 - in activities.js
   * XAPI-00053 - in activities.js
   * XAPI-00054 - in activities.js
   * XAPI-00055 - in activities.js
   * XAPI-00056 - in activities.js
   * XAPI-00057 - in activities.js
   * XAPI-00058 - in activities.js
   * XAPI-00059 - in activities.js
   * XAPI-00060 - in activities.js
   * XAPI-00061 - in activities.js
   * XAPI-00062 - in activities.js
   * XAPI-00063 - in activities.js
   * XAPI-00064 - below
   */
  templatingSelection.createTemplate("activities.ts");

  /**  XAPI-00064, Data 2.4.4.1 when objectType is activity
   * An Activity Definition uses the "interactionType" property if correctResponsesPattern is present. An LRS rejects a statement with 400 Bad Request if a correctResponsePattern is present and interactionType is not.
   */
  describe('An Activity Definition uses the "interactionType" property if any of the correctResponsesPattern, choices, scale, source, target, or steps properties are used (Multiplicity, Data 2.4.4.1.s8, XAPI-00064) **Implicit**', () => {
    it('Activity Definition uses correctResponsesPattern without "interactionType" property', async () => {
      let correctResponsesPatterntemplates = [
        { statement: "{{statements.default}}" },
        { object: "{{activities.other}}" },
      ];
      correctResponsesPattern = createStatement(helper, correctResponsesPatterntemplates);
      delete ((correctResponsesPattern.object as Record<string, unknown>)["definition"] as Record<string, unknown>)[
        "interactionType"
      ];
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(correctResponsesPattern),
        400,
      );
    });

    it('Activity Definition uses choices without "interactionType" property', async () => {
      let choicetemplates = [{ statement: "{{statements.default}}" }, { object: "{{activities.choice}}" }];
      choice = createStatement(helper, choicetemplates);
      delete ((choice.object as Record<string, unknown>)["definition"] as Record<string, unknown>)["interactionType"];
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(choice),
        400,
      );
    });

    it('Activity Definition uses fill-in without "interactionType" property', async () => {
      let fillintemplates = [{ statement: "{{statements.default}}" }, { object: "{{activities.fill_in}}" }];
      fillin = createStatement(helper, fillintemplates);
      delete ((fillin.object as Record<string, unknown>)["definition"] as Record<string, unknown>)["interactionType"];
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(fillin),
        400,
      );
    });

    it('Activity Definition uses scale without "interactionType" property', async () => {
      let scaletemplates = [{ statement: "{{statements.default}}" }, { object: "{{activities.likert}}" }];
      scale = createStatement(helper, scaletemplates);
      delete ((scale.object as Record<string, unknown>)["definition"] as Record<string, unknown>)["interactionType"];
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(scale),
        400,
      );
    });

    it('Activity Definition uses long-fill-in without "interactionType" property', async () => {
      let fillintemplates = [{ statement: "{{statements.default}}" }, { object: "{{activities.long_fill_in}}" }];
      fillin = createStatement(helper, fillintemplates);
      delete ((fillin.object as Record<string, unknown>)["definition"] as Record<string, unknown>)["interactionType"];
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(fillin),
        400,
      );
    });

    it('Activity Definition uses source without "interactionType" property', async () => {
      let sourcetemplates = [{ statement: "{{statements.default}}" }, { object: "{{activities.matching}}" }];
      source = createStatement(helper, sourcetemplates);
      delete ((source.object as Record<string, unknown>)["definition"] as Record<string, unknown>)["interactionType"];
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(source),
        400,
      );
    });

    it('Activity Definition uses target without "interactionType" property', async () => {
      let targettemplates = [{ statement: "{{statements.default}}" }, { object: "{{activities.matching_target}}" }];
      target = createStatement(helper, targettemplates);
      delete ((target.object as Record<string, unknown>)["definition"] as Record<string, unknown>)["interactionType"];
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(target),
        400,
      );
    });

    it('Activity Definition uses numeric without "interactionType" property', async () => {
      let numerictemplates = [{ statement: "{{statements.default}}" }, { object: "{{activities.numeric}}" }];
      numeric = createStatement(helper, numerictemplates);
      delete ((numeric.object as Record<string, unknown>)["definition"] as Record<string, unknown>)["interactionType"];
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(numeric),
        400,
      );
    });

    it('Activity Definition uses other without "interactionType" property', async () => {
      let othertemplates = [{ statement: "{{statements.default}}" }, { object: "{{activities.other}}" }];
      other = createStatement(helper, othertemplates);
      delete ((other.object as Record<string, unknown>)["definition"] as Record<string, unknown>)["interactionType"];
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(other),
        400,
      );
    });

    it('Activity Definition uses performance without "interactionType" property', async () => {
      let stepstemplates = [{ statement: "{{statements.default}}" }, { object: "{{activities.performance}}" }];
      steps = createStatement(helper, stepstemplates);
      delete ((steps.object as Record<string, unknown>)["definition"] as Record<string, unknown>)["interactionType"];
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(steps),
        400,
      );
    });

    it('Activity Definition uses sequencing without "interactionType" property', async () => {
      let seqtemplates = [{ statement: "{{statements.default}}" }, { object: "{{activities.sequencing}}" }];
      seq = createStatement(helper, seqtemplates);
      delete ((seq.object as Record<string, unknown>)["definition"] as Record<string, unknown>)["interactionType"];
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(seq),
        400,
      );
    });

    it('Activity Definition uses true-false without "interactionType" property', async () => {
      let tftemplates = [{ statement: "{{statements.default}}" }, { object: "{{activities.true_false}}" }];
      tf = createStatement(helper, tftemplates);
      delete ((tf.object as Record<string, unknown>)["definition"] as Record<string, unknown>)["interactionType"];
      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(tf),
        400,
      );
    });
  });

  //Data 2.4.4.2 - when the object is an agent or a group
  /**  Matchup with Conformance Requirements Document
   * XAPI-00065 - below
   */

  /** XAPI-00065, Data 2.4.4.2 when the object is an agent or a group
   * Statements that use an Agent or Group as an Object MUST specify an "objectType" property. The LRS rejects with 400 Bad Request if the “objectType” property is absent and the Object is an Agent Object or Group Object.
   */
  describe('Statements that use an Agent or Group as an Object MUST specify an "objectType" property. (Data 2.4.4.2.s1.b1, XAPI-00065)', () => {
    it("should fail when using agent as object and no objectType", async () => {
      let templates = [{ statement: "{{statements.object_agent_default}}" }];
      let data = helper.createFromTemplate(templates).statement as { object: Record<string, unknown> };
      delete data.object.objectType;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        400,
      );
    });

    it("should fail when using group as object and no objectType", async () => {
      let templates = [{ statement: "{{statements.object_group_default}}" }];
      let data = helper.createFromTemplate(templates).statement as { object: Record<string, unknown> };
      delete data.object.objectType;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        400,
      );
    });

    it("substatement should fail when using agent as object and no objectType", async () => {
      let templates = [
        { statement: "{{statements.object_substatement}}" },
        { object: "{{statements.object_agent_default}}" },
      ];
      let data = helper.createFromTemplate(templates).statement as { object: Record<string, unknown> };
      delete data.object.objectType;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        400,
      );
    });

    it("substatement should fail when using group as object and no objectType", async () => {
      let templates = [
        { statement: "{{statements.object_substatement}}" },
        { object: "{{statements.object_group_default}}" },
      ];
      let data = helper.createFromTemplate(templates).statement as { object: Record<string, unknown> };
      delete data.object.objectType;

      await expectAsync(
        request(helper.getEndpointAndAuth())
          .post(helper.getEndpointStatements())
          .headers(helper.addAllHeaders({}))
          .json(data),
        400,
      );
    });
  });

  //Data 2.4.4.3 - when the object is a statement
  /** Matchup with Conformance Requirements Document
   * XAPI-00066 - in substatements.js
   * XAPI-00067 - in substatements.js
   * XAPI-00068 - in substatements.js
   * XAPI-00069 - in substatements.js
   * XAPI-00070 - in substatements.js
   * XAPI-00071 - in substatements.js
   * XAPI-00072 - in statementrefs.js
   * XAPI-00073 - in statementrefs.js
   */
  templatingSelection.createTemplate("substatements.ts");
  templatingSelection.createTemplate("statementrefs.ts");
});
