import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

interface SubscriptionContextType {
  plan: SubscriptionPlan;
  isLoading: boolean;
  canEnableMonitor: boolean;
  enabledMonitorCount: number;
  maxMonitors: number | null; // null means unlimited
  features: {
    emailAlerts: boolean;
    slackNotifications: boolean;
    smsNotifications: boolean;
  };
  refreshSubscription: () => Promise<void>;
  upgradePlan: (newPlan: SubscriptionPlan) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<SubscriptionPlan>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [canEnableMonitor, setCanEnableMonitor] = useState(false);
  const [enabledMonitorCount, setEnabledMonitorCount] = useState(0);

  const getFeatures = (currentPlan: SubscriptionPlan) => ({
    emailAlerts: true, // All plans have email
    slackNotifications: currentPlan === 'pro' || currentPlan === 'enterprise',
    smsNotifications: currentPlan === 'enterprise',
  });

  const getMaxMonitors = (currentPlan: SubscriptionPlan) => {
    return currentPlan === 'free' ? 1 : null; // null means unlimited
  };

  const refreshSubscription = async () => {
    if (!user) return;

    try {
      // Get user's plan from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_plan')
        .eq('user_id', user.id)
        .maybeSingle();

      const userPlan = (profile?.subscription_plan as SubscriptionPlan) || 'free';
      setPlan(userPlan);

      // Get enabled monitor count
      const { count } = await supabase
        .from('monitors')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('enabled', true);

      const enabledCount = count || 0;
      setEnabledMonitorCount(enabledCount);

      // Check if user can enable more monitors
      if (userPlan === 'free') {
        setCanEnableMonitor(enabledCount < 1);
      } else {
        setCanEnableMonitor(true); // Pro and Enterprise have unlimited
      }
    } catch (error) {
      console.error('Error refreshing subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const upgradePlan = async (newPlan: SubscriptionPlan) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          subscription_plan: newPlan,
          subscription_status: 'active',
          subscription_start_date: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;
      
      await refreshSubscription();
    } catch (error) {
      console.error('Error upgrading plan:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (user) {
      refreshSubscription();
    } else {
      setIsLoading(false);
      setPlan('free');
      setCanEnableMonitor(false);
      setEnabledMonitorCount(0);
    }
  }, [user]);

  return (
    <SubscriptionContext.Provider
      value={{
        plan,
        isLoading,
        canEnableMonitor,
        enabledMonitorCount,
        maxMonitors: getMaxMonitors(plan),
        features: getFeatures(plan),
        refreshSubscription,
        upgradePlan,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}