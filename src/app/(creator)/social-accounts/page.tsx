"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AtSign,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { AddSocialDialog } from "@/components/socials/add-social-dialog";
import { api, isUpstreamExpired } from "@/lib/api-client";

interface Social {
  publicId: string;
  handle: string;
  platform: string;
  theme: string;
  url: string;
  language: string;
  status?: string;
}
interface SocialsResp {
  socials: Social[];
}

interface MeResp {
  email: string;
  profile?: { bioVerificationCode?: string };
}

export default function SocialsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const me = useQuery<MeResp>({
    queryKey: ["me"],
    queryFn: () => api.get<MeResp>("/api/me"),
  });
  const socials = useQuery<SocialsResp>({
    queryKey: ["socials"],
    queryFn: () => api.get<SocialsResp>("/api/socials"),
    staleTime: 30_000,
  });

  React.useEffect(() => {
    if (socials.error && isUpstreamExpired(socials.error))
      router.replace("/login");
  }, [socials.error, router]);

  const remove = useMutation({
    mutationFn: (publicId: string) =>
      api.del<{ ok: true }>(`/api/socials/${publicId}`),
    onSuccess: () => {
      toast.success("Account removed");
      qc.invalidateQueries({ queryKey: ["socials"] });
    },
    onError: (err: any) => {
      if (isUpstreamExpired(err)) {
        router.replace("/login");
        return;
      }
      toast.error(err?.message || "Could not remove");
    },
  });

  const code = me.data?.profile?.bioVerificationCode;
  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <>
      <PageHeader
        title="Social Media Accounts"
        description="Connect your accounts. Each account must have your verification code in bio."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add account
          </Button>
        }
      />

      <div className="container max-w-7xl py-6 space-y-6">
        {/* Verification code card */}
        <Card className="p-5">
          {me.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-72" />
            </div>
          ) : code ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  Your verification code
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Add this to the bio of any social account before connecting
                  it.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="px-3 py-2 rounded-md bg-secondary font-mono text-sm">
                  {code}
                </code>
                <Button size="sm" variant="outline" onClick={copyCode}>
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm">
              <div className="font-medium">
                Your account isn&apos;t fully set up yet
              </div>
              <div className="text-muted-foreground mt-1">
                Your verification code hasn&apos;t been generated. Contact your
                admin — they need to finish setting up your account before you
                can connect social profiles.
              </div>
            </div>
          )}
        </Card>

        {/* Accounts list */}
        <div className="space-y-3">
          {socials.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))
          ) : (socials.data?.socials.length ?? 0) === 0 ? (
            <EmptyState
              icon={AtSign}
              title="No social accounts yet"
              description="Add your first account to start applying to campaigns."
              action={
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" /> Add account
                </Button>
              }
            />
          ) : (
            socials.data!.socials.map((s) => (
              <Card key={s.publicId} className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center text-xs font-semibold uppercase">
                  {s.platform.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{s.url.split("/")[1]}</span>
                    <Badge variant="secondary">{s.platform}</Badge>
                    {s.status === "VERIFIED" ? (
                      <Badge variant="success">Verified</Badge>
                    ) : (
                      <Badge variant="warning">Unverified</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span>{s.theme}</span>
                    <span>·</span>
                    <a
                      href={
                        s.url.startsWith("http") ? s.url : `https://${s.url}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" /> Profile
                    </a>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm(`Remove @${s.handle}?`))
                      remove.mutate(s.publicId);
                  }}
                  disabled={remove.isPending}
                  title="Remove"
                >
                  {remove.isPending && remove.variables === s.publicId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </Card>
            ))
          )}
        </div>
      </div>

      <AddSocialDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
