'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { api, isApiError } from '@/lib/api-client';
import { messageForError } from '@/lib/error-messages';
import { loginSchema, type LoginInput } from '@/lib/validation/auth';
import { FormField } from './FormField';

/**
 * LoginForm — TDD §6.3, acuan `login_learning_study_ai/`.
 *
 * Skema Zod-nya adalah `lib/validation/auth.ts` YANG SAMA dengan yang dipakai
 * Route Handler (§3.1) — pesan validasi di klien dan di server karena itu tidak
 * bisa berbeda.
 *
 * Penyajian error (§9.4): `401 INVALID_CREDENTIALS` dan `403 ACCOUNT_INACTIVE`
 * adalah kegagalan tingkat form (bukan satu field), sehingga ditampilkan sebagai
 * banner `role="alert"` di atas tombol — bukan menyalahkan field email.
 */
type LoginUser = { id: number; role: 'participant' | 'admin' };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const rememberMe = watch('rememberMe');

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await api.post<{ user: LoginUser }>('/auth/login', values);

      // `?next=` diisi middleware saat pengguna dilempar dari halaman terproteksi.
      const nextParam = searchParams.get('next');
      const fallback = result.user.role === 'admin' ? '/admin' : '/dashboard';
      // Hanya path internal yang diterima — mencegah open redirect.
      const target = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : fallback;

      router.replace(target);
      router.refresh();
    } catch (error) {
      setFormError(messageForError(error));
      if (isApiError(error) && error.status === 429) {
        // 429 tetap ditampilkan di banner form: pengguna sedang menatap form ini,
        // toast di pojok layar justru mudah terlewat pada alur login.
      }
    }
  });

  return (
    <div>
      <div className="mb-10 text-center lg:text-left">
        <h1 className="mb-2 text-headline-lg-mobile text-on-surface lg:text-headline-lg">
          Welcome back
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Masuk untuk melanjutkan pembelajaran Anda.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <FormField
          label="Email"
          icon="mail"
          autoComplete="email"
          placeholder="nama@perusahaan.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <FormField
          label="Password"
          icon="lock"
          revealable
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="rememberMe"
              checked={Boolean(rememberMe)}
              onCheckedChange={(checked) => setValue('rememberMe', checked === true)}
            />
            <Label htmlFor="rememberMe" className="cursor-pointer text-body-sm text-on-surface-variant">
              Remember me
            </Label>
          </div>

          {/*
            "Forgot password?" ada di acuan desain, tetapi pemulihan password
            mandiri butuh notifikasi email yang OUT OF SCOPE MVP (§2 PRD).
            Reset password dikerjakan admin lewat User Access (A-09), jadi tautan
            ini menjelaskan jalurnya alih-alih mengarah ke halaman yang tak ada.
          */}
          <span
            className="cursor-help text-label-md text-on-surface-variant underline decoration-dotted"
            title="Hubungi admin untuk reset password (belum ada notifikasi email pada MVP)."
          >
            Forgot password?
          </span>
        </div>

        {formError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-error-container bg-error-container/40 px-4 py-3 text-body-sm text-on-error-container"
          >
            <MaterialIcon name="error" className="text-[18px]" />
            {formError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Memproses…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-10 text-center text-body-sm text-on-surface-variant">
        Belum punya akun?{' '}
        <Link
          href="/register"
          className="ml-1 rounded text-label-md text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Register here
        </Link>
      </p>
    </div>
  );
}
