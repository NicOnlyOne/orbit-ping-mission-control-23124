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
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header (optional for anonymous testing)
    const authHeader = req.headers.get('Authorization');
    let isAuthenticated = false;
    
    if (authHeader) {
      isAuthenticated = true;
    }

    // Set the auth token for the request
    supabase.auth.getUser = () => Promise.resolve({ data: { user: null }, error: null });
    
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

    // If monitorId is provided and user is authenticated, update the monitor and add a check record
    if (monitorId && isAuthenticated) {
      console.log(`💾 Updating monitor ${monitorId} with results`);
      
      try {
        // Update the monitor with latest results
        const { error: updateError } = await supabase
          .from('monitors')
          .update({
            status: testResult.status,
            last_checked: new Date().toISOString(),
            response_time: testResult.responseTime,
            error_message: testResult.errorMessage || null
          })
          .eq('id', monitorId);

        if (updateError) {
          console.error('❌ Error updating monitor:', updateError);
        } else {
          console.log('✅ Monitor updated successfully');
        }

        // Add a check record
        const { error: checkError } = await supabase
          .from('monitor_checks')
          .insert({
            monitor_id: monitorId,
            status: testResult.status === 'checking' ? 'online' : testResult.status,
            response_time: testResult.responseTime,
            error_message: testResult.errorMessage || null
          });

        if (checkError) {
          console.error('❌ Error inserting check record:', checkError);
        } else {
          console.log('✅ Check record added successfully');
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