import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PasswordStrengthChecker } from "@/components/PasswordStrengthChecker";
import { Navigation } from "@/components/Navigation";
import { PhoneNumberInput } from "@/components/PhoneNumberInput";
import { AvatarUpload } from "@/components/AvatarUpload";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PricingModal } from "@/components/PricingModal";
import { PlanBadge } from "@/components/PlanBadge";
import { useToast } from "@/hooks/use-toast";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Lock, Bell, Save, Eye, EyeOff, Phone, Palette, MessageSquare, Crown, Smartphone } from "lucide-react";

interface UserProfile {
  full_name: string;
  email: string;
  phone_number: string;
  avatar_url: string | null;
  theme_preference: string;
  slack_username: string;
  slack_channel: string;
  notification_email: boolean;
  notification_preferences: {
    alerts: boolean;
    downtime: boolean;
    recovery: boolean;
    sms: boolean;
    slack: boolean;
  };
}

const Profile = () => {
  const { user, loading } = useAuth();
  const { plan, features } = useSubscription();
  const { toast } = useToast();
  const [showPricing, setShowPricing] = useState(false);
  
  const [profile, setProfile] = useState<UserProfile>({
    full_name: "",
    email: "",
    phone_number: "",
    avatar_url: null,
    theme_preference: "system",
    slack_username: "",
    slack_channel: "",
    notification_email: true,
    notification_preferences: {
      alerts: true,
      downtime: true,
      recovery: true,
      sms: true,
      slack: false
    }
  });
  
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: ""
  });
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  
  const [isPasswordStrong, setIsPasswordStrong] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Load user profile
  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        const defaultPreferences = {
          alerts: true,
          downtime: true,
          recovery: true,
          sms: true,
          slack: false
        };

        // Type guard to check if notification_preferences is a valid object
        const isValidPreferences = (prefs: any): prefs is typeof defaultPreferences => {
          return prefs && typeof prefs === 'object' && 
                 typeof prefs.alerts === 'boolean' &&
                 typeof prefs.downtime === 'boolean' &&
                 typeof prefs.recovery === 'boolean' &&
                 typeof prefs.sms === 'boolean' &&
                 typeof prefs.slack === 'boolean';
        };

        setProfile({
          full_name: data.full_name || "",
          email: data.email || user?.email || "",
          phone_number: data.phone_number || "",
          avatar_url: data.avatar_url || null,
          theme_preference: data.theme_preference || "system",
          slack_username: data.slack_username || "",
          slack_channel: data.slack_channel || "",
          notification_email: data.notification_email ?? true,
          notification_preferences: isValidPreferences(data.notification_preferences) 
            ? data.notification_preferences 
            : defaultPreferences
        });
      } else {
        // Create profile if it doesn't exist
        const defaultPreferences = {
          alerts: true,
          downtime: true,
          recovery: true,
          sms: true,
          slack: false
        };
        
        await supabase
          .from('profiles')
          .insert({
            user_id: user?.id,
            email: user?.email,
            full_name: "",
            phone_number: "",
            avatar_url: null,
            theme_preference: "system",
            slack_username: "",
            slack_channel: "",
            notification_email: true,
            notification_preferences: defaultPreferences
          });
        
        setProfile({
          full_name: "",
          email: user?.email || "",
          phone_number: "",
          avatar_url: null,
          theme_preference: "system",
          slack_username: "",
          slack_channel: "",
          notification_email: true,
          notification_preferences: defaultPreferences
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive"
      });
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const updateProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          full_name: profile.full_name,
          email: profile.email,
          phone_number: profile.phone_number,
          avatar_url: profile.avatar_url,
          theme_preference: profile.theme_preference,
          slack_username: profile.slack_username,
          slack_channel: profile.slack_channel,
          notification_email: profile.notification_email,
          notification_preferences: profile.notification_preferences
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateEmail = async () => {
    if (!user || profile.email === user.email) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: profile.email
      });

      if (error) throw error;

      toast({
        title: "Email Update",
        description: "Check your new email for confirmation link",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update email",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async () => {
    if (!passwords.new || passwords.new !== passwords.confirm) {
      toast({
        title: "Error",
        description: "Passwords don't match",
        variant: "destructive"
      });
      return;
    }

    if (!isPasswordStrong) {
      toast({
        title: "Error",
        description: "Please choose a stronger password",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });

      if (error) throw error;

      setPasswords({ current: "", new: "", confirm: "" });
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlanRestrictedAction = (featureName: string, requiredPlan: string) => {
    toast({
      title: "Premium Feature",
      description: `${featureName} is available on ${requiredPlan} plan and above`,
      variant: "default"
    });
    setShowPricing(true);
  };

  if (loading || isLoadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">🛰️</div>
          <p className="text-xl text-muted-foreground">Loading Profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium">
      <Navigation />
      
      <div className="pt-20">
        <div className="bg-space-dark/80 backdrop-blur-sm border-b border-space-light">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">User Profile</h1>
              <PlanBadge />
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
          {/* Plan and Billing */}
          <Card className="bg-space-medium border-space-light">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Plan and billing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  {/* Current Plan Status */}
                  <div className="p-4 bg-gradient-to-r from-primary/10 to-blue-500/10 border border-primary/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">You're on {plan.charAt(0).toUpperCase() + plan.slice(1).replace('-', ' ')} Plan</span>
                      </div>
                      <PlanBadge />
                    </div>
                  </div>
                  
                  {/* Subscription Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Subscription started</p>
                      <p className="text-sm font-medium">
                        {new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {plan === 'free' ? 'Plan type' : 'Renews'}
                      </p>
                      <p className="text-sm font-medium">
                        {plan === 'free' 
                          ? 'Free forever'
                          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })
                        }
                      </p>
                    </div>
                  </div>

                  {/* SMS Credits for Enterprise Plans */}
                  {(plan === 'enterprise-100' || plan === 'enterprise-250') && (
                    <div className="p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">SMS Credits</span>
                        </div>
                        <span className="text-sm text-muted-foreground">850 / 1000</span>
                      </div>
                      <div className="w-full bg-space-dark rounded-full h-2 mb-2">
                        <div className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Credits reset on next billing cycle. Unused credits roll over.
                      </p>
                    </div>
                  )}
                </div>

                {/* Manage Section - Always Visible */}
                <div className="flex flex-col gap-3 lg:w-48">
                  <Button variant="outline" disabled className="w-full">
                    Manage payment
                  </Button>
                  <Button onClick={() => setShowPricing(true)} className="w-full">
                    Change plan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Information */}
          <Card className="bg-space-medium border-space-light">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-start gap-8">
                {/* Avatar Section */}
                <div className="flex-shrink-0">
                  <AvatarUpload
                    userId={user.id}
                    currentAvatarUrl={profile.avatar_url}
                    onAvatarChange={(avatarUrl) => setProfile(prev => ({ ...prev, avatar_url: avatarUrl }))}
                  />
                </div>

                {/* Profile Fields */}
                <div className="flex-1 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        value={profile.full_name}
                        onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder="Enter your full name"
                        className="bg-space-dark border-space-light"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="flex gap-2">
                        <Input
                          id="email"
                          type="email"
                          value={profile.email}
                          onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="Enter your email"
                          className="bg-space-dark border-space-light"
                        />
                        {profile.email !== user.email && (
                          <Button onClick={updateEmail} disabled={isLoading} variant="outline">
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {profile.email !== user.email && (
                        <p className="text-sm text-muted-foreground">
                          Email change requires confirmation
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <PhoneNumberInput
                      value={profile.phone_number}
                      onChange={(phone) => setProfile(prev => ({ ...prev, phone_number: phone }))}
                      label="Phone Number"
                      placeholder="Enter your phone number"
                    />
                    <p className="text-sm text-muted-foreground">
                      Used for SMS alerts when your monitored sites go offline
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={updateProfile} disabled={isLoading} className="w-full md:w-auto">
                <Save className="h-4 w-4 mr-2" />
                Save Profile
              </Button>
            </CardContent>
          </Card>

          {/* Theme Settings */}
          <Card className="bg-space-medium border-space-light">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Theme Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Theme Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred color scheme
                  </p>
                </div>
                <ThemeToggle 
                  value={profile.theme_preference} 
                  onChange={(value) => setProfile(prev => ({ ...prev, theme_preference: value }))} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Slack Integration */}
          <Card className="bg-space-medium border-space-light">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Slack Integration
                {!features.slackNotifications && (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-muted-foreground">Pro Plan Required</span>
                    <Crown className="h-4 w-4 text-yellow-500" />
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!features.slackNotifications && (
                <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Crown className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-sm mb-1">Upgrade to Pro for Slack Notifications</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Get instant alerts in your Slack channels when your sites go down
                      </p>
                      <Button size="sm" onClick={() => setShowPricing(true)} className="h-7">
                        Upgrade to Pro
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="slackUsername">Slack Username</Label>
                  <Input
                    id="slackUsername"
                    value={profile.slack_username}
                    onChange={(e) => setProfile(prev => ({ ...prev, slack_username: e.target.value }))}
                    placeholder="@username"
                    className="bg-space-dark border-space-light"
                    disabled={!features.slackNotifications}
                  />
                  <p className="text-sm text-muted-foreground">
                    Your Slack username for notifications
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="slackChannel">Slack Channel</Label>
                  <Input
                    id="slackChannel"
                    value={profile.slack_channel}
                    onChange={(e) => setProfile(prev => ({ ...prev, slack_channel: e.target.value }))}
                    placeholder="#channel or @user"
                    className="bg-space-dark border-space-light"
                    disabled={!features.slackNotifications}
                  />
                  <p className="text-sm text-muted-foreground">
                    Channel or user to send alerts to
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Slack Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts in Slack when your sites go offline
                  </p>
                  {features.slackNotifications && (!profile.slack_username || !profile.slack_channel) && (
                    <p className="text-sm text-orange-500">
                      Please configure Slack username and channel above to enable notifications
                    </p>
                  )}
                  {!features.slackNotifications && (
                    <p className="text-sm text-purple-400">
                      Available on Pro plan and above
                    </p>
                  )}
                </div>
                <Switch
                  checked={features.slackNotifications && profile.notification_preferences.slack && !!(profile.slack_username && profile.slack_channel)}
                  onCheckedChange={(checked) => {
                    if (!features.slackNotifications) {
                      handlePlanRestrictedAction("Slack notifications", "Pro");
                      return;
                    }
                    setProfile(prev => ({ 
                      ...prev, 
                      notification_preferences: { 
                        ...prev.notification_preferences, 
                        slack: checked 
                      } 
                    }));
                  }}
                  disabled={!features.slackNotifications || (!profile.slack_username || !profile.slack_channel)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Password Update */}
          <Card className="bg-space-medium border-space-light">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPasswords.new ? "text" : "password"}
                        value={passwords.new}
                        onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                        placeholder="Enter new password"
                        className="bg-space-dark border-space-light pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      >
                        {showPasswords.new ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showPasswords.confirm ? "text" : "password"}
                        value={passwords.confirm}
                        onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                        placeholder="Confirm new password"
                        className="bg-space-dark border-space-light pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      >
                        {showPasswords.confirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <PasswordStrengthChecker
                    password={passwords.new}
                    onStrengthChange={setIsPasswordStrong}
                  />
                </div>
              </div>

              <Button
                onClick={updatePassword}
                disabled={isLoading || !isPasswordStrong || passwords.new !== passwords.confirm}
                className="w-full md:w-auto"
              >
                <Lock className="h-4 w-4 mr-2" />
                Update Password
              </Button>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card className="bg-space-medium border-space-light">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-medium mb-4">Alert Types</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Downtime Alerts</p>
                          <p className="text-xs text-muted-foreground">When your site goes offline</p>
                        </div>
                        <Switch
                          checked={profile.notification_preferences.downtime}
                          onCheckedChange={(checked) => setProfile(prev => ({ 
                            ...prev, 
                            notification_preferences: { 
                              ...prev.notification_preferences, 
                              downtime: checked 
                            } 
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Recovery Alerts</p>
                          <p className="text-xs text-muted-foreground">When your site comes back online</p>
                        </div>
                        <Switch
                          checked={profile.notification_preferences.recovery}
                          onCheckedChange={(checked) => setProfile(prev => ({ 
                            ...prev, 
                            notification_preferences: { 
                              ...prev.notification_preferences, 
                              recovery: checked 
                            } 
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-medium mb-4">Delivery Methods</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Email Notifications</p>
                          <p className="text-xs text-muted-foreground">Receive alerts via email</p>
                        </div>
                        <Switch
                          checked={profile.notification_email}
                          onCheckedChange={(checked) => setProfile(prev => ({ 
                            ...prev, 
                            notification_email: checked 
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium text-sm">SMS Notifications</p>
                            <p className="text-xs text-muted-foreground">Receive alerts via text message</p>
                            {features.smsNotifications && !profile.phone_number && (
                              <p className="text-xs text-orange-500">Please add phone number above</p>
                            )}
                            {!features.smsNotifications && (
                              <p className="text-xs text-yellow-600">Enterprise plan required</p>
                            )}
                          </div>
                          {!features.smsNotifications && (
                            <div className="ml-2">
                              <Crown className="h-4 w-4 text-yellow-500" />
                            </div>
                          )}
                        </div>
                        <Switch
                          checked={features.smsNotifications && profile.notification_preferences.sms && !!profile.phone_number}
                          onCheckedChange={(checked) => {
                            if (!features.smsNotifications) {
                              handlePlanRestrictedAction("SMS notifications", "Enterprise");
                              return;
                            }
                            setProfile(prev => ({ 
                              ...prev, 
                              notification_preferences: { 
                                ...prev.notification_preferences, 
                                sms: checked 
                              } 
                            }));
                          }}
                          disabled={!features.smsNotifications || !profile.phone_number}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium text-sm">Slack Notifications</p>
                            <p className="text-xs text-muted-foreground">Receive alerts in Slack</p>
                            {features.slackNotifications && (!profile.slack_username || !profile.slack_channel) && (
                              <p className="text-xs text-orange-500">Please configure Slack integration above</p>
                            )}
                            {!features.slackNotifications && (
                              <p className="text-xs text-purple-400">Pro plan required</p>
                            )}
                          </div>
                          {!features.slackNotifications && (
                            <div className="ml-2">
                              <Crown className="h-4 w-4 text-purple-500" />
                            </div>
                          )}
                        </div>
                        <Switch
                          checked={features.slackNotifications && profile.notification_preferences.slack && !!(profile.slack_username && profile.slack_channel)}
                          onCheckedChange={(checked) => {
                            if (!features.slackNotifications) {
                              handlePlanRestrictedAction("Slack notifications", "Pro");
                              return;
                            }
                            setProfile(prev => ({ 
                              ...prev, 
                              notification_preferences: { 
                                ...prev.notification_preferences, 
                                slack: checked 
                              } 
                            }));
                          }}
                          disabled={!features.slackNotifications || (!profile.slack_username || !profile.slack_channel)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">System Alerts</p>
                    <p className="text-xs text-muted-foreground">Important system updates</p>
                  </div>
                  <Switch
                    checked={profile.notification_preferences.alerts}
                    onCheckedChange={(checked) => setProfile(prev => ({ 
                      ...prev, 
                      notification_preferences: { 
                        ...prev.notification_preferences, 
                        alerts: checked 
                      } 
                    }))}
                  />
                </div>
              </div>

              <Button onClick={updateProfile} disabled={isLoading} className="w-full md:w-auto">
                <Save className="h-4 w-4 mr-2" />
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
      
      <PricingModal open={showPricing} onOpenChange={setShowPricing} />
    </div>
  );
};

export default Profile;