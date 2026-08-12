import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Input — DESIGN.md "Inputs": radius 12px, label eksternal top-aligned,
 * state error memakai warna Issue pada border DAN helper text.
 *
 * `aria-invalid` yang menggerakkan gaya error (bukan prop `error` terpisah),
 * supaya penanda visual dan penanda aksesibilitas tidak bisa lepas satu sama lain.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'block min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest',
        'px-4 py-2 text-body-md text-on-surface placeholder:text-outline',
        'transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:outline-error',
        'file:mr-4 file:rounded-lg file:border-0 file:bg-surface-container-high file:px-4 file:py-2 file:text-label-md file:text-on-surface',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
