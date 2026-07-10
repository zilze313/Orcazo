'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus, Trash2, Loader2, Eye, EyeOff } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

const ALL_PERMISSIONS = [
  { key: 'campaigns',       label: 'Campaigns & Rules' },
  { key: 'reposting',       label: 'Reposting' },
  { key: 'creators',        label: 'Creator Signups & Allowlist' },
  { key: 'messages',        label: 'Messages & Support' },
  { key: 'payouts',         label: 'Payouts' },
  { key: 'content',         label: 'Content (Announcements, Videos)' },
  { key: 'login-requests',  label: 'Login Requests' },
  { key: 'managed-emails',  label: 'Managed Emails' },
  { key: 'referral-codes',  label: 'Referral Codes' },
  { key: 'health',          label: 'Health Dashboard' },
] as const;

type PermKey = typeof ALL_PERMISSIONS[number]['key'];

interface AdminRow {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
  permissions: PermKey[];
  createdAt: string;
  _count?: { sessions: number };
}

interface AdminsResp { admins: AdminRow[] }

function PermissionToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-primary border-primary' : 'border-input'}`}
      >
        {checked && <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
      </div>
      <span className="text-sm">{label}</span>
    </label>
  );
}

export default function AdminsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<AdminRow | null>(null);

  const { data, isLoading } = useQuery<AdminsResp>({
    queryKey: ['admin', 'admins'],
    queryFn: () => api.get<AdminsResp>('/api/admin/admins'),
    staleTime: 10_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/admins/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'admins'] });
      toast.success('Admin deleted');
    },
    onError: () => toast.error('Failed to delete admin'),
  });

  return (
    <>
      <PageHeader
        title="Admins"
        description="Manage admin accounts and their permissions."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add admin
          </Button>
        }
      />

      <div className="container max-w-4xl py-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : (data?.admins ?? []).map((admin) => (
          <Card key={admin.id} className="p-4 flex items-start gap-4">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{admin.email}</span>
                <Badge variant={admin.role === 'SUPER_ADMIN' ? 'default' : 'secondary'} className="text-[10px]">
                  {admin.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                </Badge>
                {(admin._count?.sessions ?? 0) > 0 && (
                  <Badge variant="outline" className="text-[10px] text-green-600 border-green-400">Active</Badge>
                )}
              </div>
              {admin.role === 'ADMIN' && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {admin.permissions.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No permissions</span>
                  ) : (
                    admin.permissions.map((p) => (
                      <span key={p} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
                        {ALL_PERMISSIONS.find((x) => x.key === p)?.label ?? p}
                      </span>
                    ))
                  )}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                Created {new Date(admin.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setEditTarget(admin)}
              >
                Edit
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm(`Delete ${admin.email}? This cannot be undone.`)) {
                    deleteMut.mutate(admin.id);
                  }
                }}
                disabled={deleteMut.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <CreateAdminDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['admin', 'admins'] });
          setCreateOpen(false);
        }}
      />

      {editTarget && (
        <EditAdminDialog
          admin={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'admins'] });
            setEditTarget(null);
          }}
        />
      )}
    </>
  );
}

function CreateAdminDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [role, setRole] = React.useState<'SUPER_ADMIN' | 'ADMIN'>('ADMIN');
  const [permissions, setPermissions] = React.useState<PermKey[]>([]);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, permissions }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to create admin'); return; }
      toast.success('Admin created');
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  function togglePerm(key: PermKey) {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add admin</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <div className="flex gap-3">
              {(['ADMIN', 'SUPER_ADMIN'] as const).map((r) => (
                <label key={r} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input type="radio" checked={role === r} onChange={() => setRole(r)} className="accent-primary" />
                  {r === 'SUPER_ADMIN' ? 'Super Admin (all access)' : 'Admin (configurable)'}
                </label>
              ))}
            </div>
          </div>
          {role === 'ADMIN' && (
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {ALL_PERMISSIONS.map((p) => (
                  <PermissionToggle
                    key={p.key}
                    label={p.label}
                    checked={permissions.includes(p.key)}
                    onChange={() => togglePerm(p.key)}
                  />
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create admin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAdminDialog({ admin, onClose, onSuccess }: { admin: AdminRow; onClose: () => void; onSuccess: () => void }) {
  const [role, setRole] = React.useState<'SUPER_ADMIN' | 'ADMIN'>(admin.role);
  const [permissions, setPermissions] = React.useState<PermKey[]>(admin.permissions);
  const [password, setPassword] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = { role, permissions };
      if (password) body.password = password;
      const res = await fetch(`/api/admin/admins/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Update failed'); return; }
      toast.success('Admin updated');
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  function togglePerm(key: PermKey) {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit {admin.email}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <div className="flex gap-3">
              {(['ADMIN', 'SUPER_ADMIN'] as const).map((r) => (
                <label key={r} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input type="radio" checked={role === r} onChange={() => setRole(r)} className="accent-primary" />
                  {r === 'SUPER_ADMIN' ? 'Super Admin (all access)' : 'Admin (configurable)'}
                </label>
              ))}
            </div>
          </div>
          {role === 'ADMIN' && (
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {ALL_PERMISSIONS.map((p) => (
                  <PermissionToggle
                    key={p.key}
                    label={p.label}
                    checked={permissions.includes(p.key)}
                    onChange={() => togglePerm(p.key)}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>New password <span className="text-muted-foreground text-xs">(leave blank to keep current)</span></Label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                className="pr-10"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
