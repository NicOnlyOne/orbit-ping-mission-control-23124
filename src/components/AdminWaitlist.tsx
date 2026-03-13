import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Search, RefreshCw, Download } from "lucide-react";
import { format } from "date-fns";

interface WaitlistEntry {
  id: string;
  email: string;
  plan_interest: string;
  created_at: string;
}

const getPlanLabel = (plan: string) => {
  const labels: Record<string, string> = {
    "pro-25": "Pro 25",
    "pro-50": "Pro 50",
    "enterprise-100": "Enterprise 100",
    "enterprise-250": "Enterprise 250",
  };
  return labels[plan] || plan;
};

const getPlanBadgeVariant = (plan: string) => {
  if (plan.startsWith("enterprise")) return "destructive" as const;
  if (plan.startsWith("pro")) return "default" as const;
  return "secondary" as const;
};

export function AdminWaitlist() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadWaitlist = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("plan_waitlist")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Failed to load waitlist:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWaitlist();
  }, []);

  const filtered = entries.filter((e) =>
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    e.plan_interest.toLowerCase().includes(search.toLowerCase())
  );

  const planCounts = entries.reduce((acc, e) => {
    acc[e.plan_interest] = (acc[e.plan_interest] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const exportCsv = () => {
    const csv = [
      "Email,Plan Interest,Signed Up",
      ...filtered.map((e) =>
        `${e.email},${e.plan_interest},${e.created_at ? format(new Date(e.created_at), "yyyy-MM-dd HH:mm") : ""}`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-space-medium border-space-light">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Waitlist Signups ({entries.length})
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={loadWaitlist} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search emails..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-space-dark border-space-light"
              />
            </div>
          </div>
        </div>
        {Object.keys(planCounts).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(planCounts).map(([plan, count]) => (
              <Badge key={plan} variant={getPlanBadgeVariant(plan)} className="text-caption">
                {getPlanLabel(plan)}: {count}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-space-2xl">
            <div className="animate-spin text-page-title">🛰️</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-space-light hover:bg-space-dark/50">
                  <TableHead>Email</TableHead>
                  <TableHead>Plan Interest</TableHead>
                  <TableHead>Signed Up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id} className="border-space-light hover:bg-space-dark/30">
                    <TableCell className="text-body-sm">{e.email}</TableCell>
                    <TableCell>
                      <Badge variant={getPlanBadgeVariant(e.plan_interest)} className="text-caption">
                        {getPlanLabel(e.plan_interest)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-body-sm text-muted-foreground">
                      {format(new Date(e.created_at), "MMM d, yyyy 'at' HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-space-xl text-muted-foreground">
                      {search ? "No matching signups" : "No waitlist signups yet"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
