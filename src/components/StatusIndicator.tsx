import { cn } from "@/lib/utils";

// Canonical UI statuses your design uses
const STATUS_CONFIG = {
  online: {
    color: "bg-status-online",
    glow: "shadow-[0_0_10px_hsl(142_100%_45%/0.6)]",
    text: "System Operational",
    icon: "🛰️",
  },
  offline: {
    color: "bg-status-offline",
    glow: "shadow-[0_0_10px_hsl(0_84%_55%/0.6)]",
    text: "Mission Abort",
    icon: "🚨",
  },
  warning: {
    color: "bg-status-warning",
    glow: "shadow-[0_0_10px_hsl(45_100%_50%/0.6)]",
    text: "Caution Advised",
    icon: "⚠️",
  },
  checking: {
    color: "bg-status-checking",
    glow: "shadow-[0_0_10px_hsl(210_100%_50%/0.6)]",
    text: "Scanning Sector",
    icon: "🔍",
  },
} as const;

type StatusType = keyof typeof STATUS_CONFIG; // "online" | "offline" | "warning" | "checking"

interface StatusIndicatorProps {
  // Accept legacy/API values but keep UI vocabulary stable
  status?: string | null;
  label: string;
  className?: string;
}

// Map whatever the backend gives us -> UI keys
function normalizeStatus(input?: string | null): StatusType {
  const s = (input ?? "").toString().trim().toUpperCase();

  if (s === "UP" || s === "ONLINE" || s === "OK" || s === "HEALTHY") return "online";
  if (s === "DOWN" || s === "OFFLINE" || s === "ERROR" || s === "FAIL" || s === "FAILED") return "offline";
  if (s === "WARNING" || s === "WARN" || s === "DEGRADED") return "warning";
  if (s === "PENDING" || s === "CHECKING") return "checking";

  // Fallback when unknown/empty: "checking" feels safest for transient/unknown
  return "checking";
}

export const StatusIndicator = ({ status, label, className }: StatusIndicatorProps) => {
  const canonical = normalizeStatus(status);
  const config = STATUS_CONFIG[canonical]; // always defined

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative">
        <div
          className={cn("w-3 h-3 rounded-full animate-pulse", config.color, config.glow)}
        />
        <div
          className={cn("absolute inset-0 w-3 h-3 rounded-full animate-ping", config.color, "opacity-30")}
        />
      </div>
      <span className="text-body-sm font-token-medium text-muted-foreground">
        {config.icon} {label} - {config.text}
      </span>
    </div>
  );
};

// Optional: export for reuse when mapping API data lists
export { normalizeStatus };
