'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { ErrorState } from '@/components/shared/ErrorState';
import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Pagination, useCursorPagination } from '@/components/shared/Pagination';
import { StatusPill } from '@/components/shared/StatusPill';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/sonner';
import { api, apiFetchWithMeta } from '@/lib/api-client';
import { messageForError } from '@/lib/error-messages';
import { qk } from '@/lib/query-keys';
import { ParticipantSearchBar } from './ParticipantSearchBar';
import type { ParticipantRow } from './types';

/**
 * UserAccessTable + RoleSelect + StatusToggle — TDD §6.9, PRD §3.B.11.
 *
 * **Setiap aksi berisiko lewat dialog konfirmasi**: mengubah peran dan
 * menonaktifkan akun keduanya mencabut/menambah kuasa, dan menonaktifkan akun
 * langsung merevoke seluruh sesi aktifnya (§5.3) — bukan aksi yang pantas
 * terjadi karena salah klik.
 *
 * Error yang wajib ditangani (§9.4): `409 LAST_ADMIN`, `403 CANNOT_DEMOTE_SELF`,
 * `403 CANNOT_DEACTIVATE_SELF`.
 *
 * TEMUAN KONTRAK (dilaporkan): §3.4 tidak menyediakan endpoint daftar user
 * untuk User Access — yang ada hanya `GET /admin/participants`. Endpoint itu
 * ternyata mengembalikan SELURUH user beserta `role`-nya, jadi ia dipakai di
 * sini. Konsekuensinya filter peran dikerjakan di client atas halaman yang
 * sedang termuat, karena `participantQuerySchema` tidak punya parameter `role`.
 */
