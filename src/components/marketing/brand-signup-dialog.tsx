'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TurnstileWidget } from '@/components/turnstile-widget';
import { api } from '@/lib/api-client';
import { MARKETING } from '@/config/marketing';

const schema = z.object({
  email:         z.string().trim().toLowerCase().email('Enter a valid email'),
  brandName:     z.string().trim().min(2, 'Brand name is required').max(120),
  monthlyBudget: z.string().trim().min(1, 'Pick a budget range'),
  // Honeypot — visually hidden field
  website:       z.string().max(0).optional(),
});
type Form = z.infer<typeof schema>;

export function BrandSignupDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [submitted, setSubmitted] = React.useState(false);
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', brandName: '', monthlyBudget: '', website: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: Form) =>
      api.post<{ ok: true }>('/api/public/brand-signup', { ...values, turnstileToken }),
    onSuccess: () => {
      setSubmitted(true);
      toast.success('We will reach out shortly.');
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not send your inquiry'),
  });

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setSubmitted(false);
        form.reset({ email: '', brandName: '', monthlyBudget: '', website: '' });
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {submitted ? (
          <div className="text-center py-6">
            <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl mb-2">Thanks for reaching out</DialogTitle>
            <p className="text-sm text-muted-foreground">
              We received your inquiry and a member of our team will email you within one business day.
            </p>
            <Button className="mt-6" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Sign up as a brand</DialogTitle>
              <DialogDescription>
                Tell us about your brand and we&apos;ll reach out within one business day with a custom proposal.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
              className="space-y-4"
              autoComplete="off"
            >
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand name</Label>
                <Input id="brandName" placeholder="e.g. Cantina" disabled={mutation.isPending} {...form.register('brandName')} />
                {form.formState.errors.brandName && (
                  <p className="text-xs text-destructive">{form.formState.errors.brandName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" placeholder="you@yourbrand.com" disabled={mutation.isPending} {...form.register('email')} />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Monthly ad budget</Label>
                <Select
                  value={form.watch('monthlyBudget')}
                  onValueChange={(v) => form.setValue('monthlyBudget', v, { shouldValidate: true })}
                >
                  <SelectTrigger><SelectValue placeholder="Pick a range" /></SelectTrigger>
                  <SelectContent>
                    {MARKETING.budgetOptions.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.monthlyBudget && (
                  <p className="text-xs text-destructive">{form.formState.errors.monthlyBudget.message}</p>
                )}
              </div>

              {/* Honeypot — hidden from humans, filled by bots */}
              <div className="hidden" aria-hidden="true">
                <Label>Website</Label>
                <Input tabIndex={-1} autoComplete="off" {...form.register('website')} />
              </div>

              <TurnstileWidget onToken={setTurnstileToken} className="flex justify-center" />

              <Button type="submit" className="w-full" disabled={mutation.isPending || !turnstileToken}>
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send inquiry
              </Button>
              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                By submitting you agree to be contacted by our team. We&apos;ll never share your details.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
