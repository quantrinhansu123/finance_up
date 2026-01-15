"use client";

import { useState, useEffect } from "react";
import { Search, RotateCcw, Download, Plus, Filter, ChevronDown, ChevronUp } from "lucide-react";
import SearchableSelect from "./SearchableSelect";
import { useTranslation } from "@/lib/i18n";

export interface FilterConfig {
    id: string;
    label: string;
    options: { value: string; label: string }[];
    advanced?: boolean;
}

interface DataTableToolbarProps {
    searchPlaceholder?: string;
    onSearch: (value: string) => void;
    onReset: () => void;
    onExport: () => void;
    onAdd?: () => void;
    addLabel?: string;
    filters?: FilterConfig[];
    onFilterChange: (filterId: string, value: string) => void;
    activeFilters: Record<string, string>;
    enableDateRange?: boolean;
}

export default function DataTableToolbar({
    searchPlaceholder,
    onSearch,
    onReset,
    onExport,
    onAdd,
    addLabel,
    filters = [],
    onFilterChange,
    activeFilters,
    enableDateRange = false
}: DataTableToolbarProps) {
    const { t } = useTranslation();
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            onSearch(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, onSearch]);

    const hasAdvancedFilters = filters.some(f => f.advanced);
    const standardFilters = filters.filter(f => !f.advanced);
    const advancedFilters = filters.filter(f => f.advanced);

    const isAnyFilterActive = searchTerm !== "" || Object.values(activeFilters).some(v => v !== "");

    return (
        <div className="space-y-4">
            {/* Main Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Search - Left */}
                <div className="relative flex-1 min-w-[240px]">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                        type="text"
                        placeholder={searchPlaceholder || t("search_default")}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                    />
                </div>

                {/* Standard Filters */}
                {standardFilters.map(filter => (
                    <div key={filter.id} className="min-w-[180px]">
                        <SearchableSelect
                            options={filter.options.map(opt => ({ id: opt.value, label: opt.label }))}
                            value={activeFilters[filter.id] || ""}
                            onChange={(val) => onFilterChange(filter.id, val)}
                            placeholder={filter.label}
                            className="w-full"
                        />
                    </div>
                ))}

                {/* Advanced Toggle */}
                {hasAdvancedFilters && (
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold transition-all ${showAdvanced ? "bg-orange-500/20 border-orange-500/50 text-orange-400" : "bg-white/5 border-white/10 text-[var(--muted)] hover:text-white"}`}
                    >
                        <Filter size={16} />
                        <span className="text-sm">{t("advanced_filter")}</span>
                        {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                )}

                {/* Action Buttons - Right */}
                <div className="flex items-center gap-2 ml-auto">
                    {isAnyFilterActive && (
                        <button
                            onClick={() => {
                                setSearchTerm("");
                                onReset();
                            }}
                            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[var(--muted)] hover:text-white hover:bg-white/10 transition-all"
                            title={t("reset")}
                        >
                            <RotateCcw size={18} />
                        </button>
                    )}

                    <button
                        onClick={onExport}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/10 border border-blue-600/20 text-blue-400 font-bold hover:bg-blue-600/20 transition-all"
                    >
                        <Download size={18} />
                        <span className="text-sm hidden sm:inline">{t("export_excel")}</span>
                    </button>

                    {onAdd && (
                        <button
                            onClick={onAdd}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/20"
                        >
                            <Plus size={20} />
                            <span className="text-sm">{addLabel || t("add_new_default")}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Advanced Filters Expandable Area */}
            {showAdvanced && (advancedFilters.length > 0 || enableDateRange) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Date Range Filters */}
                    {enableDateRange && (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase tracking-wider font-bold text-[var(--muted)] ml-1">
                                    {t("from_date")}
                                </label>
                                <input
                                    type="date"
                                    value={activeFilters.startDate || ""}
                                    onChange={(e) => onFilterChange("startDate", e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase tracking-wider font-bold text-[var(--muted)] ml-1">
                                    {t("to_date")}
                                </label>
                                <input
                                    type="date"
                                    value={activeFilters.endDate || ""}
                                    onChange={(e) => onFilterChange("endDate", e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                />
                            </div>
                        </>
                    )}

                    {advancedFilters.map(filter => (
                        <div key={filter.id} className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-[var(--muted)] ml-1">
                                {filter.label}
                            </label>
                            <SearchableSelect
                                options={filter.options.map(opt => ({ id: opt.value, label: opt.label }))}
                                value={activeFilters[filter.id] || ""}
                                onChange={(val) => onFilterChange(filter.id, val)}
                                placeholder={t("all_placeholder")}
                                className="w-full"
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
