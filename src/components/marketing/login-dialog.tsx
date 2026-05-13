"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emailForm = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});
const codeForm = z.object({
  code: z.string().trim().regex(/^\d{4,8}$/, "Code must be 4–8 digits"),
});

export function LoginDialog({
  open,
  onOpenChange,
  onSwitchToSignup,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSwitchToSignup?: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<"email" | "code">("email");
  const [email, setEmail] = React.useState("");

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setStep("email");
      setEmail("");
      emailHook.reset();
      codeHook.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const emailHook = useForm<z.infer<typeof emailForm>>({
    resolver: zodResolver(emailForm),
    defaultValues: { email: "" },
  });

  const codeHook = useForm<z.infer<typeof codeForm>>({
    resolver: zodResolver(codeForm),
    defaultValues: { code: "" },
  });

  async function requestCode(values: z.infer<typeof emailForm>) {
    try {
      const r = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error || "Could not send code");
        return;
      }
      setEmail(values.email);
      setStep("code");
      toast.success("Check your email — a verification code is on its way.");
    } catch {
      toast.error("Network error");
    }
  }

  async function verify(values: z.infer<typeof codeForm>) {
    try {
      const r = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: values.code }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error || "Could not verify code");
        return;
      }
      toast.success("Welcome back!");
      onOpenChange(false);
      router.push("/campaigns");
      router.refresh();
    } catch {
      toast.error("Network error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-10 h-10 mb-1 rounded-md bg-primary text-primary-foreground mx-auto">
            {step === "email" ? (
              <Mail className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <DialogTitle className="text-center text-xl">
            {step === "email" ? "Sign in to Orcazo" : "Enter your code"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === "email"
              ? "Enter your email and we'll send you a verification code."
              : `We sent a code to ${email}. It can take 15–20 seconds to arrive.`}
          </DialogDescription>
        </DialogHeader>

        {step === "email" ? (
          <form onSubmit={emailHook.handleSubmit(requestCode)} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                disabled={emailHook.formState.isSubmitting}
                {...emailHook.register("email")}
              />
              {emailHook.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {emailHook.formState.errors.email.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={emailHook.formState.isSubmitting}>
              {emailHook.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Send code
            </Button>
            {onSwitchToSignup && (
              <p className="text-xs text-center text-muted-foreground">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={onSwitchToSignup}
                  className="text-foreground font-medium underline-offset-4 hover:underline"
                >
                  Apply as a creator
                </button>
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={codeHook.handleSubmit(verify)} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="login-code">Verification code</Label>
              <Input
                id="login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="123456"
                disabled={codeHook.formState.isSubmitting}
                {...codeHook.register("code")}
              />
              {codeHook.formState.errors.code && (
                <p className="text-xs text-destructive">
                  {codeHook.formState.errors.code.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={codeHook.formState.isSubmitting}>
              {codeHook.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify and continue
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStep("email")}
              disabled={codeHook.formState.isSubmitting}
            >
              Use a different email
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
