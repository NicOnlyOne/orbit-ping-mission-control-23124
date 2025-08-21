import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestUrlRequest {
  url: string;
  monitorId?: string;
}

interface TestUrlResponse {
  status: 'online' | 'offline' | 'warning';
  responseTime: number;
  errorMessage?: string;
  statusCode?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Mission Control: URL test initiated');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create clients: one with the caller's auth (for RLS), one with service role (for privileged writes)
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseAuthed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseService = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData } = await supabaseAuthed.auth.getUser();
    const user = userData?.user ?? null;
    
    const { url, monitorId }: TestUrlRequest = await req.json();
    
    if (!url) {
      console.log('❌ No URL provided');
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🛰️ Testing URL: ${url}`);
    
    const startTime = Date.now();
    let testResult: TestUrlResponse;

    try {
      // Add protocol if missing
      let testUrl = url;
      if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
        testUrl = 'https://' + testUrl;
      }

      // Test the URL with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(testUrl, {
        method: 'HEAD', // Use HEAD to avoid downloading content
        signal: controller.signal,
        headers: {
          'User-Agent': 'OrbitPing-Monitor/1.0'
        }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      console.log(`📊 Response received: ${response.status} in ${responseTime}ms`);

      if (response.ok) {
        testResult = {
          status: responseTime > 2000 ? 'warning' : 'online',
          responseTime,
          statusCode: response.status
        };
      } else {
        testResult = {
          status: 'offline',
          responseTime,
          statusCode: response.status,
          errorMessage: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.log(`❌ Request failed after ${responseTime}ms:`, error.message);

      let errorMessage = 'Connection failed';
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout (10s)';
      } else if (error.message.includes('DNS')) {
        errorMessage = 'DNS resolution failed';
      } else if (error.message.includes('connection')) {
        errorMessage = 'Connection refused';
      }

      testResult = {
        status: 'offline',
        responseTime,
        errorMessage
      };
    }

    // If monitorId is provided and we have an authenticated user, update DB
    if (monitorId && user) {
      console.log(`💾 Updating monitor ${monitorId} for user ${user.id}`);

      try {
        // Verify monitor ownership and get previous status via RLS-enabled client
        const { data: monitorRow, error: monitorFetchError } = await supabaseAuthed
          .from('monitors')
          .select('id, user_id, status, name, url')
          .eq('id', monitorId)
          .single();

        if (monitorFetchError || !monitorRow) {
          console.error('❌ Monitor fetch/ownership check failed:', monitorFetchError);
          return new Response(
            JSON.stringify({ error: 'Monitor not found or access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const previousStatus = monitorRow.status;
        const wasOnline = previousStatus === 'online';
        const isNowOffline = testResult.status === 'offline';

        // Update the monitor using the authed client (RLS enforced)
        const { error: updateError } = await supabaseAuthed
          .from('monitors')
          .update({
            status: testResult.status,
            last_checked: new Date().toISOString(),
            response_time: testResult.responseTime,
            error_message: testResult.errorMessage || null,
          })
          .eq('id', monitorId);

        if (updateError) {
          console.error('❌ Error updating monitor:', updateError);
        } else {
          console.log('✅ Monitor updated successfully');
        }

        // Insert check record with service role (no public INSERT policy on monitor_checks)
        const { error: checkError } = await supabaseService
          .from('monitor_checks')
          .insert({
            monitor_id: monitorId,
            status: testResult.status,
            response_time: testResult.responseTime,
            error_message: testResult.errorMessage || null,
          });

        if (checkError) {
          console.error('❌ Error inserting check record:', checkError);
        } else {
          console.log('✅ Check record added successfully');
        }

        // Send alert email if website transitioned to offline from any non-offline state
        if (previousStatus !== 'offline' && isNowOffline) {
          console.log('🚨 Website went down (', previousStatus, '→ offline ), sending alert email...');
          try {
            const alertResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-alert-email`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                monitorId,
                monitorName: monitorRow.name,
                monitorUrl: monitorRow.url,
                errorMessage: testResult.errorMessage,
                statusCode: testResult.statusCode || undefined,
              }),
            });
            if (!alertResponse.ok) {
              const alertError = await alertResponse.text();
              console.error('❌ Failed to send alert email:', alertError);
            } else {
              console.log('✅ Alert email sent successfully');
            }
          } catch (emailError) {
            console.error('❌ Error sending alert email:', emailError);
          }
        }
      } catch (dbError) {
        console.error('❌ Database operation failed:', dbError);
      }
    }

    console.log('🎯 Mission complete, returning results');
    return new Response(
      JSON.stringify(testResult),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Mission failed:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});