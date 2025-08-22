import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
      const { data, error } = await supabase.functions.invoke('test-url', {
        body: { url: url.trim() }
      });

      if (error) throw error;

      setResult(data as TestResult);
      setShowConversion(true);
      
      // Store in localStorage for potential conversion
      localStorage.setItem('pending-mission-url', url.trim());
      
    } catch (error) {
      console.error('Error testing URL:', error);
      setResult({
        status: 'offline',
        responseTime: 0,
        errorMessage: 'Failed to test URL'
      });
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'offline':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'warning':
        return 'Slow Response';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-space-medium border-space-light">
        <CardHeader>
          <CardTitle className="text-center text-xl">
            🔍 Free URL Health Check
          </CardTitle>
          <p className="text-center text-muted-foreground">
            Test any website instantly - no registration required
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="check-url" className="text-sm font-medium">
              Website URL
            </Label>
            <Input
              id="check-url"
              placeholder="https://your-website.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-space-dark border-space-light mt-2"
              onKeyPress={(e) => e.key === 'Enter' && !isChecking && handleCheck()}
            />
          </div>

          <Button 
            variant="rocket" 
            className="w-full"
            disabled={!url.trim() || isChecking}
            onClick={handleCheck}
          >
            {isChecking ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Checking Status...
              </>
            ) : (
              <>
                🔍 Check Website Status
              </>
            )}
          </Button>

          {result && (
            <Card className="bg-space-dark border-space-light">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{getStatusText(result.status)}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {result.responseTime}ms
                  </span>
                </div>
                
                <div className="text-sm text-muted-foreground mb-2">
                  URL: {url}
                </div>

                {result.errorMessage && (
                  <div className="text-sm text-red-400">
                    Error: {result.errorMessage}
                  </div>
                )}

                {result.statusCode && (
                  <div className="text-sm text-muted-foreground">
                    Status Code: {result.statusCode}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {showConversion && result && (
            <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="text-lg font-semibold">
                    🚀 Want to monitor this website 24/7?
                  </div>
                  <p className="text-muted-foreground">
                    Create a free account to get continuous monitoring, instant alerts, 
                    uptime tracking, and detailed analytics for your websites.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to="/auth" onClick={() => onConvertToUser?.(url)}>
                      <Button variant="rocket" size="lg">
                        🚀 Start Free Monitoring
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="lg"
                      onClick={() => setShowConversion(false)}
                    >
                      Maybe Later
                    </Button>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Free forever • No credit card required • 30-second setup
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};