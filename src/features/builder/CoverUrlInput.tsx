'use client';

import * as React from 'react';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * CoverUrlInput — pengganti sementara CoverUploader (TDD §6.7).
 *
 * MODE INSERT-URL: selama storage persisten belum dipasang (filesystem Vercel
 * ephemeral, STORAGE_DRIVER masih `local`), admin menempelkan URL gambar yang
 * sudah dihosting di tempat lain alih-alih mengunggah file. Endpoint
 * `POST /admin/uploads` sengaja dibiarkan hidup supaya kembali ke mode upload
 * nanti cukup menukar komponen ini.
 *
 * URL diterapkan saat blur/Enter, bukan per ketukan — supaya pratinjau tidak
 * mencoba memuat URL yang baru setengah diketik.
 */
export function CoverUrlInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [draft, setDraft] = React.useState(value ?? '');
  const [error, setError] = React.useState<string | null>(null);

  // Sinkron ketika parent mengganti nilai (mis. reset form / muat event lain).
  React.useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const apply = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      setError(null);
      onChange(null);
      return;
    }
    if (!/^https?:\/\/.+/.test(trimmed)) {
      setError('URL cover tidak valid. Gunakan tautan lengkap berawalan http(s)://');
      return;
    }
    setError(null);
    onChange(trimmed);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="cover-url">Cover Event</Label>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-outline-variant bg-surface-container-high sm:w-64">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL eksternal yang ditempel admin; host disaring saat sanitasi (§8.4).
            <img src={value} alt="Pratinjau cover event" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-on-surface-variant">
              <MaterialIcon name="image" className="text-[32px]" />
              <span className="text-label-sm">16:9 ratio (JPG, PNG, WebP)</span>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 sm:max-w-sm">
          <Input
            id="cover-url"
            type="url"
            inputMode="url"
            placeholder="https://contoh.com/gambar-cover.jpg"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={apply}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                apply();
              }
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby="cover-url-hint"
          />

          {value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft('');
                setError(null);
                onChange(null);
              }}
            >
              <MaterialIcon name="delete" />
              Hapus cover
            </Button>
          )}

          <p id="cover-url-hint" className="text-label-sm text-on-surface-variant">
            Tempel URL gambar yang sudah dihosting (disarankan rasio 16:9, https).
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
