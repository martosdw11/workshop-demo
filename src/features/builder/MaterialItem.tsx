'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as React from 'react';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { PointsInput } from './PointsInput';
import { RichTextEditor } from './RichTextEditor';
import type { MaterialNode, TiptapDoc } from './types';

/**
 * `ModuleItem` (depth 0) & `LessonItem` (depth 1) — TDD §6.7.
 *
 * Keduanya berbagi satu implementasi karena bentuk editornya identik; yang
 * berbeda hanya indentasi, label, dan hak menambah anak (sub-materi tidak boleh
 * punya anak — batas 2 level, §2.4).
 *
 * Drag handle memakai `useSortable` dari `@dnd-kit`, yang mendukung **keyboard
 * sensor**: handle bisa difokus, lalu Space/panah memindahkan item (§7.7 PRD).
 */
export type MaterialItemProps = {
  node: MaterialNode;
  index: number;
  label: string;
  onChange: (patch: Partial<Pick<MaterialNode, 'title' | 'points' | 'contentJson'>>) => void;
  onDelete: () => void;
  onAddLesson?: () => void;
  isLocked: boolean;
  children?: React.ReactNode;
};

export function MaterialItem({
  node,
  label,
  onChange,
  onDelete,
  onAddLesson,
  isLocked,
  children,
}: MaterialItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });
  const [expanded, setExpanded] = React.useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const isLesson = node.depth === 1;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border border-outline-variant bg-surface-container-lowest',
        isDragging && 'opacity-60 shadow-level2',
        isLesson && 'bg-surface-container-low',
      )}
    >
      <div className="flex flex-wrap items-center gap-3 p-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Ubah urutan ${node.title || label}`}
          className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <MaterialIcon name="drag_indicator" />
        </button>

        <div className="min-w-0 flex-1">
          <Label htmlFor={`title-${node.id}`} className="sr-only">
            Judul {label}
          </Label>
          <Input
            id={`title-${node.id}`}
            value={node.title}
            placeholder={isLesson ? 'Judul sub-materi' : 'Judul materi'}
            onChange={(event) => onChange({ title: event.target.value })}
            className="border-0 bg-transparent px-0 text-title-md"
          />
          <span className="text-label-sm uppercase text-on-surface-variant">{label}</span>
        </div>

        <PointsInput
          id={`points-${node.id}`}
          value={node.points}
          onChange={(points) => onChange({ points })}
          disabled={isLocked}
        />

        <Button
          variant="ghost"
          size="icon"
          aria-expanded={expanded}
          aria-label={expanded ? 'Tutup editor konten' : 'Buka editor konten'}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <MaterialIcon name={expanded ? 'expand_less' : 'expand_more'} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={`Hapus ${label}`}
          onClick={onDelete}
          className="text-error hover:bg-error-container"
        >
          <MaterialIcon name="delete" />
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-outline-variant p-3">
          {isLocked && (
            <p className="mb-3 flex items-start gap-2 rounded-lg border border-tertiary-fixed-dim bg-tertiary-fixed/50 px-3 py-2 text-body-sm text-on-tertiary-fixed">
              <MaterialIcon name="info" className="text-[18px]" />
              Materi ini sudah dikerjakan peserta. Perubahan `points` hanya berlaku untuk peserta
              berikutnya — poin yang sudah diraih tidak dihitung ulang (TDD §4.6).
            </p>
          )}
          <RichTextEditor
            valueJson={node.contentJson}
            onChange={(doc: TiptapDoc) => onChange({ contentJson: doc })}
          />
        </div>
      )}

      {children}

      {onAddLesson && (
        <div className="border-t border-outline-variant p-3">
          <Button variant="ghost" size="sm" onClick={onAddLesson}>
            <MaterialIcon name="add" />
            Add Lesson
          </Button>
        </div>
      )}
    </li>
  );
}
