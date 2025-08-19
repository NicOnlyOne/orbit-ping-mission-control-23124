import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MissionCard } from "@/components/MissionCard";
import { StatusIndicator } from "@/components/StatusIndicator";
import { AnonymousUrlChecker } from "@/components/AnonymousUrlChecker";
import heroImage from "@/assets/hero-mission-control.jpg";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMonitors } from "@/hooks/useMonitors";
import { Link } from "react-router-dom";
import { LogOut, User, Plus, RefreshCw } from "lucide-react";

const Index = () => {
  const [newMissionUrl, setNewMissionUrl] = useState("");
  const [newMissionName, setNewMissionName] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const { user, loading, signOut } = useAuth();
  const { monitors, loading: monitorsLoading, createMonitor, testMonitor, deleteMonitor, updateMonitorInterval } = useMonitors();
  
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
      const monitorId = await createMonitor(
        newMissionName || 'My Website', 
        newMissionUrl
      );
      if (monitorId) {
        setNewMissionUrl('');
        setNewMissionName('');
      }
    } finally {
      setIsDeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">🛰️</div>
          <p className="text-xl text-muted-foreground">Initializing Mission Control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Navigation Header */}
      <header className="fixed top-0 w-full z-50 bg-space-dark/80 backdrop-blur-sm border-b border-space-light">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            <span className="text-xl font-bold text-foreground">OrbitPing</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.email}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => signOut()}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
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

      {/* Space particles background */}
      <div className="space-particles" />
      
      {/* Hero Section */}
      {user ? (
            ) : (
              <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-space-deep/80 via-space-dark/60 to-space-medium/40" />
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
          <div className="animate-float">
            <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              🚀 OrbitPing
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-4 font-medium">
              Your website's mission control
            </p>
            <p className="text-lg md:text-xl text-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
              "All systems go — unless they're not. We'll let you know."
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            {user ? (
              <Button variant="rocket" size="lg" className="text-lg px-8 py-6">
                🚀 Open Mission Control
              </Button>
            ) : (
              <Link to="/auth">
                <Button variant="rocket" size="lg" className="text-lg px-8 py-6">
                  🚀 Launch Mission Control
                </Button>
              </Link>
            )}
            <Button variant="mission" size="lg" className="text-lg px-8 py-6">
              📊 View Live Demo
            </Button>
          </div>
          
          {/* Mission Status Overview */}
          <Card className="bg-space-medium/80 backdrop-blur-sm border-space-light max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center text-xl">
                🛰️ Global Mission Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatusIndicator status="online" label="Primary Systems" />
                <StatusIndicator status="checking" label="Deep Space Scan" />
                <StatusIndicator status="online" label="Satellite Network" />
              </div>
              <div className="text-center text-sm text-muted-foreground pt-4 border-t border-space-light">
                Monitoring 1,247 active missions across the galaxy
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
            )}
      
      {/* Mission Control Dashboard */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              🛰️ Mission Control Center
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Monitor your digital assets like a space mission. Get instant alerts when systems go dark, 
              track uptime like orbital trajectories, and maintain mission-critical reliability.
            </p>
          </div>

          {user ? (
            /* Registered User - Deploy New Mission */
            <Card className="bg-space-medium border-space-light mb-12 max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-center text-xl">
                  🚀 Deploy New Mission
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="mission-name" className="text-sm font-medium">
                    Mission Name (Optional)
                  </Label>
                  <Input
                    id="mission-name"
                    placeholder="Alpha Station"
                    value={newMissionName}
                    onChange={(e) => setNewMissionName(e.target.value)}
                    className="bg-space-dark border-space-light mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="mission-url" className="text-sm font-medium">
                    Target Coordinates (URL)
                  </Label>
                  <Input
                    id="mission-url"
                    placeholder="https://your-website.com"
                    value={newMissionUrl}
                    onChange={(e) => setNewMissionUrl(e.target.value)}
                    className="bg-space-dark border-space-light mt-2"
                    onKeyPress={(e) => e.key === 'Enter' && handleDeployMission()}
                  />
                </div>
                <Button 
                  variant="rocket" 
                  className="w-full"
                  disabled={!newMissionUrl.trim() || isDeploying}
                  onClick={handleDeployMission}
                >
                  {isDeploying ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Deploying Mission...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      🚀 Initialize Mission Launch
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            /* Anonymous User - Simple URL Checker */
            <div className="mb-12">
              <AnonymousUrlChecker 
                onConvertToUser={(url) => {
                  localStorage.setItem('pending-mission-url', url);
                }}
              />
            </div>
          )}

          {/* Active Missions Grid */}
          {user ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-foreground">Active Missions</h3>
                <div className="text-sm text-muted-foreground">
                  {monitors.length} {monitors.length === 1 ? 'mission' : 'missions'} deployed
                </div>
              </div>
              
              {monitorsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="bg-space-medium border-space-light animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-space-light rounded mb-2"></div>
                        <div className="h-3 bg-space-light rounded w-2/3"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : monitors.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {monitors.map((monitor) => (
                    <MissionCard
                      key={monitor.id}
                      name={monitor.name}
                      url={monitor.url}
                      status={monitor.status}
                      uptime={`${monitor.uptime_percentage}%`}
                      responseTime={monitor.response_time ? `${monitor.response_time}ms` : 'N/A'}
                      monitoringInterval={monitor.monitoring_interval}
                      onTest={() => testMonitor(monitor.id)}
                      onDelete={() => deleteMonitor(monitor.id)}
                      onIntervalChange={(interval) => updateMonitorInterval(monitor.id, interval)}
                      lastChecked={monitor.last_checked}
                    />
                  ))}
                </div>
              ) : (
                <Card className="bg-space-medium border-space-light">
                  <CardContent className="p-12 text-center">
                    <div className="text-6xl mb-4">🛰️</div>
                    <h3 className="text-xl font-semibold mb-2">No Active Missions</h3>
                    <p className="text-muted-foreground mb-4">
                      Deploy your first monitoring mission to start tracking your websites and APIs.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  name: "Alpha Station",
                  url: "https://example.com",
                  status: "online" as const,
                  uptime: "99.97%",
                  responseTime: "142ms"
                },
                {
                  name: "Beta Outpost", 
                  url: "https://api.beta.com",
                  status: "warning" as const,
                  uptime: "98.3%",
                  responseTime: "580ms"
                },
                {
                  name: "Gamma Base",
                  url: "https://gamma-service.net", 
                  status: "checking" as const,
                  uptime: "100%",
                  responseTime: "89ms"
                }
              ].map((mission, index) => (
                <MissionCard
                  key={index}
                  name={mission.name}
                  url={mission.url}
                  status={mission.status}
                  uptime={mission.uptime}
                  responseTime={mission.responseTime}
                />
              ))}
            </div>
          )}

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
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
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            Ready for Liftoff?
          </h2>
          <p className="text-xl text-muted-foreground mb-12">
            Join thousands of mission commanders who trust OrbitPing to keep their digital universe operational.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Button variant="rocket" size="lg" className="text-lg px-8 py-6">
                🚀 Start Your Mission
              </Button>
            ) : (
              <Link to="/auth">
                <Button variant="rocket" size="lg" className="text-lg px-8 py-6">
                  🚀 Start Your Mission
                </Button>
              </Link>
            )}
            <Button variant="command" size="lg" className="text-lg px-8 py-6">
              📞 Contact Mission Control
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
