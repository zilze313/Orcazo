"use client";

// Creator asks to be added as a collaborator on an admin post. The admin
// then sends the actual invite from the platform app to the handle given
// here; the creator accepts it on the platform and confirms in-app.

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Handshake } from "lucide-react";
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
  handle: z.string().trim().min(1, "Enter your handle").max(120),
  followers: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function RequestCollabDialog({
  open,
  onOpenChange,
  post,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  post: { id: string; accountLabel: string; platform: string } | null;
}) {
  const qc = useQueryClient();
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { handle: "", followers: "" } });

  const mutation = useMutation({
    mutationFn: (values: Form) =>
      api.post<{ ok: true; id: string }>("/api/repost/collab-requests", {
        repostPostId: post!.id,
        handle: values.handle,
        platform: post!.platform,
        ...(values.followers ? { followers: Number(values.followers) } : {}),
      }),
    onSuccess: () => {
      toast.success("Collab requested — you'll be notified when the invite is sent");
      onOpenChange(false);
      form.reset();
      qc.invalidateQueries({ queryKey: ["repost", "feed"] });
      qc.invalidateQueries({ queryKey: ["repost", "collabs"] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || "Could not submit"),
  });

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a collab</DialogTitle>
          <DialogDescription>
            {post.accountLabel} will send a collaborator invite to the handle you enter.
            Accept it in the {post.platform} app, then confirm here.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collab-handle">Your {post.platform} handle</Label>
            <Input
              id="collab-handle"
              placeholder="@yourhandle"
              autoFocus
              disabled={mutation.isPending}
              {...form.register("handle")}
            />
            {form.formState.errors.handle && (
              <p className="text-xs text-destructive">{form.formState.errors.handle.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="collab-followers">Followers on that account</Label>
            <Input
              id="collab-followers"
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
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Handshake className="h-4 w-4" />}
              Request collab
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
