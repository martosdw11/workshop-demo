import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Penggabung className standar shadcn/ui: `clsx` menyusun kondisional,
 * `tailwind-merge` membuang kelas Tailwind yang saling bertabrakan sehingga
 * `className` dari pemanggil selalu menang atas default komponen.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Inisial untuk avatar (maks. 2 huruf) — dipakai timeline respons & tabel peserta. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
