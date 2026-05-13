"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, Mail, ShieldCheck, Send, Plus, Trash2, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { PlatformIcon, PLATFORM_LABELS } from "@/components/platform-icon";
import { api } from "@/lib/api-client";

// ── Constants ────────────────────────────────────────────────────────────────

const RESEND_COOLDOWN = 60;

const PLATFORMS = [
  "tiktok", "instagram", "youtube", "snapchat", "x", "facebook",
] as const;

// ── Zod schemas ──────────────────────────────────────────────────────────────

const loginEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});
const loginCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{4,8}$/, "Code must be 4–8 digits"),
});

const signupSchema = z.object({
  publicEmail: z.string().trim().toLowerCase().email("Enter a valid email"),
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  whatsapp: z.string().trim().min(5, "Enter a valid WhatsApp number").max(40),
  referralCode: z.string().trim().max(50).optional(),
  socialAccounts: z
    .array(
      z.object({
        platform: z.enum(PLATFORMS),
        handle: z
          .string()
          .trim()
          .min(1, "Username required")
          .max(80)
          .refine(
            (v) =>
              !v.includes("/") &&
              !/^https?/i.test(v) &&
              !/^www\./i.test(v) &&
              !/\.(com|net|org|io|me|co)\b/i.test(v),
            "Enter a username, not a link",
          )
          .transform((v) => (v.startsWith("@") ? v.slice(1) : v)),
      }),
    )
    .min(1, "At least one social account is required")
    .max(4),
  website: z.string().max(0).optional(),
});

type LoginEmailForm = z.infer<typeof loginEmailSchema>;
type LoginCodeForm  = z.infer<typeof loginCodeSchema>;
type SignupForm     = z.infer<typeof signupSchema>;

// ── Left decorative panel ────────────────────────────────────────────────────

function LeftPanel() {
  return (
    <div className="hidden md:flex flex-col justify-between bg-primary text-primary-foreground p-10 relative overflow-hidden">
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      {/* Logo */}
      <Link href="/" className="flex items-center gap-1 z-10">
        <img src="/Light.png" alt="Orcazo" className="h-8 w-auto object-contain brightness-0 invert" />
      </Link>

      {/* Headline */}
      <div className="z-10">
        <h2 className="text-3xl font-semibold leading-snug tracking-tight max-w-xs">
          Make money uploading videos on social media
        </h2>
        <p className="mt-3 text-primary-foreground/75 text-sm max-w-xs leading-relaxed">
          Join thousands of creators earning real income from short-form content.
          No follower minimum required.
        </p>
      </div>

      {/* Stat */}
      <p className="text-xs text-primary-foreground/60 z-10">
        $12M+ paid out to creators · 150,000+ on the network
      </p>
    </div>
  );
}

// ── Login form ───────────────────────────────────────────────────────────────

