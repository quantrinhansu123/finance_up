export interface ExchangeRates {
    [key: string]: number;
}

const API_URL = "https://api.exchangerate-api.com/v4/latest/USD";
const CACHE_KEY = "exchange_rates_usd";
const CACHE_DURATION = 3600 * 1000 * 6; // 6 hours

export async function getExchangeRates(): Promise<ExchangeRates> {
    // Try to get from localStorage if on client
    if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { rates, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION) {
                return rates;
            }
        }
    }

    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error("Failed to fetch rates");
        const data = await res.json();
        const rates = data.rates;

        // Save to localStorage if on client
        if (typeof window !== 'undefined') {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                rates,
                timestamp: Date.now()
            }));
        }

        return rates;
    } catch (error) {
        console.error("Currency fetch error:", error);
        // Fallback rates if API fails
        return {
            USD: 1,
            VND: 25400,
            KHR: 4100,
            TRY: 35,
            MMK: 2100,
            THB: 35,
            LAK: 21000,
            MYR: 4.7,
            IDR: 15700,
            PHP: 56,
            SGD: 1.35
        };
    }
}

export const CURRENCY_METADATA: Record<string, { flag: string, name: string }> = {
    VND: { flag: "🇻🇳", name: "Việt Nam Đồng" },
    USD: { flag: "🇺🇸", name: "US Dollar" },
    KHR: { flag: "🇰🇭", name: "Cambodian Riel" },
    TRY: { flag: "🇹🇷", name: "Turkish Lira" },
    MMK: { flag: "🇲🇲", name: "Myanmar Kyat" },
    THB: { flag: "🇹🇭", name: "Thai Baht" },
    LAK: { flag: "🇱🇦", name: "Lao Kip" },
    MYR: { flag: "🇲🇾", name: "Malaysian Ringgit" },
    IDR: { flag: "🇮🇩", name: "Indonesian Rupiah" },
    PHP: { flag: "🇵🇭", name: "Philippine Peso" },
    SGD: { flag: "🇸🇬", name: "Singapore Dollar" },
};

export function getCurrencyFlag(currency: string): string {
    return CURRENCY_METADATA[currency]?.flag || "💰";
}

export function getCurrencyName(currency: string): string {
    return CURRENCY_METADATA[currency]?.name || currency;
}

export function convertCurrency(amount: number, from: string, to: string, rates: ExchangeRates): number {
    if (from === to) return amount;
    const rateFrom = rates[from] || 1;
    const rateTo = rates[to] || 1;
    // Convert to USD first (since base is USD), then to target
    const amountInUSD = amount / rateFrom;
    return amountInUSD * rateTo;
}

/**
 * Normalizes user-facing amount text (vi-VN or international) to a canonical string
 * with dot as decimal separator, e.g. "1.234,56" -> "1234.56", "12." while typing -> "12."
 */
export function normalizeAmountInput(input: string): string {
    const raw = input.trim().replace(/\s/g, "").replace(/[^\d.,]/g, "");
    if (!raw) return "";

    if (raw.includes(",")) {
        const commaIdx = raw.indexOf(",");
        if (raw.indexOf(",", commaIdx + 1) !== -1) return "";

        const intPart = raw.slice(0, commaIdx).replace(/\./g, "");
        const decPart = raw.slice(commaIdx + 1).replace(/[.,]/g, "");
        if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart)) return "";
        if (raw.endsWith(",") && decPart === "") return intPart ? `${intPart}.` : ".";
        return decPart ? `${intPart}.${decPart}` : intPart;
    }

    const dotCount = (raw.match(/\./g) || []).length;
    if (dotCount === 0) return raw;

    if (dotCount === 1) {
        const [intPart, decPart] = raw.split(".");
        if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart)) return "";
        if (raw.endsWith(".")) return `${intPart}.`;
        return decPart ? `${intPart}.${decPart}` : intPart;
    }

    const lastDot = raw.lastIndexOf(".");
    const afterLast = raw.slice(lastDot + 1);
    const beforeLast = raw.slice(0, lastDot).replace(/\./g, "");
    if (/^\d{1,2}$/.test(afterLast) && /^\d*$/.test(beforeLast)) {
        return `${beforeLast}.${afterLast}`;
    }
    return raw.replace(/\./g, "");
}

/**
 * Formats a number to a currency string with thousands separators (vi-VN locale).
 * Example: 1000000 -> "1.000.000", 1234.5 -> "1.234,5"
 */
export function formatCurrencyVN(value: number | string): string {
    if (value === "" || value === undefined || value === null) return "";
    if (typeof value === "string" && value.endsWith(".")) {
        const intPart = value.slice(0, -1);
        if (!intPart) return ",";
        const num = parseFloat(intPart);
        if (isNaN(num)) return "";
        return `${num.toLocaleString("vi-VN")},`;
    }
    const num =
        typeof value === "string"
            ? parseFloat(normalizeAmountInput(value) || value)
            : value;
    if (isNaN(num)) return "";
    return num.toLocaleString("vi-VN", { maximumFractionDigits: 10 });
}

/**
 * Parses a formatted currency string back to a number.
 * Example: "1.234.567,89" -> 1234567.89
 */
export function parseCurrencyVN(value: string): number {
    if (!value) return 0;
    const canonical = normalizeAmountInput(value);
    if (!canonical || canonical === ".") return 0;
    const num = parseFloat(canonical);
    return isNaN(num) ? 0 : num;
}
