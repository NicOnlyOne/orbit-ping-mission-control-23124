import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import {
  getMonitorInterval,
  normalizeMonitor,
  normalizeMonitorUrl,
  type Monitor,
} from "@/lib/monitors";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

export function useMonitors() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const userId = user?.id;
  const { canEnableMonitor, maxMonitors, refreshSubscription } = useSubscription();
  const monitorsRef = useRef<Monitor[]>([]);
  const requestIdRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const testingMonitorsRef = useRef(new Set<string>());

  useEffect(() => {
    monitorsRef.current = monitors;
  }, [monitors]);

  const updateMonitor = useCallback((monitorId: string, status: Monitor["status"]) => {
    setMonitors((current) =>
      current.map((monitor) => (monitor.id === monitorId ? { ...monitor, status } : monitor)),
    );
  }, []);

  const fetchMonitors = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!userId) {
      setMonitors([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("monitors")
        .select("*")
        .order("created_at", { ascending: false });

      if (requestId !== requestIdRef.current) return;
      if (error) throw error;
      setMonitors((data ?? []).map(normalizeMonitor));
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error("Error fetching monitors:", error);
      toast.error("Houston, we have a problem loading your missions");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [userId]);

  const scheduleFetch = useCallback(
    (delay = 250) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        void fetchMonitors();
      }, delay);
    },
    [fetchMonitors],
  );

  useEffect(() => {
    setLoading(Boolean(userId));
    void fetchMonitors();

    return () => {
      requestIdRef.current += 1;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [userId, fetchMonitors]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`monitors-changes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monitors",
          filter: `user_id=eq.${userId}`,
        },
        () => scheduleFetch(),
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [userId, scheduleFetch]);

  const testMonitor = useCallback(
    async (monitorId: string, url?: string) => {
      if (testingMonitorsRef.current.has(monitorId)) return;

      const monitorUrl = url ?? monitorsRef.current.find((monitor) => monitor.id === monitorId)?.url;
      if (!monitorUrl) {
        toast.error("Mission URL not found. Could not start test.");
        return;
      }

      testingMonitorsRef.current.add(monitorId);
      updateMonitor(monitorId, "checking");

      try {
        const { data, error } = await supabase.functions.invoke("test-url", {
          body: { url: monitorUrl, monitorId, forceAlert: true },
        });
        if (error) throw error;

        scheduleFetch(500);
        const result = data as { status?: string } | null;
        const statusMessages: Record<string, string> = {
          UP: "✅ All systems operational!",
          DOWN: "🚨 Mission down! Houston, we have a problem!",
        };
        toast.success(statusMessages[result?.status ?? ""] || "Test completed");
      } catch (error) {
        console.error("Error testing monitor:", error);
        toast.error(`Mission test failed: ${getErrorMessage(error, "Communication error")}`);
        updateMonitor(monitorId, "offline");
      } finally {
        testingMonitorsRef.current.delete(monitorId);
      }
    },
    [scheduleFetch, updateMonitor],
  );

  const createMonitor = useCallback(
    async (name: string, url: string): Promise<string | null> => {
      if (!userId) {
        toast.error("Please sign in to deploy missions");
        return null;
      }

      try {
        const cleanUrl = normalizeMonitorUrl(url);
        const { data, error } = await supabase
          .from("monitors")
          .insert({
            user_id: userId,
            name: name.trim() || new URL(cleanUrl).hostname,
            url: cleanUrl,
            status: "checking",
            enabled: canEnableMonitor,
          })
          .select()
          .single();

        if (error) throw error;
        toast.success(`🚀 Mission "${data.name}" deployed successfully!`);

        await Promise.all([fetchMonitors(), refreshSubscription()]);
        await testMonitor(data.id, data.url);
        return data.id;
      } catch (error) {
        console.error("Error creating monitor:", error);
        toast.error(`Mission deployment failed: ${getErrorMessage(error)}`);
        return null;
      }
    },
    [userId, canEnableMonitor, fetchMonitors, refreshSubscription, testMonitor],
  );

  const deleteMonitor = useCallback(
    async (monitorId: string) => {
      const monitor = monitorsRef.current.find((item) => item.id === monitorId);

      try {
        const { error } = await supabase.from("monitors").delete().eq("id", monitorId);
        if (error) throw error;
        toast.success(`🗑️ Mission "${monitor?.name}" aborted successfully`);
        await Promise.all([fetchMonitors(), refreshSubscription()]);
      } catch (error) {
        console.error("Error deleting monitor:", error);
        toast.error(`Failed to abort mission: ${getErrorMessage(error)}`);
      }
    },
    [fetchMonitors, refreshSubscription],
  );

  const updateMonitorInterval = useCallback(async (monitorId: string, intervalSeconds: number) => {
    try {
      const { error } = await supabase
        .from("monitors")
        .update({ monitoring_interval: intervalSeconds })
        .eq("id", monitorId);
      if (error) throw error;
      toast.success("🛰️ Monitoring interval updated successfully");
    } catch (error) {
      console.error("Error updating monitor interval:", error);
      toast.error(`Failed to update monitoring interval: ${getErrorMessage(error)}`);
    }
  }, []);

  const toggleMonitorEnabled = useCallback(
    async (monitorId: string) => {
      const monitor = monitorsRef.current.find((item) => item.id === monitorId);
      if (!monitor) return;

      if (!monitor.enabled && !canEnableMonitor) {
        toast.error(
          `⚠️ Free plan limit: Only ${maxMonitors} active monitors allowed. Upgrade to Pro for more monitoring!`,
        );
        return;
      }

      try {
        const { error } = await supabase
          .from("monitors")
          .update({ enabled: !monitor.enabled })
          .eq("id", monitorId);
        if (error) throw error;

        toast.success(`🛰️ Mission ${!monitor.enabled ? "activated" : "paused"} successfully`);
        await Promise.all([fetchMonitors(), refreshSubscription()]);
      } catch (error) {
        console.error("Error toggling monitor:", error);
        toast.error(`Failed to update mission status: ${getErrorMessage(error)}`);
      }
    },
    [canEnableMonitor, maxMonitors, fetchMonitors, refreshSubscription],
  );

  const scheduleKey = monitors
    .map((monitor) => `${monitor.id}:${monitor.monitoring_interval}:${monitor.enabled ? 1 : 0}`)
    .join("|");
  const schedules = useMemo(
    () =>
      scheduleKey
        ? scheduleKey.split("|").map((schedule) => {
            const [id, interval, enabled] = schedule.split(":");
            return { id, interval: getMonitorInterval(Number(interval)), enabled: enabled === "1" };
          })
        : [],
    [scheduleKey],
  );

  useEffect(() => {
    if (!userId) return;

    const timers = schedules
      .filter((schedule) => schedule.enabled)
      .map((schedule) =>
        setInterval(() => {
          const monitor = monitorsRef.current.find((item) => item.id === schedule.id);
          if (monitor?.enabled && monitor.status !== "checking") {
            void testMonitor(schedule.id, monitor.url);
          }
        }, schedule.interval * 1000),
      );

    return () => timers.forEach(clearInterval);
  }, [userId, schedules, testMonitor]);

  return useMemo(
    () => ({
      monitors,
      loading,
      fetchMonitors,
      createMonitor,
      testMonitor,
      deleteMonitor,
      updateMonitorInterval,
      toggleMonitorEnabled,
    }),
    [
      monitors,
      loading,
      fetchMonitors,
      createMonitor,
      testMonitor,
      deleteMonitor,
      updateMonitorInterval,
      toggleMonitorEnabled,
    ],
  );
}
