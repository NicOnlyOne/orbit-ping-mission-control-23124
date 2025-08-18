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
      
      // Test the URL immediately
      testMonitor(data.id);
      
      // Refresh monitors
      fetchMonitors();
      
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
      const monitor = monitors.find(m => m.id === monitorId);
      if (!monitor) {
        toast.error('Mission not found');
        return;
      }

      // Update status to checking
      setMonitors(prev => prev.map(m => 
        m.id === monitorId ? { ...m, status: 'checking' } : m
      ));

      const { data, error } = await supabase.functions.invoke('test-url', {
        body: {
          url: monitor.url,
          monitorId: monitorId
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

  return {
    monitors,
    loading,
    fetchMonitors,
    createMonitor,
    testMonitor,
    deleteMonitor
  };
}