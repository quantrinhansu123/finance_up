"use client";

import { useState, useMemo, ReactNode } from "react";
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export interface Column<T> {
    key: string;
    header: string;
    width?: string;
    align?: "left" | "center" | "right";
    render?: (item: T, index: number) => ReactNode;
    className?: string;
    sortable?: boolean;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    itemsPerPage?: number;
    onRowClick?: (item: T) => void;
    emptyMessage?: string;
    showIndex?: boolean;
    colorScheme?: "default" | "green" | "red" | "blue";
    maxWidth?: string; // e.g., "max-w-4xl", "max-w-2xl"
    layout?: "table" | "grid" | "auto"; // auto is table on desktop, card on mobile
}

const colorSchemes = {
    default: "bg-blue-500",
    green: "bg-green-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
};

export default function DataTable<T extends { id?: string }>({
    data,
    columns,
    itemsPerPage = 15,
    onRowClick,
    emptyMessage = "Không có dữ liệu",
    showIndex = true,
    colorScheme = "default",
    maxWidth = "w-full",
    layout = "auto",
}: DataTableProps<T>) {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({
        key: "",
        direction: null,
    });

    const handleSort = (key: string) => {
        let direction: "asc" | "desc" | null = "asc";
        if (sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        } else if (sortConfig.key === key && sortConfig.direction === "desc") {
            direction = null;
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) return data;

        return [...data].sort((a, b) => {
            const aVal = (a as any)[sortConfig.key];
            const bVal = (b as any)[sortConfig.key];

            if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
    }, [data, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(start, start + itemsPerPage);
    }, [sortedData, currentPage, itemsPerPage]);

    // Reset page when data changes
    useMemo(() => {
        if (currentPage > Math.ceil(sortedData.length / itemsPerPage)) {
            setCurrentPage(1);
        }
    }, [sortedData.length, itemsPerPage]);

    const getAlignClass = (align?: "left" | "center" | "right") => {
        switch (align) {
            case "center": return "text-center";
            case "right": return "text-right";
            default: return "text-left";
        }
    };

    return (
        <div className={`glass-card rounded-xl overflow-hidden ${maxWidth} ${maxWidth !== "w-full" ? "mx-auto" : ""}`}>
            {/* Desktop Table View */}
            {(layout === "table" || layout === "auto") && (
                <div className={`${layout === "auto" ? "hidden md:block" : ""} overflow-x-auto`}>
                    <table className="w-full text-left text-[15px]">
                        <thead className="bg-black/30 text-white/50 text-xs uppercase font-bold tracking-wider">
                            <tr>
                                {showIndex && <th className="p-4 w-12">#</th>}
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        className={`p-4 ${col.width || ""} ${getAlignClass(col.align)} ${col.sortable !== false ? "cursor-pointer hover:text-white transition-colors" : ""}`}
                                        onClick={() => col.sortable !== false && handleSort(col.key)}
                                    >
                                        <div className={`flex items-center gap-2 ${col.align === "center" ? "justify-center" : col.align === "right" ? "justify-end" : ""}`}>
                                            {col.header}
                                            {col.sortable !== false && (
                                                <span className="text-white/20">
                                                    {sortConfig.key === col.key ? (
                                                        sortConfig.direction === "asc" ? <ArrowUp size={14} className="text-blue-400" /> : <ArrowDown size={14} className="text-blue-400" />
                                                    ) : (
                                                        <ArrowUpDown size={14} />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-medium">
                            {paginatedData.map((item, index) => (
                                <tr
                                    key={item.id || index}
                                    className={`hover:bg-white/5 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                                    onClick={() => onRowClick?.(item)}
                                >
                                    {showIndex && (
                                        <td className="p-4 text-white/40">
                                            {(currentPage - 1) * itemsPerPage + index + 1}
                                        </td>
                                    )}
                                    {columns.map((col) => (
                                        <td
                                            key={col.key}
                                            className={`p-4 ${getAlignClass(col.align)} ${col.className || ""}`}
                                        >
                                            {col.render
                                                ? col.render(item, (currentPage - 1) * itemsPerPage + index)
                                                : (item as any)[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Card View (Mobile by default, or Desktop if layout='grid') */}
            {(layout === "grid" || layout === "auto") && (
                <div className={`${layout === "auto" ? "md:hidden" : ""} divide-y md:divide-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:p-4 divide-white/5`}>
                    {paginatedData.map((item, index) => (
                        <div
                            key={item.id || index}
                            className={`p-4 space-y-3 active:bg-white/5 md:bg-white/5 md:rounded-xl md:border md:border-white/5 md:hover:border-white/20 transition-all ${onRowClick ? "cursor-pointer" : ""}`}
                            onClick={() => onRowClick?.(item)}
                        >
                            {/* Card Header (using first column) */}
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 overflow-hidden">
                                    {columns[0].render
                                        ? columns[0].render(item, (currentPage - 1) * itemsPerPage + index)
                                        : (item as any)[columns[0].key]}
                                </div>
                                {showIndex && (
                                    <span className="text-xs font-bold text-white/20">
                                        #{(currentPage - 1) * itemsPerPage + index + 1}
                                    </span>
                                )}
                            </div>

                            {/* Card Details (other columns) */}
                            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                                {columns.slice(1).map((col) => {
                                    const isActions = col.key === "actions";
                                    return (
                                        <div
                                            key={col.key}
                                            className={`${isActions ? "col-span-2 pt-2 flex justify-center border-t border-white/5" : "flex flex-col gap-1"}`}
                                        >
                                            {!isActions && (
                                                <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider">
                                                    {col.header}
                                                </span>
                                            )}
                                            <div className={`text-[14px] ${getAlignClass(col.align)}`}>
                                                {col.render
                                                    ? col.render(item, (currentPage - 1) * itemsPerPage + index)
                                                    : (item as any)[col.key]}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {paginatedData.length === 0 && (
                <div className="p-10 text-center text-white/30 text-lg">
                    {emptyMessage}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-white/10 gap-4">
                    <div className="text-sm text-white/50 order-2 sm:order-1">
                        Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, sortedData.length)} / {sortedData.length}
                    </div>
                    <div className="flex items-center gap-1 order-1 sm:order-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setCurrentPage(p => Math.max(1, p - 1)); }}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={18} />
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={(e) => { e.stopPropagation(); setCurrentPage(pageNum); }}
                                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                                            ? `${colorSchemes[colorScheme as keyof typeof colorSchemes]} text-white`
                                            : "hover:bg-white/10 text-white/50"
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={(e) => { e.stopPropagation(); setCurrentPage(p => Math.min(totalPages, p + 1)); }}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper components for common cell types
export function AmountCell({ amount, type, currency }: { amount: number; type: "IN" | "OUT"; currency: string }) {
    return (
        <span className={`font-semibold ${type === "IN" ? "text-green-400" : "text-red-400"}`}>
            {type === "IN" ? "+" : "-"}{amount.toLocaleString()} {currency}
        </span>
    );
}

export function StatusBadge({ status }: { status: "APPROVED" | "PENDING" | "REJECTED" | string }) {
    const styles = {
        APPROVED: "bg-green-500/20 text-green-400",
        PENDING: "bg-yellow-500/20 text-yellow-400",
        REJECTED: "bg-red-500/20 text-red-400",
    };
    const labels = {
        APPROVED: "Đã duyệt",
        PENDING: "Chờ duyệt",
        REJECTED: "Từ chối",
    };
    return (
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${styles[status as keyof typeof styles] || "bg-white/10 text-white/50"}`}>
            {labels[status as keyof typeof labels] || status}
        </span>
    );
}

export function DateCell({ date }: { date: string }) {
    return (
        <span className="text-white/70">
            {new Date(date).toLocaleDateString("vi-VN")}
        </span>
    );
}

export function TextCell({ primary, secondary }: { primary: string; secondary?: string }) {
    return (
        <div>
            <div className="text-white font-medium">{primary}</div>
            {secondary && <div className="text-xs text-white/40 truncate max-w-[150px]">{secondary}</div>}
        </div>
    );
}

export function ImageCell({ images }: { images?: string[] }) {
    if (!images || images.length === 0) {
        return <span className="text-white/30">-</span>;
    }
    return (
        <div className="flex justify-center gap-1">
            {images.map((img, i) => (
                <a
                    key={i}
                    href={img}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lg hover:text-blue-400 transition-colors"
                    title="Xem ảnh"
                    onClick={(e) => e.stopPropagation()}
                >
                    📎
                </a>
            ))}
        </div>
    );
}

export function ActionCell({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
            {children}
        </div>
    );
}
