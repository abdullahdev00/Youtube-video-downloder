import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Star } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for casual users",
    features: [
      "Single video downloads",
      "Up to 720p quality",
      "Standard processing speed",
      "Limited formats (MP4, MP3)",
      "Ad-supported experience"
    ],
    limitations: [
      "Download limit: 5 per day",
      "No batch downloads",
      "No priority support"
    ],
    popular: false,
    cta: "Start Free"
  },
  {
    name: "Premium",
    price: "$9.99",
    period: "per month",
    description: "For content creators and power users",
    features: [
      "Unlimited video downloads",
      "Up to 4K (2160p) quality",
      "Priority processing speed",
      "All formats supported",
      "Ad-free experience",
      "Batch downloads (up to 50)",
      "Download history & favorites",
      "Premium customer support",
      "Subtitle downloads",
      "Custom thumbnails"
    ],
    limitations: [],
    popular: true,
    cta: "Start Premium Trial"
  },
  {
    name: "Pro",
    price: "$19.99",
    period: "per month",
    description: "For businesses and heavy users",
    features: [
      "Everything in Premium",
      "Unlimited batch downloads",
      "API access (1000 calls/day)",
      "White-label solution",
      "Priority support (1h response)",
      "Custom download settings",
      "Team collaboration tools",
      "Advanced analytics",
      "Custom branding options"
    ],
    limitations: [],
    popular: false,
    cta: "Contact Sales"
  }
];

export function PremiumSection() {
  const handlePlanSelect = (planName: string) => {
    console.log(`Selected plan: ${planName}`);
    // TODO: Implement payment processing
  };

  return (
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Choose Your Plan
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Unlock premium features and download without limits
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={`relative hover-elevate transition-all duration-300 ${
                plan.popular 
                  ? "border-primary shadow-lg scale-105" 
                  : "border/50"
              }`}
              data-testid={`card-plan-${plan.name.toLowerCase()}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1 flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <div className="flex items-center justify-center mb-2">
                  {plan.name === "Free" && <Zap className="h-6 w-6 text-chart-2 mr-2" />}
                  {plan.name === "Premium" && <Crown className="h-6 w-6 text-primary mr-2" />}
                  {plan.name === "Pro" && <Star className="h-6 w-6 text-chart-3 mr-2" />}
                  <CardTitle className="text-xl" data-testid={`text-plan-name-${index}`}>
                    {plan.name}
                  </CardTitle>
                </div>
                <div className="mb-2">
                  <span className="text-3xl font-bold text-foreground" data-testid={`text-plan-price-${index}`}>
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground" data-testid={`text-plan-description-${index}`}>
                  {plan.description}
                </p>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Features */}
                <div className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-chart-2 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground" data-testid={`text-feature-${index}-${featureIndex}`}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Limitations (for free plan) */}
                {plan.limitations.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border/50">
                    <h4 className="text-sm font-medium text-muted-foreground">Limitations:</h4>
                    {plan.limitations.map((limitation, limitIndex) => (
                      <div key={limitIndex} className="flex items-start gap-3">
                        <div className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground">•</div>
                        <span className="text-sm text-muted-foreground" data-testid={`text-limitation-${index}-${limitIndex}`}>
                          {limitation}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA Button */}
                <Button
                  className={`w-full ${
                    plan.popular 
                      ? "bg-primary hover:bg-primary/90" 
                      : "bg-secondary hover:bg-secondary/90"
                  }`}
                  onClick={() => handlePlanSelect(plan.name)}
                  data-testid={`button-select-plan-${index}`}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 text-center">
          <div className="flex flex-wrap justify-center items-center gap-8 mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-8 w-8 bg-chart-2/20 rounded-full flex items-center justify-center">
                <Check className="h-4 w-4 text-chart-2" />
              </div>
              <span>30-day money-back guarantee</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-8 w-8 bg-chart-2/20 rounded-full flex items-center justify-center">
                <Check className="h-4 w-4 text-chart-2" />
              </div>
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-8 w-8 bg-chart-2/20 rounded-full flex items-center justify-center">
                <Check className="h-4 w-4 text-chart-2" />
              </div>
              <span>Secure payment processing</span>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            All plans include SSL encryption and privacy protection. No hidden fees.
          </p>
        </div>
      </div>
    </section>
  );
}