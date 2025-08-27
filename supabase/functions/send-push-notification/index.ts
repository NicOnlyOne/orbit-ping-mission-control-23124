import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

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

// Function to generate OAuth2 access token
async function getAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY');
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');

  if (!clientEmail || !privateKey || !projectId) {
    throw new Error('Missing Firebase service account credentials');
  }

  console.log('Attempting to create JWT with client email:', clientEmail);

  // Create JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600, // 1 hour
    scope: "https://www.googleapis.com/auth/firebase.messaging"
  };

  // Clean the private key - ensure proper format
  let cleanKey = privateKey.trim();
  
  // Handle different possible formats
  if (!cleanKey.includes('-----BEGIN PRIVATE KEY-----')) {
    // If missing headers, assume it's just the base64 content
    cleanKey = `-----BEGIN PRIVATE KEY-----\n${cleanKey}\n-----END PRIVATE KEY-----`;
  }
  
  // Normalize line endings
  cleanKey = cleanKey.replace(/\\n/g, '\n');

  console.log('Key starts with:', cleanKey.substring(0, 50));
  console.log('Key ends with:', cleanKey.substring(cleanKey.length - 50));

  try {
    // Use djwt's built-in key import
    const jwt = await create({ alg: "RS256", typ: "JWT" }, payload, cleanKey);

    console.log('JWT created successfully, exchanging for access token...');

    // Exchange JWT for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      throw new Error(`Failed to get access token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Access token obtained successfully');
    return tokenData.access_token;
  } catch (error) {
    console.error('Error in getAccessToken:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, title, body, data, userId }: PushNotificationRequest = await req.json();
    
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
    if (!projectId) {
      throw new Error('Firebase project ID not configured');
    }

    // Get OAuth2 access token
    const accessToken = await getAccessToken();

    // Construct FCM v1 message
    const message = {
      message: {
        token: token,
        notification: {
          title,
          body,
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
      }
    };

    console.log('Sending FCM v1 message:', { title, body, token: token.substring(0, 20) + '...' });

    // Send notification via FCM HTTP v1 API
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const raw = await response.text();
    let result: any = raw;
    try {
      result = JSON.parse(raw);
    } catch (_) {
      // keep raw HTML/text for debugging
    }

    if (!response.ok) {
      console.error('FCM v1 error response:', { status: response.status, result });
      return new Response(
        JSON.stringify({ success: false, status: response.status, result }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('FCM v1 response:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.name,
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