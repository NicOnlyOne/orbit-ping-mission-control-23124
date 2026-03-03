import { Badge } from "@/components/ui/badge";
import { useSubscription, SubscriptionPlan } from "@/hooks/useSubscription";
import { Crown, Rocket, Star } from "lucide-react";

interface PlanBadgeProps {
  plan?: SubscriptionPlan;
  className?: string;
}

const planConfig = {
  free: {
    label: "Free",
    icon: Star,
    variant: "secondary" as const,
    className: "bg-muted text-muted-foreground"
  },
  'pro-25': {
    label: "Pro",
    icon: Rocket,
    variant: "default" as const,
    className: "bg-nebula-blue text-foreground"
  },
  'pro-50': {
    label: "Pro+",
    icon: Rocket,
    variant: "default" as const,
    className: "bg-nebula-blue text-foreground"
  },
  'enterprise-100': {
    label: "Enterprise",
    icon: Crown,
    variant: "default" as const,
    className: "bg-gradient-to-r from-secondary to-primary text-foreground"
  },
  'enterprise-250': {
    label: "Enterprise+",
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
      {config.label}
    </Badge>
  );
}