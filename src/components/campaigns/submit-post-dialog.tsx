'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, isUpstreamExpired } from '@/lib/api-client';
import { CampaignSummary } from './types';
import { useRouter } from 'next/navigation';

const schema = z.object({
  linkSubmitted: z.string().url('Enter a valid URL').max(2048),
});
type Form = z.infer<typeof schema>;

export function SubmitPostDialog({
  open,
  onOpenChange,
  campaign,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaign: CampaignSummary;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { linkSubmitted: '' } });

  const mutation = useMutation({
    mutationFn: async (values: Form) =>
      api.post<{ ok: true; message: string }>('/api/posts', {
        campaignPublicId: campaign.publicId,
        campaignName: campaign.name,
        linkSubmitted: values.linkSubmitted,
        creatorTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: (data) => {
      toast.success(data.message || 'Submitted!');
      onOpenChange(false);
      form.reset();
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      if (isUpstreamExpired(err)) {
        toast.error('Session expired — please sign in again');
        router.replace('/login');
        return;
      }
      toast.error(err?.message || 'Could not submit');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit a post</DialogTitle>
          <DialogDescription>{campaign.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="link">Video URL</Label>
            <Input
              id="link"
              type="url"
              placeholder="https://www.instagram.com/reel/..."
              autoFocus
              disabled={mutation.isPending}
              {...form.register('linkSubmitted')}
            />
            {form.formState.errors.linkSubmitted && (
              <p className="text-xs text-destructive">{form.formState.errors.linkSubmitted.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Paste the link to the video you posted. We&apos;ll track views and calculate your earnings automatically.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
