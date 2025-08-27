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

// Function to generate OAuth2 access token
async function getAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY');
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');

  if (!clientEmail || !privateKey || !projectId) {
    throw new Error('Missing Firebase service account credentials');
  }

  console.log('Attempting to create JWT with client email:', clientEmail);

  // Create JWT claims
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600, // 1 hour
    scope: "https://www.googleapis.com/auth/firebase.messaging"
  };

  // Normalize the private key (handle quotes and escaped newlines)
  let key = privateKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith('\'') && key.endsWith('\''))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, '\n').replace(/\r/g, '');
  console.log('Normalized private key length:', key.length);

  // Helper to base64url-encode input
  const encoder = new TextEncoder();
  const base64url = (input: ArrayBuffer | Uint8Array | string): string => {
    let bytes: Uint8Array;
    if (typeof input === 'string') bytes = encoder.encode(input);
    else if (input instanceof Uint8Array) bytes = input;
    else bytes = new Uint8Array(input);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  // Build unsigned token header.payload
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(claims));
  const unsigned = `${encodedHeader}.${encodedPayload}`;

  // Import PKCS#8 private key and sign
  const begin = '-----BEGIN PRIVATE KEY-----';
  const end = '-----END PRIVATE KEY-----';
  let base64 = key;
  if (base64.includes(begin)) {
    base64 = base64.slice(base64.indexOf(begin) + begin.length, base64.indexOf(end));
  }
  base64 = base64.replace(/[\n\r\s]/g, '');
  const binaryDer = atob(base64);
  const derBytes = new Uint8Array(binaryDer.length);
  for (let i = 0; i < binaryDer.length; i++) derBytes[i] = binaryDer.charCodeAt(i);

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    derBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsigned)
  );
  const jwt = `${unsigned}.${base64url(signature)}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
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