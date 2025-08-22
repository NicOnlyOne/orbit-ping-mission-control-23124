import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Clock, RefreshCw, Rocket } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Link } from "react-router-dom";

interface TestResult {
  status: 'online' | 'offline' | 'warning';
  responseTime: number;
  errorMessage?: string;
  statusCode?: number;
}

interface AnonymousUrlCheckerProps {
  onConvertToUser?: (url: string) => void;
}

export const AnonymousUrlChecker = ({ onConvertToUser }: AnonymousUrlCheckerProps) => {
  const [url, setUrl] = useState("https://niconlyone.com/");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showConversion = result?.status && result.status !== 'offline' && !error;

  const handleTestUrl = async () => {
    if (!url) {
      setError("Please enter a URL.");
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // The function now expects a JSON object with a 'url' key. This is the crucial fix.
      const { data, error: functionError } = await supabase.functions.invoke('test-url', {
        body: { url: url },
      });

      if (functionError) {
        throw new Error(functionError.message);
      }
      
      // The backend returns a simple object. We need to map it to the TestResult format.
      const probeResult = data.result;
      const newResult: TestResult = {
        status: probeResult.ok ? 'online' : 'offline',
        responseTime: data.duration,
        statusCode: probeResult.status,
        errorMessage: probeResult.error,
      };

      setResult(newResult);

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      setResult(null); // Clear previous results on error
    } finally {
      // Ensure the loading spinner always stops.
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-space-dark border-space-light shadow-[0_0_30px_hsl(18_90%_55%/0.2)]">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold">
          <Rocket className="inline-block mr-2 text-primary" />
          Mission Control: Instant Ping
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-grow space-y-2">
            <Label htmlFor="url-input">Target URL</Label>
            <Input
              id="url-input"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-space-medium border-space-light focus:ring-primary focus:border-primary"
            />
          </div>
          <Button
            onClick={handleTestUrl}
            disabled={loading}
            className="self-end sm:w-auto w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Pinging...
              </>
            ) : (
              "Launch Probe"
            )}
          </Button>
        </div>

        {error && (
            <div className="mt-4 text-center p-4 bg-red-900/50 border border-red-500/50 text-white rounded-md">
                <AlertCircle className="inline-block mr-2" />
                {error}
            </div>
        )}

        {result && (
          <Card className="mt-6 bg-space-medium border-space-light">
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className={`text-2xl font-bold flex items-center justify-center gap-2 ${
                    result.status === 'online' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {result.status === 'online' ? <CheckCircle /> : <AlertCircle />}
                    {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Response Time</p>
                  <p className="text-2xl font-bold flex items-center justify-center gap-2">
                    <Clock size={20} />
                    {result.responseTime}ms
                  </p>
                </div>
                <div className="space-y-1 col-span-2 md:col-span-1">
                  <p className="text-sm font-medium text-muted-foreground">URL</p>
                  <p className="text-lg font-mono truncate" title={url}>{url}</p>
                </div>
              </div>
            </div>
            {result.errorMessage && (
              <div className="p-3 bg-destructive/10 border-t border-space-light text-destructive-foreground rounded-b-md">
                <p className="font-semibold text-sm">Details:</p>
                <p className="text-xs font-mono">{result.errorMessage}</p>
              </div>
            )}
          </Card>
        )}

        {showConversion && onConvertToUser && (
             <Card className="text-center mt-6 p-6 bg-gradient-to-br from-background to-muted/30 border-space-light">
                <CardContent className="space-y-4 p-0">
                    <h3 className="text-xl font-bold">Don't Let Your Guard Down</h3>
                    <p className="text-muted-foreground">
                        A single check isn't enough. Get instant alerts and historical uptime data.
                        It's free.
                    </p>
                    <Button asChild className="w-full" size="lg" onClick={() => onConvertToUser(url)}>
                        <Link to="/login">
                            <Rocket className="h-4 w-4 mr-2" />
                            Deploy Continuous Monitoring
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        )}
      </CardContent>
    </Card>
  );
};
