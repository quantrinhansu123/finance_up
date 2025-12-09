"use client";

import { useEffect, useState, useMemo } from "react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts";
import { getTransactions, getAccounts, getRevenues, getFixedCosts, getProjects } from "@/lib/finance";
import { Transaction, Account, Currency, MonthlyRevenue, Fund, FixedCost, Project } from "@/types/finance";
import { canViewGlobalStats, getUserRole, Role, getAccessibleProjects } from "@/lib/permissions";
import { getExchangeRates, convertCurrency } from "@/lib/currency";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];
const FUND_COLORS: Record<string, string> = {
    "Ads": "#f472b6",
    "Vận hành": "#60a5fa",
    "Lương": "#34d399",
    "SIM": "#fbbf24",
    "Văn phòng": "#a78bfa",
    "Marketing": "#fb923c"
};

const CURRENCY_COLORS: Record<string, string> = {
    "VND": "#ef4444",
    "USD": "#3b82f6",
    "KHR": "#22c55e",
    "TRY": "#f59e0b"
};

type ViewPeriod = "day" | "month" | "quarter" | "year";

// Category mapping for fixed costs
const FIXED_COST_CATEGORIES = [
    { key: "Lương nhân sự", label: "Lương nhân sự", icon: "👥" },
    { key: "Thuê văn phòng", label: "Thuê văn phòng", icon: "🏢" },
    { key: "Cước vận chuyển", label: "Cước vận chuyển", icon: "🚚" },
    { key: "Marketing/Ads", label: "Marketing/Ads", icon: "📢" },
    { key: "Vận hành", label: "Vận hành", icon: "⚙️" },
    { key: "SIM", label: "SIM", icon: "📱" },
    { key: "Thuế", label: "Thuế", icon: "📋" },
    { key: "Khác", label: "Khác", icon: "📦" }
];

