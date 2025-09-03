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
    price: '$0',
    period: 'forever',
    icon: Star,
    description: 'Perfect for getting started',
    features: [
      '1 active monitor',
      'Email alerts',
      'Basic uptime tracking',
      'Community support'
    ],
    limitations: ['Limited to 1 active monitor']
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: '$9',
    period: 'per month',
    icon: Rocket,
    description: 'Best for small teams',
    features: [
      'Unlimited monitors',
      'Email alerts',
      'Slack notifications',
      'Advanced analytics',
      'Priority support'
    ],
    popular: true
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    price: '$29',
    period: 'per month',
    icon: Crown,
    description: 'For mission-critical operations',
    features: [
      'Everything in Pro',
      'SMS notifications',
      'Custom alerting rules',
      'SLA monitoring',
      'Dedicated support'
    ]
  }
];

export function PricingModal({ open, onOpenChange }: PricingModalProps) {
  const { plan: currentPlan, upgradePlan } = useSubscription();

  const handleUpgrade = async (planId: typeof plans[0]['id']) => {
    if (planId === currentPlan) return;

    try {
      await upgradePlan(planId);
      toast.success(`Successfully upgraded to ${planId} plan!`);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to upgrade plan. Please try again.');
      console.error('Upgrade error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Choose Your Mission Plan</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
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
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-nebula-blue text-white px-3 py-1 rounded-full text-xs font-medium">
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
                  
                  {plan.limitations && (
                    <div className="mb-4 p-3 bg-muted rounded-lg">
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">Limitations:</h4>
                      {plan.limitations.map((limitation, index) => (
                        <p key={index} className="text-xs text-muted-foreground">{limitation}</p>
                      ))}
                    </div>
                  )}
                  
                  <Button 
                    className="w-full"
                    variant={isCurrentPlan ? "outline" : (isPopular ? "default" : "outline")}
                    disabled={isCurrentPlan}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {isCurrentPlan ? 'Current Plan' : `Upgrade to ${plan.name}`}
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