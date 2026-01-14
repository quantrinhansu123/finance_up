"use client";

import React, { useState, useEffect } from "react";
import { formatCurrencyVN, parseCurrencyVN } from "@/lib/currency";

interface CurrencyInputProps {
    value: string | number;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    currency?: string;
    required?: boolean;
    disabled?: boolean;
}

export default function CurrencyInput({
    value,
    onChange,
    placeholder = "0",
    className = "",
    currency = "USD",
    required = false,
    disabled = false
}: CurrencyInputProps) {
    const [displayValue, setDisplayValue] = useState("");

    // Sync display value with external value
    useEffect(() => {
        if (value === "" || value === undefined || value === null) {
            setDisplayValue("");
        } else {
            const formatted = formatCurrencyVN(value);
            setDisplayValue(formatted);
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;

        // Only allow numbers and commas
        const cleanInput = input.replace(/[^\d]/g, "");

        if (cleanInput === "") {
            setDisplayValue("");
            onChange("");
            return;
        }

        const numValue = parseInt(cleanInput, 10);
        if (isNaN(numValue)) return;

        // Update display with formatting
        setDisplayValue(numValue.toLocaleString("en-US"));

        // Update parent with numeric string
        onChange(numValue.toString());
    };

    return (
        <div className="relative">
            <input
                type="text"
                value={displayValue}
                onChange={handleChange}
                placeholder={placeholder}
                className={`glass-input w-full p-3 pr-16 rounded-xl text-lg font-semibold focus:outline-none transition-colors ${className}`}
                required={required}
                disabled={disabled}
                inputMode="numeric"
            />
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold ${currency === 'VND' ? 'text-red-400' :
                    currency === 'USD' ? 'text-blue-400' : 'text-green-400'
                }`}>
                {currency}
            </span>
        </div>
    );
}
