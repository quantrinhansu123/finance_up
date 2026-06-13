"use client";

import React, { useState, useEffect } from "react";
import {
    formatAmountInputDisplay,
    formatCurrencyVN,
    normalizeAmountInput,
    usesDotThousandsSeparator,
} from "@/lib/currency";

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
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (isFocused) return;
        if (value === "" || value === undefined || value === null) {
            setDisplayValue("");
        } else {
            setDisplayValue(formatCurrencyVN(value, currency));
        }
    }, [value, isFocused, currency]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value.replace(/[^\d.,]/g, "");

        if (input === "") {
            setDisplayValue("");
            onChange("");
            return;
        }

        const canonical = normalizeAmountInput(input, currency);
        if (!canonical) return;

        setDisplayValue(
            usesDotThousandsSeparator(currency)
                ? formatAmountInputDisplay(input, currency)
                : input
        );
        onChange(canonical);
    };

    const handleBlur = () => {
        setIsFocused(false);
        if (!displayValue) {
            onChange("");
            return;
        }
        const canonical = normalizeAmountInput(displayValue, currency);
        if (!canonical || canonical === ".") {
            setDisplayValue("");
            onChange("");
            return;
        }
        const num = parseFloat(canonical);
        if (isNaN(num)) {
            setDisplayValue("");
            onChange("");
            return;
        }
        setDisplayValue(formatCurrencyVN(num, currency));
        onChange(num.toString());
    };

    return (
        <div className="relative">
            <input
                type="text"
                value={displayValue}
                onChange={handleChange}
                onFocus={() => setIsFocused(true)}
                onBlur={handleBlur}
                placeholder={placeholder}
                className={`glass-input w-full p-3 pr-16 rounded-xl text-lg font-semibold focus:outline-none transition-colors ${className}`}
                required={required}
                disabled={disabled}
                inputMode="decimal"
            />
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold ${currency === 'VND' ? 'text-rose-400' :
                currency === 'USD' ? 'text-blue-400' :
                    currency === 'KHR' ? 'text-emerald-400' :
                        currency === 'TRY' ? 'text-orange-400' :
                            currency === 'MMK' ? 'text-yellow-400' :
                                'text-green-400'
                }`}>
                {currency}
            </span>
        </div>
    );
}
