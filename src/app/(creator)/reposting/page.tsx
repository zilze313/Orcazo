"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Repeat, Rss, ListChecks, Wallet, Send, Loader2, CheckCircle2, Clock,
  XCircle, Banknote, Bitcoin, Mail, DollarSign, History, ExternalLink,
  Handshake, Layers, UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { PlatformIcon } from "@/components/platform-icon";
import { SubmitRepostDialog } from "@/components/repost/submit-repost-dialog";
import { RequestCollabDialog } from "@/components/repost/request-collab-dialog";
import { api } from "@/lib/api-client";
import { formatMoney, formatNumber, formatRelative } from "@/lib/utils";

type Tab = "feed" | "submissions" | "wallet";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "feed", label: "Feed", icon: Rss },
  { key: "submissions", label: "My Submissions", icon: ListChecks },
  { key: "wallet", label: "Repost Wallet", icon: Wallet },
];

export default function RepostingPage() {
  const [tab, setTab] = React.useState<Tab>("feed");

  return (
    <>
      <PageHeader
        title="Reposting"
        description="Subscribe to admin accounts, repost their content, and track a separate wallet just for this program."
      />
      <div className="container max-w-5xl py-6 space-y-6">
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <Button
                key={t.key}
                size="sm"
                variant={tab === t.key ? "default" : "outline"}
                onClick={() => setTab(t.key)}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </Button>
            );
          })}
        </div>

        {tab === "feed" && <FeedTab />}
        {tab === "submissions" && <SubmissionsTab />}
        {tab === "wallet" && <WalletTab />}
      </div>
    </>
  );
}

// ─── Feed ───────────────────────────────────────────────────────────────────

