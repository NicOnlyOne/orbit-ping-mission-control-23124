import { Slider } from "@/components/ui/slider";
import { useState } from "react";

interface MonitoringIntervalSliderProps {
  value: number; // in seconds
  onChange: (value: number) => void;
  className?: string;
}

export const MonitoringIntervalSlider = ({ 
  value, 
  onChange, 
  className 
}: MonitoringIntervalSliderProps) => {
  const [localValue, setLocalValue] = useState([value]);

  // Convert seconds to minutes for display
  const getDisplayValue = (seconds: number) => {
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  // Predefined intervals in seconds: 30s, 1m, 2m, 5m, 10m, 15m, 30m, 60m
  const intervals = [30, 60, 120, 300, 600, 900, 1800, 3600];
  
  const handleValueChange = (newValue: number[]) => {
    const selectedInterval = intervals[newValue[0]];
    setLocalValue(newValue);
    onChange(selectedInterval);
  };

  const currentIndex = intervals.findIndex(interval => interval === value);
  const displayIndex = currentIndex !== -1 ? currentIndex : 3; // Default to 5 minutes

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-space-md">
        <span className="text-body-sm text-muted-foreground">Monitor interval</span>
        <span className="text-body-sm font-token-medium text-foreground">
          {getDisplayValue(value)}
        </span>
      </div>
      
      <Slider
        value={[displayIndex]}
        onValueChange={handleValueChange}
        max={intervals.length - 1}
        min={0}
        step={1}
        className="w-full"
      />
      
      <div className="flex justify-between text-caption text-muted-foreground mt-space-sm">
        <span>30s</span>
        <span>60m</span>
      </div>
      
      <p className="text-caption text-muted-foreground mt-space-sm leading-relaxed">
        Your website can be checked every {getDisplayValue(value).toLowerCase()} so you can get an instant notification in case things go wrong.
      </p>
    </div>
  );
};