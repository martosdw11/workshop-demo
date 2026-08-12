'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MaterialIcon } from './MaterialIcon';

/**
 * Pagination — TDD §6.2, mengikuti footer tabel `admin_participant_list`.
 *
 * ASUMSI EKSPLISIT (A-F02): mockup menampilkan nomor halaman (1 2 3 …), tetapi
 * kontrak §3.1 memakai **cursor**, bukan `OFFSET` — "loncat ke halaman 7"
 * memang tidak mungkin dilayani tanpa mengubah kontrak API (dilarang di epic
 * ini). Yang diimplementasikan: Previous / Next berbasis tumpukan cursor +
 * pemilih rows-per-page + keterangan rentang baris. Nomor halaman tetap terlihat
 * sebagai indikator ("Halaman 3"), tapi tidak bisa diklik langsung.
 */
export type PaginationProps = {
  rowsPerPage: number;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
  rowsPerPageOptions?: number[];
  /** Jumlah baris yang sedang tampil di halaman ini. */
  currentCount: number;
  pageIndex: number;
  hasNext: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  isLoading?: boolean;
  className?: string;
};

export function Pagination({
  rowsPerPage,
  onRowsPerPageChange,
  rowsPerPageOptions = [10, 25, 50],
  currentCount,
  pageIndex,
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
  isLoading = false,
  className,
}: PaginationProps) {
  const from = currentCount === 0 ? 0 : pageIndex * rowsPerPage + 1;
  const to = pageIndex * rowsPerPage + currentCount;

  return (
    <nav
      aria-label="Navigasi halaman"
      className={cn(
        'flex flex-col items-center justify-between gap-4 border-t border-outline-variant px-4 py-3 sm:flex-row',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {onRowsPerPageChange && (
          <>
            <span className="text-body-sm text-on-surface-variant">Baris per halaman</span>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(value) => onRowsPerPageChange(Number(value))}
            >
              <SelectTrigger className="w-20" aria-label="Baris per halaman">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rowsPerPageOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-body-sm text-on-surface-variant" aria-live="polite">
          {currentCount === 0
            ? 'Tidak ada data'
            : `Menampilkan ${formatNumber(from)}–${formatNumber(to)} · Halaman ${pageIndex + 1}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onPrevious}
            disabled={!hasPrevious || isLoading}
            aria-label="Halaman sebelumnya"
          >
            <MaterialIcon name="chevron_left" />
            Sebelumnya
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onNext}
            disabled={!hasNext || isLoading}
            aria-label="Halaman berikutnya"
          >
            Berikutnya
            <MaterialIcon name="chevron_right" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

/**
 * Hook pendamping: menyimpan tumpukan cursor supaya tombol "Sebelumnya" bisa
 * bekerja di atas API yang hanya mengirim `nextCursor`.
 */
export function useCursorPagination() {
  const [stack, setStack] = React.useState<Array<string | null>>([null]);
  const [pageIndex, setPageIndex] = React.useState(0);

  const goNext = React.useCallback(
    (nextCursor: string | null) => {
      if (!nextCursor) return;
      // Dipotong sampai halaman aktif dulu: setelah "Sebelumnya", cursor halaman
      // yang lebih dalam sudah tidak sah lagi dan harus dibuang, bukan ditumpuk.
      setStack((prev) => [...prev.slice(0, pageIndex + 1), nextCursor]);
      setPageIndex((prev) => prev + 1);
    },
    [pageIndex],
  );

  const goPrevious = React.useCallback(() => {
    setPageIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const reset = React.useCallback(() => {
    setStack([null]);
    setPageIndex(0);
  }, []);

  return {
    cursor: stack[pageIndex] ?? null,
    pageIndex,
    hasPrevious: pageIndex > 0,
    goNext,
    goPrevious,
    reset,
  };
}
