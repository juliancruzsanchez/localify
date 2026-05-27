import { describe, it, expect } from "vitest";
import { formatTime, formatMs, formatDuration } from "@/lib/formatTime";

describe("formatTime", () => {
  it("formats 0 seconds as 0:00", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("formats 65 seconds as 1:05", () => {
    expect(formatTime(65)).toBe("1:05");
  });

  it("formats 3600 seconds as 60:00", () => {
    expect(formatTime(3600)).toBe("60:00");
  });

  it("pads single-digit seconds", () => {
    expect(formatTime(61)).toBe("1:01");
  });
});

describe("formatMs", () => {
  it("converts ms to formatted time", () => {
    expect(formatMs(65000)).toBe("1:05");
  });

  it("handles 0 ms", () => {
    expect(formatMs(0)).toBe("0:00");
  });
});

describe("formatDuration", () => {
  it("formats under an hour without hours component", () => {
    expect(formatDuration(125)).toBe("2:05");
  });

  it("formats over an hour with hours component", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});
