import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Check, X, Rocket } from "lucide-react";

interface SlackIntegrationTestProps {
  slackChannel?: string;
  slackUsername?: string;
}

export const SlackIntegrationTest = ({ slackChannel = "", slackUsername = "" }: SlackIntegrationTestProps) => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [channel, setChannel] = useState(slackChannel);
  const { toast } = useToast();

  const testSlackNotification = async () => {
    if (!channel) {
      toast({
        title: "Channel Required",
        description: "Please enter a Slack channel name (e.g. #alerts)",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);
    setTestResult('idle');
    
    try {
      const { data, error } = await supabase.functions.invoke('notify-slack', {
        body: {
          channel: channel.startsWith('#') ? channel : `#${channel}`,
          message: `Hello ${slackUsername || 'there'}! 👋 This is a test notification to verify your Slack integration is working correctly.\n\n✅ *Integration Status:* Active`,
          title: "🛰️ MissionControl Integration Test",
          color: "#2ECC71",
          monitorName: "Integration Test",
          timestamp: new Date().toISOString(),
          username: slackUsername || undefined,
        }
      });

      if (error) {
        console.error('Slack test error:', error);
        setTestResult('error');
        toast({
          title: "Test Failed ❌",
          description: error.message || "Failed to send test notification. Check your Slack configuration.",
          variant: "destructive"
        });
        return;
      }

      if (data?.error) {
        setTestResult('error');
        toast({
          title: "Test Failed ❌",
          description: data.error === "Slack integration not connected" 
            ? "Slack connector is not linked. Please contact your admin."
            : data.details || data.error,
          variant: "destructive"
        });
        return;
      }

      setTestResult('success');
      toast({
        title: "Test Sent! 🎉",
        description: `Check ${channel} in Slack for the test notification`
      });
    } catch (error: any) {
      console.error('Unexpected error during Slack test:', error);
      setTestResult('error');
      toast({
        title: "Test Error ❌",
        description: "Failed to send test notification. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="bg-space-medium border-space-light">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Test Slack Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="testChannel">Channel to send test message</Label>
          <Input
            id="testChannel"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="#alerts"
            className="bg-space-dark border-space-light"
          />
          <p className="text-xs text-muted-foreground">
            The bot can post to any public channel. For private channels, invite the bot first.
          </p>
        </div>

        <Button
          onClick={testSlackNotification}
          disabled={isTesting || !channel}
          variant="outline"
          size="sm"
        >
          {isTesting ? (
            <Rocket className="h-4 w-4 animate-bounce" />
          ) : testResult === 'success' ? (
            <Check className="h-4 w-4 text-astro-green" />
          ) : testResult === 'error' ? (
            <X className="h-4 w-4 text-rocket-red" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isTesting ? 'Sending...' : 'Send Test Message'}
        </Button>

        {testResult === 'success' && (
          <div className="p-3 bg-astro-green/10 border border-astro-green/20 rounded-lg">
            <p className="text-sm text-astro-green">✅ Slack integration is working! Check your channel.</p>
          </div>
        )}

        {testResult === 'error' && (
          <div className="p-3 bg-rocket-red/10 border border-rocket-red/20 rounded-lg">
            <p className="text-sm text-rocket-red">❌ Test failed. Make sure the channel exists and the bot has access.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
