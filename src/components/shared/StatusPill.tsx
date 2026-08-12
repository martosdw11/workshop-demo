import { Badge } from '@/components/ui/badge';
import { MaterialIcon } from './MaterialIcon';

/**
 * StatusPill — TDD §6.2.
 *
 * Label domain diambil PERSIS dari PRD §3.A.3 (campuran ID/EN):
 * `Belum diikuti` / `Sedang diikuti` / `Selesai`. Teksnya TIDAK boleh
 * diterjemahkan atau diseragamkan.
 */
export type StatusPillVariant =
  | 'not-joined'
  | 'in-progress'
  | 'completed'
  | 'open'
  | 'resolved'
  | 'draft'
  | 'published'
  | 'finished'
  | 'active'
  | 'inactive';

const CONFIG: Record<
  StatusPillVariant,
  { label: string; variant: React.ComponentProps<typeof Badge>['variant']; icon?: string }
> = {
  // Badge keikutsertaan di kartu katalog (PRD §3.A.3)
  'not-joined': { label: 'Belum diikuti', variant: 'outline' },
  'in-progress': { label: 'Sedang diikuti', variant: 'primary', icon: 'play_circle' },
  completed: { label: 'Selesai', variant: 'completed', icon: 'check_circle' },

  // Status issue (responses.issue_status)
  open: { label: 'Open', variant: 'pending', icon: 'report_problem' },
  resolved: { label: 'Resolved', variant: 'completed', icon: 'task_alt' },

  // Status event (events.status)
  draft: { label: 'Draft', variant: 'neutral' },
  published: { label: 'Published', variant: 'primary' },
  finished: { label: 'Finished', variant: 'completed' },

  // Status akun (users.status)
  active: { label: 'Active', variant: 'completed' },
  inactive: { label: 'Inactive', variant: 'neutral' },
};

export function StatusPill({
  variant,
  className,
  label,
}: {
  variant: StatusPillVariant;
  className?: string;
  /** Override teks bila konteks butuh kata lain (mis. "Belum ada"). */
  label?: string;
}) {
  const config = CONFIG[variant];
  return (
    <Badge variant={config.variant} className={className}>
      {config.icon && <MaterialIcon name={config.icon} filled className="text-[14px]" />}
      {label ?? config.label}
    </Badge>
  );
}
