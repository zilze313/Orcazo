"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";

const schema = z.object({
  repostUrl: z.string().url("Enter a valid URL").max(2048),
  reportedViews: z.string().optional(),
  followers: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function SubmitRepostDialog({
  open,
  onOpenChange,
  post,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  post: { id: string; accountLabel: string } | null;
}) {
  const qc = useQueryClient();
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { repostUrl: "", reportedViews: "", followers: "" } });

  const mutation = useMutation({
    mutationFn: (values: Form) =>
      api.post<{ ok: true; id: string }>("/api/repost/submissions", {
        repostPostId: post!.id,
        repostUrl: values.repostUrl,
        ...(values.reportedViews ? { reportedViews: Number(values.reportedViews) } : {}),
        ...(values.followers ? { followers: Number(values.followers) } : {}),
      }),
    onSuccess: () => {
      toast.success("Repost submitted — admin will review it");
      onOpenChange(false);
      form.reset();
      qc.invalidateQueries({ queryKey: ["repost", "feed"] });
      qc.invalidateQueries({ queryKey: ["repost", "submissions"] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || "Could not submit"),
  });

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit your repost</DialogTitle>
          <DialogDescription>{post.accountLabel}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repostUrl">Your repost link</Label>
            <Input
              id="repostUrl"
              type="url"
              placeholder="https://www.instagram.com/reel/..."
              autoFocus
              disabled={mutation.isPending}
              {...form.register("repostUrl")}
            />
            {form.formState.errors.repostUrl && (
              <p className="text-xs text-destructive">{form.formState.errors.repostUrl.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="reportedViews">Views on your repost (optional)</Label>
            <Input
              id="reportedViews"
              type="number"
              min="0"
              placeholder="e.g. 12000"
              disabled={mutation.isPending}
              {...form.register("reportedViews")}
            />
            <p className="text-xs text-muted-foreground">
              Self-reported — just gives our team a quick data point when reviewing your payout.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="followers">Followers on the account you reposted with</Label>
            <Input
              id="followers"
              type="number"
              min="0"
              placeholder="e.g. 55000"
              disabled={mutation.isPending}
              {...form.register("followers")}
            />
            <p className="text-xs text-muted-foreground">
              Your bounty tier is based on this — our team verifies it against your account.
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
