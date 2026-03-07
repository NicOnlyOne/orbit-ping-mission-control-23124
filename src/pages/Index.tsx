import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MissionCard } from "@/components/MissionCard";
import { StatusIndicator } from "@/components/StatusIndicator";
import { AnonymousUrlChecker } from "@/components/AnonymousUrlChecker";
import { SMSForm } from "@/components/SMSForm";
import { SMSLogs } from "@/components/SMSLogs";
import { Navigation } from "@/components/Navigation";
import { SlackTestButton } from "@/components/SlackTestButton";
import { SlackIntegrationTest } from "@/components/SlackIntegrationTest";
import { PlanLimitWarning } from "@/components/PlanLimitWarning";
import { PricingModal } from "@/components/PricingModal";
import heroImage from "@/assets/hero-mission-control.jpg";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMonitors } from "@/hooks/useMonitors";
import { useSubscription } from "@/hooks/useSubscription";
import { Link } from "react-router-dom";
import { Plus, RefreshCw, Check, Star, Rocket, Crown, Mail, MessageSquare, Smartphone } from "lucide-react";

const Index = () => {
  const [newMissionUrl, setNewMissionUrl] = useState("");
  const [newMissionName, setNewMissionName] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  
  // State for dropdown selections
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({
    pro: 25,
    enterprise: 100
  });
  const {
    user,
    loading
  } = useAuth();
  
  const {
    monitors,
    loading: monitorsLoading,
    createMonitor,
    testMonitor,
    deleteMonitor,
    updateMonitorInterval,
    toggleMonitorEnabled
  } = useMonitors();

  const { canEnableMonitor, plan } = useSubscription();

  // Plan categories for pricing
  const planCategories = [{
    id: 'free',
    name: 'Free',
    icon: Star,
    description: 'Great for small projects or testing your "mission control."',
    baseFeatures: ['5 monitors', '5-minute checks', 'Email alerts', 'Basic uptime tracking'],
    options: [{
      monitors: 5,
      price: 0,
      planId: 'free' as const
    }]
  }, {
    id: 'pro',
    name: 'Pro',
    icon: Rocket,
    description: 'Powerful for small teams who want fast alerts and better tracking.',
    baseFeatures: ['1-minute checks', 'Email alerts', 'Slack notifications'],
    options: [{
      monitors: 25,
      price: 12,
      planId: 'pro-25' as const
    }, {
      monitors: 50,
      price: 19,
      planId: 'pro-50' as const
    }]
  }, {
    id: 'enterprise',
    name: 'Enterprise',
    icon: Crown,
    description: 'Perfect for critical services where real-time phone alerts matter.',
    baseFeatures: ['30-second checks', 'Email alerts', 'Slack notifications', 'SMS notifications', '100 SMS included/month'],
    options: [{
      monitors: 100,
      price: 49,
      planId: 'enterprise-100' as const
    }, {
      monitors: 250,
      price: 99,
      planId: 'enterprise-250' as const
    }]
  }];

  const getCurrentOption = (category: typeof planCategories[0]) => {
    if (category.id === 'free') return category.options[0];
    return category.options.find(opt => opt.monitors === selectedOptions[category.id]) || category.options[0];
  };

  // Handle pending mission from anonymous testing
  useEffect(() => {
    if (user) {
      const pendingUrl = localStorage.getItem('pending-mission-url');
      if (pendingUrl) {
        setNewMissionUrl(pendingUrl);
        setNewMissionName('My Website');
        localStorage.removeItem('pending-mission-url');

        // Auto-deploy the mission after a short delay
        setTimeout(() => {
          handleDeployMission();
        }, 1000);
      }
    }
  }, [user]);
  const handleDeployMission = async () => {
    if (!newMissionUrl.trim() || !user) return;
    setIsDeploying(true);
    try {
      const monitorId = await createMonitor(newMissionName || 'My Website', newMissionUrl);
      if (monitorId) {
        setNewMissionUrl('');
        setNewMissionName('');
      }
    } finally {
      setIsDeploying(false);
    }
  };
  if (loading) {
    return <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-hero mb-space-md">🛰️</div>
          <p className="text-card-title text-muted-foreground">Initializing Mission Control...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen">
      
      <Navigation />

      {/* Space particles background */}
      <div className="space-particles" />
      
      <div className="pt-20"> {/* Add padding for fixed navigation */}
      
      {/* Hero Section */}
      {user ? <section></section> : <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20" style={{
        backgroundImage: `url(${heroImage})`
      }} />
        <div className="absolute inset-0 bg-gradient-to-br from-space-deep/80 via-space-dark/60 to-space-medium/40" />
        
        {/* Fade to transparent at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background via-background/80 to-transparent" />
        
        <div className="relative z-10 max-w-6xl mx-auto px-space-page-x text-center">
          <div className="animate-float">
            <h1 className="text-hero font-token-bold mb-space-lg bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent my-0 py-[20px] md:text-8xl">
              🚀 OrbitPing
            </h1>
            <p className="text-card-title md:text-section-title text-muted-foreground mb-space-md font-token-medium">
              Your website's mission control
            </p>
            <p className="text-body-lg md:text-card-title text-foreground mb-space-2xl max-w-3xl mx-auto leading-relaxed">
              "All systems go — unless they're not. We'll let you know."
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-space-md justify-center items-center mb-space-section">
            {user ? <Button variant="rocket" size="lg" className="text-lg px-8 py-6">
                🚀 Open Mission Control
              </Button> : <Link to="/auth">
                <Button variant="rocket" size="lg" className="text-lg px-8 py-6">
                  🚀 Launch Mission Control
                </Button>
              </Link>}
            <Button variant="mission" size="lg" className="text-lg px-8 py-6">
              📊 View Live Demo
            </Button>
          </div>
          
          {/* Mission Status Overview */}
          <Card className="bg-space-medium/80 backdrop-blur-sm border-space-light max-w-2xl mx-auto">
            <CardHeader>
              <h2 className="text-section-title font-token-semibold leading-none tracking-tight text-center">
                🛰️ Global Mission Status
              </h2>
            </CardHeader>
            <CardContent className="space-y-space-md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                <StatusIndicator status="online" label="Primary Systems" />
                <StatusIndicator status="checking" label="Deep Space Scan" />
                <StatusIndicator status="online" label="Satellite Network" />
              </div>
              <div className="text-center text-body-sm text-muted-foreground pt-space-md border-t border-space-light">
                Monitoring 1,247 active missions across the galaxy
              </div>
            </CardContent>
          </Card>
        </div>
      </section>}
      
      {/* Mission Control Dashboard */}
      <section className="py-space-section px-space-page-x">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-space-section">
            <h3 className="text-page-title md:text-[3.25rem] font-token-bold mb-space-lg text-foreground">
              🛰️ Mission Control Center
            </h3>
            <p className="text-card-title text-muted-foreground max-w-3xl mx-auto">
              Monitor your digital assets like a space mission. Get instant alerts when systems go dark, 
              track uptime like orbital trajectories, and maintain mission-critical reliability.
            </p>
          </div>

          {user ? (/* Registered User - Deploy New Mission */
        <Card className="bg-space-medium border-space-light mb-12 max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-center text-card-title">
                  🚀 Deploy New Mission
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-space-md">
                <div>
                  <Label htmlFor="mission-name" className="text-body-sm font-token-medium">
                    Mission Name (Optional)
                  </Label>
                  <Input id="mission-name" placeholder="Alpha Station" value={newMissionName} onChange={e => setNewMissionName(e.target.value)} className="bg-space-dark border-space-light mt-space-sm" />
                </div>
                <div>
                  <Label htmlFor="mission-url" className="text-body-sm font-token-medium">
                    Target Coordinates (URL)
                  </Label>
                  <Input id="mission-url" placeholder="https://your-website.com" value={newMissionUrl} onChange={e => setNewMissionUrl(e.target.value)} className="bg-space-dark border-space-light mt-space-sm" onKeyPress={e => e.key === 'Enter' && handleDeployMission()} />
                </div>
                 <Button variant="rocket" className="w-full" disabled={!newMissionUrl.trim() || isDeploying} onClick={handleDeployMission}>
                   {isDeploying ? <>
                       <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                       Deploying Mission...
                     </> : <>
                       <Plus className="h-4 w-4 mr-2" />
                       🚀 Initialize Mission Launch
                     </>}
                 </Button>
                 
                 {/* Plan limit warning */}
                 <PlanLimitWarning onUpgrade={() => setShowPricing(true)} className="mt-space-md" />
               </CardContent>
             </Card>) : (/* Anonymous User - Simple URL Checker */
        <div className="mb-12">
              <AnonymousUrlChecker onConvertToUser={url => {
            localStorage.setItem('pending-mission-url', url);
          }} />
            </div>)}

          {/* Active Missions Grid */}
          {user ? <div className="space-y-space-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-section-title font-token-bold text-foreground">Active Missions</h3>
                <div className="text-body-sm text-muted-foreground">
                  {monitors.length} {monitors.length === 1 ? 'mission' : 'missions'} deployed
                  {plan === 'free' && ` • ${monitors.filter(m => m.enabled).length}/1 active`}
                </div>
              </div>
              
              {monitorsLoading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
                  {[...Array(3)].map((_, i) => <Card key={i} className="bg-space-medium border-space-light animate-pulse">
                      <CardContent className="p-space-card">
                        <div className="h-4 bg-space-light rounded mb-space-sm"></div>
                        <div className="h-3 bg-space-light rounded w-2/3"></div>
                      </CardContent>
                    </Card>)}
                </div> : monitors.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
                  {monitors.map(monitor => <MissionCard key={monitor.id} name={monitor.name} url={monitor.url} status={monitor.status} uptime={`${monitor.uptime_percentage}%`} responseTime={monitor.response_time ? `${monitor.response_time}ms` : 'N/A'} monitoringInterval={monitor.monitoring_interval} enabled={monitor.enabled} errorMessage={monitor.error_message} onTest={() => testMonitor(monitor.id)} onDelete={() => deleteMonitor(monitor.id)} onToggleEnabled={() => toggleMonitorEnabled(monitor.id)} onIntervalChange={interval => updateMonitorInterval(monitor.id, interval)} lastChecked={monitor.last_checked} />)}
                </div> : <Card className="bg-space-medium border-space-light">
                  <CardContent className="p-space-2xl text-center">
                    <div className="text-hero mb-space-md">🛰️</div>
                    <h3 className="text-card-title font-token-semibold mb-space-sm">No Active Missions</h3>
                    <p className="text-muted-foreground mb-space-md">
                      Deploy your first monitoring mission to start tracking your websites and APIs.
                    </p>
                  </CardContent>
                </Card>}
            </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
              {[{
            name: "Alpha Station",
            url: "https://example.com",
            status: "online" as const,
            uptime: "99.97%",
            responseTime: "142ms"
          }, {
            name: "Beta Outpost",
            url: "https://api.beta.com",
            status: "warning" as const,
            uptime: "98.3%",
            responseTime: "580ms"
          }, {
            name: "Gamma Base",
            url: "https://gamma-service.net",
            status: "checking" as const,
            uptime: "100%",
            responseTime: "89ms"
          }].map((mission, index) => <MissionCard key={index} name={mission.name} url={mission.url} status={mission.status} uptime={mission.uptime} responseTime={mission.responseTime} />)}
            </div>}

          {/* Features Grid */}
          {user ? <div></div> : <div className="grid grid-cols-1 md:grid-cols-3 gap-space-xl mt-space-section">
                <Card className="bg-space-medium border-space-light hover:bg-space-light transition-all duration-300 hover:shadow-[0_0_20px_hsl(18_90%_55%/0.3)]">
                  <CardHeader>
                    <CardTitle className="text-center">
                      🚨 Instant Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-center">
                      "Houston, we have a problem." Get notified the moment your systems go dark.
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-space-medium border-space-light hover:bg-space-light transition-all duration-300 hover:shadow-[0_0_20px_hsl(210_100%_50%/0.3)]">
                  <CardHeader>
                    <CardTitle className="text-center">
                      📊 Mission Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-center">
                      Track uptime like orbital mechanics. Detailed reports for mission-critical insights.
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-space-medium border-space-light hover:bg-space-light transition-all duration-300 hover:shadow-[0_0_20px_hsl(142_100%_45%/0.3)]">
                  <CardHeader>
                    <CardTitle className="text-center">
                      🛰️ Global Coverage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-center">
                      Monitor from multiple satellite positions. Worldwide coverage for planetary-scale operations.
                    </p>
                  </CardContent>
                </Card>
              </div>}      
        </div>
      </section>

      {/* Pricing Section for Anonymous Users */}
      {!user && (
         <section className="py-space-section px-space-page-x">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-space-section">
              <h2 className="text-page-title font-token-bold mb-space-md bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Choose Your Mission Plan
              </h2>
              <p className="text-card-title text-muted-foreground">
                Scale your monitoring needs with our flexible pricing
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-xl">
              {planCategories.map((category, index) => {
                const Icon = category.icon;
                const currentOption = getCurrentOption(category);
                const isPopular = index === 1; // Pro plan is most popular

                return (
                  <Card key={category.id} className={`relative transition-all duration-300 ${
                    isPopular 
                      ? 'bg-gradient-to-br from-space-medium via-space-dark to-space-medium border-2 border-nebula-blue shadow-[0_0_40px_hsl(210_100%_50%/0.3)] scale-105 hover:scale-110 hover:shadow-[0_0_60px_hsl(210_100%_50%/0.4)]' 
                      : 'bg-space-medium border-space-light hover:border-space-medium hover:shadow-lg'
                  }`}>
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                        <span className="bg-gradient-to-r from-nebula-blue to-primary text-starlight-white px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
                          ⭐ Most Popular
                        </span>
                      </div>
                    )}
                    
                    <CardHeader className="text-center py-space-xl px-space-card">
                      <div className="flex items-center justify-center mb-space-md">
                        <Icon className={`h-12 w-12 ${
                          isPopular 
                            ? 'text-nebula-blue drop-shadow-[0_0_8px_hsl(210_100%_50%/0.6)]' 
                            : 'text-muted-foreground'
                        }`} />
                      </div>
                      <CardTitle className={`text-card-title mb-space-md ${
                        isPopular 
                          ? 'text-nebula-blue font-token-bold' 
                          : ''
                      }`}>{category.name}</CardTitle>
                      <CardDescription className="text-body mb-space-lg px-space-sm py-[10px]">{category.description}</CardDescription>
                      
                      {/* Price Display */}
                      <div className="mb-space-lg py-[10px]">
                        <span className={`text-page-title font-token-bold ${
                          isPopular 
                            ? 'text-nebula-blue' 
                            : ''
                        }`}>
                          €{currentOption.price}
                        </span>
                        <span className="text-muted-foreground text-body-lg">/month</span>
                      </div>

                      {/* Monitor Selection Dropdown */}
                      {category.options.length > 1 && (
                        <div className="mb-space-md">
                          <Select
                            value={selectedOptions[category.id]?.toString()}
                            onValueChange={(value) => setSelectedOptions(prev => ({
                              ...prev,
                              [category.id]: parseInt(value)
                            }))}
                          >
                            <SelectTrigger className="w-full bg-background border border-muted">
                              <SelectValue placeholder="Select monitors" />
                            </SelectTrigger>
                            <SelectContent>
                              {category.options.map(option => (
                                <SelectItem key={option.monitors} value={option.monitors.toString()}>
                                  {option.monitors} monitors
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardHeader>
                    
                    <CardContent>
                      <ul className="space-y-space-md mb-space-lg">
                        {category.id !== 'free' && (
                          <li className="flex items-center gap-space-sm">
                            <Check className="h-4 w-4 text-astro-green flex-shrink-0" />
                            <span className="text-body-sm">{currentOption.monitors} monitors</span>
                          </li>
                        )}
                        {category.baseFeatures.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-astro-green flex-shrink-0" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <Link to="/auth">
                        <Button 
                          variant={isPopular ? "default" : "outline"} 
                          className={`w-full transition-all duration-300 ${
                            isPopular 
                              ? 'bg-gradient-to-r from-nebula-blue to-primary hover:from-nebula-blue/80 hover:to-primary/80 text-starlight-white font-bold border-2 border-nebula-blue/50 hover:border-nebula-blue hover:shadow-[0_0_20px_hsl(210_100%_50%/0.5)] hover:scale-105 transform' 
                              : ''
                          }`}
                        >
                          {isPopular && <span className="mr-2">🚀</span>}
                          Get Started{category.id === 'free' ? ' Free' : ''}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-space-xl p-space-md bg-space-medium rounded-card">
              <div className="flex items-center justify-center gap-space-xl text-body-sm text-muted-foreground">
                <div className="flex items-center gap-space-sm">
                  <Mail className="h-4 w-4" />
                  <span>Email alerts</span>
                </div>
                <div className="flex items-center gap-space-sm">
                  <MessageSquare className="h-4 w-4" />
                  <span>Slack (Pro)</span>
                </div>
                <div className="flex items-center gap-space-sm">
                  <Smartphone className="h-4 w-4" />
                  <span>SMS (Enterprise)</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
       {user ? (
          <section className="py-20 px-6">
            <div className="max-w-6xl mx-auto">
              {/* 🚀 Your Dashboard component */}
            </div>
          </section>
        ) : (
          <section className="py-space-section px-space-page-x text-center">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-page-title md:text-[3.25rem] font-token-bold mb-space-lg text-foreground">
                Ready for Liftoff?
              </h3>
              <p className="text-card-title text-muted-foreground mb-space-2xl">
                Join thousands of mission commanders who trust OrbitPing to keep their digital universe operational.
              </p>
              <div className="flex flex-col sm:flex-row gap-space-md justify-center">
                <Link to="/auth">
                  <Button variant="rocket" size="lg" className="text-body-lg px-space-xl py-space-lg">
                    🚀 Start Your Mission
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        )}     
      </div>
      
      <Footer />
      <PricingModal open={showPricing} onOpenChange={setShowPricing} />
    </div>;
};
export default Index;