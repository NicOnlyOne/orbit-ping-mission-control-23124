import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";
import { Check, Mail, MessageSquare, Smartphone, Star, Rocket, Crown } from "lucide-react";
import { toast } from "sonner";

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const plans = [
  {
    id: 'free' as const,
    name: 'Free',
    price: '€0',
    period: 'month',
    icon: Star,
    description: 'Great for small projects or testing your "mission control."',
    features: [
      '5 monitors',
      '5-minute checks',
      'Email alerts',
      'Basic uptime tracking'
    ]
  },
  {
    id: 'pro-25' as const,
    name: 'Pro',
    price: '€12',
    period: 'month',
    icon: Rocket,
    description: 'Powerful for small teams who want fast alerts and better tracking.',
    features: [
      '25 monitors',
      '1-minute checks',
      'Email alerts',
      'Slack notifications'
    ],
    popular: true
  },
  {
    id: 'pro-50' as const,
    name: 'Pro+',
    price: '€19',
    period: 'month',
    icon: Rocket,
    description: 'More monitors for growing teams.',
    features: [
      '50 monitors',
      '1-minute checks',
      'Email alerts',
      'Slack notifications'
    ]
  },
  {
    id: 'enterprise-100' as const,
    name: 'Enterprise',
    price: '€49',
    period: 'month',
    icon: Crown,
    description: 'Perfect for critical services where real-time phone alerts matter.',
    features: [
      '100 monitors',
      '30-second checks',
      'Email alerts',
      'Slack notifications',
      'SMS notifications',
      '100 SMS included/month'
    ]
  },
  {
    id: 'enterprise-250' as const,
    name: 'Enterprise+',
    price: '€99',
    period: 'month',
    icon: Crown,
    description: 'Maximum capacity for large operations.',
    features: [
      '250 monitors',
      '30-second checks',
      'Email alerts',
      'Slack notifications',
      'SMS notifications',
      '100 SMS included/month'
    ]
  }
];

export function PricingModal({ open, onOpenChange }: PricingModalProps) {
  const { plan: currentPlan, upgradePlan } = useSubscription();

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

  const handlePlanChange = async (planId: typeof plans[0]['id']) => {
    if (planId === currentPlan) return;

    try {
      await upgradePlan(planId);
      const action = isUpgrade(planId) ? 'upgraded' : 'changed';
      toast.success(`Successfully ${action} to ${planId} plan!`);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to change plan. Please try again.');
      console.error('Plan change error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Choose Your Mission Plan</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = currentPlan === plan.id;
            const isPopular = plan.popular;

            return (
              <Card 
                key={plan.id} 
                className={`relative ${isPopular ? 'border-nebula-blue shadow-lg scale-105' : ''} ${isCurrentPlan ? 'bg-muted/50' : ''}`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <span className="bg-gradient-to-r from-nebula-blue to-astro-green text-white px-4 py-2 rounded-full text-xs font-semibold shadow-lg border border-white/20">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <CardHeader className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Icon className={`h-8 w-8 ${isPopular ? 'text-nebula-blue' : 'text-muted-foreground'}`} />
                  </div>
                  <CardTitle className="flex items-center justify-center gap-2">
                    {plan.name}
                    {isCurrentPlan && (
                      <span className="text-xs bg-astro-green text-white px-2 py-1 rounded">
                        Current
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-astro-green flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? "outline" : (isPopular ? "default" : "outline")}
                    disabled={isCurrentPlan}
                    onClick={() => handlePlanChange(plan.id)}
                  >
                    {isCurrentPlan 
                      ? 'Current Plan' 
                      : `${isUpgrade(plan.id) ? 'Upgrade' : 'Change'} to ${plan.name}`
                    }
                  </Button>
                </CardContent>
              </Card>
            );
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
              <span>Slack (Pro+)</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span>SMS (Enterprise)</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}