"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const emailForm = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});
const codeForm = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "Code must be 4–8 digits"),
});

type Step = "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");

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
      toast.success("Verification code sent. Ask your admin for the code.");
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
      toast.success("Welcome back");
      router.push("/campaigns");
      router.refresh();
    } catch {
      toast.error("Network error");
    }
  }

  return (
    <div className="grid min-h-screen px-4 place-items-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center w-10 h-10 mb-2 rounded-md bg-primary text-primary-foreground">
            {step === "email" ? (
              <Mail className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {step === "email" ? "Sign in to Orcazo" : "Enter your code"}
          </CardTitle>
          <CardDescription>
            {step === "email"
              ? "Use the email your admin assigned you. A verification code will be sent — your admin will share it with you."
              : `We sent a code to ${email}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form
              onSubmit={emailHook.handleSubmit(requestCode)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@yourwork.com"
                  disabled={emailHook.formState.isSubmitting}
                  {...emailHook.register("email")}
                />
                {emailHook.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {emailHook.formState.errors.email.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={emailHook.formState.isSubmitting}
              >
                {emailHook.formState.isSubmitting && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Send code
              </Button>
              <p className="text-xs text-center text-muted-foreground pt-1">
                Don&apos;t have an account?{" "}
                <a
                  href="/creators"
                  className="text-foreground font-medium underline-offset-4 hover:underline"
                >
                  Apply as a creator
                </a>
              </p>
            </form>
          ) : (
            <form
              onSubmit={codeHook.handleSubmit(verify)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
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
              <Button
                type="submit"
                className="w-full"
                disabled={codeHook.formState.isSubmitting}
              >
                {codeHook.formState.isSubmitting && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
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
        </CardContent>
      </Card>
    </div>
  );
}
