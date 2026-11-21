import type { Tables } from "@/integrations/supabase/types";

export type MonitorStatus = "online" | "offline" | "checking" | "warning";
export type MonitorRow = Tables<"monitors">;

export type Monitor = Omit<
  MonitorRow,
  "status" | "enabled" | "monitoring_interval" | "uptime_percentage"
> & {
  status: MonitorStatus;
  enabled: boolean;
  monitoring_interval: number;
  uptime_percentage: number;
};

export const DEFAULT_MONITOR_INTERVAL = 300;
export const MIN_MONITOR_INTERVAL = 30;
export const MAX_MONITOR_INTERVAL = 3600;

export function normalizeMonitorStatus(status: string): MonitorStatus {
  switch (status.toUpperCase()) {
    case "UP":
    case "ONLINE":
      return "online";
    case "DOWN":
    case "OFFLINE":
      return "offline";
    case "WARNING":
      return "warning";
    default:
      return "checking";
  }
}

export function normalizeMonitor(monitor: MonitorRow): Monitor {
  return {
    ...monitor,
    status: normalizeMonitorStatus(monitor.status),
    enabled: monitor.enabled ?? true,
    monitoring_interval: getMonitorInterval(monitor.monitoring_interval),
    uptime_percentage: monitor.uptime_percentage ?? 100,
  };
}

export function normalizeMonitorUrl(url: string): string {
  const trimmedUrl = url.trim();
  const withProtocol = /^https?:\/\//i.test(trimmedUrl)
    ? trimmedUrl
    : `https://${trimmedUrl}`;

  return new URL(withProtocol).toString();
}

export function getMonitorInterval(interval: number | null | undefined): number {
  return Math.min(
    MAX_MONITOR_INTERVAL,
    Math.max(MIN_MONITOR_INTERVAL, interval || DEFAULT_MONITOR_INTERVAL),
  );
}
