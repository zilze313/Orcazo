"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Wallet,
  DollarSign,
  Banknote,
  Bitcoin,
  Mail,
  Loader2,
  Send,
  Clock,
  CheckCircle2,
  History,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { Separator } from "@/components/ui/separator";
import { api, isUpstreamExpired } from "@/lib/api-client";
import { formatMoney, formatRelative } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface PayoutItem {
  id: string;
  createdAt: string;
  status: string;
  amountAtRequest: number;
  amountPaid: number | null;
  penalty: number | null;
  adminNote: string | null;
  method: "BANK" | "CRYPTO" | "PAYPAL";
  paidAt: string | null;
  rejectedAt: string | null;
}

interface PayoutsResp {
  history: PayoutItem[];
  waitingPayment: number;
  totalPaid: number;
  minPayout: number;
  canRequest: boolean;
  pending: { id: string; status: string; createdAt: string } | null;
  savedDetails: {
    method: "BANK" | "CRYPTO" | "PAYPAL";
    details: Record<string, string>;
  } | null;
}

type PayoutMethod = "BANK" | "CRYPTO" | "PAYPAL";
const NETWORKS = [
  "BTC",
  "ETH",
  "USDC_ERC20",
  "USDC_TRC20",
  "USDT_ERC20",
  "USDT_TRC20",
  "SOL",
] as const;
const NETWORK_LABELS: Record<string, string> = {
  BTC: "Bitcoin (BTC)",
  ETH: "Ethereum (ETH)",
  USDC_ERC20: "USDC (Ethereum)",
  USDC_TRC20: "USDC (Tron)",
  USDT_ERC20: "USDT (Ethereum)",
  USDT_TRC20: "USDT (Tron)",
  SOL: "Solana (SOL)",
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

function statusVariant(
  s: string,
): "success" | "warning" | "destructive" | "secondary" | "default" {
  const x = s.toUpperCase();
  if (x === "PAID") return "success";
  if (x === "REJECTED" || x === "CANCELLED") return "destructive";
  if (x === "IN_PROGRESS" || x === "REQUESTED") return "warning";
  return "secondary";
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    REQUESTED: "Requested",
    IN_PROGRESS: "In progress",
    PAID: "Paid",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };
  return map[s.toUpperCase()] ?? s;
}

