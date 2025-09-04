import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubscription } from "@/hooks/useSubscription";
import { Check, Mail, MessageSquare, Smartphone, Star, Rocket, Crown } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
const planCategories = [{
  id: 'free',
  name: 'Free',
  icon: Star,
  description: 'Great for small projects or testing your "mission control."',
  baseFeatures: ['5 monitors', '5-minute checks', 'Email alerts', 'Basic uptime tracking'],
  options: [{
    monitors: 5,
    price: 0,
    planId: 'free' as const
  }]
}, {
  id: 'pro',
  name: 'Pro',
  icon: Rocket,
  description: 'Powerful for small teams who want fast alerts and better tracking.',
  baseFeatures: ['1-minute checks', 'Email alerts', 'Slack notifications'],
  options: [{
    monitors: 25,
    price: 12,
    planId: 'pro-25' as const
  }, {
    monitors: 50,
    price: 19,
    planId: 'pro-50' as const
  }]
}, {
  id: 'enterprise',
  name: 'Enterprise',
  icon: Crown,
  description: 'Perfect for critical services where real-time phone alerts matter.',
  baseFeatures: ['30-second checks', 'Email alerts', 'Slack notifications', 'SMS notifications', '100 SMS included/month'],
  options: [{
    monitors: 100,
    price: 49,
    planId: 'enterprise-100' as const
  }, {
    monitors: 250,
    price: 99,
    planId: 'enterprise-250' as const
  }]
}];
export function PricingModal({
  open,
  onOpenChange
}: PricingModalProps) {
  const {
    plan: currentPlan,
    upgradePlan
  } = useSubscription();

  // State for dropdown selections
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({
    pro: 25,
    enterprise: 100
  });

  // Plan hierarchy for determining upgrade vs downgrade
  const planHierarchy = {
    free: 0,
    'pro-25': 1,
    'pro-50': 2,
    'enterprise-100': 3,
    'enterprise-250': 4
  };
  const isUpgrade = (targetPlan: string) => {
    return planHierarchy[targetPlan as keyof typeof planHierarchy] > planHierarchy[currentPlan];
  };
  const handlePlanChange = async (planId: string) => {
    if (planId === currentPlan) return;
    try {
      await upgradePlan(planId as any);
      const action = isUpgrade(planId) ? 'upgraded' : 'changed';
      toast.success(`Successfully ${action} to plan!`);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to change plan. Please try again.');
      console.error('Plan change error:', error);
    }
  };
  const getCurrentOption = (category: typeof planCategories[0]) => {
    if (category.id === 'free') return category.options[0];
    return category.options.find(opt => opt.monitors === selectedOptions[category.id]) || category.options[0];
  };
  const isCurrentPlan = (planId: string) => currentPlan === planId;
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Choose Your Mission Plan</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          {planCategories.map(category => {
          const Icon = category.icon;
          const currentOption = getCurrentOption(category);
          const currentPlanActive = isCurrentPlan(currentOption.planId);
          return <Card key={category.id} className={`relative ${currentPlanActive ? 'bg-muted/50' : ''}`}>
                <CardHeader className="text-center py-8 px-6">
                  <div className="flex items-center justify-center mb-4">
                    <Icon className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <CardTitle className="flex items-center justify-center gap-2 text-xl mb-4">
                    {category.name}
                    {currentPlanActive && <span className="text-xs bg-astro-green text-starlight-white px-2 py-1 rounded">
                        Current
                      </span>}
                  </CardTitle>
                  <CardDescription className="text-base mb-6 px-2 py-[10px]">{category.description}</CardDescription>
                  
                  {/* Price Display */}
                  <div className="mb-6 py-[10px]">
                    <span className="text-4xl font-bold">
                      €{currentOption.price}
                    </span>
                    <span className="text-muted-foreground text-lg">/month</span>
                  </div>

                  {/* Monitor Selection Dropdown */}
                  {category.options.length > 1 && <div className="mb-4">
                      <Select value={selectedOptions[category.id]?.toString()} onValueChange={value => setSelectedOptions(prev => ({
                  ...prev,
                  [category.id]: parseInt(value)
                }))}>
                        <SelectTrigger className="w-full bg-background border border-muted">
                          <SelectValue placeholder="Select monitors" />
                        </SelectTrigger>
                        <SelectContent>
                          {category.options.map(option => <SelectItem key={option.monitors} value={option.monitors.toString()}>
                              {option.monitors} monitors / month
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>}
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {category.baseFeatures.map((feature, index) => <li key={index} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-astro-green flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>)}
                  </ul>
                  
                  <Button className="w-full" variant={currentPlanActive ? "outline" : "default"} disabled={currentPlanActive} onClick={() => handlePlanChange(currentOption.planId)}>
                    {currentPlanActive ? 'Current Plan' : `${isUpgrade(currentOption.planId) ? 'Upgrade' : 'Change'} to ${category.name}`}
                  </Button>
                </CardContent>
              </Card>;
        })}
        </div>
        
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>Email alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span>Slack (Pro)</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span>SMS (Enterprise)</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>;
}