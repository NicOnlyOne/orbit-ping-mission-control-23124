import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationRequest {
  token: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  userId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, title, body, data, userId }: PushNotificationRequest = await req.json();
    
    const serverKey = Deno.env.get('FIREBASE_SERVER_KEY');
    if (!serverKey) {
      throw new Error('Firebase server key not configured');
    }

    // Construct FCM message
    const message = {
      to: token,
      notification: {
        title,
        body,
        icon: '/favicon.ico',
        click_action: data?.url || '/'
      },
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      webpush: {
        headers: {
          "TTL": "86400" // 24 hours
        },
        notification: {
          title,
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'orbitping-notification',
          requireInteraction: true,
          actions: [
            {
              action: 'view',
              title: 'View Details'
            }
          ],
          data: {
            url: data?.url || '/',
            ...data
          }
        }
      }
    };

    console.log('Sending FCM message:', { title, body, token: token.substring(0, 20) + '...' });

    // Send notification via FCM
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('FCM error response:', result);
      throw new Error(`FCM error: ${result.error || 'Unknown error'}`);
    }

    console.log('FCM response:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.multicast_id || result.message_id,
        result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error sending push notification:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});