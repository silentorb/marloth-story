import { describe, expect, test } from "bun:test";
import { IS_A_TYPE, LEGACY_IN_DATABASE_TYPE, isTypeMembershipType } from "./labels";

describe("labels", () => {
  test("isTypeMembershipType recognizes is_a and legacy in_database", () => {
    expect(isTypeMembershipType(IS_A_TYPE)).toBe(true);
    expect(isTypeMembershipType(LEGACY_IN_DATABASE_TYPE)).toBe(true);
    expect(isTypeMembershipType("features")).toBe(false);
  });
});
