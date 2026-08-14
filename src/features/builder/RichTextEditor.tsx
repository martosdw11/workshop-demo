'use client';

import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import type { TiptapDoc } from './types';

/**
 * RichTextEditor — TDD §6.7 & A-05.
 *
 * **JSON adalah source of truth**: `onChange` mengirim `editor.getJSON()`, dan
 * HTML untuk peserta dirender + disanitasi DI SERVER saat menyimpan (§8.4).
 * Editor ini tidak pernah mengirim HTML ke API.
 *
 * Toolbar dibatasi pada node/mark yang ada di whitelist §8.4 — menambahkan
 * tombol untuk node yang akan dibuang sanitasi hanya akan membuat admin
 * kehilangan pekerjaannya tanpa penjelasan.
 */
function ToolbarButton({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'bg-primary-container text-on-primary-container'
          : 'text-on-surface-variant hover:bg-surface-container-high',
      )}
    >
      <MaterialIcon name={icon} className="text-[20px]" />
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
   * MODE INSERT-URL (sementara): gambar disisipkan lewat URL yang sudah
   * dihosting di tempat lain, bukan upload file — storage persisten belum
   * dipasang di Vercel. Host non-https tetap akan dibuang sanitasi server (§8.4).
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
      aria-label="Format konten materi"
      className="flex flex-wrap items-center gap-1 border-b border-outline-variant p-2"
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

export function RichTextEditor({
  valueJson,
  onChange,
  disabled = false,
}: {
  valueJson: TiptapDoc | null;
  onChange: (doc: TiptapDoc) => void;
  disabled?: boolean;
}) {
  const editor = useEditor({
    // Wajib di App Router: render pertama terjadi di server.
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: false, protocols: ['http', 'https', 'mailto'] }),
      Image,
    ],
    // `TiptapDoc` (bentuk kontrak §3.4) memakai `unknown[]` untuk `content`,
    // sementara TipTap menuntut `JSONContent`. Keduanya bentuk dokumen yang
    // sama; cast di batas ini menghindari menyalin ulang seluruh tipe TipTap
    // ke dalam kontrak API hanya demi kepuasan compiler.
    content: (valueJson ?? { type: 'doc', content: [] }) as Record<string, unknown>,
    editorProps: {
      attributes: {
        class: 'prose-material min-h-40 px-4 py-3 focus:outline-none',
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON() as TiptapDoc),
  });

  if (!editor) {
    return (
      <div className="min-h-40 rounded-lg border border-outline-variant bg-surface-container-lowest" />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
      {!disabled && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
