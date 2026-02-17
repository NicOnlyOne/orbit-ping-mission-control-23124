import { useState, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Users, Activity, Search, ArrowLeft, RefreshCw, User, Satellite } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  full_name: string | null;
  email: string;
  subscription_plan: string;
  created_at: string;
  avatar_url: string | null;
  monitors_total: number;
  monitors_enabled: number;
}

const getPlanBadgeVariant = (plan: string) => {
  if (plan.startsWith("enterprise")) return "destructive";
  if (plan.startsWith("pro")) return "default";
  return "secondary";
};

const PLANS: { value: string; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "pro-25", label: "Pro 25" },
  { value: "pro-50", label: "Pro 50" },
  { value: "enterprise-100", label: "Enterprise 100" },
  { value: "enterprise-250", label: "Enterprise 250" },
];

const getPlanLabel = (plan: string) => {
  return PLANS.find((p) => p.value === plan)?.label || plan;
};

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingChange, setPendingChange] = useState<{ userId: string; userName: string; currentPlan: string; newPlan: string } | null>(null);
  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users");
      if (error) throw error;
      setUsers(data?.users || []);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmPlanChange = async () => {
    if (!pendingChange) return;
    const { userId, newPlan } = pendingChange;
    setPendingChange(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-plan", {
        body: { userId, plan: newPlan },
      });
      if (error) throw error;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, subscription_plan: newPlan } : u))
      );
      toast.success(`Plan updated to ${getPlanLabel(newPlan)}`);
    } catch (error) {
      console.error("Failed to update plan:", error);
      toast.error("Failed to update plan");
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">🛰️</div>
          <p className="text-xl text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-xl text-foreground mb-2">Admin Access Required</p>
          <p className="text-sm text-muted-foreground mb-4">This page is restricted to mission control admins</p>
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      u.subscription_plan.toLowerCase().includes(search.toLowerCase())
  );

  const totalMonitors = users.reduce((sum, u) => sum + u.monitors_total, 0);
  const activeMonitors = users.reduce((sum, u) => sum + u.monitors_enabled, 0);
  const planDistribution = users.reduce((acc, u) => {
    const plan = u.subscription_plan || "free";
    acc[plan] = (acc[plan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-space-deep via-space-dark to-space-medium">
      <Navigation />

      <div className="pt-20 px-6">
        <div className="max-w-7xl mx-auto py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Shield className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
                <Badge variant="outline" className="border-primary/30 text-primary">Admin Only</Badge>
              </div>
              <p className="text-muted-foreground">
                Manage users, view plans, and monitor system health
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/analytics">
                <Button variant="outline" size="sm">
                  <Activity className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={loadUsers} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="bg-space-medium border-space-light">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-3xl font-bold text-foreground">{users.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-space-medium border-space-light">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Monitors</p>
                    <p className="text-3xl font-bold text-foreground">{totalMonitors}</p>
                  </div>
                  <Satellite className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-space-medium border-space-light">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Monitors</p>
                    <p className="text-3xl font-bold text-foreground">{activeMonitors}</p>
                  </div>
                  <Activity className="h-8 w-8 text-astro-green" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-space-medium border-space-light">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Plan Breakdown</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(planDistribution).map(([plan, count]) => (
                        <Badge key={plan} variant={getPlanBadgeVariant(plan)} className="text-xs">
                          {getPlanLabel(plan)}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card className="bg-space-medium border-space-light">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  All Users ({filteredUsers.length})
                </CardTitle>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-space-dark border-space-light"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin text-4xl">🛰️</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-space-light hover:bg-space-dark/50">
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead className="text-center">Monitors</TableHead>
                        <TableHead className="text-center">Active</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id} className="border-space-light hover:bg-space-dark/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                {u.avatar_url ? (
                                  <AvatarImage src={u.avatar_url} alt={u.full_name || "User"} />
                                ) : null}
                                <AvatarFallback className="bg-muted text-xs">
                                  <User className="h-3 w-3" />
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">
                                {u.full_name || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                          <TableCell>
                            <Select
                              value={u.subscription_plan}
                              onValueChange={(val) => {
                                if (val !== u.subscription_plan) {
                                  setPendingChange({ userId: u.id, userName: u.full_name || u.email, currentPlan: u.subscription_plan, newPlan: val });
                                }
                              }}
                            >
                              <SelectTrigger className="w-[140px] h-8 bg-space-dark border-space-light text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PLANS.map((p) => (
                                  <SelectItem key={p.value} value={p.value}>
                                    <Badge variant={getPlanBadgeVariant(p.value)} className="text-xs">
                                      {p.label}
                                    </Badge>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center text-sm">{u.monitors_total}</TableCell>
                          <TableCell className="text-center text-sm">{u.monitors_enabled}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {u.created_at ? format(new Date(u.created_at), "MMM d, yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {search ? "No users match your search" : "No users found"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!pendingChange} onOpenChange={(open) => !open && setPendingChange(null)}>
        <AlertDialogContent className="bg-space-medium border-space-light">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Plan Change</AlertDialogTitle>
            <AlertDialogDescription>
              Change <span className="font-semibold text-foreground">{pendingChange?.userName}</span>'s plan from{" "}
              <Badge variant={getPlanBadgeVariant(pendingChange?.currentPlan || "")} className="text-xs mx-1">
                {getPlanLabel(pendingChange?.currentPlan || "")}
              </Badge>{" "}
              to{" "}
              <Badge variant={getPlanBadgeVariant(pendingChange?.newPlan || "")} className="text-xs mx-1">
                {getPlanLabel(pendingChange?.newPlan || "")}
              </Badge>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPlanChange}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;
