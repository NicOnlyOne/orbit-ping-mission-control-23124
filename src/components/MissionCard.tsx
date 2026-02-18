import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusIndicator } from "./StatusIndicator";
import { MonitoringIntervalSlider } from "./MonitoringIntervalSlider";

import { cn } from "@/lib/utils";
import { ExternalLink, RefreshCw, Trash2, Settings, Play, Pause } from "lucide-react";
import { useState } from "react";

interface MissionCardProps {
  name: string;
  url: string;
  status: "online" | "offline" | "warning" | "checking";
  uptime: string;
  responseTime: string;
  monitoringInterval?: number;
  enabled?: boolean;
  errorMessage?: string | null;
  className?: string;
  onTest?: () => void;
  onDelete?: () => void;
  onToggleEnabled?: () => void;
  onIntervalChange?: (interval: number) => void;
  lastChecked?: string | null;
}

export const MissionCard = ({ 
  name, 
  url, 
  status, 
  uptime, 
  responseTime, 
  monitoringInterval = 300,
  enabled = true,
  errorMessage,
  className,
  onTest,
  onDelete,
  onToggleEnabled,
  onIntervalChange,
  lastChecked
}: MissionCardProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const formatLastChecked = (dateString: string | null) => {
    if (!dateString) return { relative: 'Never', absolute: '' };
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    let relative = '';
    if (diffMins < 1) relative = 'Just now';
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffMins < 1440) { // Less than 24 hours
      const diffHours = Math.floor(diffMins / 60);
      relative = `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffMins / 1440);
      relative = `${diffDays}d ago`;
    }
    
    // Format absolute time: "Dec 20, 2024 at 3:45 PM"
    const absolute = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    return { relative, absolute };
  };

  return (
    <Card className={cn(
      "bg-space-medium border-space-light hover:bg-space-light transition-all duration-300 group",
      "hover:shadow-[0_0_20px_hsl(220_15%_20%/0.5)]",
      !enabled && "opacity-60",
      className
    )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              🚀 {name}
              {!enabled && <span className="text-xs bg-muted px-2 py-1 rounded">PAUSED</span>}
            </CardTitle>
            <div className="flex items-center gap-1">
              {onToggleEnabled && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onToggleEnabled}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {enabled ? "Pause monitoring" : "Resume monitoring"}
                  </TooltipContent>
                </Tooltip>
              )}
              {onDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onDelete}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Delete mission
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
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
        
        {status === 'offline' && errorMessage && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            <p className="font-medium mb-1">⚠️ Error Details</p>
            <p className="text-xs text-destructive/80">{errorMessage}</p>
          </div>
        )}
        
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
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              Last checked: {formatLastChecked(lastChecked).relative}
            </div>
            <div className="text-xs font-mono text-muted-foreground/70">
              {formatLastChecked(lastChecked).absolute}
            </div>
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
          
          <Button 
            variant="command" 
            size="sm" 
            className="flex-1"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 p-4 bg-space-dark rounded-lg border border-space-light space-y-6">
            {onIntervalChange && (
              <MonitoringIntervalSlider
                value={monitoringInterval}
                onChange={onIntervalChange}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};