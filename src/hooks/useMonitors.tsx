import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';

interface Monitor {
  id: string;
  name: string;
  url: string;
  status: 'online' | 'offline' | 'checking' | 'warning';
  last_checked: string | null;
  response_time: number | null;
  uptime_percentage: number;
  error_message: string | null;
  monitoring_interval: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useMonitors() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { canEnableMonitor, refreshSubscription } = useSubscription();

  // Fetch monitors
  const fetchMonitors = async () => {
    if (!user) {
      setMonitors([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('monitors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching monitors:', error);
        toast.error('Failed to load mission data');
        return;
      }

      if (!data) {
        setMonitors([]);
        return;
      }

      setMonitors(data.map(monitor => ({
        ...monitor,
        status: monitor.status === 'UP' ? 'online' : monitor.status === 'DOWN' ? 'offline' : monitor.status as 'online' | 'offline' | 'checking' | 'warning'
      })));
    } catch (error) {
      console.error('Unexpected error fetching monitors:', error);
      toast.error('Houston, we have a problem loading your missions');
    } finally {
      setLoading(false);
    }
  };

  // Create new monitor
  const createMonitor = async (name: string, url: string): Promise<string | null> => {
    if (!user) {
      toast.error('Please sign in to deploy missions');
      return null;
    }

    try {
      // Clean up URL
      let cleanUrl = url.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
      }

      const { data, error } = await supabase
        .from('monitors')
        .insert({
          user_id: user.id,
          name: name.trim() || new URL(cleanUrl).hostname,
          url: cleanUrl,
          status: 'checking',
          enabled: canEnableMonitor // Only enable if user can enable monitors
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating monitor:', error);
        toast.error('Mission deployment failed: ' + error.message);
        return null;
      }

      toast.success(`🚀 Mission "${data.name}" deployed successfully!`);
      
      await Promise.all([
        fetchMonitors(),
        refreshSubscription() // Refresh subscription to update canEnableMonitor state
      ]);
      
      // <<< LOVABLE AI FIX #1: Pass the URL directly to testMonitor
      // This avoids the race condition of trying to fetch it again.
      await testMonitor(data.id, data.url); 

      return data.id;
    } catch (error) {
      console.error('Unexpected error creating monitor:', error);
      toast.error('Mission control error during deployment');
      return null;
    }
  };

  // Test a monitor
  const testMonitor = async (monitorId: string, url?: string) => {
    try {
      // <<< LOVABLE AI FIX #2: Prioritize the passed URL
      // If a URL is provided (like during creation), use it. Otherwise, find it in our state.
      let monitorUrl = url;
      if (!monitorUrl) {
        const monitorInState = monitors.find(m => m.id === monitorId);
        if (monitorInState) {
          monitorUrl = monitorInState.url;
        }
      }

      // If we still couldn't find a URL, we can't proceed.
      if (!monitorUrl) {
        toast.error('Mission URL not found. Could not start test.');
        return;
      }

      // Update status to checking
      setMonitors(prev => prev.map(m => 
        m.id === monitorId ? { ...m, status: 'checking' } : m
      ));

      const { data, error } = await supabase.functions.invoke('test-url', {
        body: {
          url: monitorUrl, // Use the URL we just determined
          monitorId: monitorId,
          forceAlert: true,
        }
      });

      if (error) {
        console.error('Error testing URL:', error);
        toast.error(`Mission test failed: ${error.message}`);
        setMonitors(prev => prev.map(m => 
          m.id === monitorId ? { ...m, status: 'offline' } : m
        ));
        return;
      }

      // The edge function will update the database, which triggers a realtime refresh via `useEffect`
      // A small manual refresh can help, but the realtime subscription is the primary mechanism.
      setTimeout(fetchMonitors, 500);

      const statusMessages: { [key: string]: string } = {
        UP: '✅ All systems operational!',
        DOWN: '🚨 Mission down! Houston, we have a problem!'
      };

      toast.success(statusMessages[data.status] || 'Test completed');

    } catch (error) {
      console.error('Unexpected error testing monitor:', error);
      toast.error('Communication error with mission control');
      setMonitors(prev => prev.map(m => 
        m.id === monitorId ? { ...m, status: 'offline' } : m
      ));
    }
  };

  // Delete monitor
  const deleteMonitor = async (monitorId: string) => {
    try {
      const monitor = monitors.find(m => m.id === monitorId);
      const { error } = await supabase
        .from('monitors')
        .delete()
        .eq('id', monitorId);

      if (error) {
        console.error('Error deleting monitor:', error);
        toast.error('Failed to abort mission');
        return;
      }

      toast.success(`🗑️ Mission "${monitor?.name}" aborted successfully`);
      fetchMonitors();
    } catch (error) {
      console.error('Unexpected error deleting monitor:', error);
      toast.error('Mission control error during abort sequence');
    }
  };

  // Set up real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('monitors-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monitors',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // A small delay helps ensure the DB has settled before we re-fetch.
          setTimeout(() => fetchMonitors(), 250);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchMonitors();
  }, [user]);

  // Automatic monitoring: run tests at each monitor's interval
  useEffect(() => {
    if (!user || monitors.length === 0) return;

    const timers: NodeJS.Timeout[] = [];

    monitors.forEach((m) => {
      // Only set up timers for enabled monitors
      if (!m.enabled) return;
      
      const intervalSec = Math.min(3600, Math.max(30, m.monitoring_interval || 300));
      const id = setInterval(() => {
        if (m.status !== 'checking' && m.enabled) {
          testMonitor(m.id);
        }
      }, intervalSec * 1000);
      timers.push(id);
    });

    return () => {
      timers.forEach(clearInterval);
    };
  }, [user, monitors.map(m => `${m.id}:${m.monitoring_interval}:${m.status}:${m.enabled}`).join('|')]);

  // Update monitor interval
  const updateMonitorInterval = async (monitorId: string, intervalSeconds: number) => {
    try {
      const { error } = await supabase
        .from('monitors')
        .update({ monitoring_interval: intervalSeconds })
        .eq('id', monitorId);

      if (error) {
        console.error('Error updating monitor interval:', error);
        toast.error('Failed to update monitoring interval');
        return;
      }

      toast.success(`🛰️ Monitoring interval updated successfully`);
    } catch (error) {
      console.error('Unexpected error updating interval:', error);
      toast.error('Mission control error updating interval');
    }
  };

  // Toggle monitor enabled state
  const toggleMonitorEnabled = async (monitorId: string) => {
    try {
      const monitor = monitors.find(m => m.id === monitorId);
      if (!monitor) return;

      // Check if user can enable monitor (for enabling only)
      if (!monitor.enabled && !canEnableMonitor) {
        toast.error('⚠️ Free plan limit: Only 1 active monitor allowed. Upgrade to Pro for unlimited monitoring!');
        return;
      }

      const { error } = await supabase
        .from('monitors')
        .update({ enabled: !monitor.enabled })
        .eq('id', monitorId);

      if (error) {
        console.error('Error toggling monitor enabled state:', error);
        toast.error('Failed to update mission status');
        return;
      }

      toast.success(`🛰️ Mission ${!monitor.enabled ? 'activated' : 'paused'} successfully`);
      
      await Promise.all([
        fetchMonitors(),
        refreshSubscription() // Refresh subscription state
      ]);
    } catch (error) {
      console.error('Unexpected error toggling monitor:', error);
      toast.error('Mission control error updating status');
    }
  };


  return {
    monitors,
    loading,
    fetchMonitors,
    createMonitor,
    testMonitor,
    deleteMonitor,
    updateMonitorInterval,
    toggleMonitorEnabled
  };
}
