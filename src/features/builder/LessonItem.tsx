'use client';

import { MaterialItem, type MaterialItemProps } from './MaterialItem';

/**
 * LessonItem — TDD §6.7 (sub-materi, `depth = 1`).
 * TIDAK menerima `onAddLesson`: sub-materi tidak boleh punya anak lagi — batas
 * dua level ditegakkan `CHECK depth IN (0,1)` + trigger di database (§2.4),
 * dan UI di sini tidak menawarkan jalan untuk melanggarnya.
 */
export function LessonItem(
  props: Omit<MaterialItemProps, 'label' | 'onAddLesson' | 'children'> & {
    index: number;
    parentIndex: number;
  },
) {
  return <MaterialItem {...props} label={`Lesson ${props.parentIndex + 1}.${props.index + 1}`} />;
}
