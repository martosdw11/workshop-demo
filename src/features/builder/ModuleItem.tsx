'use client';

import { MaterialItem, type MaterialItemProps } from './MaterialItem';

/**
 * ModuleItem — TDD §6.7 (materi utama, `depth = 0`).
 * Satu-satunya yang boleh punya anak; tombol **Add Lesson** ada di sini.
 */
export function ModuleItem(props: Omit<MaterialItemProps, 'label'> & { index: number }) {
  return <MaterialItem {...props} label={`Modul ${props.index + 1}`} />;
}
