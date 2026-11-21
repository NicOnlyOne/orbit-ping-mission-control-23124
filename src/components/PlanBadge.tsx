import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";
import { PLAN_DEFINITIONS, type SubscriptionPlan } from "@/lib/plans";
import { Crown, Rocket, Star } from "lucide-react";

interface PlanBadgeProps {
  plan?: SubscriptionPlan;
  className?: string;
}

const planConfig = {
  free: {
    icon: Star,
    variant: "secondary" as const,
    className: "bg-muted text-muted-foreground"
  },
  'pro-25': {
    icon: Rocket,
    variant: "default" as const,
    className: "bg-nebula-blue text-foreground"
  },
  'pro-50': {
    icon: Rocket,
    variant: "default" as const,
    className: "bg-nebula-blue text-foreground"
  },
  'enterprise-100': {
    icon: Crown,
    variant: "default" as const,
    className: "bg-gradient-to-r from-secondary to-primary text-foreground"
  },
  'enterprise-250': {
    icon: Crown,
    variant: "default" as const,
    className: "bg-gradient-to-r from-secondary to-primary text-foreground"
  }
};

export function PlanBadge({ plan: propPlan, className }: PlanBadgeProps) {
  const { plan: contextPlan } = useSubscription();
  const plan = propPlan || contextPlan;
  const config = planConfig[plan] || planConfig.free; // Fallback to free plan config
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant}
      className={`${config.className} ${className}`}
    >
      <Icon className="h-3 w-3 mr-1" />
      {PLAN_DEFINITIONS[plan]?.badgeLabel || PLAN_DEFINITIONS.free.badgeLabel}
    </Badge>
  );
}