'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { isApiError } from '@/lib/api-client';

/**
 * Providers global — TanStack Query (baseline §7.1 PRD) + Tooltip + Toaster.
 *
 * Kebijakan retry yang penting: **4xx tidak pernah di-retry**. Mengulang
 * `403 MATERIAL_LOCKED` atau `409 ALREADY_ENROLLED` tidak akan pernah berhasil,
 * hanya menunda pesan yang seharusnya langsung terlihat pengguna — dan pada
 * endpoint tulis, retry otomatis justru menabrak rate limit §9.3.
 *
 * `staleTime` 30 detik menyamai TTL cache server (§7.3) sehingga refetch klien
 * tidak lebih rapat daripada data yang mungkin berubah. Polling 30 detik
 * DITETAPKAN PER-QUERY di area admin saja (§6.8) — halaman peserta tidak
 * melakukan refetch berkala.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // Di server selalu client baru (tidak boleh berbagi cache antar request);
  // di browser satu instance supaya cache bertahan lintas navigasi.
  if (typeof window === 'undefined') return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
