"use client";

import { useState, useMemo, ReactNode } from "react";
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";

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
    maxWidth = "w-full",
    layout = "auto",
    emptyMessage,
    showIndex = true,
    colorScheme = "default",
}: DataTableProps<T>) {
    const { t, language } = useTranslation();
    const [currentPage, setCurrentPage] = useState(1);
    const finalEmptyMessage = emptyMessage || t("no_data");
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
        <div className={`glass-card rounded-2xl overflow-hidden border border-white/5 relative group/table ${maxWidth} ${maxWidth !== "w-full" ? "mx-auto" : ""}`}>
            {/* Design Accents */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent z-20" />

            {/* Desktop Table View */}
            {(layout === "table" || layout === "auto") && (
                <div className={`${layout === "auto" ? "hidden md:block" : ""} overflow-x-auto relative`}>
                    <div className="absolute inset-0 bg-grid-white opacity-[0.02] pointer-events-none" />

                    <table className={`w-full text-left text-[14px] border-collapse ${columns.length < 5 ? "max-w-5xl mx-auto" : ""}`}>
                        <thead className="bg-white/[0.03] backdrop-blur-md text-white/40 text-[11px] uppercase font-bold tracking-[0.1em] border-b border-white/5 relative z-10">
                            <tr className="group/th-row">
                                {showIndex && <th className="p-4 w-12 text-center">#</th>}
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        className={`p-0 ${col.width || ""} ${col.sortable !== false ? "cursor-pointer hover:bg-white/[0.02] transition-colors" : ""}`}
                                        onClick={() => col.sortable !== false && handleSort(col.key)}
                                    >
                                        <div className={`flex items-center gap-2 py-4 px-4 ${col.align === "center" ? "justify-center" : col.align === "right" ? "justify-end" : ""}`}>
                                            <span className="relative">
                                                {col.header}
                                                {sortConfig.key === col.key && (
                                                    <motion.div layoutId="sortUnderline" className="absolute -bottom-1 left-0 w-full h-[1px] bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                                )}
                                            </span>
                                            {col.sortable !== false && (
                                                <span className="transition-all duration-300 opacity-20 group-hover/th-row:opacity-100">
                                                    {sortConfig.key === col.key ? (
                                                        sortConfig.direction === "asc" ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
                                                    ) : (
                                                        <ArrowUpDown size={12} />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04] font-medium relative z-10">
                            <AnimatePresence mode="popLayout">
                                {paginatedData.map((item, index) => (
                                    <motion.tr
                                        key={item.id || index}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.98 }}
                                        transition={{ duration: 0.2, delay: index * 0.02 }}
                                        className={`group/row hover:bg-white/[0.03] transition-all duration-300 relative ${onRowClick ? "cursor-pointer" : ""}`}
                                        onClick={() => onRowClick?.(item)}
                                    >
                                        {showIndex && (
                                            <td className="p-4 text-white/20 text-xs font-mono group-hover/row:text-blue-400 transition-colors text-center border-l-2 border-transparent group-hover/row:border-blue-500/50">
                                                {((currentPage - 1) * itemsPerPage + index + 1).toString().padStart(2, '0')}
                                            </td>
                                        )}
                                        {columns.map((col) => (
                                            <td
                                                key={col.key}
                                                className={`p-4 text-white/70 group-hover/row:text-white transition-colors ${getAlignClass(col.align)} ${col.className || ""}`}
                                            >
                                                {col.render
                                                    ? col.render(item, (currentPage - 1) * itemsPerPage + index)
                                                    : (item as any)[col.key]}
                                            </td>
                                        ))}
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Card View (Mobile) */}
            {(layout === "grid" || layout === "auto") && (
                <div className={`${layout === "auto" ? "md:hidden" : ""} divide-y divide-white/5`}>
                    {paginatedData.map((item, index) => (
                        <div
                            key={item.id || index}
                            className={`p-4 space-y-3 active:bg-white/5 transition-all ${onRowClick ? "cursor-pointer" : ""}`}
                            onClick={() => onRowClick?.(item)}
                        >
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1">
                                    {columns[0].render
                                        ? columns[0].render(item, (currentPage - 1) * itemsPerPage + index)
                                        : (item as any)[columns[0].key]}
                                </div>
                                {showIndex && (
                                    <span className="text-xs font-mono text-white/20">
                                        #{(currentPage - 1) * itemsPerPage + index + 1}
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {columns.slice(1).map((col) => {
                                    const isActions = col.key === "actions";
                                    return (
                                        <div key={col.key} className={`${isActions ? "col-span-2 pt-2 border-t border-white/5" : ""}`}>
                                            {!isActions && (
                                                <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider">
                                                    {col.header}
                                                </span>
                                            )}
                                            <div className="text-[14px]">
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
                <div className="p-16 text-center text-white/20 text-lg italic tracking-wide">
                    {finalEmptyMessage}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white/[0.01] border-t border-white/5 gap-4 relative z-20">
                    <div className="text-[12px] text-white/30 font-medium order-2 sm:order-1 flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        {t("showing")} <span className="text-white/60">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, sortedData.length)}</span> {t("of")} <span className="text-white/60">{sortedData.length}</span>
                    </div>
                    <div className="flex items-center gap-2 order-1 sm:order-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setCurrentPage(p => Math.max(1, p - 1)); }}
                            disabled={currentPage === 1}
                            className="p-2 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/10 disabled:opacity-20 transition-all active:scale-90"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) pageNum = i + 1;
                                else if (currentPage <= 3) pageNum = i + 1;
                                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = currentPage - 2 + i;

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={(e) => { e.stopPropagation(); setCurrentPage(pageNum); }}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === pageNum
                                            ? `bg-gradient-to-br ${colorSchemes[colorScheme as keyof typeof colorSchemes]} text-white shadow-lg shadow-blue-500/20`
                                            : "hover:bg-white/5 text-white/40 hover:text-white"
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
                            className="p-2 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/10 disabled:opacity-20 transition-all active:scale-90"
                        >
                            <ChevronRight size={16} />
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
    const { t } = useTranslation();
    const styles = {
        APPROVED: "bg-green-500/20 text-green-400 border border-green-500/20",
        PENDING: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/20",
        REJECTED: "bg-red-500/20 text-red-400 border border-red-500/20",
    };
    const labels = {
        APPROVED: t("approved"),
        PENDING: t("pending"),
        REJECTED: t("rejected"),
    };
    return (
        <span className={`px-2 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider ${styles[status as keyof typeof styles] || "bg-white/10 text-white/50 border border-white/10"}`}>
            {labels[status as keyof typeof labels] || status}
        </span>
    );
}

export function DateCell({ date }: { date: string }) {
    const { language } = useTranslation();
    return (
        <span className="text-white/60 font-mono text-xs">
            {new Date(date).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US")}
        </span>
    );
}

export function TextCell({ primary, secondary }: { primary: string; secondary?: string }) {
    return (
        <div className="flex flex-col gap-0.5">
            <div className="text-white font-semibold leading-tight">{primary}</div>
            {secondary && <div className="text-[11px] text-white/30 truncate max-w-[180px] font-medium">{secondary}</div>}
        </div>
    );
}

export function ImageCell({ images }: { images?: string[] }) {
    if (!images || images.length === 0) {
        return <span className="text-white/10">-</span>;
    }
    return (
        <div className="flex justify-center gap-1.5">
            {images.map((img, i) => (
                <a
                    key={i}
                    href={img}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 px-2 rounded-md bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-blue-500/30 transition-all text-[10px]"
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
        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
            {children}
        </div>
    );
}
