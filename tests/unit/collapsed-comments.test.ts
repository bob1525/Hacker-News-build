import { describe, expect, it } from "vitest";
import { parseCollapsedIds, toggleCollapsedId } from "@/lib/domain/collapsed-comments";

describe("collapsed comment session state", () => {
  it("parses a stored id list and drops junk", () => {
    expect(parseCollapsedIds(JSON.stringify(["a", "b", "a"]))).toEqual(["a", "b"]);
    expect(parseCollapsedIds("not json")).toEqual([]);
    expect(parseCollapsedIds(JSON.stringify({ id: "a" }))).toEqual([]);
    expect(parseCollapsedIds(null)).toEqual([]);
  });

  it("toggles an id on and off without touching the others", () => {
    expect(toggleCollapsedId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleCollapsedId(["a", "b"], "a")).toEqual(["b"]);
  });
});
