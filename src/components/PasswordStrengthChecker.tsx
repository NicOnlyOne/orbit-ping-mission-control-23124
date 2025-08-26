import { useState, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface PasswordStrengthCheckerProps {
  password: string;
  onStrengthChange?: (isStrong: boolean) => void;
}

interface PasswordRequirement {
  label: string;
  met: boolean;
  regex?: RegExp;
  check?: (password: string) => boolean;
}

export const PasswordStrengthChecker = ({ password, onStrengthChange }: PasswordStrengthCheckerProps) => {
  const requirements = useMemo((): PasswordRequirement[] => {
    const reqs = [
      {
        label: "At least 8 characters",
        met: password.length >= 8,
      },
      {
        label: "Contains uppercase letter",
        met: /[A-Z]/.test(password),
      },
      {
        label: "Contains lowercase letter",
        met: /[a-z]/.test(password),
      },
      {
        label: "Contains number",
        met: /\d/.test(password),
      },
      {
        label: "Contains special character",
        met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password),
      },
      {
        label: "No common patterns",
        met: !isCommonPassword(password),
      },
    ];
    
    const strongPassword = reqs.filter(req => req.met).length >= 5;
    onStrengthChange?.(strongPassword && password.length >= 8);
    
    return reqs;
  }, [password, onStrengthChange]);

  const strength = requirements.filter(req => req.met).length;
  const strengthPercentage = (strength / requirements.length) * 100;

  const getStrengthColor = () => {
    if (strength < 2) return "hsl(var(--destructive))";
    if (strength < 4) return "hsl(var(--status-warning))";
    if (strength < 5) return "hsl(var(--secondary))";
    return "hsl(var(--status-online))";
  };

  const getStrengthText = () => {
    if (strength < 2) return "Weak";
    if (strength < 4) return "Fair";
    if (strength < 5) return "Good";
    return "Strong";
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Password Strength</span>
          <span 
            className="font-medium"
            style={{ color: getStrengthColor() }}
          >
            {getStrengthText()}
          </span>
        </div>
        <Progress 
          value={strengthPercentage} 
          className="h-2"
          style={{
            // @ts-ignore
            '--progress-color': getStrengthColor()
          }}
        />
      </div>
      
      <div className="space-y-1">
        {requirements.map((req, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            {req.met ? (
              <Check className="h-3 w-3 text-status-online" />
            ) : (
              <X className="h-3 w-3 text-destructive" />
            )}
            <span className={cn(
              req.met ? "text-status-online" : "text-muted-foreground"
            )}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Common password patterns to avoid
function isCommonPassword(password: string): boolean {
  const commonPatterns = [
    'password', '123456', 'qwerty', 'abc123', 'letmein', 'admin',
    'welcome', 'monkey', '111111', 'dragon', 'master', 'shadow',
    'superman', 'michael', 'football', 'baseball', 'liverpool'
  ];
  
  const lowerPassword = password.toLowerCase();
  return commonPatterns.some(pattern => 
    lowerPassword.includes(pattern) || 
    lowerPassword === pattern ||
    /^(.)\1{2,}$/.test(password) || // repeated characters
    /^(012|123|234|345|456|567|678|789|890|987|876|765|654|543|432|321|210)/.test(password) // sequential
  );
}