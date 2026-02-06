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
 * Formats a number to a currency string with thousands separators.
 * Example: 1000000 -> "1,000,000"
 */
export function formatCurrencyVN(value: number | string): string {
    if (value === "" || value === undefined || value === null) return "";
    // Handle both dot and comma separators during parsing for robustness
    const num = typeof value === "string" ? parseFloat(value.replace(/\./g, "").replace(/,/g, "")) : value;
    if (isNaN(num)) return "";
    // vi-VN uses . for thousands and , for decimals
    return num.toLocaleString("vi-VN");
}

/**
 * Parses a formatted currency string back to a number.
 * Example: "1,000,000" -> 1000000
 */
export function parseCurrencyVN(value: string): number {
    if (!value) return 0;
    // Remove dots (thousands separator in vi-VN)
    const cleanValue = value.replace(/\./g, "");
    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
}