interface FeedPost {
  id: string;
  postUrl: string;
  note: string | null;
  createdAt: string;
  allowRepost: boolean;
  allowCollab: boolean;
  collabSlotsLeft: number;
  account: { platform: string; handle: string; label: string };
  mySubmission: { repostUrl: string; reportedViews: number | null; status: string; createdAt: string } | null;
  myCollabRequest: { id: string; handle: string; status: string; createdAt: string } | null;
}
interface FeedTier { id: string; minFollowers: number; repostBounty: number; collabBounty: number }
interface FeedResp {
  items: FeedPost[];
  tiers: FeedTier[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

function FeedTab() {
  const qc = useQueryClient();
  const query = useQuery<FeedResp>({
    queryKey: ["repost", "feed"],
    queryFn: () => api.get<FeedResp>("/api/repost/feed"),
    staleTime: 10_000,
  });
  const [submitTarget, setSubmitTarget] = React.useState<{ id: string; accountLabel: string } | null>(null);
  const [collabTarget, setCollabTarget] = React.useState<{ id: string; accountLabel: string; platform: string } | null>(null);

  if (query.isLoading) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  }

  const items = query.data?.items ?? [];
  const tiers = query.data?.tiers ?? [];

  return (
    <>
      <TierStrip tiers={tiers} />

      {items.length === 0 ? (
        <EmptyState
          icon={Rss}
          title="No posts yet"
          description="Subscribe to an account in Explore Campaigns to see their posts here when admin logs a new one."
        />
      ) : (
        <div className="space-y-3">
          {items.map((post) => (
            <Card key={post.id} className="p-4">
              <div className="flex items-start gap-3 flex-wrap">
                <PlatformIcon platform={post.account.platform} className="h-5 w-5 flex-shrink-0 text-muted-foreground mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{post.account.label}</span>
                    <span className="text-xs text-muted-foreground">{formatRelative(post.createdAt)}</span>
                    {post.allowRepost && <Badge variant="secondary" className="gap-1 text-[10px]"><Repeat className="h-2.5 w-2.5" /> Repost</Badge>}
                    {post.allowCollab && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Handshake className="h-2.5 w-2.5" /> Collab · {post.collabSlotsLeft} slot{post.collabSlotsLeft === 1 ? "" : "s"} left
                      </Badge>
                    )}
                  </div>
                  <a
                    href={post.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1 break-all"
                  >
                    <ExternalLink className="h-3 w-3 flex-shrink-0" /> {post.postUrl}
                  </a>
                  {post.note && <p className="text-xs text-muted-foreground mt-1">{post.note}</p>}
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  {post.allowRepost && (
                    post.mySubmission ? (
                      <SubmissionStatusBadge status={post.mySubmission.status} />
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setSubmitTarget({ id: post.id, accountLabel: post.account.label })}
                      >
                        <Send className="h-3.5 w-3.5" /> Submit repost
                      </Button>
                    )
                  )}
                  {post.allowCollab && (
                    post.myCollabRequest ? (
                      <CollabStatusInline
                        status={post.myCollabRequest.status}
                        requestId={post.myCollabRequest.id}
                        onConfirmed={() => {
                          qc.invalidateQueries({ queryKey: ["repost", "feed"] });
                          qc.invalidateQueries({ queryKey: ["repost", "collabs"] });
                        }}
                      />
                    ) : post.collabSlotsLeft > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCollabTarget({ id: post.id, accountLabel: post.account.label, platform: post.account.platform })}
                      >
                        <Handshake className="h-3.5 w-3.5" /> Request collab
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Collab slots full</Badge>
                    )
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SubmitRepostDialog
        open={!!submitTarget}
        onOpenChange={(v) => { if (!v) setSubmitTarget(null); }}
        post={submitTarget}
      />
      <RequestCollabDialog
        open={!!collabTarget}
        onOpenChange={(v) => { if (!v) setCollabTarget(null); }}
        post={collabTarget}
      />
    </>
  );
}

/** Compact earnings table so creators know what a repost/collab pays. */
function TierStrip({ tiers }: { tiers: FeedTier[] }) {
  if (tiers.length === 0) return null;
  return (
    <div className="mb-4 rounded-md border bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-2">
        <Layers className="h-3.5 w-3.5" /> Bounty per approved repost / collab
      </div>
      <div className="flex gap-2 flex-wrap">
        {tiers.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs">
            <span className="text-muted-foreground tabular-nums">{formatNumber(t.minFollowers)}+ followers</span>
            <span className="font-semibold tabular-nums text-green-600 dark:text-green-400">
              {formatMoney(t.repostBounty)}{t.collabBounty !== t.repostBounty ? ` / ${formatMoney(t.collabBounty)}` : ""}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SubmissionStatusBadge({ status }: { status: string }) {
  if (status === "APPROVED") return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Approved</Badge>;
  if (status === "REJECTED") return <Badge variant="destructive" className="gap-1"><XCircle className="h-2.5 w-2.5" /> Rejected</Badge>;
  if (status === "REVIEWED") return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Reviewed</Badge>;
  return <Badge variant="warning" className="gap-1"><Clock className="h-2.5 w-2.5" /> Pending review</Badge>;
}

function CollabStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "INVITED":  return <Badge variant="warning" className="gap-1"><Send className="h-2.5 w-2.5" /> Invite sent — check your app</Badge>;
    case "ACCEPTED": return <Badge variant="secondary" className="gap-1"><UserCheck className="h-2.5 w-2.5" /> Accepted — being verified</Badge>;
    case "APPROVED": return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Collab approved</Badge>;
    case "REJECTED": return <Badge variant="destructive" className="gap-1"><XCircle className="h-2.5 w-2.5" /> Declined</Badge>;
    default:         return <Badge variant="warning" className="gap-1"><Clock className="h-2.5 w-2.5" /> Collab requested</Badge>;
  }
}

/** Collab status in the feed; when INVITED, lets the creator confirm acceptance. */
function CollabStatusInline({
  status, requestId, onConfirmed,
}: {
  status: string;
  requestId: string;
  onConfirmed: () => void;
}) {
  const [confirming, setConfirming] = React.useState(false);

  if (status !== "INVITED") return <CollabStatusBadge status={status} />;

  async function confirm() {
    setConfirming(true);
    try {
      await api.patch("/api/repost/collab-requests", { id: requestId, action: "accepted" });
      toast.success("Confirmed — our team will verify and credit your bounty");
      onConfirmed();
    } catch (e) {
      toast.error((e as Error)?.message || "Failed");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <CollabStatusBadge status={status} />
      <Button size="sm" variant="outline" onClick={confirm} disabled={confirming}>
        {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
        I accepted the invite
      </Button>
    </div>
  );
}

// ─── My Submissions ─────────────────────────────────────────────────────────

interface SubmissionItem {
  id: string;
  repostUrl: string;
  reportedViews: number | null;
  status: string;
  bountyPaid: number | null;
  adminNote: string | null;
  createdAt: string;
  post: { postUrl: string; account: { platform: string; label: string } };
}

interface CollabItem {
  id: string;
  handle: string;
  status: string;
  bountyPaid: number | null;
  adminNote: string | null;
  createdAt: string;
  post: { postUrl: string; account: { platform: string; label: string } };
}

function SubmissionsTab() {
  const qc = useQueryClient();
  const query = useQuery<{ items: SubmissionItem[] }>({
    queryKey: ["repost", "submissions"],
    queryFn: () => api.get("/api/repost/submissions"),
    staleTime: 10_000,
  });
  const collabs = useQuery<{ items: CollabItem[] }>({
    queryKey: ["repost", "collabs"],
    queryFn: () => api.get("/api/repost/collab-requests"),
    staleTime: 10_000,
  });

  if (query.isLoading || collabs.isLoading) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }

  const items = query.data?.items ?? [];
  const collabItems = collabs.data?.items ?? [];

  if (items.length === 0 && collabItems.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No submissions yet"
        description="Once you submit a repost or request a collab from the Feed tab, it'll show up here."
      />
    );
  }

  return (
    <div className="space-y-6">
      {items.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Repeat className="h-4 w-4" /> Reposts
          </h2>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Your repost</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Bounty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <React.Fragment key={s.id}>
                    <TableRow>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          <PlatformIcon platform={s.post.account.platform} className="h-3.5 w-3.5 text-muted-foreground" />
                          {s.post.account.label}
                        </div>
                      </TableCell>
                      <TableCell>
                        <a href={s.repostUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline break-all">
                          {s.repostUrl}
                        </a>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {s.reportedViews != null ? s.reportedViews.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {s.bountyPaid != null
                          ? <span className="font-semibold text-green-600 dark:text-green-400">{formatMoney(s.bountyPaid)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><SubmissionStatusBadge status={s.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatRelative(s.createdAt)}</TableCell>
                    </TableRow>
                    {s.adminNote && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={6} className="py-1.5 px-4 text-xs text-muted-foreground italic">
                          {s.adminNote}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {collabItems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Handshake className="h-4 w-4" /> Collabs
          </h2>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Your handle</TableHead>
                  <TableHead className="text-right">Bounty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {collabItems.map((c) => (
                  <React.Fragment key={c.id}>
                    <TableRow>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          <PlatformIcon platform={c.post.account.platform} className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.post.account.label}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">@{c.handle}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {c.bountyPaid != null
                          ? <span className="font-semibold text-green-600 dark:text-green-400">{formatMoney(c.bountyPaid)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><CollabStatusBadge status={c.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatRelative(c.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {c.status === "INVITED" && (
                          <ConfirmAcceptButton
                            id={c.id}
                            onDone={() => {
                              qc.invalidateQueries({ queryKey: ["repost", "collabs"] });
                              qc.invalidateQueries({ queryKey: ["repost", "feed"] });
                            }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                    {c.adminNote && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={6} className="py-1.5 px-4 text-xs text-muted-foreground italic">
                          {c.adminNote}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}

function ConfirmAcceptButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm" variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api.patch("/api/repost/collab-requests", { id, action: "accepted" });
          toast.success("Confirmed — our team will verify and credit your bounty");
          onDone();
        } catch (e) {
          toast.error((e as Error)?.message || "Failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
      I accepted
    </Button>
  );
}

// ─── Wallet ─────────────────────────────────────────────────────────────────

interface CreditItem { id: string; amount: number; note: string; createdAt: string }
interface PayoutHistoryItem {
  id: string; createdAt: string; status: string; method: "BANK" | "CRYPTO" | "PAYPAL";
  amountAtRequest: number; amountPaid: number | null; penalty: number | null; adminNote: string | null;
}
interface WalletResp {
  balance: number;
  credits: CreditItem[];
  history: PayoutHistoryItem[];
  minPayout: number;
  canRequest: boolean;
  pending: { id: string; status: string; createdAt: string } | null;
  totalPaid: number;
  savedDetails: { method: "BANK" | "CRYPTO" | "PAYPAL"; details: Record<string, string> } | null;
}

type PayoutMethod = "BANK" | "CRYPTO" | "PAYPAL";
const NETWORKS = ["BTC", "ETH", "USDC_ERC20", "USDC_TRC20", "USDT_ERC20", "USDT_TRC20", "SOL"] as const;
const NETWORK_LABELS: Record<string, string> = {
  BTC: "Bitcoin (BTC)", ETH: "Ethereum (ETH)", USDC_ERC20: "USDC (Ethereum)", USDC_TRC20: "USDC (Tron)",
  USDT_ERC20: "USDT (Ethereum)", USDT_TRC20: "USDT (Tron)", SOL: "Solana (SOL)",
};

const bankSchema = z.object({
  method: z.literal("BANK"),
  holderName: z.string().trim().min(2, "Account holder name required").max(120),
  bankName: z.string().trim().min(2, "Bank name required").max(120),
  iban: z.string().trim().min(5, "IBAN required").max(64),
  swift: z.string().trim().min(5, "SWIFT/BIC required").max(20),
  notes: z.string().trim().max(500).optional(),
});
const cryptoSchema = z.object({
  method: z.literal("CRYPTO"),
  network: z.enum(NETWORKS, { required_error: "Pick a network" }),
  address: z.string().trim().min(10, "Wallet address required").max(200),
  notes: z.string().trim().max(500).optional(),
});
const paypalSchema = z.object({
  method: z.literal("PAYPAL"),
  email: z.string().trim().email("Enter a valid PayPal email").max(254),
  notes: z.string().trim().max(500).optional(),
});
const formSchema = z.discriminatedUnion("method", [bankSchema, cryptoSchema, paypalSchema]);
type FormData = z.infer<typeof formSchema>;

function statusVariant(s: string): "success" | "warning" | "destructive" | "secondary" {
  const x = s.toUpperCase();
  if (x === "PAID") return "success";
  if (x === "REJECTED" || x === "CANCELLED") return "destructive";
  if (x === "IN_PROGRESS" || x === "REQUESTED") return "warning";
  return "secondary";
}
function statusLabel(s: string): string {
  const map: Record<string, string> = {
    REQUESTED: "Requested", IN_PROGRESS: "In progress", PAID: "Paid", REJECTED: "Rejected", CANCELLED: "Cancelled",
  };
  return map[s.toUpperCase()] ?? s;
}

function WalletTab() {
  const qc = useQueryClient();
  const query = useQuery<WalletResp>({
    queryKey: ["repost", "wallet"],
    queryFn: () => api.get<WalletResp>("/api/repost/wallet"),
    staleTime: 10_000,
  });

  const [method, setMethod] = React.useState<PayoutMethod>("BANK");
  React.useEffect(() => {
    if (query.data?.savedDetails) setMethod(query.data.savedDetails.method);
  }, [query.data?.savedDetails]);

  const submitMut = useMutation({
    mutationFn: (values: FormData) => api.post<{ ok: true }>("/api/repost/wallet", values),
    onSuccess: () => {
      toast.success("Payout request submitted. Our team will process it within a few days.");
      qc.invalidateQueries({ queryKey: ["repost", "wallet"] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || "Could not submit"),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={DollarSign} label="Repost wallet balance" value={query.data ? formatMoney(query.data.balance) : null} loading={query.isLoading} tone="warning" />
        <StatCard icon={CheckCircle2} label="Total paid out" value={query.data ? formatMoney(query.data.totalPaid) : null} loading={query.isLoading} tone="success" />
        <StatCard
          icon={Clock}
          label="Pending request"
          value={query.data?.pending ? statusLabel(query.data.pending.status) : query.data ? "None" : null}
          loading={query.isLoading}
          tone={query.data?.pending ? "warning" : "muted"}
        />
      </div>

      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <Repeat className="h-3.5 w-3.5 flex-shrink-0" />
        This wallet is separate from your main Dashboard/Payouts balance — it's funded only by credits your admin issues for reposting.
      </div>

      {query.data?.pending && (
        <Card className="p-5 border-yellow-500/50 bg-yellow-500/5">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm">A repost payout request is in progress</div>
              <p className="text-xs text-muted-foreground mt-1">
                We received your request {formatRelative(query.data.pending.createdAt)}. You can submit a new one once this is completed.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!query.isLoading && (
        <RequestForm
          method={method}
          onMethodChange={setMethod}
          saved={query.data?.savedDetails ?? null}
          balance={query.data?.balance ?? 0}
          minPayout={query.data?.minPayout ?? 10}
          onSubmit={(v) => submitMut.mutate(v)}
          submitting={submitMut.isPending}
        />
      )}

      <Separator />

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4" /> Credits received
        </h2>
        <Card className="overflow-x-auto">
          {query.isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (query.data?.credits.length ?? 0) === 0 ? (
            <EmptyState icon={Wallet} title="No credits yet" description="When admin credits your repost wallet, it'll appear here with their note." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data!.credits.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-green-600 dark:text-green-400">{formatMoney(c.amount)}</TableCell>
                    <TableCell className="text-xs">{c.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <History className="h-4 w-4" /> Repost payout history
        </h2>
        <Card className="overflow-x-auto">
          {query.isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (query.data?.history.length ?? 0) === 0 ? (
            <EmptyState icon={History} title="No payouts yet" description="Once you request your first repost payout, it'll appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data!.history.map((p) => (
                  <React.Fragment key={p.id}>
                    <TableRow>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatMoney(p.amountAtRequest)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.amountPaid != null ? <span className="text-green-600 dark:text-green-400 font-medium">{formatMoney(p.amountPaid)}</span> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><Badge variant={statusVariant(p.status)} className="text-[10px] whitespace-nowrap">{statusLabel(p.status)}</Badge></TableCell>
                    </TableRow>
                    {p.adminNote && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={4} className="py-1.5 px-4 text-xs text-muted-foreground italic">{p.adminNote}</TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}

function RequestForm({
  method, onMethodChange, saved, onSubmit, submitting, balance, minPayout,
}: {
  method: PayoutMethod;
  onMethodChange: (m: PayoutMethod) => void;
  saved: WalletResp["savedDetails"];
  onSubmit: (v: FormData) => void;
  submitting: boolean;
  balance: number;
  minPayout: number;
}) {
  const initial: Partial<FormData> =
    saved?.method === "BANK" ? ({ method: "BANK", ...(saved.details as Record<string, string>) } as FormData)
    : saved?.method === "CRYPTO" ? ({ method: "CRYPTO", ...(saved.details as Record<string, string>) } as FormData)
    : saved?.method === "PAYPAL" ? ({ method: "PAYPAL", ...(saved.details as Record<string, string>) } as FormData)
    : { method };

  const form = useForm<FormData>({ resolver: zodResolver(formSchema), defaultValues: initial as FormData });

  React.useEffect(() => {
    form.setValue("method", method as FormData["method"]);
  }, [method, form]);

  const belowMin = balance < minPayout;

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <Send className="h-4 w-4" /> Request a repost payout
      </h2>

      {belowMin && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-muted/50 border px-3 py-2 text-xs text-muted-foreground">
          <Wallet className="h-3.5 w-3.5 flex-shrink-0" />
          Minimum balance of {formatMoney(minPayout)} required. Your current repost wallet balance is {formatMoney(balance)}.
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <Button type="button" variant={method === "BANK" ? "default" : "outline"} size="sm" onClick={() => onMethodChange("BANK")}>
          <Banknote className="h-4 w-4" /> Bank transfer
        </Button>
        <Button type="button" variant={method === "CRYPTO" ? "default" : "outline"} size="sm" onClick={() => onMethodChange("CRYPTO")}>
          <Bitcoin className="h-4 w-4" /> Crypto
        </Button>
        <Button type="button" variant={method === "PAYPAL" ? "default" : "outline"} size="sm" onClick={() => onMethodChange("PAYPAL")}>
          <Mail className="h-4 w-4" /> PayPal
        </Button>
      </div>

      <form
        onSubmit={form.handleSubmit((v) => {
          if (belowMin) { toast.error(`Minimum balance of ${formatMoney(minPayout)} required to withdraw.`); return; }
          onSubmit(v);
        })}
        className="space-y-3"
      >
        {method === "BANK" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Account holder name">
                <Input placeholder="John Doe" disabled={submitting} {...form.register("holderName" as const)} />
                <FieldError name="holderName" form={form} />
              </Field>
              <Field label="Bank name">
                <Input placeholder="HSBC" disabled={submitting} {...form.register("bankName" as const)} />
                <FieldError name="bankName" form={form} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="IBAN / Account number">
                <Input placeholder="GB82 WEST 1234 5698 7654 32" disabled={submitting} {...form.register("iban" as const)} />
                <FieldError name="iban" form={form} />
              </Field>
              <Field label="SWIFT / BIC">
                <Input placeholder="HBUKGB4B" disabled={submitting} {...form.register("swift" as const)} />
                <FieldError name="swift" form={form} />
              </Field>
            </div>
          </>
        ) : method === "CRYPTO" ? (
          <>
            <Field label="Network">
              <Select
                value={(form.watch("network" as const) as string) ?? ""}
                onValueChange={(v) => form.setValue("network" as const, v as (typeof NETWORKS)[number], { shouldValidate: true })}
                disabled={submitting}
              >
                <SelectTrigger><SelectValue placeholder="Select network" /></SelectTrigger>
                <SelectContent>
                  {NETWORKS.map((n) => <SelectItem key={n} value={n}>{NETWORK_LABELS[n]}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError name="network" form={form} />
            </Field>
            <Field label="Wallet address">
              <Input placeholder="Paste your wallet address" disabled={submitting} {...form.register("address" as const)} />
              <FieldError name="address" form={form} />
            </Field>
          </>
        ) : (
          <Field label="PayPal email">
            <Input type="email" placeholder="your@paypal.com" disabled={submitting} {...form.register("email" as const)} />
            <FieldError name="email" form={form} />
          </Field>
        )}

        <Field label="Notes (optional)">
          <Input placeholder="Anything we should know about this payout" disabled={submitting} {...form.register("notes" as const)} />
        </Field>

        <Button type="submit" className="w-full" disabled={submitting || belowMin}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Request payout
        </Button>
      </form>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function FieldError({ name, form }: { name: string; form: ReturnType<typeof useForm<FormData>> }) {
  const err = (form.formState.errors as Record<string, { message?: string } | undefined>)[name];
  if (!err) return null;
  const msg = typeof err.message === "string" ? err.message : "Invalid";
  return <p className="text-xs text-destructive">{msg}</p>;
}

function StatCard({
  icon: Icon, label, value, loading, tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  loading?: boolean;
  tone?: "default" | "muted" | "warning" | "success";
}) {
  const valueClass = {
    default: "text-foreground", muted: "text-muted-foreground",
    warning: "text-yellow-600 dark:text-yellow-400", success: "text-green-600 dark:text-green-400",
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
        <Icon className="h-4 w-4" /> {label}
      </div>
      {loading ? <Skeleton className="h-8 w-24" /> : <div className={`text-2xl font-semibold tabular-nums ${valueClass}`}>{value ?? "—"}</div>}
    </Card>
  );
}
