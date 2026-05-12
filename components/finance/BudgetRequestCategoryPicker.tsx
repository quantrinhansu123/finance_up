"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";

interface Props {
    value: string[];
    onChange: (next: string[]) => void;
    suggestions: string[];
    disabled?: boolean;
}

export default function BudgetRequestCategoryPicker({ value, onChange, suggestions, disabled }: Props) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const optionPool = useMemo(() => {
        const set = new Set<string>();
        for (const s of suggestions) {
            const t = s.trim();
            if (t) set.add(t);
        }
        for (const v of value) {
            const t = v.trim();
            if (t) set.add(t);
        }
        return Array.from(set);
    }, [suggestions, value]);

    const filtered = useMemo(() => {
        const q = draft.trim().toLowerCase();
        if (!q) return [...optionPool].sort((a, b) => a.localeCompare(b, "vi"));
        return optionPool.filter((s) => s.toLowerCase().includes(q)).sort((a, b) => a.localeCompare(b, "vi"));
    }, [optionPool, draft]);

    const add = (name: string) => {
        const t = name.trim();
        if (!t || value.includes(t)) return;
        onChange([...value, t]);
        setDraft("");
        setOpen(false);
    };

    const remove = (name: string) => {
        onChange(value.filter((x) => x !== name));
        setOpen(false);
    };

    const commitDraft = () => {
        const t = draft.trim();
        if (t) add(t);
    };

    return (
        <div ref={containerRef} className="relative z-0 space-y-2">
            <div className="flex flex-wrap gap-2 min-h-[2.5rem] items-center">
                {value.map((tag) => (
                    <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-200 text-sm font-medium"
                    >
                        {tag}
                        {!disabled && (
                            <button
                                type="button"
                                onClick={() => remove(tag)}
                                className="p-0.5 hover:bg-white/20 rounded text-blue-100"
                                aria-label={`Bỏ ${tag}`}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </span>
                ))}
                {value.length === 0 && <span className="text-white/35 text-sm">Chưa chọn hạng mục</span>}
            </div>

            {!disabled && (
                <>
                    <div className="relative">
                        <div
                            className={`flex items-center glass-input rounded-xl p-1 border-white/10 ${open ? "ring-2 ring-blue-500/40" : ""}`}
                        >
                            <input
                                className="flex-1 bg-transparent border-none outline-none p-2.5 text-white text-sm placeholder:text-white/35"
                                placeholder="Gõ tìm trong danh sách hoặc thêm hạng mục mới — Enter để thêm"
                                value={draft}
                                onChange={(e) => {
                                    setDraft(e.target.value);
                                    setOpen(true);
                                }}
                                onFocus={() => setOpen(true)}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                        e.preventDefault();
                                        setOpen(false);
                                        return;
                                    }
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        if (filtered.length === 1 && draft.trim() && filtered[0].toLowerCase() === draft.trim().toLowerCase()) {
                                            add(filtered[0]);
                                        } else {
                                            commitDraft();
                                        }
                                    }
                                }}
                            />
                            <ChevronDown
                                className={`text-white/40 mr-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                                size={18}
                                aria-hidden
                            />
                        </div>
                        {open && (
                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl max-h-[min(70vh,32rem)] overflow-y-auto overscroll-contain p-1">
                                {filtered.length === 0 ? (
                                    <div className="p-3 text-sm text-white/50 text-center">
                                        {draft.trim() ? (
                                            <>Nhấn Enter để thêm «{draft.trim()}»</>
                                        ) : (
                                            <>Không có gợi ý — gõ tên hạng mục</>
                                        )}
                                    </div>
                                ) : (
                                    filtered.map((opt) => {
                                        const sel = value.includes(opt);
                                        return (
                                            <button
                                                key={opt}
                                                type="button"
                                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${sel ? "bg-blue-600/25 text-blue-300" : "hover:bg-white/10 text-white/85"}`}
                                                onClick={() => (sel ? remove(opt) : add(opt))}
                                            >
                                                {sel ? "✓ " : ""}
                                                {opt}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                    <p className="text-[11px] text-white/35">Chọn nhiều hạng mục; có thể gõ tên mới và Enter.</p>
                </>
            )}
        </div>
    );
}
