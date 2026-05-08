'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api, isUpstreamExpired } from '@/lib/api-client';
import { PLATFORM_LABELS } from '@/components/platform-icon';
import { useRouter } from 'next/navigation';

const platforms = ['instagram', 'tiktok', 'youtube', 'snapchat', 'x', 'facebook'] as const;

const LANGUAGES = [
  'English', 'German', 'Spanish', 'Portuguese', 'Polish', 'Other',
] as const;

// Exact theme list provided by the user — order preserved
const THEMES = [
  'Texting Story',
  'Beauty - Male Audience',
  'Beauty - Female Audience',
  'Reddit Story',
  'Meme',
  'Personal',
  'Luxury',
  'Food',
  'Technology',
  'Quiz',
  'Would you rather',
  'AI image story',
  'PDF to Brainrot',
  'AI UGC',
  'Podcasts',
  'Clipping',
  'Streamers',
  'Twitch Clips',
  'Crypto',
  'Sports',
  'Animals',
  'Comedy',
  'Travel',
  'Art',
  'Gaming',
  'Science & Education',
  'Dance',
  'DIY',
  'Auto',
  'Life Hacks',
  'Oddly Satisfying',
  'Fan Page',
  'Fitness',
  'Logo Campaign',
  'Music',
  'Other',
] as const;

const schema = z.object({
  platform: z.enum(platforms),
  handle:   z.string().trim().min(1, 'Handle is required').max(80),
  language: z.enum(LANGUAGES).default('English'),
  theme:    z.enum(THEMES, { required_error: 'Pick a theme' }),
});
type Form = z.infer<typeof schema>;

export function AddSocialDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { platform: 'instagram', handle: '', language: 'English' },
  });

  const mutation = useMutation({
    mutationFn: (values: Form) => api.post<{ ok: true; message: string }>('/api/socials', values),
    onSuccess: (data) => {
      toast.success(data.message || 'Social account added');
      onOpenChange(false);
      form.reset({ platform: 'instagram', handle: '', language: 'English' });
      qc.invalidateQueries({ queryKey: ['socials'] });
    },
    onError: (err: unknown) => {
      if (isUpstreamExpired(err)) { router.replace('/login'); return; }
      toast.error((err as Error)?.message || 'Could not add account');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a social account</DialogTitle>
          <DialogDescription>
            Make sure your bio contains the verification code shown on the page before adding.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          {/* Platform + Handle */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={form.watch('platform')}
                onValueChange={(v) => form.setValue('platform', v as Form['platform'])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="handle">Handle</Label>
              <Input
                id="handle"
                placeholder="username (without @)"
                autoComplete="off"
                {...form.register('handle')}
              />
              {form.formState.errors.handle && (
                <p className="text-xs text-destructive">{form.formState.errors.handle.message}</p>
              )}
            </div>
          </div>

          {/* Language + Theme */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={form.watch('language')}
                onValueChange={(v) => form.setValue('language', v as Form['language'])}
              >
                <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Niche / Theme</Label>
              <Select
                value={form.watch('theme') ?? ''}
                onValueChange={(v) => form.setValue('theme', v as Form['theme'], { shouldValidate: true })}
              >
                <SelectTrigger><SelectValue placeholder="Select niche" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {THEMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.formState.errors.theme && (
                <p className="text-xs text-destructive">{form.formState.errors.theme.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
