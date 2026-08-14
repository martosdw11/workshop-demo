'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { api, isApiError } from '@/lib/api-client';
import { messageForError } from '@/lib/error-messages';
import { createEventSchema } from '@/lib/validation/event';
import { CoverUrlInput } from './CoverUrlInput';
import type { AdminEvent } from './types';

/**
 * EventInfoForm — TDD §6.7, PRD §3.B.7 Step 1.
 *
 * Field: Judul, Deskripsi, jadwal datetime start–end, Kuota, Cover.
 *
 * Validasi memakai `createEventSchema` dari `lib/validation` — skema YANG SAMA
 * dengan Route Handler, termasuk aturan `endAt > startAt`. Input `datetime-local`
 * memberi waktu LOKAL tanpa timezone, jadi ia dikonversi ke ISO UTC sebelum
 * dikirim (A-07: semua waktu disimpan UTC).
 */
type FormValues = {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  quota: string;
  coverUrl: string | null;
};

/** `2026-08-12T09:30` (nilai `datetime-local`) → ISO UTC. */
function localToIso(value: string): string {
  return new Date(value).toISOString();
}

/** ISO UTC → nilai `datetime-local` di timezone browser. */
function isoToLocal(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function EventInfoForm({
  event,
  onSaved,
}: {
  event: AdminEvent | null;
  onSaved?: (event: AdminEvent) => void;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<FormValues>({
    title: event?.title ?? '',
    description: event?.description ?? '',
    startAt: event ? isoToLocal(event.startAt) : '',
    endAt: event ? isoToLocal(event.endAt) : '',
    quota: event?.quota != null ? String(event.quota) : '',
    coverUrl: event?.coverUrl ?? null,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const submit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    setErrors({});

    if (!values.startAt || !values.endAt) {
      setErrors({
        ...(values.startAt ? {} : { startAt: 'Tanggal mulai wajib diisi.' }),
        ...(values.endAt ? {} : { endAt: 'Tanggal selesai wajib diisi.' }),
      });
      return;
    }

    const payload = {
      title: values.title,
      description: values.description || null,
      startAt: localToIso(values.startAt),
      endAt: localToIso(values.endAt),
      quota: values.quota === '' ? null : Number(values.quota),
      coverUrl: values.coverUrl,
    };

    const parsed = createEventSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'title');
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const result = event
        ? await api.patch<{ event: AdminEvent }>(`/admin/events/${event.id}`, parsed.data)
        : await api.post<{ event: AdminEvent }>('/admin/events', parsed.data);

      toast.success(event ? 'Info event diperbarui' : 'Event dibuat sebagai draft');

      if (onSaved) onSaved(result.event);
      else router.push(`/admin/events/${result.event.id}/edit?step=2`);
      router.refresh();
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) {
        setErrors(error.fieldErrors);
      } else {
        toast.error(messageForError(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={`${key}-error`} role="alert" className="text-body-sm text-error">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6" noValidate>
      <div className="space-y-2">
        <Label htmlFor="title">Judul Event</Label>
        <Input
          id="title"
          value={values.title}
          onChange={(changeEvent) => setField('title', changeEvent.target.value)}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? 'title-error' : undefined}
          placeholder="mis. Advanced Machine Learning"
        />
        {fieldError('title')}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Deskripsi</Label>
        <Textarea
          id="description"
          value={values.description}
          onChange={(changeEvent) => setField('description', changeEvent.target.value)}
          aria-invalid={errors.description ? true : undefined}
          placeholder="Ringkasan singkat yang tampil di kartu katalog."
          className="min-h-24"
        />
        {fieldError('description')}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startAt">Mulai</Label>
          <Input
            id="startAt"
            type="datetime-local"
            value={values.startAt}
            onChange={(changeEvent) => setField('startAt', changeEvent.target.value)}
            aria-invalid={errors.startAt ? true : undefined}
          />
          {fieldError('startAt')}
        </div>

        <div className="space-y-2">
          <Label htmlFor="endAt">Selesai</Label>
          <Input
            id="endAt"
            type="datetime-local"
            value={values.endAt}
            onChange={(changeEvent) => setField('endAt', changeEvent.target.value)}
            aria-invalid={errors.endAt ? true : undefined}
          />
          {fieldError('endAt')}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quota">Kuota Peserta</Label>
        <Input
          id="quota"
          type="number"
          min={1}
          value={values.quota}
          onChange={(changeEvent) => setField('quota', changeEvent.target.value)}
          aria-invalid={errors.quota ? true : undefined}
          aria-describedby="quota-hint"
          placeholder="Kosongkan untuk tanpa batas"
          className="max-w-48"
        />
        <p id="quota-hint" className="text-label-sm text-on-surface-variant">
          Kosongkan bila event tidak dibatasi jumlah peserta.
        </p>
        {fieldError('quota')}
      </div>

      <CoverUrlInput value={values.coverUrl} onChange={(url) => setField('coverUrl', url)} />
      {fieldError('coverUrl')}

      <Button type="submit" disabled={submitting}>
        <MaterialIcon name="save" />
        {submitting ? 'Menyimpan…' : event ? 'Simpan perubahan' : 'Simpan & lanjut ke kurikulum'}
      </Button>
    </form>
  );
}
