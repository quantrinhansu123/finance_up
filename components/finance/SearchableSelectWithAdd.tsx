"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, Plus } from "lucide-react";

interface Option {
    id: string;
    label: string;
    subLabel?: string;
    icon?: string;
}

interface SearchableSelectWithAddProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    onAddNew?: () => void;
    placeholder?: string;
    searchPlaceholder?: string;
    className?: string;
    disabled?: boolean;
    required?: boolean;
    addNewLabel?: string;
}

export default function SearchableSelectWithAdd({
    options,
    value,
    onChange,
    onAddNew,
    placeholder = "Chọn...",
    searchPlaceholder = "Tìm kiếm...",
    className = "",
    disabled = false,
    required = false,
    addNewLabel = "Thêm mới"
}: SearchableSelectWithAddProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.id === value);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm("");
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (optionId: string) => {
        onChange(optionId);
        setIsOpen(false);
        setSearchTerm("");
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange("");
    };

    const handleAddNew = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onAddNew) {
            onAddNew();
            setIsOpen(false);
            setSearchTerm("");
        }
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Selected Value Display */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full p-3 bg-black/30 border border-white/10 rounded-xl text-left flex items-center justify-between transition-all ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-white/20 cursor-pointer"
                    } ${isOpen ? "border-blue-500/50 ring-2 ring-blue-500/20" : ""}`}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {selectedOption ? (
                        <>
                            {selectedOption.icon && <span className="text-lg shrink-0">{selectedOption.icon}</span>}
                            <div className="flex-1 min-w-0">
                                <div className="text-white truncate">{selectedOption.label}</div>
                                {selectedOption.subLabel && (
                                    <div className="text-xs text-[var(--muted)] truncate">{selectedOption.subLabel}</div>
                                )}
                            </div>
                        </>
                    ) : (
                        <span className="text-[var(--muted)]">{placeholder}</span>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {value && !disabled && (
                        <div
                            onClick={handleClear}
                            className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleClear(e as any);
                                }
                            }}
                        >
                            <X size={14} className="text-[var(--muted)]" />
                        </div>
                    )}
                    <svg
                        className={`w-4 h-4 text-[var(--muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl max-h-80 overflow-hidden flex flex-col">
                    {/* Search Input */}
                    <div className="p-3 border-b border-white/10">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full pl-10 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white placeholder-[var(--muted)] focus:outline-none focus:border-blue-500/50"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto flex-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleSelect(option.id)}
                                    className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 ${value === option.id ? "bg-blue-500/10 text-blue-400" : "text-white"
                                        }`}
                                >
                                    {option.icon && <span className="text-lg shrink-0">{option.icon}</span>}
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate">{option.label}</div>
                                        {option.subLabel && (
                                            <div className="text-xs text-[var(--muted)] truncate">{option.subLabel}</div>
                                        )}
                                    </div>
                                    {value === option.id && (
                                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-[var(--muted)] text-sm">
                                Không tìm thấy kết quả
                            </div>
                        )}
                    </div>

                    {/* Add New Button */}
                    {onAddNew && (
                        <div className="border-t border-white/10">
                            <button
                                type="button"
                                onClick={handleAddNew}
                                className="w-full px-4 py-3 text-left hover:bg-blue-500/10 transition-colors flex items-center gap-2 text-blue-400 font-medium"
                            >
                                <Plus size={16} />
                                {addNewLabel}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
