import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "./StatusIndicator";
import { cn } from "@/lib/utils";
import { ExternalLink, RefreshCw, Trash2 } from "lucide-react";

interface MissionCardProps {
  name: string;
  url: string;
  status: "online" | "offline" | "warning" | "checking";
  uptime: string;
  responseTime: string;
  className?: string;
  onTest?: () => void;
  onDelete?: () => void;
  lastChecked?: string | null;
}

export const MissionCard = ({ 
  name, 
  url, 
  status, 
  uptime, 
  responseTime, 
  className,
  onTest,
  onDelete,
  lastChecked
}: MissionCardProps) => {
  const formatLastChecked = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <Card className={cn(
      "bg-space-medium border-space-light hover:bg-space-light transition-all duration-300 group",
      "hover:shadow-[0_0_20px_hsl(220_15%_20%/0.5)]",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            🚀 {name}
          </CardTitle>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground font-mono hover:text-foreground transition-colors flex items-center gap-1"
          >
            {url.replace(/^https?:\/\//, '')}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
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
        
        {lastChecked && (
          <div className="text-xs text-muted-foreground">
            Last checked: {formatLastChecked(lastChecked)}
          </div>
        )}
        
        <div className="flex gap-2">
          {onTest ? (
            <Button 
              variant="satellite" 
              size="sm" 
              className="flex-1"
              onClick={onTest}
              disabled={status === 'checking'}
            >
              {status === 'checking' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  🛰️ Test Signal
                </>
              )}
            </Button>
          ) : (
            <Button variant="satellite" size="sm" className="flex-1">
              🛰️ Test Signal
            </Button>
          )}
          
          <Button variant="command" size="sm" className="flex-1">
            📊 Analytics
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};