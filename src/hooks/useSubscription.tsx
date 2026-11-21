import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  getMaxMonitors,
  getPlanFeatures,
  isSubscriptionPlan,
  type SubscriptionPlan,
} from "@/lib/plans";

export type { SubscriptionPlan } from "@/lib/plans";

interface SubscriptionContextType {
  plan: SubscriptionPlan;
  isLoading: boolean;
  canEnableMonitor: boolean;
  enabledMonitorCount: number;
  maxMonitors: number | null;
  features: ReturnType<typeof getPlanFeatures>;
  refreshSubscription: () => Promise<void>;
  upgradePlan: (newPlan: SubscriptionPlan) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [enabledMonitorCount, setEnabledMonitorCount] = useState(0);
  const requestIdRef = useRef(0);

  const refreshSubscription = useCallback(async () => {
    if (!userId) {
      setPlan("free");
      setEnabledMonitorCount(0);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;

    try {
      const [profileResult, monitorResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("subscription_plan")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("monitors")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("enabled", true),
      ]);

      if (requestId !== requestIdRef.current) return;
      if (profileResult.error) throw profileResult.error;
      if (monitorResult.error) throw monitorResult.error;

      const storedPlan = profileResult.data?.subscription_plan;
      const nextPlan = storedPlan && isSubscriptionPlan(storedPlan) ? storedPlan : "free";
      setPlan(nextPlan);
      setEnabledMonitorCount(monitorResult.count ?? 0);
    } catch (error) {
      if (requestId === requestIdRef.current) {
        console.error("Error refreshing subscription:", error);
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [userId]);

  const upgradePlan = useCallback(
    async (newPlan: SubscriptionPlan) => {
      if (!userId) return;

      const { error } = await supabase.functions.invoke("admin-update-plan", {
        body: { userId, plan: newPlan },
      });
      if (error) throw error;
      await refreshSubscription();
    },
    [userId, refreshSubscription],
  );

  useEffect(() => {
    if (userId) {
      setIsLoading(true);
      void refreshSubscription();
    } else {
      requestIdRef.current += 1;
      setPlan("free");
      setEnabledMonitorCount(0);
      setIsLoading(false);
    }

    return () => {
      requestIdRef.current += 1;
    };
  }, [userId, refreshSubscription]);

  const maxMonitors = getMaxMonitors(plan);
  const features = useMemo(() => getPlanFeatures(plan), [plan]);
  const canEnableMonitor = enabledMonitorCount < maxMonitors;
  const value = useMemo(
    () => ({
      plan,
      isLoading,
      canEnableMonitor,
      enabledMonitorCount,
      maxMonitors,
      features,
      refreshSubscription,
      upgradePlan,
    }),
    [
      plan,
      isLoading,
      canEnableMonitor,
      enabledMonitorCount,
      maxMonitors,
      features,
      refreshSubscription,
      upgradePlan,
    ],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
