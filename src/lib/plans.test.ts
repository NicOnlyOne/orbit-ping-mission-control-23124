/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import {
  getMaxMonitors,
  getPlanFeatures,
  getPlanLabel,
  isPlanUpgrade,
  PLAN_CATEGORIES,
} from "./plans";

describe("plan rules", () => {
  it("keeps the monitor limit for every plan", () => {
    expect(getMaxMonitors("free")).toBe(5);
    expect(getMaxMonitors("pro-25")).toBe(25);
    expect(getMaxMonitors("pro-50")).toBe(50);
    expect(getMaxMonitors("enterprise-100")).toBe(100);
    expect(getMaxMonitors("enterprise-250")).toBe(250);
  });

  it("keeps Slack on paid plans and SMS on Enterprise plans", () => {
    expect(getPlanFeatures("free")).toEqual({
      emailAlerts: true,
      slackNotifications: false,
      smsNotifications: false,
    });
    expect(getPlanFeatures("pro-25").slackNotifications).toBe(true);
    expect(getPlanFeatures("pro-25").smsNotifications).toBe(false);
    expect(getPlanFeatures("enterprise-100").slackNotifications).toBe(true);
    expect(getPlanFeatures("enterprise-100").smsNotifications).toBe(true);
  });

  it("keeps the published prices tied to the correct monitor counts", () => {
    const options = PLAN_CATEGORIES.flatMap((category) => category.options);
    expect(options.map(({ planId, monitors, price }) => ({ planId, monitors, price }))).toEqual([
      { planId: "free", monitors: 5, price: 0 },
      { planId: "pro-25", monitors: 25, price: 12 },
      { planId: "pro-50", monitors: 50, price: 19 },
      { planId: "enterprise-100", monitors: 100, price: 49 },
      { planId: "enterprise-250", monitors: 250, price: 99 },
    ]);
  });

  it("uses plan names and hierarchy consistently", () => {
    expect(getPlanLabel("enterprise-250")).toBe("Enterprise 250");
    expect(isPlanUpgrade("free", "pro-25")).toBe(true);
    expect(isPlanUpgrade("enterprise-250", "pro-50")).toBe(false);
  });
});
