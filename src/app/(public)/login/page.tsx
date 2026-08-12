import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginForm } from '@/features/auth/LoginForm';

export const metadata: Metadata = { title: 'Masuk — Learning Study AI' };

/**
 * `LoginForm` membaca `?next=` lewat `useSearchParams`, sehingga ia wajib
 * dibungkus `Suspense` agar halaman ini tetap bisa dirender statis (§1.2).
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