export function RoleSelect({
  value,
  disabled,
  onChange,
}: {
  value: 'participant' | 'admin';
  disabled?: boolean;
  onChange: (role: 'participant' | 'admin') => void;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange(next as 'participant' | 'admin')}
    >
      <SelectTrigger className="w-40" aria-label="Ubah peran">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="participant">Participant</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function StatusToggle({
  status,
  disabled,
  onChange,
}: {
  status: 'active' | 'inactive';
  disabled?: boolean;
  onChange: (status: 'active' | 'inactive') => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={status === 'active'}
        disabled={disabled}
        aria-label={status === 'active' ? 'Nonaktifkan akun' : 'Aktifkan akun'}
        onCheckedChange={(checked) => onChange(checked ? 'active' : 'inactive')}
      />
      <StatusPill variant={status} />
    </div>
  );
}

type PendingAction =
  | { kind: 'role'; row: ParticipantRow; next: 'participant' | 'admin' }
  | { kind: 'status'; row: ParticipantRow; next: 'active' | 'inactive' }
  | { kind: 'reset'; row: ParticipantRow };

export function UserAccessTable({
  currentUserId,
  q,
  status,
  rowsPerPage,
}: {
  currentUserId: number;
  q: string;
  status: string;
  rowsPerPage: number;
}) {
  const queryClient = useQueryClient();
  const pagination = useCursorPagination();
  const [limit, setLimit] = React.useState(rowsPerPage);
  const [roleFilter, setRoleFilter] = React.useState<'all' | 'participant' | 'admin'>('all');
  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [temporaryPassword, setTemporaryPassword] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const queryKey = [...qk.admin.users.list({ q, status, role: roleFilter }), pagination.cursor, limit];

  const { data, error, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await apiFetchWithMeta<{ items: ParticipantRow[] }>('/admin/participants', {
        query: { q: q || undefined, status, cursor: pagination.cursor ?? undefined, limit },
      });
      const nextCursor = response.meta?.nextCursor;
      return {
        items: response.data.items,
        nextCursor: typeof nextCursor === 'string' ? nextCursor : null,
      };
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.admin.users.all });
    void queryClient.invalidateQueries({ queryKey: qk.admin.participants.all });
  };

  const roleMutation = useMutation({
    mutationFn: (input: { userId: number; role: 'participant' | 'admin' }) =>
      api.patch(`/admin/users/${input.userId}/role`, { role: input.role }),
    onSuccess: () => {
      toast.success('Peran akun diperbarui');
      setPending(null);
      invalidate();
    },
    onError: (mutationError) => toast.error(messageForError(mutationError)),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { userId: number; status: 'active' | 'inactive' }) =>
      api.patch(`/admin/users/${input.userId}/status`, { status: input.status }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.status === 'inactive'
          ? 'Akun dinonaktifkan dan seluruh sesinya dicabut'
          : 'Akun diaktifkan kembali',
      );
      setPending(null);
      invalidate();
    },
    onError: (mutationError) => toast.error(messageForError(mutationError)),
  });

  const resetMutation = useMutation({
    mutationFn: (userId: number) =>
      api.post<{ temporaryPassword: string }>(`/admin/users/${userId}/reset-password`),
    onSuccess: (result) => {
      setPending(null);
      setCopied(false);
      // Password sementara ditampilkan SEKALI (A-09) — tidak ada notifikasi
      // email di MVP, jadi admin harus menyalinnya sekarang.
      setTemporaryPassword(result.temporaryPassword);
    },
    onError: (mutationError) => toast.error(messageForError(mutationError)),
  });

  const rows = (data?.items ?? []).filter(
    (row) => roleFilter === 'all' || row.user.role === roleFilter,
  );

  const columns: Array<DataTableColumn<ParticipantRow>> = [
    {
      id: 'user',
      header: 'User',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>{row.user.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-title-md text-on-surface">
              {row.user.name}
              {row.user.id === currentUserId && (
                <span className="ml-2 text-label-sm text-on-surface-variant">(Anda)</span>
              )}
            </p>
            <p className="truncate text-label-sm text-on-surface-variant">{row.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => (
        <RoleSelect
          value={row.user.role}
          // Guard §5.3 juga ditegakkan server; di UI ia mencegah admin
          // mengunci dirinya sendiri sebelum request terkirim.
          disabled={row.user.id === currentUserId || roleMutation.isPending}
          onChange={(next) => setPending({ kind: 'role', row, next })}
        />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusToggle
          status={row.status}
          disabled={row.user.id === currentUserId || statusMutation.isPending}
          onChange={(next) => setPending({ kind: 'status', row, next })}
        />
      ),
    },
    {
      id: 'action',
      header: 'Action',
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPending({ kind: 'reset', row })}
          disabled={resetMutation.isPending}
        >
          <MaterialIcon name="lock_reset" />
          Reset password
        </Button>
      ),
    },
  ];

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const confirmLabels = pending
    ? {
        role: {
          title: `Ubah peran ${pending.row.user.name}?`,
          description:
            pending.kind === 'role' && pending.next === 'admin'
              ? 'Akun ini akan mendapat akses penuh ke portal admin, termasuk membuat event dan mengelola akun lain.'
              : 'Akun ini akan kehilangan akses ke portal admin.',
          action: 'Ubah peran',
        },
        status: {
          title:
            pending.kind === 'status' && pending.next === 'inactive'
              ? `Nonaktifkan akun ${pending.row.user.name}?`
              : `Aktifkan akun ${pending.row.user.name}?`,
          description:
            pending.kind === 'status' && pending.next === 'inactive'
              ? 'Seluruh sesi aktif akun ini dicabut seketika dan ia tidak dapat login lagi.'
              : 'Akun ini dapat login kembali seperti biasa.',
          action: 'Lanjutkan',
        },
        reset: {
          title: `Reset password ${pending.row.user.name}?`,
          description:
            'Password lama langsung tidak berlaku dan seluruh sesinya dicabut. Password sementara hanya ditampilkan satu kali.',
          action: 'Reset password',
        },
      }[pending.kind]
    : null;

  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest">
      <ParticipantSearchBar
        q={q}
        status={status}
        onParamsChange={pagination.reset}
        placeholder="Cari nama atau email…"
        extra={
          <Select
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as 'all' | 'participant' | 'admin')}
          >
            <SelectTrigger className="w-40" aria-label="Filter peran">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua peran</SelectItem>
              <SelectItem value="participant">Participant</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.user.id}
        isLoading={isFetching && !data}
        emptyTitle="Tidak ada akun"
        emptyDescription="Ubah kata kunci pencarian, filter status, atau filter peran."
      />

      <Pagination
        rowsPerPage={limit}
        onRowsPerPageChange={(next) => {
          pagination.reset();
          setLimit(next);
        }}
        currentCount={rows.length}
        pageIndex={pagination.pageIndex}
        hasNext={Boolean(data?.nextCursor)}
        hasPrevious={pagination.hasPrevious}
        onNext={() => pagination.goNext(data?.nextCursor ?? null)}
        onPrevious={pagination.goPrevious}
        isLoading={isFetching}
      />

      {/* Konfirmasi aksi berisiko */}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmLabels?.title}</DialogTitle>
            <DialogDescription>{confirmLabels?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPending(null)}>
              Batal
            </Button>
            <Button
              variant={pending?.kind === 'reset' ? 'destructive' : 'primary'}
              disabled={roleMutation.isPending || statusMutation.isPending || resetMutation.isPending}
              onClick={() => {
                if (!pending) return;
                if (pending.kind === 'role') {
                  roleMutation.mutate({ userId: pending.row.user.id, role: pending.next });
                } else if (pending.kind === 'status') {
                  statusMutation.mutate({ userId: pending.row.user.id, status: pending.next });
                } else {
                  resetMutation.mutate(pending.row.user.id);
                }
              }}
            >
              {confirmLabels?.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password sementara — ditampilkan SEKALI (A-09) */}
      <Dialog
        open={temporaryPassword !== null}
        onOpenChange={(open) => !open && setTemporaryPassword(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password sementara</DialogTitle>
            <DialogDescription>
              Salin sekarang — password ini tidak dapat ditampilkan lagi setelah dialog ditutup.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container p-4">
            <code className="min-w-0 flex-1 break-all text-title-md text-on-surface">
              {temporaryPassword}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                if (!temporaryPassword) return;
                try {
                  await navigator.clipboard.writeText(temporaryPassword);
                  setCopied(true);
                } catch {
                  toast.error('Browser menolak akses clipboard. Salin manual.');
                }
              }}
            >
              <MaterialIcon name={copied ? 'check' : 'content_copy'} />
              {copied ? 'Tersalin' : 'Salin'}
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setTemporaryPassword(null)}>Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
