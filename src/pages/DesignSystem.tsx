import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { StatusIndicator } from "@/components/StatusIndicator";

const DesignSystem = () => {
  const colors = [
    { name: "Background", class: "bg-background", text: "text-foreground" },
    { name: "Primary", class: "bg-primary", text: "text-primary-foreground" },
    { name: "Secondary", class: "bg-secondary", text: "text-secondary-foreground" },
    { name: "Muted", class: "bg-muted", text: "text-muted-foreground" },
    { name: "Accent", class: "bg-accent", text: "text-accent-foreground" },
    { name: "Destructive", class: "bg-destructive", text: "text-destructive-foreground" },
    { name: "Card", class: "bg-card", text: "text-card-foreground" },
  ];

  const spaceTokens = [
    "space-xs", "space-sm", "space-md", "space-lg", "space-xl", "space-2xl", "space-card", "space-section",
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-24 pb-space-section px-space-page-x max-w-6xl mx-auto">
        <h1 className="text-hero font-token-bold text-foreground mb-space-sm">Design System</h1>
        <p className="text-body-lg text-muted-foreground mb-space-2xl">
          OrbitPing's visual language — tokens, components, and patterns.
        </p>

        {/* Colors */}
        <section className="mb-space-section">
          <h2 className="text-section-title font-token-semibold text-foreground mb-space-lg">Colors</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-space-md">
            {colors.map((c) => (
              <div key={c.name} className={`${c.class} ${c.text} rounded-card p-space-card text-center text-body font-token-medium border border-border`}>
                {c.name}
              </div>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section className="mb-space-section">
          <h2 className="text-section-title font-token-semibold text-foreground mb-space-lg">Typography</h2>
          <div className="space-y-space-md">
            <p className="text-hero font-token-bold text-foreground">Hero — text-hero</p>
            <p className="text-page-title font-token-bold text-foreground">Page Title — text-page-title</p>
            <p className="text-section-title font-token-semibold text-foreground">Section Title — text-section-title</p>
            <p className="text-card-title font-token-semibold text-foreground">Card Title — text-card-title</p>
            <p className="text-body-lg text-foreground">Body Large — text-body-lg</p>
            <p className="text-body text-foreground">Body — text-body</p>
            <p className="text-body-sm text-muted-foreground">Body Small — text-body-sm</p>
            <p className="text-caption text-muted-foreground">Caption — text-caption</p>
          </div>
        </section>

        {/* Spacing */}
        <section className="mb-space-section">
          <h2 className="text-section-title font-token-semibold text-foreground mb-space-lg">Spacing</h2>
          <div className="space-y-space-sm">
            {spaceTokens.map((t) => (
              <div key={t} className="flex items-center gap-space-md">
                <span className="text-body-sm text-muted-foreground w-32 font-mono">{t}</span>
                <div className={`h-4 bg-primary rounded`} style={{ width: `var(--${t})` }} />
              </div>
            ))}
          </div>
        </section>

        {/* Buttons */}
        <section className="mb-space-section">
          <h2 className="text-section-title font-token-semibold text-foreground mb-space-lg">Buttons</h2>
          <div className="flex flex-wrap gap-space-md items-center">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="rocket">🚀 Rocket</Button>
          </div>
        </section>

        {/* Badges */}
        <section className="mb-space-section">
          <h2 className="text-section-title font-token-semibold text-foreground mb-space-lg">Badges</h2>
          <div className="flex flex-wrap gap-space-sm items-center">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </section>

        {/* Status Indicators */}
        <section className="mb-space-section">
          <h2 className="text-section-title font-token-semibold text-foreground mb-space-lg">Status Indicators</h2>
          <div className="flex flex-wrap gap-space-lg items-center">
            <div className="flex items-center gap-space-xs"><StatusIndicator status="up" /> <span className="text-body-sm">Up</span></div>
            <div className="flex items-center gap-space-xs"><StatusIndicator status="down" /> <span className="text-body-sm">Down</span></div>
            <div className="flex items-center gap-space-xs"><StatusIndicator status="pending" /> <span className="text-body-sm">Pending</span></div>
          </div>
        </section>

        {/* Form Elements */}
        <section className="mb-space-section">
          <h2 className="text-section-title font-token-semibold text-foreground mb-space-lg">Form Elements</h2>
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Sample Form</CardTitle>
            </CardHeader>
            <CardContent className="space-y-space-md">
              <div className="space-y-space-xs">
                <Label>Text Input</Label>
                <Input placeholder="Enter value..." />
              </div>
              <div className="flex items-center gap-space-sm">
                <Switch id="demo-switch" />
                <Label htmlFor="demo-switch">Toggle option</Label>
              </div>
              <div className="space-y-space-xs">
                <Label>Slider</Label>
                <Slider defaultValue={[50]} max={100} step={1} />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Cards */}
        <section className="mb-space-section">
          <h2 className="text-section-title font-token-semibold text-foreground mb-space-lg">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <Card>
              <CardHeader>
                <CardTitle>Standard Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-body text-muted-foreground">Cards use rounded-card radius and space-card padding from design tokens.</p>
              </CardContent>
            </Card>
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle>Highlighted Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-body text-muted-foreground">Accent border variant for emphasis.</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DesignSystem;
