import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useAdmin } from "@/hooks/useAdmin";
import { LogOut, User, ChevronDown, Crown, BarChart3, Shield, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PlanBadge } from "./PlanBadge";
import { PricingModal } from "./PricingModal";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHighContrast } from "@/hooks/useHighContrast";

interface UserProfile {
  full_name: string;
  avatar_url: string | null;
}

export function Navigation() {
  const { user, signOut } = useAuth();
  const { plan } = useSubscription();
  const { isAdmin } = useAdmin();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const { highContrast, toggle: toggleContrast } = useHighContrast();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user?.id)
        .maybeSingle();
      
      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-space-dark/80 backdrop-blur-sm border-b border-space-light">
      <div className="max-w-7xl mx-auto px-space-page-x py-space-md flex justify-between items-center">
        <Link to="/" className="flex items-center gap-space-sm hover:opacity-80 transition-opacity">
          <span className="text-section-title">🚀</span>
          <span className="text-card-title font-token-bold text-foreground">OrbitPing</span>
          <Badge variant="secondary" className="ml-space-sm uppercase tracking-wide">Alpha Test</Badge>
        </Link>
        
          <div className="flex items-center gap-space-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
                className="text-muted-foreground hover:text-foreground"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{theme === 'dark' ? "Light mode" : "Dark mode"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleContrast}
                aria-label={highContrast ? "Switch to standard contrast" : "Switch to high contrast"}
                className="text-muted-foreground hover:text-foreground"
              >
                {highContrast ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{highContrast ? "Standard mode" : "High contrast (WCAG)"}</TooltipContent>
          </Tooltip>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="flex items-center gap-3 text-muted-foreground hover:text-foreground px-3 py-2"
                >
                  <Avatar className="h-8 w-8">
                    {profile?.avatar_url ? (
                      <AvatarImage 
                        src={profile.avatar_url} 
                        alt={profile.full_name || "User avatar"} 
                      />
                    ) : null}
                    <AvatarFallback className="bg-muted">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                    <div className="flex items-center gap-space-sm">
                    <span className="hidden sm:inline font-token-medium">
                      {profile?.full_name || user.email}
                    </span>
                    <PlanBadge />
                    {isAdmin && (
                      <span className="flex items-center gap-1 text-caption font-token-semibold bg-primary/20 text-primary px-1.5 py-0.5 rounded-badge">
                        <Shield className="h-3 w-3" />
                        Admin
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center w-full">
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center w-full">
                        <Shield className="h-4 w-4 mr-2" />
                        Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/analytics" className="flex items-center w-full">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Analytics
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowPricing(true)} className="flex items-center w-full">
                  <Crown className="h-4 w-4 mr-2" />
                  Plan and billing
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="flex items-center w-full">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth">
              <Button variant="outline" size="sm">
                <User className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
    
    <PricingModal open={showPricing} onOpenChange={setShowPricing} />
  </>
);
}
