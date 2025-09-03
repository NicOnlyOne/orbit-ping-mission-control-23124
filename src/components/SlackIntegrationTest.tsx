import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Check, X } from "lucide-react";

export const SlackIntegrationTest = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [slackInfo, setSlackInfo] = useState({
    username: "",
    channel: ""
  });
  const { toast } = useToast();

  const testSlackNotification = async () => {
    setIsTesting(true);
    setTestResult('idle');
    
    try {
      const { data, error } = await supabase.functions.invoke('notify-slack', {
        body: {
          message: `🛰️ MissionControl Test Alert\n\nHello ${slackInfo.username || 'there'}! 👋\n\nThis is a test notification to verify your Slack integration is working correctly.\n\nChannel: ${slackInfo.channel || '#general'}\nTime: ${new Date().toLocaleString()}\n\n✅ Integration Status: Active`,
          title: "🛰️ MissionControl Integration Test",
          color: "good",
          url: window.location.origin,
          monitorName: "Integration Test",
          timestamp: new Date().toISOString()
        }
      });

      if (error) {
        console.error('Slack test error:', error);
        setTestResult('error');
        toast({
          title: "Test Failed ❌",
          description: error.message || "Failed to send Slack test notification. Check if webhook URL is configured.",
          variant: "destructive"
        });
        return;
      }

      setTestResult('success');
      toast({
        title: "Test Sent! 🎉",
        description: `Check your Slack ${slackInfo.channel || 'channel'} for the test notification`
      });
    } catch (error: any) {
      console.error('Unexpected error during Slack test:', error);
      setTestResult('error');
      toast({
        title: "Test Error ❌",
        description: "Failed to send Slack test notification. Please check your configuration.",
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
          Slack Integration Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="testUsername">Your Slack Username (optional)</Label>
            <Input
              id="testUsername"
              value={slackInfo.username}
              onChange={(e) => setSlackInfo(prev => ({ ...prev, username: e.target.value }))}
              placeholder="@john.doe"
              className="bg-space-dark border-space-light"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="testChannel">Slack Channel (optional)</Label>
            <Input
              id="testChannel"
              value={slackInfo.channel}
              onChange={(e) => setSlackInfo(prev => ({ ...prev, channel: e.target.value }))}
              placeholder="#alerts"
              className="bg-space-dark border-space-light"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={testSlackNotification}
            disabled={isTesting}
            variant="outline"
            size="sm"
          >
            {isTesting ? (
              <div className="animate-spin">📱</div>
            ) : testResult === 'success' ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : testResult === 'error' ? (
              <X className="h-4 w-4 text-red-500" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isTesting ? 'Testing...' : 'Test Slack Integration'}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Setup Instructions:</strong></p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Create a Slack webhook in your workspace</li>
            <li>Add the webhook URL to SLACK_WEBHOOK_URL secret</li>
            <li>Test the integration using the button above</li>
            <li>Monitor alerts will automatically post to Slack</li>
          </ol>
        </div>

        {testResult === 'success' && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-400">✅ Slack integration is working correctly!</p>
          </div>
        )}

        {testResult === 'error' && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">❌ Slack integration test failed. Check your webhook URL configuration.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};