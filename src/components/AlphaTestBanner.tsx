import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const AlphaTestBanner = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-status-warning text-space-dark px-4 py-2 text-sm font-medium">
      <div className="flex items-center justify-center space-x-2 max-w-6xl mx-auto">
        <span>🚧</span>
        <span>
          Alpha Version - This project is in early development. Many features are still being improved and refined.
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible(false)}
          className="text-space-dark hover:bg-status-warning/20 h-6 w-6 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};