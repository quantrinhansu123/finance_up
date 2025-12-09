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
            TRY: 35 // Turkish Lira fallback rate
        };
    }
}

export function convertCurrency(amount: number, from: string, to: string, rates: ExchangeRates): number {
    if (from === to) return amount;
    const rateFrom = rates[from] || 1;
    const rateTo = rates[to] || 1;
    // Convert to USD first (since base is USD), then to target
    const amountInUSD = amount / rateFrom;
    return amountInUSD * rateTo;
}
