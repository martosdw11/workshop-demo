'use client';

import * as React from 'react';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Field form dengan label eksternal top-aligned + helper text error
 * (DESIGN.md "Inputs"). Dipakai LoginForm & RegisterForm.
 *
 * Error ditampilkan INLINE di field — jalur penyajian untuk `422` dan untuk
 * `409 EMAIL_TAKEN` (§9.4 baris terakhir). Penautan `aria-describedby` +
 * `aria-invalid` dilakukan di sini agar tidak bisa terlupa di salah satu form.
 */
export type FormFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  icon?: string;
  /** Tombol mata untuk field password. */
  revealable?: boolean;
};

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, name, error, icon, revealable = false, type = 'text', className, ...props }, ref) => {
    const [revealed, setRevealed] = React.useState(false);
    const errorId = `${name}-error`;
    const inputType = revealable ? (revealed ? 'text' : 'password') : type;

    return (
      <div className="space-y-2">
        <Label htmlFor={name}>{label}</Label>
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <MaterialIcon name={icon} className="text-[20px] text-outline" />
            </span>
          )}
          <Input
            id={name}
            name={name}
            ref={ref}
            type={inputType}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(icon && 'pl-10', revealable && 'pr-12', className)}
            {...props}
          />
          {revealable && (
            <button
              type="button"
              onClick={() => setRevealed((prev) => !prev)}
              aria-label={revealed ? 'Sembunyikan password' : 'Tampilkan password'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-lg text-outline transition-colors hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <MaterialIcon name={revealed ? 'visibility_off' : 'visibility'} className="text-[20px]" />
            </button>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-body-sm text-error">
            {error}
          </p>
        )}
      </div>
    );
  },
);
FormField.displayName = 'FormField';
