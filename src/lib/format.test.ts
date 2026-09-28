import { describe, expect, it } from "vitest";
import { formatDuration, pluralize } from "./format";

describe("formatDuration", () => {
  it.each([
    [412, "6 min 52 s"],
    [45, "45 s"],
    [0, "0 s"],
    [120, "2 min"],
    [3720, "1 h 2 min"],
    [3600, "1 h"],
    [-3, "0 s"],
  ])("%i → %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe("pluralize", () => {
  it("singular y plural", () => {
    expect(pluralize(1, "dato", "datos")).toBe("1 dato");
    expect(pluralize(3, "dato", "datos")).toBe("3 datos");
    expect(pluralize(0, "dato", "datos")).toBe("0 datos");
  });
});
