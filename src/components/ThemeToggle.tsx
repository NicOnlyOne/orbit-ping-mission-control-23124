import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ThemeToggleProps {
  value: string;
  onChange: (value: string) => void;
}

export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  const cycleTheme = () => {
    if (value === 'light') {
      onChange('dark');
    } else if (value === 'dark') {
      onChange('system');
    } else {
      onChange('light');
    }
  };

  const getIcon = () => {
    switch (value) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'system':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getThemeLabel = () => {
    switch (value) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System';
      default:
        return 'System';
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={cycleTheme}
      className="gap-2"
    >
      {getIcon()}
      {getThemeLabel()}
    </Button>
  );
}