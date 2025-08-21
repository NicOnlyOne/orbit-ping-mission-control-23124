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

      setMonitors(data?.map(monitor => ({
        ...monitor,
        status: monitor.status as 'online' | 'offline' | 'checking' | 'warning'
      })) || []);
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
      
      // Refresh monitors first so local state contains the new mission
      await fetchMonitors();
      
      // Test the URL immediately
      await testMonitor(data.id);
      
      return data.id;
    } catch (error) {
      console.error('Unexpected error creating monitor:', error);
      toast.error('Mission control error during deployment');
      return null;
    }
  };

  // Test a monitor
  const testMonitor = async (monitorId: string) => {
    try {
      let monitor = monitors.find(m => m.id === monitorId) as Partial<Monitor> | undefined;
      if (!monitor) {
        // Fallback: fetch monitor URL directly from DB in case local state is stale
        const { data: fallback, error: fetchErr } = await supabase
          .from('monitors')
          .select('id, url')
          .eq('id', monitorId)
          .single();
        if (fetchErr || !fallback) {
          toast.error('Mission not found');
          return;
        }
        monitor = fallback as Partial<Monitor>;
      }

      // Update status to checking
      setMonitors(prev => prev.map(m => 
        m.id === monitorId ? { ...m, status: 'checking' } : m
      ));

      const { data, error } = await supabase.functions.invoke('test-url', {
        body: {
          url: monitor.url,
          monitorId: monitorId,
          forceAlert: true, // 👈 ensures email is sent if result is offline
        }
      });

      if (error) {
        console.error('Error testing URL:', error);
        toast.error(`Mission test failed: ${error.message}`);
        
        // Revert status
        setMonitors(prev => prev.map(m => 
          m.id === monitorId ? { ...m, status: 'offline' } : m
        ));
        return;
      }

      // The edge function will update the database, so we need to refresh
      setTimeout(fetchMonitors, 1000);
      
      const statusMessages = {
        online: '✅ All systems operational!',
        warning: '⚠️ Slow response detected',
        offline: '🚨 Mission down! Houston, we have a problem!'
      };

      toast.success(statusMessages[data.status] || 'Test completed');

    } catch (error) {
      console.error('Unexpected error testing monitor:', error);
      toast.error('Communication error with mission control');
      
      // Revert status
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
        () => {
          // Refresh monitors when any change occurs
          fetchMonitors();
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

  // Kick off tests for monitors that haven't been checked yet
  useEffect(() => {
    if (!user || monitors.length === 0) return;

    const uninitialized = monitors.filter(m => !m.last_checked);
    uninitialized.forEach((m) => {
      testMonitor(m.id);
    });
    // Depend on last_checked to avoid unnecessary repeats
  }, [user, monitors.map(m => `${m.id}:${m.last_checked ?? ''}`).join('|')]);

  // Automatic monitoring: run tests at each monitor's interval (min 30s, max 60m)
  useEffect(() => {
    if (!user || monitors.length === 0) return;

    const timers: number[] = [];

    monitors.forEach((m) => {
      const intervalSec = Math.min(3600, Math.max(30, m.monitoring_interval || 300));
      const id = window.setInterval(() => {
        // Avoid stacking tests; if currently checking, skip this tick
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
      fetchMonitors();
    } catch (error) {
      console.error('Unexpected error updating interval:', error);
      toast.error('Mission control error updating interval');
    }
  };

  return {
    monitors,
    loading,
    fetchMonitors,
    createMonitor,
    testMonitor,
    deleteMonitor,
    updateMonitorInterval
  };
}