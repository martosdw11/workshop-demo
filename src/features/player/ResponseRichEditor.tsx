'use client';

import Image from '@tiptap/extension-image';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import type { ResponseDoc } from './types';

/**
 * ResponseRichEditor — rich editor untuk respons peserta (jawaban/komentar/issue).
 *
 * Pola yang sama dengan `features/builder/RichTextEditor`: **JSON adalah source
 * of truth** — `onChange` mengirim `editor.getJSON()` plus plain text untuk
 * validasi panjang di client; HTML dirender + disanitasi DI SERVER saat
 * menyimpan (§8.4). Editor ini tidak pernah mengirim HTML ke API.
 *
 * Toolbar dibatasi whitelist respons (`ALLOWED_RESPONSE_NODES/MARKS`): tanpa
 * heading (dicadangkan untuk materi) — node di luar whitelist akan dibuang
 * sanitasi server, jadi tombolnya tidak disediakan. Gambar tersedia dalam
 * mode insert-URL (https), kebijakan `src` sama dengan editor materi.
 */
function ToolbarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        active
          ? 'bg-primary-container text-on-primary-container'
          : 'text-on-surface-variant hover:bg-surface-container-high',
      )}
    >
      <MaterialIcon name={icon} className="text-[18px]" />
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const addLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL tautan (http/https/mailto):', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  /**
   * MODE INSERT-URL (sama dengan editor materi): gambar disisipkan lewat URL
   * yang sudah dihosting di tempat lain. Host non-https tetap dibuang sanitasi
   * server (`sanitizeResponseHtml`), validasi di sini hanya umpan balik dini.
   */
  const addImage = () => {
    const url = window.prompt('URL gambar (https):', 'https://');
    if (url === null || url === '' || url === 'https://') return;
    if (!/^https:\/\/.+/.test(url.trim())) {
      toast.error('URL gambar tidak valid. Gunakan tautan lengkap berawalan https://');
      return;
    }
    editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  return (
    <div
      role="toolbar"
      aria-label="Format respons"
      className="flex flex-wrap items-center gap-1 border-b border-outline-variant p-1.5"
    >
      <ToolbarButton
        icon="format_bold"
        label="Tebal"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon="format_italic"
        label="Miring"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon="format_list_bulleted"
        label="Daftar berpoin"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon="format_list_numbered"
        label="Daftar bernomor"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon="link"
        label="Tautan"
        active={editor.isActive('link')}
        onClick={addLink}
      />
      <ToolbarButton
        icon="code"
        label="Kode"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <ToolbarButton
        icon="data_object"
        label="Blok kode"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolbarButton icon="image" label="Sisipkan gambar dari URL" onClick={addImage} />
    </div>
  );
}

/** Cek rekursif keberadaan node `image` pada dokumen editor. */
function hasImageNode(node: unknown): boolean {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as { type?: unknown; content?: unknown };
  if (n.type === 'image') return true;
  return Array.isArray(n.content) && n.content.some(hasImageNode);
}

export function ResponseRichEditor({
  id,
  placeholder,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  placeholder: string;
  invalid?: boolean;
  describedBy?: string;
  /** `text` dipakai validasi panjang & optimistic update; `doc` dikirim ke API. */
  onChange: (value: { doc: ResponseDoc; text: string }) => void;
}) {
  const editor = useEditor({
    // Wajib di App Router: render pertama terjadi di server.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        link: { openOnClick: false, autolink: false, protocols: ['http', 'https', 'mailto'] },
      }),
      Image,
    ],
    content: { type: 'doc', content: [] },
    editorProps: {
      attributes: {
        id,
        class: 'prose-material min-h-32 px-4 py-3 focus:outline-none',
        'aria-label': placeholder,
        ...(invalid ? { 'aria-invalid': 'true' } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      },
    },
    onUpdate: ({ editor: instance }) => {
      const doc = instance.getJSON() as ResponseDoc;
      let text = instance.getText({ blockSeparator: '\n' });
      // Paritas dengan ekstraksi server (`renderResponseContent`): respons yang
      // hanya berisi gambar tetap dianggap terisi — server menyimpan placeholder
      // `[gambar]` sebagai plain text-nya.
      if (text.trim() === '' && hasImageNode(doc)) text = '[gambar]';
      onChange({ doc, text });
    },
  });

  if (!editor) {
    return (
      <div className="min-h-32 rounded-lg border border-outline-variant bg-surface-container-lowest" />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
