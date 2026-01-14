"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, X } from "lucide-react";

interface Option {
    id: string;
    label: string;
    subLabel?: string;
    icon?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    className?: string;
    disabled?: boolean;
    required?: boolean;
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Chọn một tùy chọn...",
    searchPlaceholder = "Gõ để tìm kiếm...",
    className = "",
    disabled = false,
    required = false
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = useMemo(() => options.find(o => o.id === value), [options, value]);

    const filteredOptions = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return options.filter(o =>
            o.label.toLowerCase().includes(lowerSearch) ||
            (o.subLabel && o.subLabel.toLowerCase().includes(lowerSearch))
        );
    }, [options, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm("");
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (optionId: string) => {
        onChange(optionId);
        setIsOpen(false);
        setSearchTerm("");
    };

    const handleInputFocus = () => {
        if (!disabled) {
            setIsOpen(true);
        }
    };

    const clearSelection = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange("");
        setSearchTerm("");
        if (inputRef.current) inputRef.current.focus();
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                className={`flex items-center glass-input p-1 rounded-lg transition-all ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${isOpen ? "ring-2 ring-blue-500/50 bg-[#1a1a1a]" : "bg-[#0f0f0f]"}`}
                onClick={() => !disabled && !isOpen && setIsOpen(true)}
            >
                {/* Icon for selected option */}
                {!isOpen && selectedOption?.icon && (
                    <div className="pl-3 py-2 text-lg">{selectedOption.icon}</div>
                )}

                <input
                    ref={inputRef}
                    type="text"
                    className="flex-1 bg-transparent border-none outline-none p-2 text-white placeholder-[var(--muted)] text-sm"
                    placeholder={selectedOption ? "" : placeholder}
                    value={isOpen ? searchTerm : (selectedOption ? selectedOption.label : "")}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={handleInputFocus}
                    readOnly={!isOpen && !!selectedOption}
                    disabled={disabled}
                />

                {/* Sub-label for selected option when NOT searching */}
                {!isOpen && selectedOption?.subLabel && (
                    <div className="text-[var(--muted)] text-xs px-2 truncate max-w-[150px]">
                        {selectedOption.subLabel}
                    </div>
                )}

                <div className="flex items-center pr-2 gap-1">
                    {value && !disabled && (
                        <button
                            type="button"
                            onClick={clearSelection}
                            className="p-1 hover:bg-white/10 rounded-full text-[var(--muted)] hover:text-white"
                        >
                            <X size={14} />
                        </button>
                    )}
                    <ChevronDown size={16} className={`text-[var(--muted)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-60 overflow-y-auto p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <div
                                    key={option.id}
                                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${option.id === value ? "bg-blue-600/30 text-blue-400" : "hover:bg-white/5 text-[var(--muted)] hover:text-white"}`}
                                    onClick={() => handleSelect(option.id)}
                                >
                                    <div className="flex items-center gap-3 truncate">
                                        {option.icon && <span className="text-xl">{option.icon}</span>}
                                        <div className="flex flex-col truncate">
                                            <span className="text-sm font-semibold">{option.label}</span>
                                            {option.subLabel && <span className="text-[10px] opacity-70 tracking-wider uppercase">{option.subLabel}</span>}
                                        </div>
                                    </div>
                                    {option.id === value && <Check size={14} />}
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-sm text-[var(--muted)]">
                                Không tìm thấy kết quả cho "{searchTerm}"
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* hidden input for form validation */}
            {required && (
                <input
                    type="text"
                    className="absolute opacity-0 w-0 h-0 pointer-events-none"
                    value={value}
                    required
                    readOnly
                />
            )}
        </div>
    );
}
