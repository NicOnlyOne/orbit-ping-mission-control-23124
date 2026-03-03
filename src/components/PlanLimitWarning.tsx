import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { PlanBadge } from "./PlanBadge";

interface PlanLimitWarningProps {
  onUpgrade?: () => void;
  className?: string;
}

export function PlanLimitWarning({ onUpgrade, className }: PlanLimitWarningProps) {
  const { plan, enabledMonitorCount, maxMonitors, canEnableMonitor } = useSubscription();

  if (plan !== 'free' || canEnableMonitor) {
    return null;
  }

  return (
    <Alert className={`border-rocket-red/20 bg-rocket-red/5 ${className}`}>
      <AlertTriangle className="h-4 w-4 text-rocket-red" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">
            Free plan limit reached: {enabledMonitorCount}/{maxMonitors} active monitors
          </span>
          <PlanBadge plan="free" />
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onUpgrade}
          className="border-nebula-blue text-nebula-blue hover:bg-nebula-blue hover:text-foreground"
        >
          Upgrade to Pro
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}