import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";

export const SlackTestButton = () => {
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  const testSlackNotification = async () => {
    setIsTesting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('notify-slack', {
        body: {
          message: "🚨 TEST ALERT: Example.com is DOWN!\n\nURL: https://example.com\nTime: " + new Date().toLocaleString() + "\nError: Connection timeout\n\nThis is a test notification from MissionControl.",
          title: "🚨 Test Monitor Alert: Example.com is DOWN",
          color: "danger",
          url: "https://example.com",
          monitorName: "Example Website",
          timestamp: new Date().toISOString()
        }
      });

      if (error) {
        console.error('Slack test error:', error);
        toast({
          title: "Test Failed",
          description: error.message || "Failed to send Slack test notification",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Test Sent! 📱",
        description: "Check your Slack channel for the test notification"
      });
    } catch (error: any) {
      console.error('Unexpected error during Slack test:', error);
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
        <div className="animate-spin">📱</div>
      ) : (
        <MessageSquare className="h-4 w-4" />
      )}
      {isTesting ? 'Testing...' : 'Test Slack'}
    </Button>
  );
};