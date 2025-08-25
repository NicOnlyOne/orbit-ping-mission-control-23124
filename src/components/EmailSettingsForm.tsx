import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Save, X } from "lucide-react";

interface EmailSettingsFormProps {
  currentEmail?: string | null;
  onSave: (email: string) => Promise<void>;
  onCancel?: () => void;
}

export const EmailSettingsForm = ({ currentEmail, onSave, onCancel }: EmailSettingsFormProps) => {
  const [email, setEmail] = useState(currentEmail || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!email.trim()) return;
    
    setIsSaving(true);
    try {
      await onSave(email);
      onCancel?.();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Mail className="h-4 w-4" />
        Alert Email Settings
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="alert-email" className="text-xs text-muted-foreground">
          Email address for down alerts
        </Label>
        <Input
          id="alert-email"
          type="email"
          placeholder="your-email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-space-deep border-space-light"
        />
      </div>
      
      <div className="flex gap-2">
        <Button
          variant="satellite"
          size="sm"
          onClick={handleSave}
          disabled={!email.trim() || isSaving}
          className="flex-1"
        >
          {isSaving ? (
            <>
              <Save className="h-3 w-3 mr-2 animate-pulse" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-3 w-3 mr-2" />
              Save Email
            </>
          )}
        </Button>
        
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="flex-1"
          >
            <X className="h-3 w-3 mr-2" />
            Cancel
          </Button>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">
        You'll receive email alerts when this monitor goes down or comes back online.
      </p>
    </div>
  );
};