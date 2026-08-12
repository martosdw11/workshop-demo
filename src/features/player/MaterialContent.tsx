import { EmptyState } from '@/components/shared/EmptyState';

/**
 * MaterialContent — TDD §6.6 & §8.4.
 *
 * `html` di sini adalah `materials.content_html` yang **sudah tersanitasi di
 * server** (`lib/sanitize-html.ts` dipanggil service layer saat menyimpan).
 * Komponen ini SENGAJA tidak menambahkan sanitasi, parsing, atau pembersihan
 * apa pun di client: menambah lapisan kedua akan menyiratkan bahwa lapisan
 * pertama boleh dilewati, padahal §8.4 menetapkan sanitasi HANYA di server.
 *
 * Kelas `prose-material` memetakan gaya typography ke token design system
 * (globals.css) dan memakai skala `body-lg` untuk konten pembelajaran (§7.3).
 */
export function MaterialContent({ html }: { html: string | null }) {
  if (!html || html.trim() === '') {
    return (
      <EmptyState
        icon="description"
        title="Materi ini belum memiliki konten"
        description="Admin belum mengisi konten untuk materi ini. Anda tetap dapat mengirim respons di bawah."
      />
    );
  }

  return (
    <div
      className="prose-material mb-8"
      // HTML sudah tersanitasi DI SERVER (§8.4) — ini satu-satunya tempat di
      // aplikasi yang boleh merender HTML mentah, dan hanya untuk `content_html`.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
