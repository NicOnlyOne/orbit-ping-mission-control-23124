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
  const [url, setUrl] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [showConversion, setShowConversion] = useState(false);

  const handleCheck = async () => {
    if (!url.trim()) return;
    
    setIsChecking(true);
    setResult(null);
    setShowConversion(false);

    try {
      const { data: backendResult, error } = await supabase.functions.invoke('test-url', {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (error) throw error;

      // --- Translation Guide ---
      // Map the backend's response ('UP'/'DOWN') to what the UI understands ('online'/'offline')
      const mappedResult: TestResult = {
        status: backendResult.status === 'UP' ? 'online' : 'offline',
        responseTime: backendResult.responseTime,
        errorMessage: backendResult.message,
        statusCode: backendResult.httpStatus,
      };
      
      setResult(mappedResult);
      setShowConversion(true);

    } catch (err: any) {
      console.error("Error testing URL:", err);
      setResult({
        status: 'offline',
        responseTime: 0,
        errorMessage: err.message || 'An unknown error occurred.',
      });
      setShowConversion(true);
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'online': return <CheckCircle className="h-6 w-6 text-status-online" />;
      case 'offline': return <AlertCircle className="h-6 w-6 text-status-offline" />;
      case 'warning': return <AlertCircle className="h-6 w-6 text-yellow-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'online': return "text-status-online";
      case 'offline': return "text-status-offline";
      case 'warning': return "text-yellow-500";
      default: return "";
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Is your Mission-Critical Website Online?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-grow">
            <Label htmlFor="anonymous-url-check" className="sr-only">Website URL</Label>
            <Input
              id="anonymous-url-check"
              type="url"
              placeholder="e.g. https://my-website.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              disabled={isChecking}
              className="text-lg"
            />
          </div>
          <Button onClick={handleCheck} disabled={isChecking || !url.trim()} size="lg">
            {isChecking ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              "Check Status"
            )}
          </Button>
        </div>

        {result && (
          <Card className="bg-muted/50 p-6">
            <div className="flex items-start gap-4">
              <div className="mt-1">
                {getStatusIcon(result.status)}
              </div>
              <div className="flex-grow grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className={`text-2xl font-bold ${getStatusColor(result.status)}`}>
                    {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Response Time</p>
                  <p className="text-2xl font-bold">{result.responseTime}ms</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">URL</p>
                  <p className="text-lg font-mono truncate" title={url}>{url}</p>
                </div>
              </div>
            </div>
            {result.errorMessage && (
              <div className="mt-4 p-3 bg-destructive/10 border-l-4 border-destructive text-destructive-foreground rounded-r-md">
                <p className="font-semibold text-sm">Details:</p>
                <p className="text-xs font-mono">{result.errorMessage}</p>
              </div>
            )}
          </Card>
        )}

        {showConversion && onConvertToUser && (
             <Card className="text-center p-6 bg-gradient-to-br from-background to-muted/30">
                <CardContent className="space-y-4">
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
