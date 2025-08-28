import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, TestTube, Smartphone } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export const PushNotificationSettings = () => {
  const { 
    isSupported, 
    isEnabled, 
    isLoading, 
    enableNotifications,
    disableNotifications, 
    sendTestNotification 
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Push Notifications</CardTitle>
            <Badge variant="secondary">Not Supported</Badge>
          </div>
          <CardDescription>
            Push notifications are not supported in this browser or device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            To receive push notifications, please use a modern browser like Chrome, Firefox, or Safari 
            on a supported device.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Push Notifications</CardTitle>
            {isEnabled ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                Enabled
              </Badge>
            ) : (
              <Badge variant="secondary">Disabled</Badge>
            )}
          </div>
          <Smartphone className="h-5 w-5 text-muted-foreground" />
        </div>
        <CardDescription>
          Get instant alerts when your monitored services go offline or come back online.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Enable Push Notifications</div>
            <div className="text-sm text-muted-foreground">
              Receive real-time alerts on your device
            </div>
          </div>
          <Switch
            checked={isEnabled}
            disabled={isLoading}
            onCheckedChange={async (checked) => {
              if (checked && !isEnabled) {
                await enableNotifications();
              } else if (!checked && isEnabled) {
                await disableNotifications();
              }
            }}
          />
        </div>

        {isEnabled && (
          <div className="pt-4 border-t border-border">
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground">
                Notification Settings
              </div>
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm">Service downtime alerts</div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">Service recovery notifications</div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">Weekly uptime reports</div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border mt-4">
              <Button
                onClick={sendTestNotification}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Send Test Notification
              </Button>
            </div>
          </div>
        )}

        {!isEnabled && (
          <div className="pt-4 border-t border-border">
            <Button
              onClick={enableNotifications}
              disabled={isLoading}
              className="w-full"
            >
              <Bell className="h-4 w-4 mr-2" />
              {isLoading ? 'Enabling...' : 'Enable Push Notifications'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};