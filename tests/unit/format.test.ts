import { describe, expect, it } from "vitest";
import { parsePage, plural } from "@/lib/domain/format";
import { formatDateUTC, formatRelative } from "@/lib/domain/time";
import { isSafeHttpUrl, safeNextPath, siteLabel } from "@/lib/domain/url";
import { linkify } from "@/lib/domain/text";

describe("formatting", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("formats relative times the way a comment thread reads", () => {
    expect(formatRelative(new Date("2026-06-15T12:00:02Z"), now)).toBe("just now");
    expect(formatRelative(new Date("2026-06-15T11:59:30Z"), now)).toBe("30 seconds ago");
    expect(formatRelative(new Date("2026-06-15T11:59:00Z"), now)).toBe("1 minute ago");
    expect(formatRelative(new Date("2026-06-15T11:58:00Z"), now)).toBe("2 minutes ago");
    expect(formatRelative(new Date("2026-06-15T11:00:00Z"), now)).toBe("1 hour ago");
    expect(formatRelative(new Date("2026-06-15T09:00:00Z"), now)).toBe("3 hours ago");
    expect(formatRelative(new Date("2026-06-14T12:00:00Z"), now)).toBe("1 day ago");
    expect(formatRelative(new Date("2026-06-13T12:00:00Z"), now)).toBe("2 days ago");
    expect(formatRelative(new Date("2026-05-15T12:00:00Z"), now)).toBe("1 month ago");
    expect(formatRelative(new Date("2024-06-15T12:00:00Z"), now)).toBe("2 years ago");
  });

  it("formats calendar dates in UTC and pluralizes points", () => {
    expect(formatDateUTC("2026-11-10T18:00:00Z")).toBe("Nov 10, 2026");
    expect(formatDateUTC("not-a-date")).toBe("unknown date");
    expect(plural(1, "point")).toBe("1 point");
    expect(plural(0, "comment")).toBe("0 comments");
    expect(plural(2, "result")).toBe("2 results");
  });

  it("parses page numbers defensively", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("2")).toBe(2);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-4")).toBe(1);
    expect(parsePage("1.5")).toBe(1);
    expect(parsePage("9999")).toBe(1);
  });
});

describe("urls and link text", () => {
  it("accepts only http(s) links and shows a short host", () => {
    expect(isSafeHttpUrl("https://sqlite.org/whentouse.html")).toBe(true);
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("notaurl")).toBe(false);
    expect(siteLabel("https://www.sqlite.org/whentouse.html")).toBe("sqlite.org");
    expect(siteLabel("javascript:alert(1)")).toBeNull();
  });

  it("rejects open redirects", () => {
    expect(safeNextPath("/submit")).toBe("/submit");
    expect(safeNextPath("/item/abc?x=1")).toBe("/item/abc?x=1");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil")).toBe("/");
    expect(safeNextPath(" /submit ")).toBe("/submit");
    expect(safeNextPath(null)).toBe("/");
  });

  it("linkifies http urls and leaves the surrounding sentence intact", () => {
    const parts = linkify("See https://example.com/a, then stop.");
    expect(parts).toEqual([
      { type: "text", value: "See " },
      { type: "link", href: "https://example.com/a", value: "https://example.com/a" },
      { type: "text", value: ", then stop." },
    ]);
    expect(linkify("no links").every((part) => part.type === "text")).toBe(true);
  });
});
