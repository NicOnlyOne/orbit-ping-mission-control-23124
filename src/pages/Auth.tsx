import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Navigation } from '@/components/Navigation';
import { PasswordStrengthChecker } from '@/components/PasswordStrengthChecker';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Rocket, Satellite, Eye, EyeOff } from 'lucide-react';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    fullName: ''
  });
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });
  
  const [showPasswords, setShowPasswords] = useState({
    signIn: false,
    signUp: false
  });
  
  const [isPasswordStrong, setIsPasswordStrong] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  
  const { signUp, signIn, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = setTimeout(() => setResetCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resetCooldown]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordStrong) {
      toast.error('Mission control requires a stronger access code. Please follow the security guidelines.');
      return;
    }
    
    setIsLoading(true);

    try {
      const { error } = await signUp(
        signUpData.email,
        signUpData.password,
        signUpData.fullName
      );

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Commander, this email is already in our system! Try signing in instead.');
        } else {
          toast.error(`Houston, we have a problem: ${error.message}`);
        }
      } else {
        toast.success('Welcome to mission control! Check your email to confirm your account.');
      }
    } catch (error) {
      toast.error('Launch sequence failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(signInData.email, signInData.password);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid coordinates! Check your email and password.');
        } else {
          toast.error(`Mission control error: ${error.message}`);
        }
      } else {
        toast.success('Welcome back, Commander! Initializing mission control...');
        navigate('/');
      }
    } catch (error) {
      toast.error('Communication failure. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-space-dark via-space-medium to-space-light">
      <Navigation />
      
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
      
      {/* Animated stars background */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute bg-white rounded-full animate-twinkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <Card className="w-full max-w-md relative z-10 bg-space-medium/80 border-space-light backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-gradient-to-r from-primary to-accent p-3 rounded-full w-16 h-16 flex items-center justify-center">
            <Rocket className="h-8 w-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">OrbitPing Mission Control</CardTitle>
            <CardDescription className="text-muted-foreground">
              Ready to launch your monitoring mission?
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="signin" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-space-dark">
              <TabsTrigger value="signin" className="data-[state=active]:bg-primary">
                <Satellite className="h-4 w-4 mr-2" />
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-primary">
                <Rocket className="h-4 w-4 mr-2" />
                Join Mission
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Mission ID (Email)</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="commander@example.com"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    required
                    className="bg-space-dark border-space-light"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Access Code</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPasswords.signIn ? "text" : "password"}
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                      className="bg-space-dark border-space-light pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="absolute right-0 top-0 h-full px-3 py-2"
                      onClick={() => setShowPasswords(prev => ({ ...prev, signIn: !prev.signIn }))}
                    >
                      {showPasswords.signIn ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  variant="rocket" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Connecting to Mission Control...' : 'Launch Dashboard'}
                </Button>

                <div className="text-center">
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                      disabled={resetCooldown > 0}
                      onClick={async () => {
                        if (!signInData.email) {
                          toast.error('Enter your Mission ID (email) first, then click forgot password.');
                          return;
                        }
                        setResetCooldown(60);
                        try {
                          const { error } = await supabase.auth.resetPasswordForEmail(signInData.email, {
                            redirectTo: `${window.location.origin}/reset-password`,
                          });
                          if (error) {
                            toast.error(`Could not send recovery link: ${error.message}`);
                          } else {
                            toast.success('Recovery link sent! Check your inbox, Commander.');
                          }
                        } catch {
                          toast.error('Failed to send recovery link. Try again.');
                        }
                      }}
                    >
                      {resetCooldown > 0
                        ? `Retry in ${resetCooldown}s`
                        : 'Forgot your access code?'}
                    </button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Commander Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Neil Armstrong"
                    value={signUpData.fullName}
                    onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                    className="bg-space-dark border-space-light"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Mission ID (Email)</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="commander@example.com"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    required
                    className="bg-space-dark border-space-light"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Access Code</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPasswords.signUp ? "text" : "password"}
                      placeholder="Minimum 8 characters"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      required
                      className="bg-space-dark border-space-light pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="absolute right-0 top-0 h-full px-3 py-2"
                      onClick={() => setShowPasswords(prev => ({ ...prev, signUp: !prev.signUp }))}
                    >
                      {showPasswords.signUp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                {signUpData.password && (
                  <PasswordStrengthChecker 
                    password={signUpData.password} 
                    onStrengthChange={setIsPasswordStrong}
                  />
                )}
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  variant="mission" 
                  disabled={isLoading || !signUpData.password || !isPasswordStrong}
                >
                  {isLoading ? 'Preparing Launch Sequence...' : 'Join the Mission'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}