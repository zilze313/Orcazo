"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, Search, ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { PaginationBar } from "@/components/pagination-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api-client";

interface Employee {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  affiliateNetworkPublicId: string | null;
  bioVerificationCode: string | null;
  cachedBalance: string | null;
  cachedWaitingPayment: string | null;
  cachedWaitingReview: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

interface ListResp {
  employees: Employee[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

type SortField =
  | "createdAt"
  | "firstName"
  | "email"
  | "cachedBalance"
  | "cachedWaitingPayment";

const COLUMNS: Array<{
  field: SortField | null;
  label: string;
  align?: "right";
}> = [
  { field: "email", label: "Email" },
  { field: "firstName", label: "Name" },
  { field: null, label: "Bio code" },
  { field: "cachedBalance", label: "Paid", align: "right" },
  { field: "cachedWaitingPayment", label: "Awaiting payment", align: "right" },
  { field: null, label: "Awaiting review", align: "right" },
  { field: "createdAt", label: "Joined" },
];

export default function AdminEmployeesPage() {
  const router = useRouter();
  const params = useSearchParams();

  const search = params.get("search") ?? "";
  const sort = (params.get("sort") as SortField) ?? "createdAt";
  const order = (params.get("order") as "asc" | "desc") ?? "desc";
  const page = Math.max(1, parseInt(params.get("page") || "1", 10));

  const [searchInput, setSearchInput] = React.useState(search);

  // Debounce search input → URL
  React.useEffect(() => {
    const t = setTimeout(() => {
      const u = new URLSearchParams(params);
      if (searchInput) u.set("search", searchInput);
      else u.delete("search");
      u.set("page", "1");
      router.replace(`/admin/employees?${u.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const list = useQuery<ListResp>({
    queryKey: ["admin", "employees", search, sort, order, page],
    queryFn: () => {
      const u = new URLSearchParams({
        page: String(page),
        pageSize: "25",
        sort,
        order,
      });
      if (search) u.set("search", search);
      return api.get<ListResp>(`/api/admin/employees?${u.toString()}`);
    },
    staleTime: 15_000,
  });

  const setSort = (field: SortField) => {
    const u = new URLSearchParams(params);
    if (sort === field) {
      u.set("order", order === "asc" ? "desc" : "asc");
    } else {
      u.set("sort", field);
      u.set("order", "desc");
    }
    u.set("page", "1");
    router.replace(`/admin/employees?${u.toString()}`, { scroll: false });
  };

  const setPage = (p: number) => {
    const u = new URLSearchParams(params);
    u.set("page", String(p));
    router.replace(`/admin/employees?${u.toString()}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="Employees"
        description="Everyone who's logged in to Orcazo, with cached profile data."
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search email or name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
        }
      />

      <div className="container max-w-7xl py-6">
        <Card className="overflow-x-auto">
          {list.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (list.data?.employees.length ?? 0) === 0 ? (
            <EmptyState
              icon={Users}
              title={search ? "No matches" : "No employees yet"}
              description={
                search
                  ? "Try a different search term."
                  : "Once a user logs in, they'll appear here."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((col) => (
                    <TableHead
                      key={col.label}
                      className={`whitespace-nowrap ${col.align === "right" ? "text-right" : ""}`}
                    >
                      {col.field ? (
                        <button
                          onClick={() => setSort(col.field!)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {col.label}
                          <SortIcon active={sort === col.field} order={order} />
                        </button>
                      ) : (
                        col.label
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data!.employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.email}</TableCell>
                    <TableCell className="text-sm">
                      {e.firstName || e.lastName ? (
                        `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim()
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {e.bioVerificationCode || (
                        <span className="text-muted-foreground font-sans">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {e.cachedBalance ? `$${e.cachedBalance}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {e.cachedWaitingPayment ? `$${e.cachedWaitingPayment}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {e.cachedWaitingReview ? `$${e.cachedWaitingReview}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {list.data && list.data.employees.length > 0 && (
            <div className="px-4 border-t">
              <PaginationBar
                page={list.data.pagination.page}
                totalPages={list.data.pagination.totalPages}
                total={list.data.pagination.total}
                onPageChange={setPage}
              />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function SortIcon({
  active,
  order,
}: {
  active: boolean;
  order: "asc" | "desc";
}) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
  return order === "asc" ? (
    <ArrowUp className="h-3 w-3" />
  ) : (
    <ArrowDown className="h-3 w-3" />
  );
}
