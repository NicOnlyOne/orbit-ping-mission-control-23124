import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, CheckCircle, Loader2 } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().trim().email("Please enter a valid email address").max(255);

interface NotifyMeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
}

export function NotifyMeDialog({ open, onOpenChange, planName }: NotifyMeDialogProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error: dbError } = await supabase
        .from("plan_waitlist" as any)
        .insert({ email: result.data, plan_interest: planName } as any);

      if (dbError) throw dbError;

      setSubmitted(true);
      toast.success("You're on the list! We'll notify you when plans launch.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setTimeout(() => {
        setEmail("");
        setSubmitted(false);
        setError("");
      }, 300);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="flex flex-col items-center gap-space-md py-space-xl text-center">
            <div className="rounded-full bg-astro-green/10 p-4">
              <CheckCircle className="h-10 w-10 text-astro-green" />
            </div>
            <DialogHeader className="items-center">
              <DialogTitle className="text-section-title">You're on the list!</DialogTitle>
              <DialogDescription className="text-body text-muted-foreground">
                We'll send you a mission briefing as soon as the <strong className="text-foreground">{planName}</strong> plan is ready for launch.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => handleClose(false)} variant="outline" className="mt-space-sm">
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-space-sm mb-space-xs">
                <div className="rounded-full bg-nebula-blue/10 p-2">
                  <Bell className="h-5 w-5 text-nebula-blue" />
                </div>
              </div>
              <DialogTitle className="text-section-title">Get notified when {planName} launches</DialogTitle>
              <DialogDescription className="text-body-sm text-muted-foreground">
                Drop your email and we'll alert you as soon as the {planName} plan is ready for liftoff.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-space-md mt-space-md">
              <div className="space-y-space-xs">
                <Label htmlFor="waitlist-email">Email address</Label>
                <Input
                  id="waitlist-email"
                  type="email"
                  placeholder="commander@mission.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  autoFocus
                />
                {error && <p className="text-caption text-destructive">{error}</p>}
              </div>
              <Button type="submit" disabled={loading || !email.trim()} className="w-full">
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Joining...</>
                ) : (
                  <><Bell className="h-4 w-4 mr-2" /> Notify Me</>
                )}
              </Button>
              <p className="text-caption text-muted-foreground text-center">
                No spam — just a one-time launch notification.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
