"use client";

import { useState, useMemo, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T> {
    key: string;
    header: string;
    width?: string;
    align?: "left" | "center" | "right";
    render?: (item: T, index: number) => ReactNode;
    className?: string;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    itemsPerPage?: number;
    onRowClick?: (item: T) => void;
    emptyMessage?: string;
    showIndex?: boolean;
    colorScheme?: "default" | "green" | "red" | "blue";
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
}: DataTableProps<T>) {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(data.length / itemsPerPage);
    
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return data.slice(start, start + itemsPerPage);
    }, [data, currentPage, itemsPerPage]);

    // Reset page when data changes
    useMemo(() => {
        if (currentPage > Math.ceil(data.length / itemsPerPage)) {
            setCurrentPage(1);
        }
    }, [data.length]);

    const getAlignClass = (align?: "left" | "center" | "right") => {
        switch (align) {
            case "center": return "text-center";
            case "right": return "text-right";
            default: return "text-left";
        }
    };

    return (
        <div className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-black/30 text-white/50 text-xs uppercase">
                        <tr>
                            {showIndex && <th className="p-3 w-12">#</th>}
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={`p-3 ${col.width || ""} ${getAlignClass(col.align)}`}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {paginatedData.map((item, index) => (
                            <tr
                                key={item.id || index}
                                className={`hover:bg-white/5 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                                onClick={() => onRowClick?.(item)}
                            >
                                {showIndex && (
                                    <td className="p-3 text-white/40">
                                        {(currentPage - 1) * itemsPerPage + index + 1}
                                    </td>
                                )}
                                {columns.map((col) => (
                                    <td
                                        key={col.key}
                                        className={`p-3 ${getAlignClass(col.align)} ${col.className || ""}`}
                                    >
                                        {col.render
                                            ? col.render(item, (currentPage - 1) * itemsPerPage + index)
                                            : (item as any)[col.key]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {paginatedData.length === 0 && (
                            <tr>
                                <td
                                    colSpan={columns.length + (showIndex ? 1 : 0)}
                                    className="p-8 text-center text-white/30"
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-white/10">
                    <div className="text-sm text-white/50">
                        Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, data.length)} / {data.length}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        
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
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                        currentPage === pageNum
                                            ? `${colorSchemes[colorScheme]} text-white`
                                            : "hover:bg-white/10 text-white/50"
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                        
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
