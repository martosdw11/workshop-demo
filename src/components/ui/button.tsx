import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Primitif shadcn/ui — TDD §6.1.
 *
 * Override wajib yang dipakai SEMUA varian:
 *   · radius 12px (`rounded-lg`, lihat catatan A-F01 di tailwind.config.ts),
 *   · tinggi minimum 44px (touch target §7.6 PRD) — termasuk varian `sm`,
 *   · focus ring 2px `primary` dengan offset (§7.7 PRD), tidak pernah `outline:none`.
 */
const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg',
    'font-sans text-label-md transition-colors',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_.material-symbols-outlined]:text-[20px]',
  ),
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-container',
        secondary:
          'border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low',
        ghost: 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
        destructive: 'bg-error text-on-error hover:bg-on-error-container',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // Tinggi minimum 44px berlaku untuk semua ukuran teks (§7.6 PRD).
        default: 'min-h-11 px-6 py-2',
        sm: 'min-h-11 px-4 py-2 text-label-sm',
        lg: 'min-h-12 px-8 py-3',
        icon: 'h-11 w-11 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        // Default `submit` milik <button> di dalam form sering memicu submit tak
        // sengaja; tombol aksi di aplikasi ini mayoritas bukan submit.
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
