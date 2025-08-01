import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "./StatusIndicator";
import { cn } from "@/lib/utils";

interface MissionCardProps {
  name: string;
  url: string;
  status: "online" | "offline" | "warning" | "checking";
  uptime: string;
  responseTime: string;
  className?: string;
}

export const MissionCard = ({ 
  name, 
  url, 
  status, 
  uptime, 
  responseTime, 
  className 
}: MissionCardProps) => {
  return (
    <Card className={cn(
      "bg-space-medium border-space-light hover:bg-space-light transition-all duration-300",
      "hover:shadow-[0_0_20px_hsl(220_15%_20%/0.5)]",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            🚀 {name}
          </CardTitle>
          <Button variant="command" size="sm">
            View Telemetry
          </Button>
        </div>
        <p className="text-sm text-muted-foreground font-mono">{url}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <StatusIndicator status={status} label="Mission Status" />
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Mission Uptime
            </p>
            <p className="text-lg font-semibold text-status-online">
              {uptime}
            </p>
          </div>
          
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Response Time
            </p>
            <p className="text-lg font-semibold text-secondary">
              {responseTime}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="satellite" size="sm" className="flex-1">
            🛰️ Test Signal
          </Button>
          <Button variant="command" size="sm" className="flex-1">
            📊 Analytics
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};