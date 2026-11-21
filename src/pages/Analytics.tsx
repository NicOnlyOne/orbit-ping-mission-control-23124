import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Navigation } from "@/components/Navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { Activity, Users, DollarSign, TrendingUp, Calendar } from "lucide-react";

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

const CHART_CONFIG = {
  signups: { label: "User Signups", color: "hsl(var(--nebula-blue))" },
  active: { label: "Active Users", color: "hsl(var(--astro-green))" },
  revenue: { label: "Revenue", color: "hsl(var(--rocket-red))" },
};

function getDateRange(timeRange: TimeRange) {
  const now = new Date();
  switch (timeRange) {
    case "7d":
      return { start: subDays(now, 7), end: now };
    case "30d":
      return { start: subDays(now, 30), end: now };
    case "all":
      return { start: new Date("2024-01-01"), end: now };
  }
}

const Analytics = () => {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const requestIdRef = useRef(0);

  const loadAnalyticsData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);

    try {
      const { start, end } = getDateRange(timeRange);
      const [profilesResult, monitorsResult, totalUsersResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("created_at")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
          .order("created_at"),
        supabase
          .from("monitors")
          .select("created_at, user_id")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString()),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      if (requestId !== requestIdRef.current) return;
      if (profilesResult.error) throw profilesResult.error;
      if (monitorsResult.error) throw monitorsResult.error;
      if (totalUsersResult.error) throw totalUsersResult.error;

      const profiles = profilesResult.data ?? [];
      const monitors = monitorsResult.data ?? [];
      const dayCount = timeRange === "7d" ? 7 : 30;
      const signupsByDate: Record<string, number> = {};

      for (const profile of profiles) {
        const date = format(new Date(profile.created_at), "MMM dd");
        signupsByDate[date] = (signupsByDate[date] || 0) + 1;
      }

      const userSignups = [];
      let cumulative = 0;
      for (let i = dayCount; i >= 0; i--) {
        const date = format(subDays(end, i), "MMM dd");
        const signups = signupsByDate[date] || 0;
        cumulative += signups;
        userSignups.push({ date, signups, cumulative });
      }

      const activeUsersByDate: Record<string, Set<string>> = {};
      for (const monitor of monitors) {
        const date = format(new Date(monitor.created_at), "MMM dd");
        activeUsersByDate[date] ??= new Set();
        activeUsersByDate[date].add(monitor.user_id);
      }

      const activeUsers = [];
      for (let i = dayCount; i >= 0; i--) {
        const date = format(subDays(end, i), "MMM dd");
        activeUsers.push({ date, active: activeUsersByDate[date]?.size || 0 });
      }

      // Keep the existing demo revenue series while removing its unused database request.
      const revenue = [];
      let totalRevenue = 0;
      for (let i = dayCount; i >= 0; i--) {
        const date = format(subDays(end, i), "MMM dd");
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
          totalUsers: totalUsersResult.count || 0,
          activeUsers: new Set(monitors.map((monitor) => monitor.user_id)).size,
          totalRevenue,
          avgOrderValue: totalRevenue / revenue.reduce((sum, day) => sum + day.orders, 0) || 0,
        },
      });
    } catch (error) {
      if (requestId === requestIdRef.current) console.error("Error loading analytics:", error);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    if (isAdmin) void loadAnalyticsData();
    return () => {
      requestIdRef.current += 1;
    };
  }, [isAdmin, loadAnalyticsData]);

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-hero mb-space-md">📊</div>
          <p className="text-card-title text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium flex items-center justify-center">
        <div className="text-center">
          <div className="text-hero mb-space-md">🔒</div>
          <p className="text-card-title text-foreground mb-space-sm">Admin Access Required</p>
          <p className="text-body-sm text-muted-foreground">This dashboard is restricted to mission control admins only</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium">
      <Navigation />
      
      <div className="pt-20 px-space-page-x">
        <div className="max-w-7xl mx-auto py-space-xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-space-xl">
            <div>
              <h1 className="text-page-title font-token-bold text-foreground mb-space-sm">
                📊 Analytics Dashboard
              </h1>
              <p className="text-muted-foreground">
                Mission control analytics and insights
              </p>
            </div>
            
            <div className="flex items-center gap-space-md mt-space-md sm:mt-0">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg mb-space-xl">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-space-medium border-space-light animate-pulse">
                  <CardContent className="p-space-card">
                    <div className="h-4 bg-space-light rounded mb-space-sm"></div>
                    <div className="h-8 bg-space-light rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg mb-space-xl">
                <Card className="bg-space-medium border-space-light">
                  <CardContent className="p-space-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-body-sm text-muted-foreground font-token-medium">Total Users</p>
                        <p className="text-stat font-token-bold text-foreground">
                          {analyticsData?.overview.totalUsers.toLocaleString() || 0}
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-nebula-blue" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-space-medium border-space-light">
                  <CardContent className="p-space-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-body-sm text-muted-foreground font-token-medium">Active Users</p>
                        <p className="text-stat font-token-bold text-foreground">
                          {analyticsData?.overview.activeUsers.toLocaleString() || 0}
                        </p>
                      </div>
                      <Activity className="h-8 w-8 text-astro-green" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-space-medium border-space-light">
                  <CardContent className="p-space-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-body-sm text-muted-foreground font-token-medium">Total Revenue</p>
                        <p className="text-stat font-token-bold text-foreground">
                          ${analyticsData?.overview.totalRevenue.toLocaleString() || 0}
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-rocket-red" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-space-medium border-space-light">
                  <CardContent className="p-space-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-body-sm text-muted-foreground font-token-medium">Avg Order Value</p>
                        <p className="text-stat font-token-bold text-foreground">
                          ${analyticsData?.overview.avgOrderValue.toFixed(0) || 0}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg mb-space-xl">
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
                    <ChartContainer config={CHART_CONFIG} className="h-[300px]">
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
                    <ChartContainer config={CHART_CONFIG} className="h-[300px]">
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
                  <ChartContainer config={CHART_CONFIG} className="h-[400px]">
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