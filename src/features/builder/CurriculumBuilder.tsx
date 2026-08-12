'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { api, isApiError } from '@/lib/api-client';
import { messageForError } from '@/lib/error-messages';
import { qk } from '@/lib/query-keys';
import { CurriculumSummaryPanel } from './CurriculumSummaryPanel';
import { LessonItem } from './LessonItem';
import { ModuleItem } from './ModuleItem';
import type { MaterialNode, MaterialTreeResponse, TiptapDoc } from './types';

/**
 * CurriculumBuilder — TDD §6.7.
 *
 * **State lokal sebagai draft + autosave debounce 800 ms.** Setiap perubahan
 * field menulis ke draft di memori (sehingga `CurriculumSummaryPanel` ikut
 * berubah seketika, tanpa API), lalu 800 ms setelah ketikan terakhir dikirim
 * sebagai `PATCH /admin/materials/:id`. Tanpa debounce, satu kalimat judul akan
 * menjadi puluhan request.
 *
 * **Reorder mengirim SATU request** `PATCH /admin/events/:id/materials/reorder`
 * berisi seluruh tree (§6.7) — server yang menghitung ulang `order_index` dan
 * `sequence_index` dalam satu transaksi. `409 STALE_TREE` berarti struktur
 * berubah di sesi lain; UI meminta muat ulang, tidak memaksakan versinya.
 *
 * BATAS YANG DIPILIH SADAR: drag & drop memindahkan item **di dalam levelnya**
 * (modul di antara modul, lesson di dalam modulnya). Memindahkan lesson antar
 * modul lewat drag membutuhkan multi-container sortable; endpoint reorder
 * mendukungnya, tetapi UI-nya belum — dilaporkan sebagai keterbatasan, bukan
 * disembunyikan.
 */
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DEBOUNCE_MS = 800;

function countMaterials(tree: MaterialNode[]): number {
  return tree.reduce((total, node) => total + 1 + node.children.length, 0);
}

function sumPoints(tree: MaterialNode[]): number {
  return tree.reduce(
    (total, node) =>
      total + node.points + node.children.reduce((sub, child) => sub + child.points, 0),
    0,
  );
}

/** Bentuk payload reorder: seluruh tree, satu baris per materi. */
function toReorderItems(tree: MaterialNode[]) {
  const items: Array<{ id: number; parentId: number | null; orderIndex: number }> = [];
  tree.forEach((node, moduleIndex) => {
    items.push({ id: node.id, parentId: null, orderIndex: moduleIndex });
    node.children.forEach((child, lessonIndex) => {
      items.push({ id: child.id, parentId: node.id, orderIndex: lessonIndex });
    });
  });
  return items;
}

