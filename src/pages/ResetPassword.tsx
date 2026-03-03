import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navigation } from '@/components/Navigation';
import { PasswordStrengthChecker } from '@/components/PasswordStrengthChecker';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { KeyRound, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPasswordStrong, setIsPasswordStrong] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const navigate = useNavigate();

  // Wait for Supabase to process the recovery token from the URL
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Also check if session already exists (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      }
    });

    // Timeout after 10s if no session arrives
    const timeout = setTimeout(() => {
      setSessionReady((ready) => {
        if (!ready) setSessionError(true);
        return ready;
      });
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Access codes do not match. Please re-enter.');
      return;
    }

    if (!isPasswordStrong) {
      toast.error('Mission control requires a stronger access code.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(`Failed to update access code: ${error.message}`);
      } else {
        toast.success('Access code updated! Redirecting to mission control…');
        navigate('/');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-space-dark via-space-medium to-space-light">
      <Navigation />

      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />

       <Card className="w-full max-w-md relative z-10 bg-space-medium/80 border-space-light backdrop-blur-sm">
        {sessionError ? (
          <CardContent className="pt-8 text-center space-y-4">
            <p className="text-destructive">Recovery link expired or invalid. Please request a new one.</p>
            <Button variant="ghost" onClick={() => navigate('/auth')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sign In
            </Button>
          </CardContent>
        ) : !sessionReady ? (
          <CardContent className="pt-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Verifying recovery link…</p>
          </CardContent>
        ) : (
          <>
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto bg-gradient-to-r from-primary to-accent p-3 rounded-full w-16 h-16 flex items-center justify-center">
              <KeyRound className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">Set New Access Code</CardTitle>
              <CardDescription className="text-muted-foreground">
                Enter your new secure access code below.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Access Code</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-space-dark border-space-light pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="absolute right-0 top-0 h-full px-3 py-2"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {password && (
                <PasswordStrengthChecker password={password} onStrengthChange={setIsPasswordStrong} />
              )}

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Access Code</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="bg-space-dark border-space-light pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="absolute right-0 top-0 h-full px-3 py-2"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                variant="rocket"
                disabled={isLoading || !password || !isPasswordStrong || password !== confirmPassword}
              >
                {isLoading ? 'Updating Access Code…' : 'Update Access Code'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate('/auth')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sign In
              </Button>
            </form>
          </CardContent>
          </>
        )}
        </Card>
      </div>
    </div>
  );
}
