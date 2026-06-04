"use client";

import { Column } from "./DataTable";

export function createBulkSelectColumn<T extends { id: string }>(opts: {
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    canSelect: (item: T) => boolean;
    header?: string;
}): Column<T> {
    return {
        key: "select",
        header: opts.header ?? "Chọn",
        align: "center",
        width: "w-12",
        sortable: false,
        render: (item) =>
            opts.canSelect(item) ? (
                <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={opts.selectedIds.has(item.id)}
                        onChange={() => opts.onToggle(item.id)}
                        className="w-4 h-4 rounded border-white/30 accent-green-500 cursor-pointer"
                        aria-label="Chọn dòng"
                    />
                </div>
            ) : (
                <span className="text-white/20">—</span>
            ),
    };
}
