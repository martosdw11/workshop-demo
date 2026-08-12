'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Button } from '@/components/ui/button';
import { api, isApiError } from '@/lib/api-client';
import { messageForError } from '@/lib/error-messages';
import { registerSchema, type RegisterInput } from '@/lib/validation/auth';
import { FormField } from './FormField';

/**
 * RegisterForm — TDD §6.3. Empat field wajib §3.A.1 PRD:
 * **Nama Lengkap, Email, No. HP, Password**.
 *
 * `409 EMAIL_TAKEN` ditampilkan INLINE di field email (§9.4). Server mengirim
 * `details.fields.email`, tetapi teks yang dirender tetap diambil dari peta
 * kode lokal supaya satu kode = satu kalimat di seluruh aplikasi.
 *
 * Registrasi mandiri selalu menghasilkan `role='participant'` — field `role`
 * tidak ada di skema maupun di form (guard privilege escalation §5.3).
 */
export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api.post('/auth/register', values);
      // Server sudah men-set cookie sesi pada 201, jadi peserta langsung masuk.
      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      if (isApiError(error) && error.code === 'EMAIL_TAKEN') {
        setError('email', { type: 'server', message: messageForError(error) });
        return;
      }
      if (isApiError(error) && error.status === 422) {
        const fields = error.fieldErrors;
        if (fields) {
          for (const [field, message] of Object.entries(fields)) {
            if (field in values) setError(field as keyof RegisterInput, { type: 'server', message });
          }
          return;
        }
      }
      setFormError(messageForError(error));
    }
  });

  return (
    <div>
      <div className="mb-10 text-center lg:text-left">
        <h1 className="mb-2 text-headline-lg-mobile text-on-surface lg:text-headline-lg">
          Buat akun baru
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Daftar untuk mengikuti event pembelajaran.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <FormField
          label="Nama Lengkap"
          icon="person"
          autoComplete="name"
          placeholder="Nama lengkap Anda"
          error={errors.name?.message}
          {...register('name')}
        />

        <FormField
          label="Email"
          icon="mail"
          autoComplete="email"
          placeholder="nama@perusahaan.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <FormField
          label="No. HP"
          icon="call"
          autoComplete="tel"
          inputMode="tel"
          placeholder="0812xxxxxxx"
          error={errors.phone?.message}
          {...register('phone')}
        />

        <FormField
          label="Password"
          icon="lock"
          revealable
          autoComplete="new-password"
          placeholder="Minimal 8 karakter, memuat huruf & angka"
          error={errors.password?.message}
          {...register('password')}
        />

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
          {isSubmitting ? 'Memproses…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-10 text-center text-body-sm text-on-surface-variant">
        Sudah punya akun?{' '}
        <Link
          href="/login"
          className="ml-1 rounded text-label-md text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
