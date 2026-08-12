'use client';

import * as React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';
import { TableSkeleton } from './LoadingSkeletons';

/**
 * DataTable<T> — TDD §6.2, gaya **borderless-row** dari `admin_participant_list`.
 *
 * Sengaja TIDAK memakai library tabel: kebutuhannya hanya render kolom, seleksi
 * baris, dan klik baris. Sorting/filtering di aplikasi ini dilakukan server
 * (kontrak §3 memakai query param + cursor), sehingga state tabel klien akan
 * menjadi sumber kebenaran kedua yang bisa melenceng.
 */
export type DataTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
};

export type DataTableProps<T> = {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string | number;
  selectable?: boolean;
  selected?: Array<string | number>;
  onSelectedChange?: (selected: Array<string | number>) => void;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  selectable = false,
  selected = [],
  onSelectedChange,
  onRowClick,
  isLoading = false,
  emptyTitle = 'Belum ada data',
  emptyDescription,
  className,
}: DataTableProps<T>) {
  const allKeys = rows.map(rowKey);
  const allSelected = allKeys.length > 0 && allKeys.every((key) => selected.includes(key));
  const someSelected = !allSelected && allKeys.some((key) => selected.includes(key));

  const toggleAll = () => {
    onSelectedChange?.(allSelected ? [] : allKeys);
  };

  const toggleOne = (key: string | number) => {
    onSelectedChange?.(
      selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key],
    );
  };

  if (isLoading) return <TableSkeleton columns={columns.length + (selectable ? 1 : 0)} />;

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} className="m-4" />;
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {selectable && (
            <TableHead className="w-11">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label="Pilih semua baris"
              />
            </TableHead>
          )}
          {columns.map((column) => (
            <TableHead key={column.id} className={column.headerClassName}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => {
          const key = rowKey(row);
          const isSelected = selected.includes(key);
          return (
            <TableRow
              key={key}
              data-state={isSelected ? 'selected' : undefined}
              // Baris yang bisa diklik harus bisa dicapai keyboard (§6.10).
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? 'button' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                onRowClick &&
                  'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
              )}
            >
              {selectable && (
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(key)}
                    aria-label="Pilih baris"
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell key={column.id} className={column.className}>
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