export default function PayoutsPage() {
  const qc = useQueryClient();
  const router = useRouter();

  const query = useQuery<PayoutsResp>({
    queryKey: ["payouts"],
    queryFn: () => api.get<PayoutsResp>("/api/payouts"),
    staleTime: 10_000,
  });

  React.useEffect(() => {
    if (query.error && isUpstreamExpired(query.error)) router.replace("/login");
  }, [query.error, router]);

  const [method, setMethod] = React.useState<PayoutMethod>("BANK");
  React.useEffect(() => {
    if (query.data?.savedDetails) setMethod(query.data.savedDetails.method);
  }, [query.data?.savedDetails]);

  const submitMut = useMutation({
    mutationFn: (values: FormData) =>
      api.post<{ ok: true }>("/api/payouts", values),
    onSuccess: () => {
      toast.success(
        "Payout request submitted. Our team will process it within a few days.",
      );
      qc.invalidateQueries({ queryKey: ["payouts"] });
    },
    onError: (err: unknown) =>
      toast.error((err as Error)?.message || "Could not submit"),
  });

  return (
    <>
      <PageHeader
        title="Payouts"
        description="Request a payout and see your payment history."
      />

      <div className="container max-w-5xl py-6 space-y-6">
        {/* Top status cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={DollarSign}
            label="Available balance"
            value={query.data ? formatMoney(query.data.waitingPayment) : null}
            loading={query.isLoading}
            tone="warning"
          />
          <StatCard
            icon={CheckCircle2}
            label="Total paid out"
            value={query.data ? formatMoney(query.data.totalPaid) : null}
            loading={query.isLoading}
            tone="success"
          />
          <StatCard
            icon={Clock}
            label="Pending request"
            value={
              query.data?.pending
                ? statusLabel(query.data.pending.status)
                : query.data
                  ? "None"
                  : null
            }
            loading={query.isLoading}
            tone={query.data?.pending ? "warning" : "muted"}
          />
        </div>

        {query.data?.pending && (
          <Card className="p-5 border-yellow-500/50 bg-yellow-500/5">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">
                  A payout request is in progress
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  We received your request{" "}
                  {formatRelative(query.data.pending.createdAt)} and our team is
                  processing it. You can submit a new request once this one is
                  completed.
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
            disabled={submitMut.isPending}
            waitingPayment={query.data?.waitingPayment ?? 0}
            minPayout={query.data?.minPayout ?? 10}
            onSubmit={(v) => submitMut.mutate(v)}
            submitting={submitMut.isPending}
          />
        )}

        <Separator />

        {/* History */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <History className="h-4 w-4" /> Payout history
          </h2>
          <Card className="overflow-x-auto">
            {query.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (query.data?.history.length ?? 0) === 0 ? (
              <EmptyState
                icon={History}
                title="No payouts yet"
                description="Once you request your first payout, it'll appear here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Penalty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data!.history.map((p) => (
                    <React.Fragment key={p.id}>
                      <TableRow>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatMoney(p.amountAtRequest)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.amountPaid != null ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              {formatMoney(p.amountPaid)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.penalty != null && p.penalty > 0 ? (
                            <span className="text-orange-600 dark:text-orange-400 text-xs">
                              {formatMoney(p.penalty)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusVariant(p.status)}
                            className="text-[10px] whitespace-nowrap"
                          >
                            {statusLabel(p.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {p.adminNote && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={5} className="py-1.5 px-4">
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {p.status === 'REJECTED'
                                ? <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                                : <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                              }
                              <span className="italic">{p.adminNote}</span>
                            </span>
                          </TableCell>
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
    </>
  );
}

function RequestForm({
  method,
  onMethodChange,
  saved,
  onSubmit,
  submitting,
  waitingPayment,
  minPayout,
}: {
  method: PayoutMethod;
  onMethodChange: (m: PayoutMethod) => void;
  saved: PayoutsResp["savedDetails"];
  disabled: boolean;
  onSubmit: (v: FormData) => void;
  submitting: boolean;
  waitingPayment: number;
  minPayout: number;
}) {
  const initial: Partial<FormData> =
    saved?.method === "BANK"
      ? ({ method: "BANK", ...(saved.details as Record<string, string>) } as FormData)
      : saved?.method === "CRYPTO"
        ? ({ method: "CRYPTO", ...(saved.details as Record<string, string>) } as FormData)
        : saved?.method === "PAYPAL"
          ? ({ method: "PAYPAL", ...(saved.details as Record<string, string>) } as FormData)
          : { method };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initial as FormData,
  });

  React.useEffect(() => {
    form.setValue("method", method as FormData["method"]);
  }, [method, form]);

  const belowMin = waitingPayment < minPayout;

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <Send className="h-4 w-4" /> Request a payout
      </h2>

      {belowMin && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-muted/50 border px-3 py-2 text-xs text-muted-foreground">
          <Wallet className="h-3.5 w-3.5 flex-shrink-0" />
          Minimum balance of {formatMoney(minPayout)} required to request a payout.
          Your current balance is {formatMoney(waitingPayment)}.
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <Button
          type="button"
          variant={method === "BANK" ? "default" : "outline"}
          size="sm"
          onClick={() => onMethodChange("BANK")}
        >
          <Banknote className="h-4 w-4" /> Bank transfer
        </Button>
        <Button
          type="button"
          variant={method === "CRYPTO" ? "default" : "outline"}
          size="sm"
          onClick={() => onMethodChange("CRYPTO")}
        >
          <Bitcoin className="h-4 w-4" /> Crypto
        </Button>
        <Button
          type="button"
          variant={method === "PAYPAL" ? "default" : "outline"}
          size="sm"
          onClick={() => onMethodChange("PAYPAL")}
        >
          <Mail className="h-4 w-4" /> PayPal
        </Button>
      </div>

      <form
        onSubmit={form.handleSubmit((v) => {
          if (belowMin) {
            toast.error(`Minimum balance of ${formatMoney(minPayout)} required to withdraw.`);
            return;
          }
          onSubmit(v);
        })}
        className="space-y-3"
      >
        {method === "BANK" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Account holder name">
                <Input
                  placeholder="John Doe"
                  disabled={submitting}
                  {...form.register("holderName" as const)}
                />
                <FieldError name="holderName" form={form} />
              </Field>
              <Field label="Bank name">
                <Input
                  placeholder="HSBC"
                  disabled={submitting}
                  {...form.register("bankName" as const)}
                />
                <FieldError name="bankName" form={form} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="IBAN / Account number">
                <Input
                  placeholder="GB82 WEST 1234 5698 7654 32"
                  disabled={submitting}
                  {...form.register("iban" as const)}
                />
                <FieldError name="iban" form={form} />
              </Field>
              <Field label="SWIFT / BIC">
                <Input
                  placeholder="HBUKGB4B"
                  disabled={submitting}
                  {...form.register("swift" as const)}
                />
                <FieldError name="swift" form={form} />
              </Field>
            </div>
          </>
        ) : method === "CRYPTO" ? (
          <>
            <Field label="Network">
              <Select
                value={(form.watch("network" as const) as string) ?? ""}
                onValueChange={(v) =>
                  form.setValue(
                    "network" as const,
                    v as (typeof NETWORKS)[number],
                    { shouldValidate: true },
                  )
                }
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent>
                  {NETWORKS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {NETWORK_LABELS[n]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError name="network" form={form} />
            </Field>
            <Field label="Wallet address">
              <Input
                placeholder="Paste your wallet address"
                disabled={submitting}
                {...form.register("address" as const)}
              />
              <FieldError name="address" form={form} />
            </Field>
            <p className="text-xs text-muted-foreground">
              Make sure the address matches the network. Funds sent to the wrong
              network are usually unrecoverable.
            </p>
          </>
        ) : (
          <>
            <Field label="PayPal email">
              <Input
                type="email"
                placeholder="your@paypal.com"
                disabled={submitting}
                {...form.register("email" as const)}
              />
              <FieldError name="email" form={form} />
            </Field>
            <p className="text-xs text-muted-foreground">
              Enter the email address linked to your PayPal account.
            </p>
          </>
        )}

        <Field label="Notes (optional)">
          <Input
            placeholder="Anything we should know about this payout"
            disabled={submitting}
            {...form.register("notes" as const)}
          />
        </Field>

        <Button type="submit" className="w-full" disabled={submitting || belowMin}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Request payout
        </Button>
      </form>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function FieldError({
  name,
  form,
}: {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
}) {
  const err = form.formState.errors?.[name];
  if (!err) return null;
  const msg = typeof err.message === "string" ? err.message : "Invalid";
  return <p className="text-xs text-destructive">{msg}</p>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  loading?: boolean;
  tone?: "default" | "muted" | "warning" | "success";
}) {
  const valueClass = {
    default: "text-foreground",
    muted: "text-muted-foreground",
    warning: "text-yellow-600 dark:text-yellow-400",
    success: "text-green-600 dark:text-green-400",
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className={`text-2xl font-semibold tabular-nums ${valueClass}`}>
          {value ?? "—"}
        </div>
      )}
    </Card>
  );
}
