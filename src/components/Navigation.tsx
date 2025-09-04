import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { LogOut, User, ChevronDown, Crown } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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

interface UserProfile {
  full_name: string;
  avatar_url: string | null;
}

export function Navigation() {
  const { user, signOut } = useAuth();
  const { plan } = useSubscription();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showPricing, setShowPricing] = useState(false);

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
        .eq('user_id', user?.id)
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
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-2xl">🚀</span>
          <span className="text-xl font-bold text-foreground">OrbitPing</span>
          <Badge variant="secondary" className="ml-2 uppercase tracking-wide">Alpha Test</Badge>
        </Link>
        
        <div className="flex items-center gap-4">
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
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline font-medium">
                      {profile?.full_name || user.email}
                    </span>
                    <PlanBadge />
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