import { describe, expect, test } from "bun:test";
import { GraphDatabase } from "../graph";
import { IS_A_TYPE } from "../labels";
import { typeTableMarkerProperties } from "../node-capabilities";
import { loadSchemaFromContent } from "./load";
import { relationshipRuleContextForType, resolveRelationshipRule } from "./resolve";
import { parseSchemaFile } from "./schema-file";
import { resolveContentPath } from "../content/paths";

describe("schema rules", () => {
  test("parseSchemaFile validates relationship rules", () => {
    const file = parseSchemaFile(
      JSON.stringify({
        version: 1,
        relationshipRules: [
          {
            id: "test",
            sourceTypeId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            label: "features",
            allowedTargetTypeIds: ["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
          },
        ],
      }),
    );
    expect(file.relationshipRules[0]?.type).toBe("features");
  });

  test("resolveRelationshipRule matches source type membership", () => {
    const db = new GraphDatabase(":memory:", { clean: true });
    const scenesType = "204dba198db74611b0b49a98dd53e8f5";
    const featuresType = "dd0de9867cc345b898929306bdf9fc83";
    const scene = "cccccccccccccccccccccccccccccccc";

    db.upsertNode(scenesType, typeTableMarkerProperties("Scenes"));
    db.upsertNode(featuresType, typeTableMarkerProperties("Features"));
    db.upsertNode(scene, { title: "Test scene" });
    db.upsertRelationship(scene, scenesType, IS_A_TYPE, {});

    const schema = parseSchemaFile(
      JSON.stringify({
        version: 1,
        relationshipRules: [
          {
            id: "scene-features",
            sourceTypeId: scenesType,
            type: "features",
            allowedTargetTypeIds: [featuresType],
          },
        ],
      }),
    );

    const rule = resolveRelationshipRule(schema, db, scene, "features");
    expect(rule?.id).toBe("scene-features");

    const context = relationshipRuleContextForType(schema, db, scene, "features");
    expect(context?.allowedTargetTypeIds).toEqual([featuresType]);
  });

  test("loadSchemaFromContent reads repo schema.json", () => {
    const schema = loadSchemaFromContent(resolveContentPath());
    expect(schema.relationshipRules.length).toBeGreaterThan(0);
    expect(schema.enums.priority?.options).toEqual(["Low", "Medium", "High", "Consideration"]);
    expect(schema.enums.priority?.defaultOrder).toBe("desc");
    expect(schema.enums.priority?.values?.High).toBe(4);
  });

  test("parseSchemaFile validates enums", () => {
    const file = parseSchemaFile(
      JSON.stringify({
        version: 1,
        relationshipRules: [],
        enums: {
          priority: {
            options: ["Low", "Medium", "High", "Consideration"],
            default: "Low",
            values: { Low: 1, Medium: 2, High: 4, Consideration: 0 },
          },
        },
      }),
    );
    expect(file.enums.priority?.default).toBe("Low");
  });

  test("parseSchemaFile rejects invalid enum default", () => {
    expect(() =>
      parseSchemaFile(
        JSON.stringify({
          version: 1,
          relationshipRules: [],
          enums: {
            priority: {
              options: ["Low", "Medium"],
              default: "High",
            },
          },
        }),
      ),
    ).toThrow(/default must be one of options/);
  });

  test("parseSchemaFile rejects values key not in options", () => {
    expect(() =>
      parseSchemaFile(
        JSON.stringify({
          version: 1,
          relationshipRules: [],
          enums: {
            priority: {
              options: ["Low", "Medium"],
              default: "Low",
              values: { Ultimate: 8 },
            },
          },
        }),
      ),
    ).toThrow(/values key "Ultimate" is not in options/);
  });

  test("parseSchemaFile defaults defaultOrder to asc when omitted", () => {
    const file = parseSchemaFile(
      JSON.stringify({
        version: 1,
        relationshipRules: [],
        enums: {
          priority: {
            options: ["Low", "Medium"],
            default: "Low",
          },
        },
      }),
    );
    expect(file.enums.priority?.defaultOrder).toBe("asc");
  });

  test("parseSchemaFile accepts defaultOrder desc", () => {
    const file = parseSchemaFile(
      JSON.stringify({
        version: 1,
        relationshipRules: [],
        enums: {
          priority: {
            options: ["Low", "Medium"],
            default: "Low",
            defaultOrder: "desc",
          },
        },
      }),
    );
    expect(file.enums.priority?.defaultOrder).toBe("desc");
  });

  test("parseSchemaFile rejects invalid defaultOrder", () => {
    expect(() =>
      parseSchemaFile(
        JSON.stringify({
          version: 1,
          relationshipRules: [],
          enums: {
            priority: {
              options: ["Low", "Medium"],
              default: "Low",
              defaultOrder: "newest",
            },
          },
        }),
      ),
    ).toThrow(/defaultOrder must be "asc" or "desc"/);
  });
});
