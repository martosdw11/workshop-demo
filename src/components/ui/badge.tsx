import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Badge — pill dengan background low-opacity dan teks berkontras tinggi
 * (DESIGN.md "Badges").
 *
 * Varian mengikuti semantik warna WAJIB di TDD §6.1:
 *   answer → `primary` · comment → neutral/`on-surface-variant` ·
 *   issue → `error` (blocker) / `tertiary` (pending) · completed & poin →
 *   `secondary` / `tertiary-container`.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-label-sm whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-container-high text-on-surface-variant',
        answer: 'bg-primary-fixed text-on-primary-fixed',
        comment: 'bg-surface-container-high text-on-surface-variant',
        issue: 'bg-error-container text-on-error-container',
        pending: 'bg-tertiary-fixed text-on-tertiary-fixed',
        completed: 'bg-secondary-fixed text-on-secondary-fixed',
        points: 'bg-tertiary-fixed text-on-tertiary-fixed',
        primary: 'bg-primary-container text-on-primary-container',
        outline: 'border border-outline-variant bg-transparent text-on-surface-variant',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
