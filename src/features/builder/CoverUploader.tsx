'use client';

import * as React from 'react';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Button } from '@/components/ui/button';
import { ALLOWED_IMAGE_MIME } from '@/lib/constants';
import { messageForCode } from '@/lib/error-messages';
import type { UploadResult } from './types';

/**
 * CoverUploader — TDD §6.7 & §8.2.
 *
 * File dikirim `multipart/form-data` ke `POST /admin/uploads` dengan
 * `kind='cover'`. Validasi sebenarnya ada di server (MIME dari **magic bytes**,
 * bukan `Content-Type` kiriman browser, §8.2) — filter di sini hanya kenyamanan,
 * dan `413 FILE_TOO_LARGE` / `422 UNSUPPORTED_MEDIA_TYPE` tetap ditampilkan apa
 * adanya bila server menolak.
 *
 * Progress upload memakai `XMLHttpRequest`, bukan `fetch`: `fetch` tidak
 * mengekspos progres unggah sama sekali.
 */
export function CoverUploader({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const upload = (file: File) => {
    setError(null);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', 'cover');

    const request = new XMLHttpRequest();
    request.open('POST', '/api/v1/admin/uploads');
    request.withCredentials = true;

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    });

    request.addEventListener('load', () => {
      setProgress(null);
      try {
        const payload = JSON.parse(request.responseText) as
          | { data: UploadResult }
          | { error: { code: string } };

        if (request.status >= 200 && request.status < 300 && 'data' in payload) {
          onChange(payload.data.publicUrl);
          return;
        }
        const code = 'error' in payload ? payload.error.code : undefined;
        setError(messageForCodeSafely(code, request.status));
      } catch {
        setError(messageForCodeSafely(undefined, request.status));
      }
    });

    request.addEventListener('error', () => {
      setProgress(null);
      setError(messageForCode('NETWORK_ERROR'));
    });

    request.send(formData);
  };

  return (
    <div className="space-y-2">
      <span className="block text-label-md text-on-surface">Cover Event</span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-outline-variant bg-surface-container-high sm:w-64">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL dari adapter storage (§8.1), host-nya dari env.
            <img src={value} alt="Pratinjau cover event" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-on-surface-variant">
              <MaterialIcon name="image" className="text-[32px]" />
              <span className="text-label-sm">16:9 ratio (JPG, PNG, WebP)</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_IMAGE_MIME.join(',')}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              event.target.value = '';
            }}
          />

          <Button
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={progress !== null}
          >
            <MaterialIcon name="upload" />
            {progress !== null ? `Mengunggah ${progress}%` : value ? 'Ganti cover' : 'Unggah cover'}
          </Button>

          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange(null)} disabled={progress !== null}>
              <MaterialIcon name="delete" />
              Hapus cover
            </Button>
          )}

          <p className="max-w-xs text-label-sm text-on-surface-variant">
            Disarankan rasio 16:9. Maksimum 3 MB.
          </p>
        </div>
      </div>

      {progress !== null && (
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progres unggah cover"
          className="h-progress w-full overflow-hidden rounded-full bg-surface-container-high"
        >
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Upload memakai XHR (demi progres), sehingga amplop error §9.1 dibongkar
 * manual di sini — tapi TEKS-nya tetap datang dari peta kode yang sama dengan
 * seluruh aplikasi, bukan kalimat baru.
 */
function messageForCodeSafely(code: string | undefined, status: number): string {
  if (code) return messageForCode(code);
  if (status === 413) return messageForCode('FILE_TOO_LARGE');
  if (status === 422) return messageForCode('UNSUPPORTED_MEDIA_TYPE');
  if (status === 403) return messageForCode('FORBIDDEN');
  return messageForCode('INTERNAL_ERROR');
}
