"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Column<T> {
  key: keyof T | "actions";
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface AdminTableProps<T extends { id: number }> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  deleteAction?: (formData: FormData) => void;
  total?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

export function AdminTable<T extends { id: number }>({
  data,
  columns,
  searchPlaceholder = "Cari...",
  onSearch,
  onEdit,
  onDelete,
  deleteAction,
  total,
  hasMore,
  onLoadMore,
  loadingMore,
}: AdminTableProps<T>) {
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<T | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    onSearch?.(value);
  };

  const handleDelete = (item: T) => {
    if (!deleteAction) return;

    const formData = new FormData();
    formData.set("id", String(item.id));

    startTransition(async () => {
      try {
        await deleteAction(formData);
        setDeleteConfirm(null);
        router.refresh();
      } catch (error) {
        console.error("Delete failed:", error);
      }
    });
  };

  return (
    <div className="space-y-3">
      {onSearch && (
        <div className="flex gap-2">
          <input
            type="search"
            className="admin-field flex-1"
            placeholder={searchPlaceholder}
            value={search}
            onChange={handleSearch}
          />
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-[var(--ink-2)]">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id}>
                  {columns.map((col) => (
                    <td key={String(col.key)}>
                      {col.key === "actions" ? (
                        <div className="flex gap-2">
                          {onEdit && (
                            <button
                              type="button"
                              className="admin-btn admin-btn-soft text-xs"
                              onClick={() => onEdit(item)}
                            >
                              Edit
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              className="admin-btn admin-btn-danger text-xs"
                              onClick={() => setDeleteConfirm(item)}
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      ) : col.render ? (
                        col.render(item)
                      ) : (
                        String(item[col.key] ?? "")
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total !== undefined && (
        <p className="text-xs text-[var(--ink-2)]">
          Menampilkan {data.length} dari {total} data
        </p>
      )}

      {hasMore && onLoadMore && (
        <button
          type="button"
          className="admin-btn admin-btn-soft"
          onClick={onLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Memuat..." : "Muat Lebih Banyak"}
        </button>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Konfirmasi Hapus</h3>
            <p className="text-[var(--ink-2)] mb-4">
              Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => setDeleteConfirm(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={isPending}
              >
                {isPending ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--line)]">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}