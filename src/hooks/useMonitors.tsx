import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  notify_email: string | null;
  created_at: string;
  updated_at: string;
}

export function useMonitors() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

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
        status: monitor.status as 'online' | 'offline' | 'checking' | 'warning',
        notify_email: monitor.notify_email || null
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
          status: 'checking'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating monitor:', error);
        toast.error('Mission deployment failed: ' + error.message);
        return null;
      }

      toast.success(`🚀 Mission "${data.name}" deployed successfully!`);
      
      await fetchMonitors();
      
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
      const intervalSec = Math.min(3600, Math.max(30, m.monitoring_interval || 300));
      const id = setInterval(() => {
        if (m.status !== 'checking') {
          testMonitor(m.id);
        }
      }, intervalSec * 1000);
      timers.push(id);
    });

    return () => {
      timers.forEach(clearInterval);
    };
  }, [user, monitors.map(m => `${m.id}:${m.monitoring_interval}:${m.status}`).join('|')]);

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

  const updateMonitorEmail = async (monitorId: string, email: string) => {
    try {
      const { error } = await supabase
        .from("monitors")
        .update({ notify_email: email } as any)
        .eq("id", monitorId);

      if (error) {
        console.error("Error updating monitor email:", error);
        toast.error("Failed to update alert email");
        return;
      }

      toast.success(`📧 Alert email updated successfully`);
      fetchMonitors();
    } catch (error) {
      console.error("Unexpected error updating email:", error);
      toast.error("Mission control error updating email");
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
    updateMonitorEmail
  };
}
