import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, RefreshCw, Rocket } from 'lucide-react';
import { TestResult } from '@/lib/types';
import { Link } from 'react-router-dom';

interface AnonymousUrlCheckerProps {
  onConvertToUser: (url: string) => void;
}

export function AnonymousUrlChecker({ onConvertToUser }: AnonymousUrlCheckerProps) {
  const [url, setUrl] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const checkUrl = async () => {
    if (!url) return;
    try {
      setIsChecking(true);
      setResult(null);

      // For anonymous users, we need to be explicit with headers and body format.
      const { data, error } = await supabase.functions.invoke("test-url", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (error) throw error;
      
      setResult(data);
    } catch (error) {
      console.error('Error testing URL:', error);
      setResult({
        status: 'DOWN',
        responseTime: 0,
        message: (error instanceof Error ? error.message : 'An unknown error occurred.'),
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      checkUrl();
    }
  };

  const handleSignUp = () => {
    onConvertToUser(url);
  };

  return (
    <Card className="w-full max-w-xl mx-auto shadow-lg bg-card/80 backdrop-blur-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold">Is Your Mission Online?</CardTitle>
        <CardDescription className="text-lg text-muted-foreground">
          Perform a real-time signal check from our global network.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex w-full items-center space-x-2 mb-4">
          <Input
            type="text"
            placeholder="https://your-website.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isChecking}
            className="text-base"
          />
          <Button onClick={checkUrl} disabled={isChecking || !url} size="lg" variant="satellite">
            {isChecking ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              'Ping Signal'
            )}
          </Button>
        </div>

        {result && (
          <div className={`mt-6 p-4 rounded-lg flex items-center gap-4 ${result.status === 'UP' ? 'bg-green-900/50 border border-green-700' : 'bg-red-900/50 border border-red-700'}`}>
            {result.status === 'UP' ? (
              <CheckCircle className="h-8 w-8 text-status-online" />
            ) : (
              <AlertCircle className="h-8 w-8 text-status-offline" />
            )}
            <div className='w-full'>
              <p className={`text-xl font-bold ${result.status === 'UP' ? 'text-status-online' : 'text-status-offline'}`}>
                Status: {result.status}
              </p>
              {result.status === 'UP' ? (
                <p className="text-sm text-muted-foreground">
                  Signal acquired in {result.responseTime}ms. Your mission is operational.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Signal lost. {result.message || "Could not connect to the server."}
                </p>
              )}
            </div>
          </div>
        )}

        {result && (
            <Card className="mt-6 bg-background/50 border-border/50">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Rocket className="h-6 w-6 text-primary" />
                        <div>
                            <CardTitle>Ready for Mission Control?</CardTitle>
                            <CardDescription>
                                Turn this one-time ping into a 24/7 automated mission.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="mb-4 text-sm text-muted-foreground">
                        Get instant alerts via email when your site goes down, track uptime history, and monitor performance over time. It's free.
                    </p>
                    <Button asChild className="w-full" size="lg" onClick={handleSignUp}>
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
}
