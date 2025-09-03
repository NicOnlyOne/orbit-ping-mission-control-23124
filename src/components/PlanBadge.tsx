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
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
  },
  pro: {
    label: "Pro",
    icon: Rocket,
    variant: "default" as const,
    className: "bg-nebula-blue text-white"
  },
  enterprise: {
    label: "Enterprise",
    icon: Crown,
    variant: "default" as const,
    className: "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
  }
};

export function PlanBadge({ plan: propPlan, className }: PlanBadgeProps) {
  const { plan: contextPlan } = useSubscription();
  const plan = propPlan || contextPlan;
  const config = planConfig[plan];
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