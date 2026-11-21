/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import {
  getMonitorInterval,
  normalizeMonitorStatus,
  normalizeMonitorUrl,
} from "./monitors";

describe("monitor helpers", () => {
  it("normalizes backend and interface statuses", () => {
    expect(normalizeMonitorStatus("UP")).toBe("online");
    expect(normalizeMonitorStatus("DOWN")).toBe("offline");
    expect(normalizeMonitorStatus("WARNING")).toBe("warning");
    expect(normalizeMonitorStatus("CHECKING")).toBe("checking");
  });

  it("adds HTTPS and trims URLs before deployment", () => {
    expect(normalizeMonitorUrl("  example.com  ")).toBe("https://example.com/");
    expect(normalizeMonitorUrl("http://example.com/path")).toBe("http://example.com/path");
  });

  it("keeps monitoring intervals between 30 seconds and one hour", () => {
    expect(getMonitorInterval(10)).toBe(30);
    expect(getMonitorInterval(60)).toBe(60);
    expect(getMonitorInterval(7200)).toBe(3600);
    expect(getMonitorInterval(null)).toBe(300);
  });
});
