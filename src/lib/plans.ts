export const SUBSCRIPTION_PLANS = [
  "free",
  "pro-25",
  "pro-50",
  "enterprise-100",
  "enterprise-250",
] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];
export type PlanCategoryId = "free" | "pro" | "enterprise";

export interface PlanOption {
  readonly monitors: number;
  readonly price: number;
  readonly planId: SubscriptionPlan;
}

export interface PlanCategory {
  readonly id: PlanCategoryId;
  readonly name: string;
  readonly description: string;
  readonly baseFeatures: readonly string[];
  readonly options: readonly PlanOption[];
}

export const PLAN_CATEGORIES: readonly PlanCategory[] = [
  {
    id: "free",
    name: "Free",
    description: 'Great for small projects or testing your "mission control."',
    baseFeatures: ["5 monitors", "5-minute checks", "Email alerts", "Basic uptime tracking"],
    options: [{ monitors: 5, price: 0, planId: "free" }],
  },
  {
    id: "pro",
    name: "Pro",
    description: "Powerful for small teams who want fast alerts and better tracking.",
    baseFeatures: ["1-minute checks", "Email alerts", "Slack notifications"],
    options: [
      { monitors: 25, price: 12, planId: "pro-25" },
      { monitors: 50, price: 19, planId: "pro-50" },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Perfect for critical services where real-time phone alerts matter.",
    baseFeatures: [
      "30-second checks",
      "Email alerts",
      "Slack notifications",
      "SMS notifications",
      "100 SMS included/month",
    ],
    options: [
      { monitors: 100, price: 49, planId: "enterprise-100" },
      { monitors: 250, price: 99, planId: "enterprise-250" },
    ],
  },
];

export const PLAN_DEFINITIONS: Record<
  SubscriptionPlan,
  { label: string; badgeLabel: string; maxMonitors: number; rank: number }
> = {
  free: { label: "Free", badgeLabel: "Free", maxMonitors: 5, rank: 0 },
  "pro-25": { label: "Pro 25", badgeLabel: "Pro", maxMonitors: 25, rank: 1 },
  "pro-50": { label: "Pro 50", badgeLabel: "Pro+", maxMonitors: 50, rank: 2 },
  "enterprise-100": {
    label: "Enterprise 100",
    badgeLabel: "Enterprise",
    maxMonitors: 100,
    rank: 3,
  },
  "enterprise-250": {
    label: "Enterprise 250",
    badgeLabel: "Enterprise+",
    maxMonitors: 250,
    rank: 4,
  },
};

export const PLAN_SELECT_OPTIONS = SUBSCRIPTION_PLANS.map((value) => ({
  value,
  label: PLAN_DEFINITIONS[value].label,
}));

export const DEFAULT_PLAN_SELECTION: Record<PlanCategoryId, number> = {
  free: 5,
  pro: 25,
  enterprise: 100,
};

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return (SUBSCRIPTION_PLANS as readonly string[]).includes(value);
}

export function getPlanLabel(plan: string): string {
  return isSubscriptionPlan(plan) ? PLAN_DEFINITIONS[plan].label : plan;
}

export function getMaxMonitors(plan: SubscriptionPlan): number {
  return PLAN_DEFINITIONS[plan].maxMonitors;
}

export function getPlanFeatures(plan: SubscriptionPlan) {
  return {
    emailAlerts: true,
    slackNotifications: plan.startsWith("pro-") || plan.startsWith("enterprise-"),
    smsNotifications: plan.startsWith("enterprise-"),
  };
}

export function getSelectedPlanOption(
  category: PlanCategory,
  selectedMonitors?: number,
): PlanOption {
  return (
    category.options.find((option) => option.monitors === selectedMonitors) ??
    category.options[0]
  );
}

export function isPlanUpgrade(currentPlan: SubscriptionPlan, targetPlan: SubscriptionPlan): boolean {
  return PLAN_DEFINITIONS[targetPlan].rank > PLAN_DEFINITIONS[currentPlan].rank;
}
