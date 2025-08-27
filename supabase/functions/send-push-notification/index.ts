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

  // Sanitize and import private key as CryptoKey (PKCS8)
  let key = privateKey.trim();

  // Strip wrapping quotes if present
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith('\'') && key.endsWith('\''))) {
    key = key.slice(1, -1);
  }

  // Normalize escaped newlines and remove CR
  key = key.replace(/\\n/g, '\n').replace(/\r/g, '');

  // Helper to convert PEM/Base64 to ArrayBuffer (PKCS8 DER)
  function pemToArrayBuffer(pemOrBase64: string): ArrayBuffer {
    let base64 = pemOrBase64;
    const begin = '-----BEGIN PRIVATE KEY-----';
    const end = '-----END PRIVATE KEY-----';
    if (base64.includes(begin)) {
      const start = base64.indexOf(begin) + begin.length;
      const stop = base64.indexOf(end);
      base64 = base64.slice(start, stop);
    }
    base64 = base64.replace(/[^A-Za-z0-9+/=_-]/g, '');
    base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  const pkcs8Der = pemToArrayBuffer(key);
  console.log('PKCS8 DER byteLength:', (pkcs8Der as ArrayBuffer).byteLength);

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign JWT with RS256 using CryptoKey
  const jwt = await create({ alg: 'RS256', typ: 'JWT' }, payload, cryptoKey);

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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