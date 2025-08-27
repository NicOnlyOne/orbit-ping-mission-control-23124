import { useState, useEffect, useCallback } from 'react';
import { requestNotificationPermission, onMessageListener } from '@/lib/firebase';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export const usePushNotifications = () => {
  const [token, setToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = () => {
      const supported = 'Notification' in window && 'serviceWorker' in navigator;
      setIsSupported(supported);
      
      if (supported) {
        setIsEnabled(Notification.permission === 'granted');
      }
    };
    
    checkSupport();
  }, []);

  // Register service worker
  useEffect(() => {
    if (isSupported) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, [isSupported]);

  // Listen for foreground messages
  useEffect(() => {
    let mounted = true;
    
    const setupMessageListener = async () => {
      try {
        const payload: any = await onMessageListener();
        if (mounted && payload) {
          console.log('Foreground message received:', payload);
          
          // Show toast notification for foreground messages
          toast({
            title: payload.notification?.title || 'Notification',
            description: payload.notification?.body || 'You have a new notification',
          });
        }
      } catch (err) {
        console.log('Failed to listen for messages:', err);
      }
    };

    if (isSupported) {
      setupMessageListener();
    }

    return () => {
      mounted = false;
    };
  }, [toast, isSupported]);

  // Store FCM token in Supabase when user is available
  const saveFCMToken = useCallback(async (fcmToken: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          fcm_token: fcmToken,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving FCM token:', error);
      } else {
        console.log('FCM token saved successfully');
      }
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  }, [user]);

  // Request permission and get token
  const enableNotifications = useCallback(async () => {
    if (!isSupported) {
      toast({
        title: 'Not Supported',
        description: 'Push notifications are not supported in this browser.',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);
    
    try {
      const fcmToken = await requestNotificationPermission();
      
      if (fcmToken) {
        setToken(fcmToken);
        setIsEnabled(true);
        
        // Save token to database
        await saveFCMToken(fcmToken);
        
        toast({
          title: 'Notifications Enabled',
          description: 'You will receive push notifications for system alerts.',
        });
        
        return true;
      } else {
        toast({
          title: 'Permission Denied',
          description: 'Please enable notifications in your browser settings.',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to enable push notifications. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, toast, saveFCMToken]);

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    if (!token) {
      toast({
        title: 'No Token',
        description: 'Please enable notifications first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          token,
          title: '🛰️ OrbitPing Test Alert',
          body: 'This is a test notification from Mission Control!',
          data: {
            type: 'test',
            url: '/'
          }
        }
      });

      if (error) throw error;

      toast({
        title: 'Test Sent',
        description: 'Check your notifications for the test message.',
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: 'Test Failed',
        description: 'Failed to send test notification.',
        variant: 'destructive',
      });
    }
  }, [token, toast]);

  return {
    isSupported,
    isEnabled,
    isLoading,
    token,
    enableNotifications,
    sendTestNotification,
  };
};