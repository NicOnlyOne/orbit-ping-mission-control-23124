import { cn } from "@/lib/utils";

type StatusType = "online" | "offline" | "warning" | "checking";

interface StatusIndicatorProps {
  status: StatusType;
  label: string;
  className?: string;
}

export const StatusIndicator = ({ status, label, className }: StatusIndicatorProps) => {
  const statusConfig = {
    online: {
      color: "bg-status-online",
      glow: "shadow-[0_0_10px_hsl(142_100%_45%/0.6)]",
      text: "System Operational",
      icon: "🛰️"
    },
    offline: {
      color: "bg-status-offline",
      glow: "shadow-[0_0_10px_hsl(0_84%_55%/0.6)]",
      text: "Mission Abort",
      icon: "🚨"
    },
    warning: {
      color: "bg-status-warning",
      glow: "shadow-[0_0_10px_hsl(45_100%_50%/0.6)]",
      text: "Caution Advised",
      icon: "⚠️"
    },
    checking: {
      color: "bg-status-checking",
      glow: "shadow-[0_0_10px_hsl(210_100%_50%/0.6)]",
      text: "Scanning Sector",
      icon: "🔍"
    }
  };

  const config = statusConfig[status];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative">
        <div 
          className={cn(
            "w-3 h-3 rounded-full animate-pulse",
            config.color,
            config.glow
          )}
        />
        <div 
          className={cn(
            "absolute inset-0 w-3 h-3 rounded-full animate-ping",
            config.color,
            "opacity-30"
          )}
        />
      </div>
      <span className="text-sm font-medium text-muted-foreground">
        {config.icon} {label} - {config.text}
      </span>
    </div>
  );
};