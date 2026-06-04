"use client";

import { Trash2 } from "lucide-react";

type Accent = "green" | "red" | "blue" | "amber";

const accentStyles: Record<Accent, string> = {
    green: "border-green-500/20 bg-green-500/5",
    red: "border-red-500/20 bg-red-500/5",
    blue: "border-blue-500/20 bg-blue-500/5",
    amber: "border-amber-500/20 bg-amber-500/5",
};

interface BulkSelectionBarProps {
    selectableCount: number;
    selectedCount: number;
    allSelected: boolean;
    onToggleAll: () => void;
    onClear: () => void;
    onBulkDelete: () => void;
    bulkDeleting?: boolean;
    processingLabel?: string;
    itemLabel?: string;
    accent?: Accent;
}

export default function BulkSelectionBar({
    selectableCount,
    selectedCount,
    allSelected,
    onToggleAll,
    onClear,
    onBulkDelete,
    bulkDeleting = false,
    processingLabel = "Đang xử lý...",
    itemLabel = "mục",
    accent = "green",
}: BulkSelectionBarProps) {
    if (selectableCount === 0) return null;

    return (
        <div
            className={`glass-card rounded-xl border px-4 py-3 flex flex-wrap items-center gap-3 text-sm ${accentStyles[accent]}`}
        >
            <label className="flex items-center gap-2 cursor-pointer text-white/80">
                <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    className="w-4 h-4 rounded border-white/30 accent-green-500"
                />
                <span>
                    Chọn tất cả ({selectableCount})
                </span>
            </label>
            {selectedCount > 0 && (
                <>
                    <span className="text-[var(--muted)]">
                        Đã chọn{" "}
                        <span className="text-white font-bold tabular-nums">{selectedCount}</span>{" "}
                        {itemLabel}
                    </span>
                    <button
                        type="button"
                        onClick={onClear}
                        className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-[var(--muted)] hover:text-white hover:bg-white/5"
                    >
                        Bỏ chọn
                    </button>
                    <button
                        type="button"
                        onClick={onBulkDelete}
                        disabled={bulkDeleting}
                        className="ml-auto px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 flex items-center gap-1.5"
                    >
                        <Trash2 size={14} />
                        {bulkDeleting ? processingLabel : `Xóa ${selectedCount} ${itemLabel}`}
                    </button>
                </>
            )}
        </div>
    );
}