function LoginForm({ onSwitchToSignup }: { onSwitchToSignup: () => void }) {
  const router = useRouter();
  const [step, setStep] = React.useState<"email" | "code">("email");
  const [email, setEmail] = React.useState("");
  const [cooldown, setCooldown] = React.useState(0);
  const [resending, setResending] = React.useState(false);

  const emailHook = useForm<LoginEmailForm>({
    resolver: zodResolver(loginEmailSchema),
    defaultValues: { email: "" },
  });
  const codeHook = useForm<LoginCodeForm>({
    resolver: zodResolver(loginCodeSchema),
    defaultValues: { code: "" },
  });

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode(values: LoginEmailForm) {
    const r = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await r.json();
    if (!r.ok) { toast.error(data.error || "Could not send code"); return; }
    setEmail(values.email);
    setStep("code");
    setCooldown(RESEND_COOLDOWN);
    toast.success("Code sent — check your inbox.");
  }

  const resendCode = React.useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const r = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!r.ok) { toast.error(data.error || "Could not resend code"); return; }
      setCooldown(RESEND_COOLDOWN);
      toast.success("New code sent.");
    } catch {
      toast.error("Network error");
    } finally {
      setResending(false);
    }
  }, [email, cooldown, resending]);

  async function verify(values: LoginCodeForm) {
    const r = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: values.code }),
    });
    const data = await r.json();
    if (!r.ok) { toast.error(data.error || "Could not verify code"); return; }
    toast.success("Welcome back!");
    router.push("/campaigns");
    router.refresh();
  }

  if (step === "email") {
    return (
      <form onSubmit={emailHook.handleSubmit(requestCode)} className="space-y-4">
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
            <p className="text-xs text-destructive">{emailHook.formState.errors.email.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={emailHook.formState.isSubmitting}>
          {emailHook.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <Mail className="w-4 h-4" />
          Send code
        </Button>
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
      </form>
    );
  }

  return (
    <form onSubmit={codeHook.handleSubmit(verify)} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        We sent a code to <strong className="text-foreground">{email}</strong>.{" "}
        It can take 15–20 seconds to arrive.
      </p>
      <div className="space-y-2">
        <Label htmlFor="login-code">Verification code</Label>
        <Input
          id="login-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          placeholder="123456"
          autoFocus
          disabled={codeHook.formState.isSubmitting}
          {...codeHook.register("code")}
        />
        {codeHook.formState.errors.code && (
          <p className="text-xs text-destructive">{codeHook.formState.errors.code.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={codeHook.formState.isSubmitting}>
        {codeHook.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
        <ShieldCheck className="w-4 h-4" />
        Verify and continue
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={resendCode}
        disabled={cooldown > 0 || resending || codeHook.formState.isSubmitting}
      >
        {resending && <Loader2 className="w-4 h-4 animate-spin" />}
        {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
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
  );
}

// ── Signup / application form ─────────────────────────────────────────────────

function SignupForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [submitted, setSubmitted] = React.useState(false);
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      publicEmail: "",
      fullName: "",
      whatsapp: "",
      referralCode: "",
      socialAccounts: [{ platform: "tiktok", handle: "" }],
      website: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "socialAccounts",
  });

  const mutation = useMutation({
    mutationFn: (values: SignupForm) =>
      api.post<{ ok: true }>("/api/public/creator-signup", {
        ...values,
        turnstileToken,
      }),
    onSuccess: () => setSubmitted(true),
    onError: (err: unknown) =>
      toast.error((err as Error)?.message || "Could not submit application"),
  });

  if (submitted) {
    return (
      <div className="text-center py-6">
        <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600 mb-4">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Application received!</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Thanks for applying! Our team will review your accounts and reach out on
          WhatsApp within 24 hours with next steps.
        </p>
        <Button className="mt-6" onClick={onSwitchToLogin}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
      className="space-y-4"
      autoComplete="off"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="su-name">Full name</Label>
          <Input
            id="su-name"
            placeholder="Jane Doe"
            disabled={mutation.isPending}
            {...form.register("fullName")}
          />
          {form.formState.errors.fullName && (
            <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="su-email">Email</Label>
          <Input
            id="su-email"
            type="email"
            placeholder="you@email.com"
            disabled={mutation.isPending}
            {...form.register("publicEmail")}
          />
          {form.formState.errors.publicEmail && (
            <p className="text-xs text-destructive">{form.formState.errors.publicEmail.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="su-whatsapp">WhatsApp number</Label>
        <Input
          id="su-whatsapp"
          placeholder="+1 555 123 4567"
          disabled={mutation.isPending}
          {...form.register("whatsapp")}
        />
        {form.formState.errors.whatsapp && (
          <p className="text-xs text-destructive">{form.formState.errors.whatsapp.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="su-ref">
          Referral code{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="su-ref"
          placeholder="e.g. sam123"
          disabled={mutation.isPending}
          {...form.register("referralCode")}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Social accounts</Label>
          <span className="text-xs text-muted-foreground">{fields.length} / 4</span>
        </div>
        <p className="text-xs text-muted-foreground">
          At least 1 required. 3–4 accounts strongly preferred.
        </p>
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="flex gap-2 items-start">
              <div className="w-32 flex-shrink-0">
                <Controller
                  control={form.control}
                  name={`socialAccounts.${i}.platform`}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger>
                        <SelectValue>
                          <span className="flex items-center gap-2">
                            <PlatformIcon platform={f.value} className="h-3.5 w-3.5" />
                            {PLATFORM_LABELS[f.value] ?? f.value}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((p) => (
                          <SelectItem key={p} value={p}>
                            <span className="flex items-center gap-2">
                              <PlatformIcon platform={p} className="h-3.5 w-3.5" />
                              {PLATFORM_LABELS[p] ?? p}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <Input
                  placeholder="@username (no links)"
                  disabled={mutation.isPending}
                  {...form.register(`socialAccounts.${i}.handle`)}
                />
                {form.formState.errors.socialAccounts?.[i]?.handle && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.socialAccounts?.[i]?.handle?.message}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={mutation.isPending || fields.length === 1}
                onClick={() => remove(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        {fields.length < 4 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ platform: "instagram", handle: "" })}
            disabled={mutation.isPending}
          >
            <Plus className="h-3.5 w-3.5" /> Add another account
          </Button>
        )}
        {form.formState.errors.socialAccounts &&
          typeof form.formState.errors.socialAccounts.message === "string" && (
            <p className="text-xs text-destructive">
              {form.formState.errors.socialAccounts.message}
            </p>
          )}
      </div>

      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <Input tabIndex={-1} autoComplete="off" {...form.register("website")} />
      </div>

      <TurnstileWidget onToken={setTurnstileToken} className="flex justify-center" />

      <Button
        type="submit"
        className="w-full"
        disabled={mutation.isPending || !turnstileToken}
      >
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Submit application
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}

// ── Root auth screen ──────────────────────────────────────────────────────────

export function AuthScreen({ defaultTab }: { defaultTab: "login" | "signup" }) {
  const [tab, setTab] = React.useState<"login" | "signup">(defaultTab);

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <LeftPanel />

      {/* Right: form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-10 md:px-16">
        {/* Mobile logo */}
        <div className="md:hidden flex items-center gap-1 mb-8">
          <img src="/Light.png" alt="Orcazo" className="h-8 w-auto object-contain dark:hidden" />
          <img src="/Dark.png"  alt="Orcazo" className="h-8 w-auto object-contain hidden dark:block" />
        </div>

        <div className="w-full max-w-md mx-auto">
          {/* Tab switcher */}
          <div className="flex rounded-lg border p-1 mb-6 bg-muted/40">
            <button
              type="button"
              onClick={() => setTab("login")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                tab === "login"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                tab === "signup"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Apply as creator
            </button>
          </div>

          {/* Form content */}
          <div>
            <div className="mb-5">
              <h1 className="text-2xl font-semibold tracking-tight">
                {tab === "login" ? "Welcome back" : "Join the network"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {tab === "login"
                  ? "Enter your email and we'll send you a verification code."
                  : "Quick form, no fluff. Most applicants hear back within 24 hours."}
              </p>
            </div>

            {tab === "login" ? (
              <LoginForm onSwitchToSignup={() => setTab("signup")} />
            ) : (
              <SignupForm onSwitchToLogin={() => setTab("login")} />
            )}
          </div>
        </div>

        <p className="mt-8 text-xs text-center text-muted-foreground">
          <Link href="/terms" className="hover:underline">Terms</Link>
          {" · "}
          <Link href="/privacy" className="hover:underline">Privacy</Link>
        </p>
      </div>
    </div>
  );
}
