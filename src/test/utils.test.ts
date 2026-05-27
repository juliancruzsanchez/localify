import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn utility", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles undefined values", () => {
    expect(cn("foo", undefined, "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    expect(cn("foo", true && "bar", "baz")).toBe("foo bar baz");
  });

  it("deduplicates Tailwind classes", () => {
    // tailwind-merge deduplication
    expect(cn("p-4", "p-2")).toBe("p-2");
  });
});
