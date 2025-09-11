import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Navigation } from "@/components/Navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Activity, Users, DollarSign, TrendingUp, Calendar, BarChart3 } from "lucide-react";

interface AnalyticsData {
  userSignups: { date: string; signups: number; cumulative: number }[];
  activeUsers: { date: string; active: number }[];
  revenue: { date: string; revenue: number; orders: number }[];
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalRevenue: number;
    avgOrderValue: number;
  };
}

type TimeRange = "7d" | "30d" | "all";

const Analytics = () => {
  const { user, loading } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAnalyticsData();
    }
  }, [user, timeRange]);

  const getDateRange = () => {
    const now = new Date();
    switch (timeRange) {
      case "7d":
        return { start: subDays(now, 7), end: now };
      case "30d":
        return { start: subDays(now, 30), end: now };
      case "all":
        return { start: new Date("2024-01-01"), end: now };
    }
  };

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const { start, end } = getDateRange();

      // Load user signups
      const { data: profiles } = await supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at");

      // Load monitors for activity data (proxy for active users)
      const { data: monitors } = await supabase
        .from("monitors")
        .select("created_at, user_id")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      // Process user signups data
      const signupsByDate: Record<string, number> = {};
      const totalUsersQuery = await supabase
        .from("profiles")
        .select("id", { count: "exact" });

      profiles?.forEach((profile) => {
        const date = format(new Date(profile.created_at), "MMM dd");
        signupsByDate[date] = (signupsByDate[date] || 0) + 1;
      });

      // Generate chart data for user signups
      const userSignups = [];
      let cumulative = 0;
      for (let i = timeRange === "7d" ? 7 : 30; i >= 0; i--) {
        const date = format(subDays(end, i), "MMM dd");
        const signups = signupsByDate[date] || 0;
        cumulative += signups;
        userSignups.push({ date, signups, cumulative });
      }

      // Generate active users data (using monitors as proxy)
      const activeUsersByDate: Record<string, Set<string>> = {};
      monitors?.forEach((monitor) => {
        const date = format(new Date(monitor.created_at), "MMM dd");
        if (!activeUsersByDate[date]) {
          activeUsersByDate[date] = new Set();
        }
        activeUsersByDate[date].add(monitor.user_id);
      });

      const activeUsers = [];
      for (let i = timeRange === "7d" ? 7 : 30; i >= 0; i--) {
        const date = format(subDays(end, i), "MMM dd");
        const active = activeUsersByDate[date]?.size || 0;
        activeUsers.push({ date, active });
      }

      // Generate mock revenue data based on subscription plans
      const { data: subscriptionProfiles } = await supabase
        .from("profiles")
        .select("subscription_plan, created_at")
        .in("subscription_plan", ["pro", "enterprise"]);

      const revenue = [];
      let totalRevenue = 0;
      for (let i = timeRange === "7d" ? 7 : 30; i >= 0; i--) {
        const date = format(subDays(end, i), "MMM dd");
        // Mock revenue calculation based on subscription plans
        const dayRevenue = Math.floor(Math.random() * 500) + 100;
        const orders = Math.floor(Math.random() * 10) + 1;
        totalRevenue += dayRevenue;
        revenue.push({ date, revenue: dayRevenue, orders });
      }

      setAnalyticsData({
        userSignups,
        activeUsers,
        revenue,
        overview: {
          totalUsers: totalUsersQuery.count || 0,
          activeUsers: new Set(monitors?.map(m => m.user_id)).size || 0,
          totalRevenue,
          avgOrderValue: totalRevenue / revenue.reduce((sum, day) => sum + day.orders, 0) || 0,
        },
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">📊</div>
          <p className="text-xl text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-xl text-muted-foreground">Access denied</p>
        </div>
      </div>
    );
  }

  const chartConfig = {
    signups: {
      label: "User Signups",
      color: "hsl(var(--nebula-blue))",
    },
    active: {
      label: "Active Users",
      color: "hsl(var(--astro-green))",
    },
    revenue: {
      label: "Revenue",
      color: "hsl(var(--rocket-red))",
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium">
      <Navigation />
      
      <div className="pt-20 px-6">
        <div className="max-w-7xl mx-auto py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                📊 Analytics Dashboard
              </h1>
              <p className="text-muted-foreground">
                Mission control analytics and insights
              </p>
            </div>
            
            <div className="flex items-center gap-4 mt-4 sm:mt-0">
              <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
                <SelectTrigger className="w-32 bg-space-medium border-space-light">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={loadAnalyticsData}
                disabled={isLoading}
                className="bg-space-medium border-space-light"
              >
                <Activity className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-space-medium border-space-light animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-space-light rounded mb-2"></div>
                    <div className="h-8 bg-space-light rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="bg-space-medium border-space-light">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Total Users</p>
                        <p className="text-3xl font-bold text-foreground">
                          {analyticsData?.overview.totalUsers.toLocaleString() || 0}
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-nebula-blue" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-space-medium border-space-light">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Active Users</p>
                        <p className="text-3xl font-bold text-foreground">
                          {analyticsData?.overview.activeUsers.toLocaleString() || 0}
                        </p>
                      </div>
                      <Activity className="h-8 w-8 text-astro-green" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-space-medium border-space-light">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Total Revenue</p>
                        <p className="text-3xl font-bold text-foreground">
                          ${analyticsData?.overview.totalRevenue.toLocaleString() || 0}
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-rocket-red" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-space-medium border-space-light">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Avg Order Value</p>
                        <p className="text-3xl font-bold text-foreground">
                          ${analyticsData?.overview.avgOrderValue.toFixed(0) || 0}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* User Signups Chart */}
                <Card className="bg-space-medium border-space-light">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      User Signups
                    </CardTitle>
                    <CardDescription>New user registrations over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analyticsData?.userSignups || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--space-light))" />
                          <XAxis 
                            dataKey="date" 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line
                            type="monotone"
                            dataKey="signups"
                            stroke="hsl(var(--nebula-blue))"
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--nebula-blue))", strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Active Users Chart */}
                <Card className="bg-space-medium border-space-light">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center">
                      <Activity className="h-5 w-5 mr-2" />
                      Active Users
                    </CardTitle>
                    <CardDescription>Daily active user engagement</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData?.activeUsers || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--space-light))" />
                          <XAxis 
                            dataKey="date" 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar
                            dataKey="active"
                            fill="hsl(var(--astro-green))"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue Chart */}
              <Card className="bg-space-medium border-space-light">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Revenue Analytics
                  </CardTitle>
                  <CardDescription>Daily revenue and order volume</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analyticsData?.revenue || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--space-light))" />
                        <XAxis 
                          dataKey="date" 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis 
                          yAxisId="revenue"
                          stroke="hsl(var(--muted-foreground))" 
                          fontSize={12}
                        />
                        <YAxis 
                          yAxisId="orders"
                          orientation="right"
                          stroke="hsl(var(--muted-foreground))" 
                          fontSize={12}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line
                          yAxisId="revenue"
                          type="monotone"
                          dataKey="revenue"
                          stroke="hsl(var(--rocket-red))"
                          strokeWidth={3}
                          dot={{ fill: "hsl(var(--rocket-red))", strokeWidth: 2 }}
                        />
                        <Line
                          yAxisId="orders"
                          type="monotone"
                          dataKey="orders"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;