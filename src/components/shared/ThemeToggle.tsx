'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { applyTheme, currentTheme, THEME_STORAGE_KEY } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { MaterialIcon } from './MaterialIcon';

/**
 * ThemeToggle — tombol pengganti tema terang ↔ gelap (PRD §7.7).
 *
 * TIDAK menyimpan tema di state React, dan itu disengaja. Tema sudah dipasang ke
 * <html> oleh skrip anti-FOUC (`lib/theme.ts`) SEBELUM React hidrasi, sehingga
 * markup server ("belum tahu tema") dan markup klien ("sudah tahu") akan berbeda
 * — persis resep hydration mismatch. Karena itu ikon dan labelnya ditukar oleh
 * CSS lewat varian `dark:`, bukan oleh render ulang: server dan klien
 * menghasilkan HTML yang identik, dan yang berubah hanya kelas pada <html>.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const handleToggle = () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Lihat catatan di `storedTheme()` — gagal menyimpan tidak boleh
      // membatalkan perubahan tema yang sudah terlihat pengguna.
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      title="Ganti tema terang / gelap"
      className={cn(className)}
    >
      {/* Ikon menunjukkan TUJUAN klik, bukan keadaan sekarang: di tema gelap
          tampil matahari (menuju terang), dan sebaliknya. */}
      <MaterialIcon name="light_mode" className="hidden dark:inline-block" />
      <MaterialIcon name="dark_mode" className="dark:hidden" />

      {/* Label pembaca layar ikut ditukar CSS, dengan alasan yang sama seperti
          ikon — `aria-label` tidak bisa dikendalikan CSS, teks bisa. */}
      <span className="sr-only hidden dark:inline">Ganti ke tema terang</span>
      <span className="sr-only dark:hidden">Ganti ke tema gelap</span>
    </Button>
  );
}
