import { describe, expect, test } from "bun:test";
import { HOME_NODE_ID } from "../../shared/types";
import { SIDEBAR_NODE_LINKS } from "../sidebar-nav";
import { isHomeNavActive } from "./SidePanel";

describe("isHomeNavActive", () => {
  test("is true only on the home node page", () => {
    expect(
      isHomeNavActive("node-page", HOME_NODE_ID, HOME_NODE_ID),
    ).toBe(true);
    expect(
      isHomeNavActive("node-page", SIDEBAR_NODE_LINKS[0]!.id, HOME_NODE_ID),
    ).toBe(false);
    expect(isHomeNavActive("graph-explorer", HOME_NODE_ID, HOME_NODE_ID)).toBe(
      false,
    );
    expect(isHomeNavActive("node-page", HOME_NODE_ID, null)).toBe(false);
  });
});
