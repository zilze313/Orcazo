"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle2, Plus, Trash2 } from "lucide-react";
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

const PLATFORMS = [
  "tiktok",
  "instagram",
  "youtube",
  "snapchat",
  "x",
  "facebook",
] as const;

const REFERRAL_CODE: string = "orca353";

const schema = z.object({
  publicEmail: z.string().trim().toLowerCase().email("Enter a valid email"),
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  whatsapp: z.string().trim().min(5, "Enter a valid WhatsApp number").max(40),
  referralCode: z
    .string()
    .trim()
    .refine((v) => v === REFERRAL_CODE, { message: "Invalid referral code" }),
  socialAccounts: z
    .array(
      z.object({
        platform: z.enum(PLATFORMS),
        handle: z.string().trim().min(1, "Handle required").max(80),
      }),
    )
    .min(1, "At least one social account is required")
    .max(4),
  // Honeypot
  website: z.string().max(0).optional(),
});
type Form = z.infer<typeof schema>;

export function CreatorSignupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [submitted, setSubmitted] = React.useState(false);
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(
    null,
  );

  const form = useForm<Form>({
    resolver: zodResolver(schema),
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
    mutationFn: (values: Form) =>
      api.post<{ ok: true }>("/api/public/creator-signup", {
        ...values,
        turnstileToken,
      }),
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: unknown) =>
      toast.error((err as Error)?.message || "Could not submit application"),
  });

  React.useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setSubmitted(false);
        form.reset({
          publicEmail: "",
          fullName: "",
          whatsapp: "",
          referralCode: "",
          socialAccounts: [{ platform: "tiktok", handle: "" }],
          website: "",
        });
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {submitted ? (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600 mb-4">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <DialogTitle className="text-xl mb-2">
              Application received
            </DialogTitle>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Thanks for applying! Our team will review your accounts and reach
              out on WhatsApp within 24 hours with the next steps.
            </p>
            <Button className="mt-6" onClick={() => onOpenChange(false)}>
              Got it
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Apply as a creator</DialogTitle>
              <DialogDescription>
                Quick form, no fluff. Most applicants hear back within 24 hours.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
              className="space-y-4"
              autoComplete="off"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    placeholder="Jane Doe"
                    disabled={mutation.isPending}
                    {...form.register("fullName")}
                  />
                  {form.formState.errors.fullName && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.fullName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publicEmail">Email</Label>
                  <Input
                    id="publicEmail"
                    type="email"
                    placeholder="you@email.com"
                    disabled={mutation.isPending}
                    {...form.register("publicEmail")}
                  />
                  {form.formState.errors.publicEmail && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.publicEmail.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp number</Label>
                <Input
                  id="whatsapp"
                  placeholder="+1 555 123 4567"
                  disabled={mutation.isPending}
                  {...form.register("whatsapp")}
                />
                {form.formState.errors.whatsapp && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.whatsapp.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="referralCode">Referral code</Label>
                <Input
                  id="referralCode"
                  placeholder="Enter your referral code"
                  disabled={mutation.isPending}
                  {...form.register("referralCode")}
                />
                {form.formState.errors.referralCode && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.referralCode.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Social accounts</Label>
                  <span className="text-xs text-muted-foreground">
                    {fields.length} / 4
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  At least 1 required. 3–4 accounts strongly preferred — they
                  help us approve faster.
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
                                    <PlatformIcon
                                      platform={f.value}
                                      className="h-3.5 w-3.5"
                                    />
                                    {PLATFORM_LABELS[f.value] ?? f.value}
                                  </span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {PLATFORMS.map((p) => (
                                  <SelectItem key={p} value={p}>
                                    <span className="flex items-center gap-2">
                                      <PlatformIcon
                                        platform={p}
                                        className="h-3.5 w-3.5"
                                      />
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
                          placeholder="username"
                          disabled={mutation.isPending}
                          {...form.register(`socialAccounts.${i}.handle`)}
                        />
                        {form.formState.errors.socialAccounts?.[i]?.handle && (
                          <p className="text-xs text-destructive mt-1">
                            {
                              form.formState.errors.socialAccounts?.[i]?.handle
                                ?.message
                            }
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={mutation.isPending || fields.length === 1}
                        onClick={() => remove(i)}
                        title="Remove"
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
                    onClick={() =>
                      append({ platform: "instagram", handle: "" })
                    }
                    disabled={mutation.isPending}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add another account
                  </Button>
                )}
                {form.formState.errors.socialAccounts &&
                  typeof form.formState.errors.socialAccounts.message ===
                    "string" && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.socialAccounts.message}
                    </p>
                  )}
              </div>

              {/* Honeypot */}
              <div className="hidden" aria-hidden="true">
                <Label>Website</Label>
                <Input
                  tabIndex={-1}
                  autoComplete="off"
                  {...form.register("website")}
                />
              </div>

              <TurnstileWidget
                onToken={setTurnstileToken}
                className="flex justify-center"
              />

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
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