export function CurriculumBuilder({
  eventId,
  initialTree,
  lockedMaterialIds,
}: {
  eventId: number;
  initialTree: MaterialNode[];
  /** Materi yang sudah dikerjakan peserta (§4.6) — poinnya tetap boleh diubah. */
  lockedMaterialIds: number[];
}) {
  const queryClient = useQueryClient();
  const [tree, setTree] = React.useState<MaterialNode[]>(initialTree);
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const pendingRef = React.useRef(new Map<number, Partial<MaterialNode>>());
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Keyboard sensor — syarat aksesibilitas §7.7 PRD.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: qk.admin.events.materials(eventId) });
    void queryClient.invalidateQueries({ queryKey: qk.admin.events.detail(eventId) });
  }, [queryClient, eventId]);

  /** Mengirim seluruh perubahan yang tertunda (satu PATCH per materi). */
  const flushPending = React.useCallback(async () => {
    const pending = pendingRef.current;
    if (pending.size === 0) return;

    const entries = Array.from(pending.entries());
    pendingRef.current = new Map();
    setSaveState('saving');

    try {
      for (const [materialId, patch] of entries) {
        await api.patch(`/admin/materials/${materialId}`, patch);
      }
      setSaveState('saved');
      invalidate();
    } catch (error) {
      setSaveState('error');
      if (isApiError(error) && error.code === 'MATERIAL_LOCKED_BY_PROGRESS') {
        toast.error(messageForError(error));
      } else {
        toast.error(messageForError(error));
      }
    }
  }, [invalidate]);

  const queueSave = React.useCallback(
    (materialId: number, patch: Partial<MaterialNode>) => {
      const existing = pendingRef.current.get(materialId) ?? {};
      pendingRef.current.set(materialId, { ...existing, ...patch });

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flushPending(), AUTOSAVE_DEBOUNCE_MS);
    },
    [flushPending],
  );

  // Perubahan yang belum ter-flush tidak boleh hilang saat komponen dilepas.
  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const patchNode = (
    materialId: number,
    patch: Partial<Pick<MaterialNode, 'title' | 'points' | 'contentJson'>>,
  ) => {
    setTree((prev) =>
      prev.map((node) =>
        node.id === materialId
          ? { ...node, ...patch }
          : {
              ...node,
              children: node.children.map((child) =>
                child.id === materialId ? { ...child, ...patch } : child,
              ),
            },
      ),
    );
    queueSave(materialId, patch as Partial<MaterialNode>);
  };

  const addMaterial = useMutation({
    mutationFn: (input: { parentId: number | null; title: string }) =>
      api.post<{ material: MaterialNode; summary: { materialCount: number; totalPoints: number } }>(
        `/admin/events/${eventId}/materials`,
        { parentId: input.parentId, title: input.title, contentJson: null, points: 0 },
      ),
    onSuccess: (data, variables) => {
      const created: MaterialNode = { ...data.material, children: data.material.children ?? [] };
      setTree((prev) =>
        variables.parentId === null
          ? [...prev, created]
          : prev.map((node) =>
              node.id === variables.parentId
                ? { ...node, children: [...node.children, created] }
                : node,
            ),
      );
      invalidate();
    },
    onError: (error) => toast.error(messageForError(error)),
  });

  const deleteMaterial = useMutation({
    mutationFn: (materialId: number) => api.delete(`/admin/materials/${materialId}`),
    onSuccess: (_data, materialId) => {
      setTree((prev) =>
        prev
          .filter((node) => node.id !== materialId)
          .map((node) => ({
            ...node,
            children: node.children.filter((child) => child.id !== materialId),
          })),
      );
      invalidate();
    },
    // `409 MATERIAL_HAS_PROGRESS` sengaja tidak menghapus apa pun dari draft:
    // materinya memang masih ada di server.
    onError: (error) => toast.error(messageForError(error)),
  });

  const reorder = useMutation({
    mutationFn: (nextTree: MaterialNode[]) =>
      api.patch<{ tree: MaterialNode[] }>(`/admin/events/${eventId}/materials/reorder`, {
        items: toReorderItems(nextTree),
      }),
    onSuccess: (data) => {
      setTree(data.tree);
      invalidate();
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'STALE_TREE') {
        toast.error(messageForError(error), {
          action: { label: 'Muat ulang', onClick: () => window.location.reload() },
        });
        return;
      }
      toast.error(messageForError(error));
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);

    const moduleIndex = tree.findIndex((node) => node.id === activeId);
    if (moduleIndex >= 0) {
      const targetIndex = tree.findIndex((node) => node.id === overId);
      if (targetIndex < 0) return;
      const next = arrayMove(tree, moduleIndex, targetIndex);
      setTree(next);
      reorder.mutate(next);
      return;
    }

    // Lesson: hanya bergeser di dalam modul induknya.
    const parent = tree.find((node) => node.children.some((child) => child.id === activeId));
    if (!parent) return;
    const from = parent.children.findIndex((child) => child.id === activeId);
    const to = parent.children.findIndex((child) => child.id === overId);
    if (to < 0) return;

    const next = tree.map((node) =>
      node.id === parent.id ? { ...node, children: arrayMove(node.children, from, to) } : node,
    );
    setTree(next);
    reorder.mutate(next);
  };

  const materialCount = countMaterials(tree);
  const totalPoints = sumPoints(tree);

  return (
    <div className="grid grid-cols-1 gap-gutter lg:grid-cols-[1fr_280px]">
      <div>
        {tree.length === 0 ? (
          <EmptyState
            icon="account_tree"
            title="Belum ada materi"
            description="Tambahkan modul pertama untuk memulai kurikulum event ini."
            action={
              <Button onClick={() => addMaterial.mutate({ parentId: null, title: 'Modul baru' })}>
                <MaterialIcon name="add" />
                Add Module
              </Button>
            }
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tree.map((node) => node.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-4">
                {tree.map((node, moduleIndex) => (
                  <ModuleItem
                    key={node.id}
                    node={node}
                    index={moduleIndex}
                    isLocked={lockedMaterialIds.includes(node.id)}
                    onChange={(patch) => patchNode(node.id, patch)}
                    onDelete={() => deleteMaterial.mutate(node.id)}
                    onAddLesson={() =>
                      addMaterial.mutate({ parentId: node.id, title: 'Sub-materi baru' })
                    }
                  >
                    {node.children.length > 0 && (
                      <SortableContext
                        items={node.children.map((child) => child.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="flex flex-col gap-2 border-t border-outline-variant p-3">
                          {node.children.map((child, lessonIndex) => (
                            <LessonItem
                              key={child.id}
                              node={child}
                              index={lessonIndex}
                              parentIndex={moduleIndex}
                              isLocked={lockedMaterialIds.includes(child.id)}
                              onChange={(patch) => patchNode(child.id, patch)}
                              onDelete={() => deleteMaterial.mutate(child.id)}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    )}
                  </ModuleItem>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {tree.length > 0 && (
          <Button
            variant="secondary"
            className="mt-4 w-full"
            disabled={addMaterial.isPending}
            onClick={() => addMaterial.mutate({ parentId: null, title: 'Modul baru' })}
          >
            <MaterialIcon name="add" />
            Add Module
          </Button>
        )}
      </div>

      <CurriculumSummaryPanel
        moduleCount={tree.length}
        materialCount={materialCount}
        totalPoints={totalPoints}
        savingState={saveState}
      />
    </div>
  );
}

/** Dipakai halaman edit untuk menormalkan respons `GET …/materials`. */
export function normalizeTree(response: MaterialTreeResponse): MaterialNode[] {
  return response.tree.map((node) => ({ ...node, children: node.children ?? [] }));
}

export type { TiptapDoc };
