import { useState } from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Send, Check, X } from "lucide-react";

interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export const PhoneNumberInput = ({ 
  value, 
  onChange, 
  label = "Phone Number", 
  placeholder = "Enter phone number",
  required = false 
}: PhoneNumberInputProps) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const validatePhoneNumber = async () => {
    if (!value) {
      toast({
        title: "Error",
        description: "Please enter a phone number first",
        variant: "destructive"
      });
      return;
    }

    setIsValidating(true);
    setValidationStatus('idle');

    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: value,
          message: "🛰️ MissionControl: This is a test message to validate your phone number. You're all set!"
        }
      });

      if (error) {
        console.error('SMS validation error:', error);
        setValidationStatus('error');
        
        // Handle trial account limitation
        if (error.message?.includes('trial') || error.message?.includes('verified')) {
          toast({
            title: "Twilio Trial Account Limitation",
            description: "Your phone number needs to be verified in Twilio console first, or upgrade to a paid account to send to any number.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Validation Failed",
            description: error.message || "Failed to send validation SMS",
            variant: "destructive"
          });
        }
        return;
      }

      setValidationStatus('success');
      toast({
        title: "Validation Sent! 📱",
        description: "Check your phone for a test message from MissionControl"
      });
    } catch (error: any) {
      console.error('Unexpected error during SMS validation:', error);
      setValidationStatus('error');
      toast({
        title: "Validation Error",
        description: "Failed to send validation SMS",
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="phone">{label} {required && "*"}</Label>
      <div className="flex gap-2">
        <div className="flex-1">
          <PhoneInput
            international
            countryCallingCodeEditable={false}
            defaultCountry="US"
            value={value as any}
            onChange={(phone: any) => onChange(phone || "")}
            placeholder={placeholder}
            className="phone-input"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={validatePhoneNumber}
          disabled={isValidating || !value}
          className="shrink-0"
        >
          {isValidating ? (
            <div className="animate-spin">📱</div>
          ) : validationStatus === 'success' ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : validationStatus === 'error' ? (
            <X className="h-4 w-4 text-red-500" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isValidating ? 'Sending...' : 'Test'}
        </Button>
      </div>
      {validationStatus === 'success' && (
        <p className="text-sm text-green-600">✅ Phone number validated successfully!</p>
      )}
      {validationStatus === 'error' && (
        <p className="text-sm text-destructive">❌ Validation failed. Please check the number and try again.</p>
      )}
    </div>
  );
};