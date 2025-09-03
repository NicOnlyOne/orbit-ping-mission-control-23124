import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
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

import { useToast } from "@/hooks/use-toast";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Lock, Bell, Save, Eye, EyeOff, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserProfile {
  full_name: string;
  email: string;
  phone_number: string;
  notification_email: boolean;
  notification_preferences: {
    alerts: boolean;
    downtime: boolean;
    recovery: boolean;
    sms: boolean;
  };
}

const Profile = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<UserProfile>({
    full_name: "",
    email: "",
    phone_number: "",
    notification_email: true,
    notification_preferences: {
      alerts: true,
      downtime: true,
      recovery: true,
      sms: true
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
        .select('full_name, email, phone_number, notification_email, notification_preferences')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setProfile({
          full_name: data.full_name || "",
          email: data.email || user?.email || "",
          phone_number: data.phone_number || "",
          notification_email: data.notification_email ?? true,
          notification_preferences: (data.notification_preferences as {
            alerts: boolean;
            downtime: boolean;
            recovery: boolean;
            sms: boolean;
          }) || {
            alerts: true,
            downtime: true,
            recovery: true,
            sms: true
          }
        });
      } else {
        // Create profile if it doesn't exist
        const defaultPreferences = {
          alerts: true,
          downtime: true,
          recovery: true,
          sms: true
        };
        
        await supabase
          .from('profiles')
          .insert({
            user_id: user?.id,
            email: user?.email,
            full_name: "",
            phone_number: "",
            notification_email: true,
            notification_preferences: defaultPreferences
          });
        
        setProfile({
          full_name: "",
          email: user?.email || "",
          phone_number: "",
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
            </div>
          </div>
        </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        {/* Profile Information */}
        <Card className="bg-space-medium border-space-light">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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

            <Button onClick={updateProfile} disabled={isLoading} className="w-full md:w-auto">
              <Save className="h-4 w-4 mr-2" />
              Save Profile
            </Button>
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
                      className="absolute right-0 top-0 h-full px-3 py-2"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    >
                      {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                      className={cn(
                        "bg-space-dark border-space-light pr-10",
                        passwords.confirm && passwords.new !== passwords.confirm && "border-destructive"
                      )}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    >
                      {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {passwords.confirm && passwords.new !== passwords.confirm && (
                    <p className="text-sm text-destructive">Passwords don't match</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {passwords.new && (
                  <PasswordStrengthChecker 
                    password={passwords.new} 
                    onStrengthChange={setIsPasswordStrong}
                  />
                )}
              </div>
            </div>

            <Button 
              onClick={updatePassword} 
              disabled={isLoading || !passwords.new || passwords.new !== passwords.confirm || !isPasswordStrong}
              className="w-full md:w-auto"
            >
              <Lock className="h-4 w-4 mr-2" />
              Update Password
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="bg-space-medium border-space-light">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notification Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive email alerts when your monitored sites go offline
                  </p>
                </div>
                <Switch
                  checked={profile.notification_email}
                  onCheckedChange={(checked) => setProfile(prev => ({ ...prev, notification_email: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    SMS Notifications
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Receive SMS alerts when your monitored sites go offline
                  </p>
                  {!profile.phone_number && (
                    <p className="text-sm text-orange-500">
                      Please add a phone number above to enable SMS notifications
                    </p>
                  )}
                </div>
                <Switch
                  checked={profile.notification_preferences.sms && !!profile.phone_number}
                  onCheckedChange={(checked) => setProfile(prev => ({ 
                    ...prev, 
                    notification_preferences: { 
                      ...prev.notification_preferences, 
                      sms: checked 
                    } 
                  }))}
                  disabled={!profile.phone_number}
                />
              </div>
            </div>
            
            <Separator className="bg-space-light" />

            <div className="space-y-4">
              <h4 className="font-medium">Alert Types</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Downtime Alerts</p>
                    <p className="text-xs text-muted-foreground">When sites go offline</p>
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
                    <p className="text-xs text-muted-foreground">When sites come back online</p>
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

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">General Alerts</p>
                    <p className="text-xs text-muted-foreground">Other important notifications</p>
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
            </div>
            
            <Separator className="bg-space-light" />
            
            <Button onClick={updateProfile} disabled={isLoading} className="w-full md:w-auto">
              <Save className="h-4 w-4 mr-2" />
              Save Notification Settings
            </Button>
          </CardContent>
        </Card>

      </div>
      </div>
    </div>
  );
};

export default Profile;