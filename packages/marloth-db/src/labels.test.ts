import { describe, expect, test } from "bun:test";
import { IS_A_LABEL, LEGACY_IN_DATABASE_LABEL, isTypeMembershipLabel } from "./labels";

describe("labels", () => {
  test("isTypeMembershipLabel recognizes IS_A and legacy IN_DATABASE", () => {
    expect(isTypeMembershipLabel(IS_A_LABEL)).toBe(true);
    expect(isTypeMembershipLabel(LEGACY_IN_DATABASE_LABEL)).toBe(true);
    expect(isTypeMembershipLabel("FEATURES")).toBe(false);
  });
});