export default function DashboardPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [revenues, setRevenues] = useState<MonthlyRevenue[]>([]);
    const [funds, setFunds] = useState<Fund[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [userRole, setUserRole] = useState<Role>("STAFF");
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [viewPeriod, setViewPeriod] = useState<ViewPeriod>("month");
    const [rates, setRates] = useState<any>({});

    // NEW: Filters
    const [filterProject, setFilterProject] = useState<string>("");
    const [filterCurrency, setFilterCurrency] = useState<Currency | "ALL">("ALL");

    // Summary Metrics
    const [totalBalance, setTotalBalance] = useState(0);
    const [periodIn, setPeriodIn] = useState(0);
    const [periodOut, setPeriodOut] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);

    // NEW: Balance by currency (không quy đổi)
    const [balanceByCurrency, setBalanceByCurrency] = useState<Record<Currency, number>>({} as any);

    // Fund Expenses
    const [fundExpenses, setFundExpenses] = useState<Record<string, number>>({});

    // Category Stats
    const [categoryTotals, setCategoryTotals] = useState<Record<string, { in: number, out: number }>>({});
    const [dailyCategoryStats, setDailyCategoryStats] = useState<any[]>([]);
    
    // Project Stats
    const [projectStats, setProjectStats] = useState<Record<string, { in: number, out: number, budget: number }>>({});

    // NEW: Fixed Cost Summary by Category
    const [fixedCostSummary, setFixedCostSummary] = useState<Record<string, { amount: number, currency: Currency, count: number }>>({});

    // NEW: Salary Report Data
    const [salaryReport, setSalaryReport] = useState<any[]>([]);

    // Chart Data
    const [chartData, setChartData] = useState<any[]>([]);
    const [catData, setCatData] = useState<any[]>([]);
    const [categoryTrendData, setCategoryTrendData] = useState<any[]>([]);
    const [salaryRatios, setSalaryRatios] = useState<any[]>([]);

    // NEW: Currency breakdown chart data
    const [currencyBreakdown, setCurrencyBreakdown] = useState<any[]>([]);

    // Warnings
    const [highValueTxs, setHighValueTxs] = useState<Transaction[]>([]);
    const [pendingTxs, setPendingTxs] = useState<Transaction[]>([]);

    // UI State for tables
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [dailySearchTerm, setDailySearchTerm] = useState("");
    const [showAllDays, setShowAllDays] = useState(false);
    const [showAllProjects, setShowAllProjects] = useState(false);
    const [showFixedCostDetails, setShowFixedCostDetails] = useState(false);

    // Get accessible projects based on user role
    const accessibleProjects = useMemo(() => {
        return getAccessibleProjects(currentUser, projects);
    }, [currentUser, projects]);

    useEffect(() => {
        const u = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (u) {
            const parsedUser = JSON.parse(u);
            const computedRole = getUserRole(parsedUser);
            setUserRole(computedRole);
            setCurrentUser(parsedUser);
        }

        const loadData = async () => {
            setLoading(true);
            try {
                const [txs, accs, exchangeRates, revsData, fundsData, projectsData, fixedCostsData] = await Promise.all([
                    getTransactions(),
                    getAccounts(),
                    getExchangeRates(),
                    getRevenues(),
                    getDocs(collection(db, "finance_funds")).then(s => s.docs.map(d => ({ id: d.id, ...d.data() } as Fund))),
                    getProjects(),
                    getFixedCosts()
                ]);

                setTransactions(txs);
                setRevenues(revsData);
                setFunds(fundsData);
                setAccounts(accs);
                setProjects(projectsData);
                setFixedCosts(fixedCostsData);
                setRates(exchangeRates);

                // Calculate balance by currency (không quy đổi)
                const byCurrency: Record<Currency, number> = { VND: 0, USD: 0, KHR: 0, TRY: 0 };
                let totalUSD = 0;
                accs.forEach(acc => {
                    byCurrency[acc.currency] = (byCurrency[acc.currency] || 0) + acc.balance;
                    totalUSD += convertCurrency(acc.balance, acc.currency, "USD", exchangeRates);
                });
                setBalanceByCurrency(byCurrency);
                setTotalBalance(totalUSD);

                // Calculate fixed cost summary by category
                const fcSummary: Record<string, { amount: number, currency: Currency, count: number }> = {};
                fixedCostsData.filter(fc => fc.status === "ON").forEach(fc => {
                    const cat = fc.category || "Khác";
                    if (!fcSummary[cat]) {
                        fcSummary[cat] = { amount: 0, currency: fc.currency, count: 0 };
                    }
                    // Convert to same currency for summary (use first currency found)
                    const converted = convertCurrency(fc.amount, fc.currency, fcSummary[cat].currency, exchangeRates);
                    fcSummary[cat].amount += converted;
                    fcSummary[cat].count++;
                });
                setFixedCostSummary(fcSummary);

                calculateMetrics(txs, exchangeRates, viewPeriod, revsData, fundsData, projectsData, "", "ALL");

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Recalculate when period or filters change
    useEffect(() => {
        if (transactions.length > 0) {
            calculateMetrics(transactions, rates, viewPeriod, revenues, funds, projects, filterProject, filterCurrency);
        }
    }, [viewPeriod, filterProject, filterCurrency]);

    const calculateMetrics = (
        txs: Transaction[], 
        exchangeRates: any, 
        period: ViewPeriod, 
        revs: MonthlyRevenue[], 
        fundsData: Fund[], 
        projectsData: Project[],
        projectFilter: string,
        currencyFilter: Currency | "ALL"
    ) => {
        const now = new Date();
        let pIn = 0;
        let pOut = 0;
        let pending = 0;
        const monthlyStats: Record<string, { in: number, out: number }> = {};
        const catStats: Record<string, number> = {};
        const fundStats: Record<string, number> = {};
        const highValue: Transaction[] = [];
        const pendingList: Transaction[] = [];
        
        const catTotals: Record<string, { in: number, out: number }> = {};
        const dailyStats: Record<string, Record<string, { in: number, out: number }>> = {};
        const projStats: Record<string, { in: number, out: number, budget: number }> = {};

        // Currency breakdown
        const currencyIn: Record<string, number> = { VND: 0, USD: 0, KHR: 0, TRY: 0 };
        const currencyOut: Record<string, number> = { VND: 0, USD: 0, KHR: 0, TRY: 0 };

        // Salary report data
        const salaryData: any[] = [];

        fundsData.forEach(f => {
            fundStats[f.name] = 0;
        });
        
        projectsData.forEach(p => {
            projStats[p.id] = { 
                in: 0, 
                out: 0, 
                budget: p.budget || 0 
            };
        });

        // Filter transactions
        let filteredTxs = txs;
        if (projectFilter) {
            filteredTxs = filteredTxs.filter(tx => tx.projectId === projectFilter);
        }
        if (currencyFilter !== "ALL") {
            filteredTxs = filteredTxs.filter(tx => tx.currency === currencyFilter);
        }

        filteredTxs.forEach(tx => {
            const d = new Date(tx.date);
            const amountUSD = currencyFilter === "ALL" 
                ? convertCurrency(tx.amount, tx.currency, "USD", exchangeRates)
                : tx.amount; // Keep original if filtering by currency
            const dateKey = d.toISOString().split('T')[0];
            const cat = tx.category || "Khác";

            if (tx.status === "PENDING") {
                pending++;
                pendingList.push(tx);
            }

            const isHighValue = (tx.currency === "VND" && tx.amount > 5000000) ||
                ((tx.currency === "USD" || tx.currency === "KHR") && tx.amount > 100);
            if (isHighValue && tx.type === "OUT") {
                highValue.push(tx);
            }

            // Period Check - NEW: Added "day" option
            let inPeriod = false;
            if (period === "day") {
                inPeriod = d.toDateString() === now.toDateString();
            } else if (period === "month") {
                inPeriod = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            } else if (period === "quarter") {
                const currentQ = Math.floor(now.getMonth() / 3);
                const txQ = Math.floor(d.getMonth() / 3);
                inPeriod = txQ === currentQ && d.getFullYear() === now.getFullYear();
            } else {
                inPeriod = d.getFullYear() === now.getFullYear();
            }

            if (tx.status === "APPROVED") {
                // Currency breakdown (original amounts)
                if (inPeriod) {
                    if (tx.type === "IN") {
                        currencyIn[tx.currency] = (currencyIn[tx.currency] || 0) + tx.amount;
                    } else {
                        currencyOut[tx.currency] = (currencyOut[tx.currency] || 0) + tx.amount;
                    }
                }

                if (inPeriod) {
                    if (tx.type === "IN") pIn += amountUSD;
                    else pOut += amountUSD;
                    
                    if (!catTotals[cat]) catTotals[cat] = { in: 0, out: 0 };
                    if (tx.type === "IN") catTotals[cat].in += amountUSD;
                    else catTotals[cat].out += amountUSD;
                    
                    if (tx.projectId && projStats[tx.projectId]) {
                        if (tx.type === "IN") projStats[tx.projectId].in += amountUSD;
                        else projStats[tx.projectId].out += amountUSD;
                    }

                    // Collect salary transactions for report
                    if (cat.toLowerCase().includes("lương") || cat.toLowerCase().includes("salary")) {
                        salaryData.push({
                            date: tx.date,
                            amount: tx.amount,
                            currency: tx.currency,
                            description: tx.description,
                            status: tx.status,
                            createdBy: tx.createdBy
                        });
                    }
                }
                
                if (inPeriod) {
                    if (!dailyStats[dateKey]) dailyStats[dateKey] = {};
                    if (!dailyStats[dateKey][cat]) dailyStats[dateKey][cat] = { in: 0, out: 0 };
                    if (tx.type === "IN") dailyStats[dateKey][cat].in += amountUSD;
                    else dailyStats[dateKey][cat].out += amountUSD;
                }
            }

            if (tx.status === "APPROVED") {
                const monthKey = `${d.getMonth() + 1}/${d.getFullYear()}`;
                if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { in: 0, out: 0 };
                if (tx.type === "IN") monthlyStats[monthKey].in += amountUSD;
                else monthlyStats[monthKey].out += amountUSD;

                if (tx.type === "OUT" && inPeriod) {
                    catStats[cat] = (catStats[cat] || 0) + amountUSD;

                    const fund = fundsData.find(f => f.id === tx.fundId);
                    if (fund) {
                        fundStats[fund.name] = (fundStats[fund.name] || 0) + amountUSD;
                    }
                }
            }
        });

        setPeriodIn(pIn);
        setPeriodOut(pOut);
        setPendingCount(pending);
        setFundExpenses(fundStats);
        setHighValueTxs(highValue.slice(0, 5));
        setPendingTxs(pendingList.slice(0, 5));
        setCategoryTotals(catTotals);
        setProjectStats(projStats);
        setSalaryReport(salaryData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        
        // Currency breakdown for chart
        const currencies: Currency[] = ["VND", "USD", "KHR", "TRY"];
        const currencyData = currencies
            .filter(c => currencyIn[c] > 0 || currencyOut[c] > 0)
            .map(c => ({
                currency: c,
                in: currencyIn[c],
                out: currencyOut[c],
                net: currencyIn[c] - currencyOut[c]
            }));
        setCurrencyBreakdown(currencyData);

        const dailyArray = Object.entries(dailyStats)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 30);
        setDailyCategoryStats(dailyArray);

        const cData = Object.entries(monthlyStats).map(([key, val]) => ({
            name: key,
            income: val.in,
            expense: val.out
        })).sort((a, b) => {
            const [m1, y1] = a.name.split('/').map(Number);
            const [m2, y2] = b.name.split('/').map(Number);
            return new Date(y1, m1).getTime() - new Date(y2, m2).getTime();
        }).slice(-6);
        setChartData(cData);

        const pData = Object.entries(catStats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        setCatData(pData);

        // Category trend
        const topCategories = Object.entries(catStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([cat]) => cat);

        const trendData: Record<string, any> = {};
        Object.entries(dailyStats).forEach(([date, cats]) => {
            let dateLabel = "";
            const d = new Date(date);
            
            if (period === "day") {
                dateLabel = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            } else if (period === "month") {
                dateLabel = d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
            } else if (period === "quarter") {
                dateLabel = d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
            } else {
                dateLabel = d.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' });
            }
            
            const dateObj: any = { date: dateLabel };
            topCategories.forEach(cat => {
                const catData = (cats as any)[cat];
                dateObj[cat] = catData ? catData.out : 0;
            });
            trendData[date] = dateObj;
        });

        const trendArray = Object.entries(trendData)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([, data]) => data);
        
        setCategoryTrendData(trendArray);

        // Salary Ratios
        const currentMonthRev = revs.find(r => {
            const m = parseInt(r.month);
            const y = parseInt(r.year);
            return m === (now.getMonth() + 1) && y === now.getFullYear();
        });

        if (currentMonthRev && currentMonthRev.amount > 0) {
            const revUSD = convertCurrency(currentMonthRev.amount, currentMonthRev.currency, "USD", exchangeRates);
            const salaryByType: Record<string, number> = { "Marketing": 0, "Sale": 0, "Vận hành": 0 };
            
            filteredTxs.forEach(tx => {
                const d = new Date(tx.date);
                const inPeriod = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                if (tx.status === "APPROVED" && tx.type === "OUT" && inPeriod) {
                    const cat = tx.category?.toLowerCase() || "";
                    const desc = tx.description?.toLowerCase() || "";
                    const amtUSD = convertCurrency(tx.amount, tx.currency, "USD", exchangeRates);

                    if (cat.includes("marketing") || desc.includes("marketing")) {
                        salaryByType["Marketing"] += amtUSD;
                    } else if (cat.includes("sale") || desc.includes("sale")) {
                        salaryByType["Sale"] += amtUSD;
                    } else if (cat.includes("vận hành") || cat.includes("operation") || desc.includes("vận hành")) {
                        salaryByType["Vận hành"] += amtUSD;
                    }
                }
            });

            setSalaryRatios([
                { name: "Lương Marketing / DT", value: (salaryByType["Marketing"] / revUSD * 100).toFixed(1), color: "#f472b6" },
                { name: "Lương Sale / DT", value: (salaryByType["Sale"] / revUSD * 100).toFixed(1), color: "#60a5fa" },
                { name: "Lương Vận hành / DT", value: (salaryByType["Vận hành"] / revUSD * 100).toFixed(1), color: "#34d399" }
            ]);
        } else {
            setSalaryRatios([]);
        }
    };

    const formatCurrency = (val: number, currency?: string) => {
        if (currency && currency !== "USD") {
            return new Intl.NumberFormat('vi-VN').format(val) + " " + currency;
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    };

    const getPeriodLabel = () => {
        switch (viewPeriod) {
            case "day": return "Hôm nay";
            case "month": return "Tháng này";
            case "quarter": return "Quý này";
            case "year": return "Năm này";
        }
    };

    if (loading) return <div className="p-8 text-[var(--muted)]">Loading Dashboard...</div>;

    if (!canViewGlobalStats(userRole)) {
        return (
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">My Dashboard</h1>
                    <p className="text-[var(--muted)]">Welcome back.</p>
                </div>
                <div className="glass-card p-6 rounded-xl">
                    <h3 className="text-xl font-bold mb-4">My Recent Transactions</h3>
                    <p className="text-[var(--muted)]">Go to Transactions tab to view history.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header with Period Selector and Filters */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Tổng quan Tài chính</h1>
                    <p className="text-[var(--muted)]">
                        Dữ liệu thời gian thực 
                        {filterCurrency === "ALL" ? " (Quy đổi USD)" : ` (${filterCurrency})`}
                        {filterProject && ` • ${projects.find(p => p.id === filterProject)?.name}`}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Period Selector */}
                    <div className="flex bg-white/5 rounded-xl p-1">
                        {(["day", "month", "quarter", "year"] as ViewPeriod[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setViewPeriod(p)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${viewPeriod === p
                                    ? "bg-gradient-to-r from-[#FF5E62] to-[#FF9966] text-white shadow-lg"
                                    : "text-[var(--muted)] hover:text-white"
                                }`}
                            >
                                {p === "day" ? "Ngày" : p === "month" ? "Tháng" : p === "quarter" ? "Quý" : "Năm"}
                            </button>
                        ))}
                    </div>
                    
                    {/* Project Filter */}
                    <select
                        value={filterProject}
                        onChange={(e) => setFilterProject(e.target.value)}
                        className="glass-input px-3 py-2 rounded-lg text-sm"
                    >
                        <option value="">Tất cả dự án</option>
                        {accessibleProjects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

                    {/* Currency Filter */}
                    <select
                        value={filterCurrency}
                        onChange={(e) => setFilterCurrency(e.target.value as Currency | "ALL")}
                        className="glass-input px-3 py-2 rounded-lg text-sm"
                    >
                        <option value="ALL">Tất cả tiền tệ</option>
                        <option value="VND">🇻🇳 VND</option>
                        <option value="USD">🇺🇸 USD</option>
                        <option value="KHR">🇰🇭 KHR</option>
                        <option value="TRY">🇹🇷 TRY (Lira)</option>
                    </select>

                    <Link href="/finance/transactions" className="glass-button px-4 py-2 rounded-lg text-sm">
                        Xem giao dịch →
                    </Link>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-card p-6 rounded-xl relative overflow-hidden group border border-white/5">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="text-6xl">💰</span>
                    </div>
                    <p className="text-[var(--muted)] text-sm font-medium uppercase">Tổng số dư</p>
                    <h3 className="text-3xl font-bold text-white mt-1">{formatCurrency(totalBalance)}</h3>
                    <p className="text-xs text-green-400 mt-2">Tất cả tài khoản</p>
                </div>

                <div className="glass-card p-6 rounded-xl border border-white/5">
                    <p className="text-[var(--muted)] text-sm font-medium uppercase">Tiền vào ({getPeriodLabel()})</p>
                    <h3 className="text-3xl font-bold text-green-400 mt-1">
                        +{filterCurrency === "ALL" ? formatCurrency(periodIn) : formatCurrency(periodIn, filterCurrency)}
                    </h3>
                </div>

                <div className="glass-card p-6 rounded-xl border border-white/5">
                    <p className="text-[var(--muted)] text-sm font-medium uppercase">Tiền ra ({getPeriodLabel()})</p>
                    <h3 className="text-3xl font-bold text-red-400 mt-1">
                        -{filterCurrency === "ALL" ? formatCurrency(periodOut) : formatCurrency(periodOut, filterCurrency)}
                    </h3>
                </div>

                <Link href="/finance/approvals" className="glass-card p-6 rounded-xl hover:bg-white/5 transition-colors cursor-pointer border-l-4 border-yellow-500 shadow-lg shadow-yellow-900/10">
                    <p className="text-[var(--muted)] text-sm font-medium uppercase">Chờ duyệt</p>
                    <h3 className="text-3xl font-bold text-yellow-400 mt-1">{pendingCount}</h3>
                    <p className="text-xs text-[var(--muted)] mt-2">Cần xử lý</p>
                </Link>
            </div>

            {/* NEW: Balance by Currency - Tách riêng từng loại tiền */}
            <div className="glass-card p-6 rounded-xl border border-white/5">
                <h3 className="text-lg font-bold mb-4">💵 Số dư theo Loại tiền (Không quy đổi)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(balanceByCurrency)
                        .filter(([_, balance]) => balance > 0)
                        .map(([currency, balance]) => (
                            <div 
                                key={currency} 
                                className={`p-4 rounded-xl border-2 ${filterCurrency === currency ? 'border-white/40' : 'border-white/10'} bg-white/5 cursor-pointer hover:bg-white/10 transition-all`}
                                onClick={() => setFilterCurrency(filterCurrency === currency ? "ALL" : currency as Currency)}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div 
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: CURRENCY_COLORS[currency] || "#888" }}
                                    />
                                    <span className="text-sm font-medium text-[var(--muted)]">{currency}</span>
                                </div>
                                <div className="text-2xl font-bold text-white">
                                    {new Intl.NumberFormat('vi-VN').format(balance)}
                                </div>
                                {filterCurrency === currency && (
                                    <div className="text-xs text-blue-400 mt-1">Đang lọc</div>
                                )}
                            </div>
                        ))}
                </div>
            </div>

            {/* NEW: Currency Breakdown Chart */}
            {currencyBreakdown.length > 0 && (
                <div className="glass-card p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold mb-4">📊 Thu Chi theo Loại tiền ({getPeriodLabel()})</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={currencyBreakdown}>
                                <XAxis dataKey="currency" stroke="#525252" />
                                <YAxis stroke="#525252" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                    formatter={(value: number, name: string) => [
                                        new Intl.NumberFormat('vi-VN').format(value),
                                        name === "in" ? "Thu" : name === "out" ? "Chi" : "Ròng"
                                    ]}
                                />
                                <Legend formatter={(value) => value === "in" ? "Thu" : value === "out" ? "Chi" : "Ròng"} />
                                <Bar dataKey="in" name="in" fill="#4ade80" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="out" name="out" fill="#f87171" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* NEW: Fixed Cost Summary - Tổng hợp chi phí cố định */}
            <div className="glass-card p-6 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">📋 Tổng hợp Chi phí Cố định Hàng tháng</h3>
                    <button
                        onClick={() => setShowFixedCostDetails(!showFixedCostDetails)}
                        className="text-sm text-blue-400 hover:text-blue-300"
                    >
                        {showFixedCostDetails ? "Thu gọn" : "Chi tiết"}
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {FIXED_COST_CATEGORIES.map(cat => {
                        const data = fixedCostSummary[cat.key];
                        const hasData = data && data.amount > 0;
                        return (
                            <div key={cat.key} className={`p-4 rounded-xl border border-white/10 ${hasData ? 'bg-white/5' : 'bg-white/2 opacity-50'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">{cat.icon}</span>
                                    <span className="text-sm text-[var(--muted)]">{cat.label}</span>
                                </div>
                                {hasData ? (
                                    <>
                                        <div className="text-xl font-bold text-white">
                                            {new Intl.NumberFormat('vi-VN').format(data.amount)} {data.currency}
                                        </div>
                                        <div className="text-xs text-[var(--muted)] mt-1">
                                            {data.count} khoản
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-[var(--muted)]">Chưa có</div>
                                )}
                            </div>
                        );
                    })}
                </div>
                
                {/* Fixed Cost Details Table */}
                {showFixedCostDetails && fixedCosts.length > 0 && (
                    <div className="mt-6 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#1a1a1a] text-[var(--muted)] text-xs uppercase">
                                <tr>
                                    <th className="p-3 border-b border-white/10">Tên</th>
                                    <th className="p-3 border-b border-white/10">Hạng mục</th>
                                    <th className="p-3 border-b border-white/10 text-right">Số tiền</th>
                                    <th className="p-3 border-b border-white/10">Chu kỳ</th>
                                    <th className="p-3 border-b border-white/10">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {fixedCosts.map(fc => (
                                    <tr key={fc.id} className="hover:bg-white/5">
                                        <td className="p-3 font-medium text-white">{fc.name}</td>
                                        <td className="p-3 text-[var(--muted)]">{fc.category || "Khác"}</td>
                                        <td className="p-3 text-right font-bold text-white">
                                            {new Intl.NumberFormat('vi-VN').format(fc.amount)} {fc.currency}
                                        </td>
                                        <td className="p-3 text-[var(--muted)]">
                                            {fc.cycle === "MONTHLY" ? "Hàng tháng" : fc.cycle === "QUARTERLY" ? "Hàng quý" : "Hàng năm"}
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs ${fc.status === "ON" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                                {fc.status === "ON" ? "Hoạt động" : "Tạm dừng"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="mt-4 p-4 bg-white/5 rounded-lg">
                            <div className="text-lg font-bold text-white">
                                Tổng chi phí cố định: {formatCurrency(
                                    fixedCosts
                                        .filter(fc => fc.status === "ON")
                                        .reduce((sum, fc) => sum + convertCurrency(fc.amount, fc.currency, "USD", rates), 0)
                                )}
                                <span className="text-sm text-[var(--muted)] ml-2">/tháng (quy đổi USD)</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* NEW: Salary Report - Báo cáo lương chi tiết */}
            {salaryReport.length > 0 && (
                <div className="glass-card p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold mb-4">💰 Báo cáo Chi Lương ({getPeriodLabel()})</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#1a1a1a] text-[var(--muted)] text-xs uppercase">
                                <tr>
                                    <th className="p-3 border-b border-white/10">Ngày thanh toán</th>
                                    <th className="p-3 border-b border-white/10 text-right">Số tiền</th>
                                    <th className="p-3 border-b border-white/10">Tiền tệ</th>
                                    <th className="p-3 border-b border-white/10">Mô tả</th>
                                    <th className="p-3 border-b border-white/10">Người tạo</th>
                                    <th className="p-3 border-b border-white/10">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {salaryReport.slice(0, 10).map((item, idx) => (
                                    <tr key={idx} className="hover:bg-white/5">
                                        <td className="p-3 font-medium text-white">
                                            {new Date(item.date).toLocaleDateString('vi-VN', { 
                                                day: '2-digit', 
                                                month: '2-digit', 
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="p-3 text-right font-bold text-red-400">
                                            {new Intl.NumberFormat('vi-VN').format(item.amount)}
                                        </td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: CURRENCY_COLORS[item.currency] + '30', color: CURRENCY_COLORS[item.currency] }}>
                                                {item.currency}
                                            </span>
                                        </td>
                                        <td className="p-3 text-[var(--muted)] max-w-[200px] truncate">
                                            {item.description || "-"}
                                        </td>
                                        <td className="p-3 text-[var(--muted)]">{item.createdBy}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                item.status === "APPROVED" ? "bg-green-500/20 text-green-400" : 
                                                item.status === "PENDING" ? "bg-yellow-500/20 text-yellow-400" : 
                                                "bg-red-500/20 text-red-400"
                                            }`}>
                                                {item.status === "APPROVED" ? "Đã duyệt" : item.status === "PENDING" ? "Chờ duyệt" : "Từ chối"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 flex items-center justify-between p-4 bg-white/5 rounded-lg">
                        <div>
                            <span className="text-[var(--muted)]">Tổng chi lương kỳ này:</span>
                            <span className="ml-2 text-xl font-bold text-red-400">
                                {formatCurrency(salaryReport.reduce((sum, item) => sum + convertCurrency(item.amount, item.currency, "USD", rates), 0))}
                            </span>
                        </div>
                        <div className="text-sm text-[var(--muted)]">
                            {salaryReport.length} giao dịch
                        </div>
                    </div>
                </div>
            )}

            {/* Account Cards - Compact */}
            <div className="glass-card p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold">Tài khoản</h3>
                    <Link href="/finance/accounts" className="text-xs text-[var(--muted)] hover:text-white">Quản lý →</Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {accounts
                        .filter(acc => !filterCurrency || filterCurrency === "ALL" || acc.currency === filterCurrency)
                        .filter(acc => !filterProject || !acc.projectId || acc.projectId === filterProject)
                        .map(acc => {
                            const sameCurrencyAccounts = accounts.filter(a => a.currency === acc.currency);
                            const maxBalance = Math.max(...sameCurrencyAccounts.map(a => a.balance), acc.balance * 1.5);
                            const accountTxs = transactions.filter(tx => tx.accountId === acc.id && tx.status === "APPROVED");
                            const now = new Date();
                            let periodIn = 0, periodOut = 0, lastMonthBalance = acc.openingBalance || 0;

                            accountTxs.forEach(tx => {
                                const d = new Date(tx.date);
                                const isThisMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                                if (isThisMonth) {
                                    if (tx.type === "IN") periodIn += tx.amount;
                                    else periodOut += tx.amount;
                                }
                                if (d < new Date(now.getFullYear(), now.getMonth(), 1)) {
                                    if (tx.type === "IN") lastMonthBalance += tx.amount;
                                    else lastMonthBalance -= tx.amount;
                                }
                            });

                            const netChange = periodIn - periodOut;
                            const changePercent = lastMonthBalance > 0 ? ((acc.balance - lastMonthBalance) / lastMonthBalance * 100).toFixed(1) : "0.0";
                            const trend = netChange >= 0 ? "up" : "down";
                            const progressPercent = maxBalance > 0 ? Math.min((acc.balance / maxBalance) * 100, 100) : 0;
                            const progressColor = CURRENCY_COLORS[acc.currency] || "bg-gray-500";

                            return (
                                <div key={acc.id} className="relative bg-white/5 rounded-lg p-3 border border-white/10 hover:border-white/20 transition-all">
                                    {acc.isLocked && (
                                        <svg className="absolute top-1.5 right-1.5 w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                    {acc.restrictCurrency && (
                                        <svg className="absolute top-1.5 right-5 w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                            <title>Chỉ chi tiền cùng loại</title>
                                            <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
                                        </svg>
                                    )}
                                    <div className="text-[10px] text-[var(--muted)] truncate mb-1">{acc.name}</div>
                                    <div className="text-base font-bold text-white leading-tight">
                                        {acc.balance.toLocaleString()} <span className="text-[10px]" style={{ color: CURRENCY_COLORS[acc.currency] }}>{acc.currency}</span>
                                    </div>
                                    <div className="h-1 bg-white/10 rounded-full overflow-hidden my-2">
                                        <div className="h-full transition-all" style={{ width: `${progressPercent}%`, backgroundColor: CURRENCY_COLORS[acc.currency] }} />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px]">
                                        <span className={trend === "up" ? "text-green-400" : "text-red-400"}>
                                            {trend === "up" ? "↑" : "↓"} {changePercent}%
                                        </span>
                                        <span className="text-green-400">+{(periodIn/1000).toFixed(0)}k</span>
                                        <span className="text-red-400">-{(periodOut/1000).toFixed(0)}k</span>
                                    </div>
                                </div>
                            );
                        })}
                    {accounts.length === 0 && (
                        <div className="col-span-full text-center text-[var(--muted)] py-2 text-xs">Chưa có tài khoản</div>
                    )}
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Income vs Expense */}
                <div className="lg:col-span-2 glass-card p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold mb-6">Thu – Chi theo tháng (6 tháng gần nhất)</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <XAxis dataKey="name" stroke="#525252" />
                                <YAxis stroke="#525252" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                    formatter={(value: number) => filterCurrency === "ALL" ? formatCurrency(value) : formatCurrency(value, filterCurrency)}
                                />
                                <Legend />
                                <Bar dataKey="income" name="Thu" fill="#4ade80" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" name="Chi" fill="#f87171" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Expense Breakdown */}
                <div className="glass-card p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold mb-6">Tỷ lệ chi phí ({getPeriodLabel()})</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={catData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {catData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => filterCurrency === "ALL" ? formatCurrency(value) : formatCurrency(value, filterCurrency)} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Category Trend Area Chart */}
            <div className="glass-card p-6 rounded-xl border border-white/5">
                <h3 className="text-lg font-bold mb-6">
                    Biến động Chi phí theo Hạng mục ({getPeriodLabel()})
                </h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={categoryTrendData}>
                            <defs>
                                {catData.slice(0, 5).map((cat, index) => (
                                    <linearGradient key={`gradient-${cat.name}`} id={`color-${index}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.1}/>
                                    </linearGradient>
                                ))}
                            </defs>
                            <XAxis 
                                dataKey="date" 
                                stroke="#525252" 
                                tick={{ fontSize: 11 }}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                            />
                            <YAxis stroke="#525252" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                formatter={(value: number) => filterCurrency === "ALL" ? formatCurrency(value) : formatCurrency(value, filterCurrency)}
                            />
                            <Legend />
                            {catData.slice(0, 5).map((cat, index) => (
                                <Area
                                    key={cat.name}
                                    type="monotone"
                                    dataKey={cat.name}
                                    stroke={COLORS[index % COLORS.length]}
                                    strokeWidth={2}
                                    fill={`url(#color-${index})`}
                                    dot={{ r: 3, fill: COLORS[index % COLORS.length] }}
                                    activeDot={{ r: 5 }}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Fund Expense Cards */}
            <div className="glass-card p-6 rounded-xl border border-white/5">
                <h3 className="text-lg font-bold mb-4">Chi theo Quỹ ({getPeriodLabel()})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {Object.entries(fundExpenses).map(([name, amount]) => (
                        <div key={name} className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: FUND_COLORS[name] || "#888" }}
                                />
                                <span className="text-sm text-[var(--muted)]">{name}</span>
                            </div>
                            <div className="text-xl font-bold text-white">
                                {filterCurrency === "ALL" ? formatCurrency(amount) : formatCurrency(amount, filterCurrency)}
                            </div>
                            {periodOut > 0 && (
                                <div className="text-xs text-[var(--muted)] mt-1">
                                    {((amount / periodOut) * 100).toFixed(1)}% tổng chi
                                </div>
                            )}
                        </div>
                    ))}
                    {Object.keys(fundExpenses).length === 0 && (
                        <div className="col-span-full text-center text-[var(--muted)] py-4">
                            Chưa có dữ liệu quỹ. Vui lòng tạo quỹ và gắn giao dịch.
                        </div>
                    )}
                </div>
            </div>

            {/* Project Summary */}
            <div className="glass-card p-6 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Thu Chi theo Dự án ({getPeriodLabel()})</h3>
                    {projects.filter(p => projectStats[p.id] && (projectStats[p.id].in > 0 || projectStats[p.id].out > 0)).length > 5 && (
                        <button
                            onClick={() => setShowAllProjects(!showAllProjects)}
                            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            {showAllProjects ? "Thu gọn ↑" : `Xem tất cả (${projects.filter(p => projectStats[p.id] && (projectStats[p.id].in > 0 || projectStats[p.id].out > 0)).length}) ↓`}
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#1a1a1a] text-[var(--muted)] text-xs uppercase font-semibold tracking-wider">
                            <tr>
                                <th className="p-4 border-b border-white/10">Dự án</th>
                                <th className="p-4 border-b border-white/10 text-right">Ngân sách</th>
                                <th className="p-4 border-b border-white/10 text-right">Thu</th>
                                <th className="p-4 border-b border-white/10 text-right">Chi</th>
                                <th className="p-4 border-b border-white/10 text-right">Còn lại</th>
                                <th className="p-4 border-b border-white/10 text-right">% Sử dụng</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {projects
                                .filter(p => !filterProject || p.id === filterProject)
                                .filter(p => projectStats[p.id] && (projectStats[p.id].in > 0 || projectStats[p.id].out > 0))
                                .sort((a, b) => (projectStats[b.id]?.out || 0) - (projectStats[a.id]?.out || 0))
                                .slice(0, showAllProjects ? undefined : 5)
                                .map(project => {
                                    const stats = projectStats[project.id];
                                    const remaining = stats.budget - stats.out;
                                    const percentUsed = stats.budget > 0 ? (stats.out / stats.budget * 100) : 0;
                                    const isOverBudget = stats.out > stats.budget;
                                    
                                    return (
                                        <tr key={project.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4">
                                                <div className="font-medium text-white">{project.name}</div>
                                                {project.description && (
                                                    <div className="text-xs text-[var(--muted)] truncate max-w-[200px]">
                                                        {project.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-right text-[var(--muted)]">
                                                {stats.budget > 0 ? (filterCurrency === "ALL" ? formatCurrency(stats.budget) : formatCurrency(stats.budget, filterCurrency)) : "-"}
                                            </td>
                                            <td className="p-4 text-right font-bold text-green-400">
                                                {stats.in > 0 ? (filterCurrency === "ALL" ? formatCurrency(stats.in) : formatCurrency(stats.in, filterCurrency)) : "-"}
                                            </td>
                                            <td className="p-4 text-right font-bold text-red-400">
                                                {stats.out > 0 ? (filterCurrency === "ALL" ? formatCurrency(stats.out) : formatCurrency(stats.out, filterCurrency)) : "-"}
                                            </td>
                                            <td className={`p-4 text-right font-bold ${remaining >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                {stats.budget > 0 ? (filterCurrency === "ALL" ? formatCurrency(remaining) : formatCurrency(remaining, filterCurrency)) : "-"}
                                            </td>
                                            <td className="p-4 text-right">
                                                {stats.budget > 0 ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className={`font-bold ${isOverBudget ? "text-red-400" : percentUsed > 80 ? "text-yellow-400" : "text-green-400"}`}>
                                                            {percentUsed.toFixed(1)}%
                                                        </span>
                                                        <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full transition-all ${isOverBudget ? "bg-red-500" : percentUsed > 80 ? "bg-yellow-500" : "bg-green-500"}`}
                                                                style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : "-"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            {projects.filter(p => projectStats[p.id] && (projectStats[p.id].in > 0 || projectStats[p.id].out > 0)).length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-[var(--muted)]">
                                        Chưa có dữ liệu dự án trong kỳ này
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Daily Category Stats - Accordion Style */}
            <div className="glass-card p-6 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-4 gap-4">
                    <h3 className="text-lg font-bold">Chi tiết theo ngày ({getPeriodLabel()})</h3>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Tìm hạng mục..."
                            value={dailySearchTerm}
                            onChange={(e) => setDailySearchTerm(e.target.value)}
                            className="glass-input px-3 py-2 rounded-lg text-sm w-48"
                        />
                        {dailyCategoryStats.length > 10 && (
                            <button
                                onClick={() => setShowAllDays(!showAllDays)}
                                className="text-sm text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
                            >
                                {showAllDays ? "Thu gọn" : `Xem thêm (${dailyCategoryStats.length})`}
                            </button>
                        )}
                    </div>
                </div>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {dailyCategoryStats
                        .filter(([date, categories]) => {
                            if (!dailySearchTerm) return true;
                            const searchLower = dailySearchTerm.toLowerCase();
                            return Object.keys(categories).some(cat => 
                                cat.toLowerCase().includes(searchLower)
                            );
                        })
                        .slice(0, showAllDays ? undefined : 10)
                        .map(([date, categories]) => {
                        const dailyTotal = Object.values(categories as Record<string, { in: number, out: number }>)
                            .reduce((sum, data) => sum + data.in + data.out, 0);
                        const dailyIn = Object.values(categories as Record<string, { in: number, out: number }>)
                            .reduce((sum, data) => sum + data.in, 0);
                        const dailyOut = Object.values(categories as Record<string, { in: number, out: number }>)
                            .reduce((sum, data) => sum + data.out, 0);
                        const dailyDiff = dailyIn - dailyOut;
                        
                        return (
                            <details key={date} className="bg-white/5 rounded-lg border border-white/10 group">
                                <summary className="p-4 cursor-pointer hover:bg-white/5 transition-all list-none">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl group-open:rotate-90 transition-transform">▶</span>
                                            <div>
                                                <div className="font-bold text-white">
                                                    {new Date(date).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                </div>
                                                <div className="text-xs text-[var(--muted)]">
                                                    {Object.keys(categories).length} hạng mục
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-xs text-[var(--muted)]">Thu</div>
                                                <div className="text-sm font-bold text-green-400">
                                                    {dailyIn > 0 ? (filterCurrency === "ALL" ? formatCurrency(dailyIn) : formatCurrency(dailyIn, filterCurrency)) : "-"}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-[var(--muted)]">Chi</div>
                                                <div className="text-sm font-bold text-red-400">
                                                    {dailyOut > 0 ? (filterCurrency === "ALL" ? formatCurrency(dailyOut) : formatCurrency(dailyOut, filterCurrency)) : "-"}
                                                </div>
                                            </div>
                                            <div className="text-right min-w-[100px]">
                                                <div className="text-xs text-[var(--muted)]">Biến động</div>
                                                <div className={`text-sm font-bold ${dailyDiff >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                    {dailyDiff >= 0 ? "↑" : "↓"} {filterCurrency === "ALL" ? formatCurrency(Math.abs(dailyDiff)) : formatCurrency(Math.abs(dailyDiff), filterCurrency)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </summary>
                                <div className="px-4 pb-4 pt-2 border-t border-white/10">
                                    <div className="space-y-2">
                                        {Object.entries(categories as Record<string, { in: number, out: number }>)
                                            .filter(([cat]) => {
                                                if (!dailySearchTerm) return true;
                                                return cat.toLowerCase().includes(dailySearchTerm.toLowerCase());
                                            })
                                            .sort((a, b) => (b[1].out) - (a[1].out))
                                            .map(([cat, data]) => {
                                                const catDiff = data.in - data.out;
                                                return (
                                                    <div key={cat} className="flex items-center justify-between p-2 rounded hover:bg-white/5">
                                                        <span className="text-sm text-white">{cat}</span>
                                                        <div className="flex items-center gap-3">
                                                            {data.in > 0 && (
                                                                <span className="text-xs text-green-400">
                                                                    +{filterCurrency === "ALL" ? formatCurrency(data.in) : formatCurrency(data.in, filterCurrency)}
                                                                </span>
                                                            )}
                                                            {data.out > 0 && (
                                                                <span className="text-xs text-red-400">
                                                                    -{filterCurrency === "ALL" ? formatCurrency(data.out) : formatCurrency(data.out, filterCurrency)}
                                                                </span>
                                                            )}
                                                            <span className={`text-xs font-bold min-w-[80px] text-right ${catDiff >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                                {catDiff >= 0 ? "↑" : "↓"} {filterCurrency === "ALL" ? formatCurrency(Math.abs(catDiff)) : formatCurrency(Math.abs(catDiff), filterCurrency)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </details>
                        );
                    })}
                    {dailyCategoryStats.length === 0 && (
                        <div className="text-center text-[var(--muted)] py-8">
                            Chưa có dữ liệu
                        </div>
                    )}
                </div>
            </div>

            {/* Salary Ratio Section */}
            {salaryRatios.length > 0 && (
                <div className="glass-card p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold mb-4">Tỷ lệ Lương / Doanh thu ({getPeriodLabel()})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {salaryRatios.map((item) => (
                            <div key={item.name} className="relative">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-[var(--muted)]">{item.name}</span>
                                    <span className="text-lg font-bold text-white">{item.value}%</span>
                                </div>
                                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${Math.min(parseFloat(item.value), 100)}%`,
                                            backgroundColor: item.color
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Warning Alerts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* High Value Transactions */}
                <div className="glass-card p-6 rounded-xl border-l-4 border-red-500 shadow-lg shadow-red-900/10">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="text-red-400">⚠️</span> Khoản chi lớn (&gt;5 triệu / &gt;$100)
                    </h3>
                    {highValueTxs.length > 0 ? (
                        <div className="space-y-3">
                            {highValueTxs.map(tx => (
                                <div key={tx.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                    <div>
                                        <div className="font-medium text-white">{tx.category}</div>
                                        <div className="text-xs text-[var(--muted)]">{new Date(tx.date).toLocaleDateString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-red-400">{tx.amount.toLocaleString()} {tx.currency}</div>
                                        <span className={`text-xs px-2 py-0.5 rounded ${tx.status === "APPROVED" ? "bg-green-500/20 text-green-400" :
                                            tx.status === "PENDING" ? "bg-yellow-500/20 text-yellow-400" :
                                                "bg-red-500/20 text-red-400"
                                            }`}>
                                            {tx.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[var(--muted)] text-center py-4">Không có khoản chi lớn</p>
                    )}
                </div>

                {/* Pending Approvals */}
                <div className="glass-card p-6 rounded-xl border-l-4 border-yellow-500 shadow-lg shadow-yellow-900/10">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="text-yellow-400">⏳</span> Đang chờ duyệt
                    </h3>
                    {pendingTxs.length > 0 ? (
                        <div className="space-y-3">
                            {pendingTxs.map(tx => (
                                <div key={tx.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                    <div>
                                        <div className="font-medium text-white">{tx.category}</div>
                                        <div className="text-xs text-[var(--muted)]">{tx.createdBy} • {new Date(tx.date).toLocaleDateString()}</div>
                                    </div>
                                    <div className="font-bold text-yellow-400">{tx.amount.toLocaleString()} {tx.currency}</div>
                                </div>
                            ))}
                            <Link href="/finance/approvals" className="block text-center text-sm text-blue-400 hover:text-blue-300 mt-2">
                                Xem tất cả →
                            </Link>
                        </div>
                    ) : (
                        <p className="text-[var(--muted)] text-center py-4">✓ Không có giao dịch chờ duyệt</p>
                    )}
                </div>
            </div>

            {/* Recent Transactions Table */}
            <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1a1a1a]">
                    <h3 className="text-lg font-bold">Giao dịch gần đây</h3>
                    <Link href="/finance/transactions" className="text-sm text-blue-400 hover:text-blue-300">Xem tất cả</Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#1a1a1a] text-[var(--muted)] text-xs uppercase font-semibold tracking-wider">
                            <tr>
                                <th className="p-4 border-b border-white/10">Ngày</th>
                                <th className="p-4 border-b border-white/10">Mô tả</th>
                                <th className="p-4 border-b border-white/10">Số tiền</th>
                                <th className="p-4 border-b border-white/10">Tiền tệ</th>
                                <th className="p-4 border-b border-white/10">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {transactions
                                .filter(tx => !filterProject || tx.projectId === filterProject)
                                .filter(tx => filterCurrency === "ALL" || tx.currency === filterCurrency)
                                .slice(0, 10)
                                .map(tx => (
                                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-[var(--muted)]">
                                            {new Date(tx.date).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-white">{tx.category}</div>
                                            {tx.description && (
                                                <div className="text-xs text-[var(--muted)] truncate max-w-[200px]">{tx.description}</div>
                                            )}
                                        </td>
                                        <td className={`p-4 font-bold ${tx.type === "IN" ? "text-green-400" : "text-red-400"}`}>
                                            {tx.type === "IN" ? "+" : "-"}{tx.amount.toLocaleString()}
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: CURRENCY_COLORS[tx.currency] + '30', color: CURRENCY_COLORS[tx.currency] }}>
                                                {tx.currency}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                tx.status === "APPROVED" ? "bg-green-500/20 text-green-400" :
                                                tx.status === "PENDING" ? "bg-yellow-500/20 text-yellow-400" :
                                                "bg-red-500/20 text-red-400"
                                            }`}>
                                                {tx.status === "APPROVED" ? "Đã duyệt" : tx.status === "PENDING" ? "Chờ duyệt" : "Từ chối"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
