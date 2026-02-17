import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";

interface SlackTestButtonProps {
  channel?: string;
}

export const SlackTestButton = ({ channel = "#general" }: SlackTestButtonProps) => {
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  const testSlackNotification = async () => {
    setIsTesting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('notify-slack', {
        body: {
          channel: channel.startsWith('#') ? channel : `#${channel}`,
          message: "🚨 *TEST ALERT:* Example.com is DOWN!\n\n*URL:* https://example.com\n*Time:* " + new Date().toLocaleString() + "\n*Error:* Connection timeout\n\nThis is a test notification from MissionControl.",
          title: "🚨 Test Monitor Alert",
          color: "#FF5C5C",
          monitorName: "Example Website",
          timestamp: new Date().toISOString()
        }
      });

      if (error) {
        toast({
          title: "Test Failed",
          description: error.message || "Failed to send Slack test notification",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Test Sent! 🚀",
        description: `Check ${channel} in Slack for the test notification`
      });
    } catch (error: any) {
      toast({
        title: "Test Error",
        description: "Failed to send Slack test notification",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Button
      onClick={testSlackNotification}
      disabled={isTesting}
      variant="outline"
      size="sm"
    >
      {isTesting ? (
        <div className="animate-spin">🚀</div>
      ) : (
        <MessageSquare className="h-4 w-4" />
      )}
      {isTesting ? 'Testing...' : 'Test Slack'}
    </Button>
  );
};
