"use client";

import { useEffect, useState, useMemo } from "react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid
} from "recharts";
import { getTransactions, getAccounts, getRevenues, getFixedCosts, getProjects } from "@/lib/finance";
import { Transaction, Account, Currency, MonthlyRevenue, Fund, FixedCost, Project } from "@/types/finance";
import { getUserRole, Role, getAccessibleProjects, hasProjectPermission } from "@/lib/permissions";
import { getExchangeRates, convertCurrency } from "@/lib/currency";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { BarChart3, Calendar } from "lucide-react";

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
type DateRangePreset = "all" | "today" | "this_week" | "this_month" | "this_year";

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

    // Helper functions for date filtering
    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isThisMonth = (date: Date) => {
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    };

    const isThisQuarter = (date: Date) => {
        const now = new Date();
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const dateQuarter = Math.floor(date.getMonth() / 3);
        return dateQuarter === currentQuarter && date.getFullYear() === now.getFullYear();
    };

    const isThisYear = (date: Date) => {
        const now = new Date();
        return date.getFullYear() === now.getFullYear();
    };
    const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [userRole, setUserRole] = useState<Role>("USER");
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [viewPeriod, setViewPeriod] = useState<ViewPeriod>("month");
    const [rates, setRates] = useState<any>({});

    // NEW: Date Range Filter
    const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("all");
    const [customDateFrom, setCustomDateFrom] = useState("");
    const [customDateTo, setCustomDateTo] = useState("");
    const [showDatePicker, setShowDatePicker] = useState(false);

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

    // Get accessible projects based on user role - chỉ lấy dự án có quyền view_reports
    const accessibleProjects = useMemo(() => {
        if (!currentUser) return [];
        if (userRole === "ADMIN") return projects;
        
        const userId = currentUser?.uid || currentUser?.id;
        if (!userId) return [];
        
        return getAccessibleProjects(currentUser, projects).filter(p => 
            hasProjectPermission(userId, p, "view_reports", currentUser)
        );
    }, [currentUser, userRole, projects]);

    // Calculate date range based on preset
    const dateRange = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Custom date range takes priority
        if (customDateFrom && customDateTo) {
            return { from: new Date(customDateFrom), to: new Date(customDateTo + "T23:59:59") };
        }
        
        switch (dateRangePreset) {
            case "today":
                return { from: today, to: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) };
            case "this_week": {
                const dayOfWeek = today.getDay();
                const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
                return { from: monday, to: now };
            }
            case "this_month":
                return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
            case "this_year":
                return { from: new Date(now.getFullYear(), 0, 1), to: now };
            case "all":
            default:
                return null; // No filter
        }
    }, [dateRangePreset, customDateFrom, customDateTo]);

    // Get label for current date range
    const getDateRangeLabel = () => {
        if (customDateFrom && customDateTo) {
            const from = new Date(customDateFrom);
            const to = new Date(customDateTo);
            return `${from.toLocaleDateString('vi-VN')} - ${to.toLocaleDateString('vi-VN')}`;
        }
        const labels: Record<DateRangePreset, string> = {
            all: "Toàn bộ",
            today: "Hôm nay",
            this_week: "Tuần này",
            this_month: "Tháng này",
            this_year: "Năm nay"
        };
        return labels[dateRangePreset];
    };

    // Clear custom dates when selecting preset
    const handlePresetChange = (preset: DateRangePreset) => {
        setDateRangePreset(preset);
        setCustomDateFrom("");
        setCustomDateTo("");
        setShowDatePicker(false);
    };

    // Apply custom date range
    const applyCustomDateRange = () => {
        if (customDateFrom && customDateTo) {
            setDateRangePreset("all"); // Reset preset when using custom
            setShowDatePicker(false);
        }
    };

    // Kiểm tra user có quyền xem dashboard không
    const canViewDashboard = useMemo(() => {
        if (userRole === "ADMIN") return true;
        return accessibleProjects.length > 0;
    }, [userRole, accessibleProjects]);

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

                setRevenues(revsData);
                setFunds(fundsData);
                setProjects(projectsData);
                setFixedCosts(fixedCostsData);
                setRates(exchangeRates);

                // Filter transactions và accounts theo dự án user có quyền
                const u = localStorage.getItem("user") || sessionStorage.getItem("user");
                const parsedUser = u ? JSON.parse(u) : null;
                const role = parsedUser ? getUserRole(parsedUser) : "USER";
                const userId = parsedUser?.uid || parsedUser?.id;

                let filteredTxs = txs;
                let filteredAccs = accs;

                if (role !== "ADMIN" && userId) {
                    // Lấy danh sách dự án user có quyền view_reports
                    const userAccessibleProjects = getAccessibleProjects(parsedUser, projectsData)
                        .filter(p => hasProjectPermission(userId, p, "view_reports", parsedUser));
                    const accessibleProjectIds = userAccessibleProjects.map(p => p.id);

                    // Filter transactions theo dự án có quyền
                    filteredTxs = txs.filter(tx => 
                        (tx.projectId && accessibleProjectIds.includes(tx.projectId)) ||
                        tx.userId === userId
                    );

                    // Filter accounts theo dự án có quyền
                    filteredAccs = accs.filter(acc => 
                        (acc.projectId && accessibleProjectIds.includes(acc.projectId)) ||
                        !acc.projectId
                    );
                }

                setTransactions(filteredTxs);
                setAccounts(filteredAccs);

                // Calculate balance by currency (không quy đổi)
                const byCurrency: Record<Currency, number> = { VND: 0, USD: 0, KHR: 0, TRY: 0 };
                let totalUSD = 0;
                filteredAccs.forEach(acc => {
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

                calculateMetrics(filteredTxs, exchangeRates, viewPeriod, revsData, fundsData, projectsData, "", "ALL", null);

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
            calculateMetrics(transactions, rates, viewPeriod, revenues, funds, projects, filterProject, filterCurrency, dateRange);
        }
    }, [viewPeriod, filterProject, filterCurrency, dateRange]);

    const calculateMetrics = (
        txs: Transaction[], 
        exchangeRates: any, 
        period: ViewPeriod, 
        revs: MonthlyRevenue[], 
        fundsData: Fund[], 
        projectsData: Project[],
        projectFilter: string,
        currencyFilter: Currency | "ALL",
        dateRangeFilter: { from: Date, to: Date } | null
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
        // NEW: Filter by date range
        if (dateRangeFilter) {
            filteredTxs = filteredTxs.filter(tx => {
                const txDate = new Date(tx.date);
                return txDate >= dateRangeFilter.from && txDate <= dateRangeFilter.to;
            });
        }

        filteredTxs.forEach(tx => {
            const d = new Date(tx.date);
            const amountUSD = currencyFilter === "ALL" 
                ? convertCurrency(tx.amount, tx.currency, "USD", exchangeRates)
                : tx.amount; // Keep original if filtering by currency
            const dateKey = d.toISOString().split('T')[0];
            // Sử dụng parentCategory để nhóm thống kê, fallback về category nếu không có
            const cat = tx.parentCategory || tx.category || "Khác";

            if (tx.status === "PENDING") {
                pending++;
                pendingList.push(tx);
            }

            const isHighValue = (tx.currency === "VND" && tx.amount > 5000000) ||
                ((tx.currency === "USD" || tx.currency === "KHR") && tx.amount > 100);
            if (isHighValue && tx.type === "OUT") {
                highValue.push(tx);
            }

            // Period Check - Use dateRange if set, otherwise include all
            let inPeriod = false;
            if (dateRangeFilter) {
                // When using date range filter, all filtered transactions are "in period"
                inPeriod = true;
            } else {
                // No date filter = include all transactions
                inPeriod = true;
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

    if (!canViewDashboard) {
        return (
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                    <p className="text-[var(--muted)]">Tổng quan tài chính</p>
                </div>
                
                <div className="glass-card p-8 rounded-xl text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">Chưa có quyền xem Dashboard</h3>
                    <p className="text-[var(--muted)] mb-4">
                        Để xem Dashboard, bạn cần được phân quyền <strong className="text-blue-400">"Xem dashboard & báo cáo"</strong> trong ít nhất một dự án.
                    </p>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
                        <p className="text-sm text-blue-400">
                            💡 <strong>Hướng dẫn:</strong> Liên hệ quản trị viên hoặc chủ dự án để được cấp quyền truy cập.
                        </p>
                    </div>
                    <div className="flex justify-center gap-3">
                        <Link 
                            href="/finance/projects"
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                            Xem dự án của tôi
                        </Link>
                        <Link 
                            href="/finance/profile"
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                        >
                            Tài khoản của tôi
                        </Link>
                    </div>
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
                        {getDateRangeLabel()}
                        {filterCurrency === "ALL" ? " • Quy đổi USD" : ` • ${filterCurrency}`}
                        {filterProject && ` • ${projects.find(p => p.id === filterProject)?.name}`}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Quick Date Presets */}
                    <div className="flex bg-white/5 rounded-lg p-0.5">
                        {([
                            { key: "all", label: "Tất cả" },
                            { key: "today", label: "Hôm nay" },
                            { key: "this_week", label: "Tuần" },
                            { key: "this_month", label: "Tháng" },
                            { key: "this_year", label: "Năm" }
                        ] as { key: DateRangePreset, label: string }[]).map(item => (
                            <button
                                key={item.key}
                                onClick={() => handlePresetChange(item.key)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    dateRangePreset === item.key && !customDateFrom
                                        ? "bg-white/20 text-white"
                                        : "text-[var(--muted)] hover:text-white"
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {/* Date Range Picker */}
                    <div className="relative">
                        <button
                            onClick={() => setShowDatePicker(!showDatePicker)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
                                customDateFrom && customDateTo
                                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                    : "bg-white/5 text-[var(--muted)] hover:text-white border border-white/10"
                            }`}
                        >
                            <Calendar size={14} />
                            {customDateFrom && customDateTo 
                                ? `${new Date(customDateFrom).toLocaleDateString('vi-VN')} - ${new Date(customDateTo).toLocaleDateString('vi-VN')}`
                                : "Chọn ngày"
                            }
                        </button>

                        {/* Date Picker Dropdown */}
                        {showDatePicker && (
                            <div className="absolute top-full right-0 mt-2 p-4 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-50 min-w-[280px]">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-white">Chọn khoảng thời gian</span>
                                    <button 
                                        onClick={() => setShowDatePicker(false)}
                                        className="text-[var(--muted)] hover:text-white"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-[var(--muted)] mb-1">Từ ngày</label>
                                        <input
                                            type="date"
                                            value={customDateFrom}
                                            onChange={(e) => setCustomDateFrom(e.target.value)}
                                            className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-[var(--muted)] mb-1">Đến ngày</label>
                                        <input
                                            type="date"
                                            value={customDateTo}
                                            onChange={(e) => setCustomDateTo(e.target.value)}
                                            className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => {
                                                setCustomDateFrom("");
                                                setCustomDateTo("");
                                            }}
                                            className="flex-1 px-3 py-2 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-[var(--muted)]"
                                        >
                                            Xóa
                                        </button>
                                        <button
                                            onClick={applyCustomDateRange}
                                            disabled={!customDateFrom || !customDateTo}
                                            className="flex-1 px-3 py-2 rounded-lg text-xs bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
                                        >
                                            Áp dụng
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Project Filter */}
                    <select
                        value={filterProject}
                        onChange={(e) => setFilterProject(e.target.value)}
                        className="glass-input px-3 py-1.5 rounded-lg text-xs"
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
                        className="glass-input px-3 py-1.5 rounded-lg text-xs"
                    >
                        <option value="ALL">Tất cả tiền tệ</option>
                        <option value="VND">VND</option>
                        <option value="USD">USD</option>
                        <option value="KHR">KHR</option>
                        <option value="TRY">TRY</option>
                    </select>

                    <Link href="/finance/transactions" className="glass-button px-3 py-1.5 rounded-lg text-xs">
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
                    <h3 className="text-2xl font-bold text-white mt-1">{formatCurrency(totalBalance)}</h3>
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                        {Object.entries(balanceByCurrency)
                            .filter(([_, balance]) => balance !== 0)
                            .map(([currency, balance]) => (
                                <div key={currency} className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CURRENCY_COLORS[currency] || "#888" }} />
                                        <span className="text-white/50">{currency}</span>
                                    </span>
                                    <span className={`font-medium ${balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                        {new Intl.NumberFormat('vi-VN').format(balance)}
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>

                <div className="glass-card p-6 rounded-xl border border-white/5">
                    <p className="text-[var(--muted)] text-sm font-medium uppercase">Tiền vào ({getDateRangeLabel()})</p>
                    <h3 className="text-3xl font-bold text-green-400 mt-1">
                        +{filterCurrency === "ALL" ? formatCurrency(periodIn) : formatCurrency(periodIn, filterCurrency)}
                    </h3>
                </div>

                <div className="glass-card p-6 rounded-xl border border-white/5">
                    <p className="text-[var(--muted)] text-sm font-medium uppercase">Tiền ra ({getDateRangeLabel()})</p>
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

            {/* Account Cards - Compact */}
            <div className="glass-card p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold">💳 Tài khoản</h3>
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
                            let accPeriodIn = 0, accPeriodOut = 0, lastMonthBalance = acc.openingBalance || 0;

                            accountTxs.forEach(tx => {
                                const d = new Date(tx.date);
                                const isThisMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                                if (isThisMonth) {
                                    if (tx.type === "IN") accPeriodIn += tx.amount;
                                    else accPeriodOut += tx.amount;
                                }
                                if (d < new Date(now.getFullYear(), now.getMonth(), 1)) {
                                    if (tx.type === "IN") lastMonthBalance += tx.amount;
                                    else lastMonthBalance -= tx.amount;
                                }
                            });

                            const netChange = accPeriodIn - accPeriodOut;
                            const changePercent = lastMonthBalance > 0 ? ((acc.balance - lastMonthBalance) / lastMonthBalance * 100).toFixed(1) : "0.0";
                            const trend = netChange >= 0 ? "up" : "down";
                            const progressPercent = maxBalance > 0 ? Math.min((acc.balance / maxBalance) * 100, 100) : 0;

                            return (
                                <div key={acc.id} className="relative bg-white/5 rounded-lg p-3 border border-white/10 hover:border-white/20 transition-all">
                                    {acc.isLocked && (
                                        <svg className="absolute top-1.5 right-1.5 w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
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
                                        <span className="text-green-400">+{(accPeriodIn/1000).toFixed(0)}k</span>
                                        <span className="text-red-400">-{(accPeriodOut/1000).toFixed(0)}k</span>
                                    </div>
                                </div>
                            );
                        })}
                    {accounts.length === 0 && (
                        <div className="col-span-full text-center text-[var(--muted)] py-2 text-xs">Chưa có tài khoản</div>
                    )}
                </div>
            </div>

            {/* Currency Breakdown Chart */}
            {currencyBreakdown.length > 0 && (
                <div className="glass-card p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold mb-4">💵 Thu Chi theo Loại tiền ({getPeriodLabel()})</h3>
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

            {/* Expense & Income Ratio Charts - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expense Breakdown */}
                <div className="glass-card p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold mb-4">📊 Tỷ lệ chi ({getPeriodLabel()})</h3>
                    <div className="h-48 mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={catData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                                    {catData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value: number) => filterCurrency === "ALL" ? formatCurrency(value) : formatCurrency(value, filterCurrency)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 border-t border-white/10 pt-4">
                        {catData.map((item, index) => (
                            <div key={item.name} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                    <span className="text-white/80">{item.name}</span>
                                </div>
                                <span className="font-bold text-red-400">
                                    {filterCurrency === "ALL" ? formatCurrency(item.value) : formatCurrency(item.value, filterCurrency)}
                                </span>
                            </div>
                        ))}
                        {catData.length === 0 && <div className="text-[var(--muted)] text-sm text-center py-4">Chưa có dữ liệu</div>}
                    </div>
                </div>

                {/* Income Breakdown */}
                <div className="glass-card p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold mb-4">💰 Tỷ lệ thu ({getPeriodLabel()})</h3>
                    <div className="h-48 mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={Object.entries(categoryTotals).filter(([_, d]) => d.in > 0).map(([n, d]) => ({ name: n, value: d.in })).sort((a, b) => b.value - a.value).slice(0, 5)}
                                    cx="50%" cy="50%" outerRadius={80} dataKey="value"
                                >
                                    {Object.entries(categoryTotals).filter(([_, d]) => d.in > 0).slice(0, 5).map((_, i) => (
                                        <Cell key={`cell-in-${i}`} fill={["#4ade80", "#22d3ee", "#a78bfa", "#fbbf24", "#f472b6"][i % 5]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => filterCurrency === "ALL" ? formatCurrency(value) : formatCurrency(value, filterCurrency)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 border-t border-white/10 pt-4">
                        {Object.entries(categoryTotals).filter(([_, d]) => d.in > 0).map(([n, d]) => ({ name: n, value: d.in })).sort((a, b) => b.value - a.value).slice(0, 5).map((item, i) => (
                            <div key={item.name} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ["#4ade80", "#22d3ee", "#a78bfa", "#fbbf24", "#f472b6"][i % 5] }} />
                                    <span className="text-white/80">{item.name}</span>
                                </div>
                                <span className="font-bold text-green-400">
                                    {filterCurrency === "ALL" ? formatCurrency(item.value) : formatCurrency(item.value, filterCurrency)}
                                </span>
                            </div>
                        ))}
                        {Object.entries(categoryTotals).filter(([_, d]) => d.in > 0).length === 0 && <div className="text-[var(--muted)] text-sm text-center py-4">Chưa có dữ liệu</div>}
                    </div>
                </div>
            </div>

            {/* Income vs Expense Monthly Chart */}
            <div className="glass-card p-6 rounded-xl border border-white/5">
                <h3 className="text-lg font-bold mb-4">📈 Thu – Chi theo tháng (6 tháng gần nhất)</h3>
                <div className="h-64">
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

            {/* Project Expense Comparison by Category */}
            <div className="glass-card p-6 rounded-xl border border-white/5">
                <h3 className="text-lg font-bold mb-6">📊 So sánh Chi phí theo Danh mục giữa các Dự án ({getPeriodLabel()})</h3>
                
                {(() => {
                    // Prepare data for project expense comparison
                    const projectExpenseByCategory: Record<string, Record<string, number>> = {};
                    const allCategories = new Set<string>();
                    
                    // Group expenses by project and parent category
                    transactions
                        .filter(tx => tx.type === "OUT")
                        .filter(tx => !filterProject || tx.projectId === filterProject)
                        .filter(tx => {
                            if (viewPeriod === "day") return isToday(new Date(tx.date));
                            if (viewPeriod === "month") return isThisMonth(new Date(tx.date));
                            if (viewPeriod === "quarter") return isThisQuarter(new Date(tx.date));
                            if (viewPeriod === "year") return isThisYear(new Date(tx.date));
                            return true;
                        })
                        .forEach(tx => {
                            const project = projects.find(p => p.id === tx.projectId);
                            if (!project) return;
                            
                            const category = tx.parentCategory || tx.category || "Khác";
                            allCategories.add(category);
                            
                            if (!projectExpenseByCategory[project.name]) {
                                projectExpenseByCategory[project.name] = {};
                            }
                            
                            const convertedAmount = filterCurrency === "ALL" || filterCurrency === tx.currency 
                                ? tx.amount 
                                : convertCurrency(tx.amount, tx.currency, filterCurrency, rates);
                            
                            projectExpenseByCategory[project.name][category] = 
                                (projectExpenseByCategory[project.name][category] || 0) + convertedAmount;
                        });
                    
                    // Prepare chart data
                    const chartData = Array.from(allCategories).map(category => {
                        const dataPoint: any = { category };
                        Object.keys(projectExpenseByCategory).forEach(projectName => {
                            dataPoint[projectName] = projectExpenseByCategory[projectName][category] || 0;
                        });
                        return dataPoint;
                    }).filter(item => {
                        // Only show categories that have expenses
                        return Object.keys(projectExpenseByCategory).some(project => item[project] > 0);
                    }).sort((a, b) => {
                        // Sort by total expense desc
                        const totalA = Object.keys(projectExpenseByCategory).reduce((sum, project) => sum + (a[project] || 0), 0);
                        const totalB = Object.keys(projectExpenseByCategory).reduce((sum, project) => sum + (b[project] || 0), 0);
                        return totalB - totalA;
                    });
                    
                    const projectNames = Object.keys(projectExpenseByCategory);
                    const projectColors = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16", "#ec4899"];
                    
                    return chartData.length > 0 ? (
                        <div className="space-y-6">
                            {/* Bar Chart */}
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis type="number" stroke="#9CA3AF" />
                                        <YAxis 
                                            type="category" 
                                            dataKey="category" 
                                            stroke="#9CA3AF" 
                                            width={120}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <Tooltip
                                            contentStyle={{ 
                                                backgroundColor: '#1f2937', 
                                                border: '1px solid #374151', 
                                                borderRadius: '8px',
                                                color: '#fff'
                                            }}
                                            formatter={(value: number) => [
                                                filterCurrency === "ALL" ? formatCurrency(value) : formatCurrency(value, filterCurrency),
                                                "Chi phí"
                                            ]}
                                        />
                                        <Legend />
                                        {projectNames.map((projectName, idx) => (
                                            <Bar 
                                                key={projectName}
                                                dataKey={projectName} 
                                                fill={projectColors[idx % projectColors.length]}
                                                radius={[0, 4, 4, 0]}
                                            />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            
                            {/* Summary Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-left p-3 text-[var(--muted)] font-medium">Danh mục</th>
                                            {projectNames.map(projectName => (
                                                <th key={projectName} className="text-right p-3 text-[var(--muted)] font-medium">
                                                    {projectName}
                                                </th>
                                            ))}
                                            <th className="text-right p-3 text-[var(--muted)] font-medium">Tổng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chartData.map((item, idx) => {
                                            const total = projectNames.reduce((sum, project) => sum + (item[project] || 0), 0);
                                            return (
                                                <tr key={item.category} className="border-b border-white/5 hover:bg-white/5">
                                                    <td className="p-3 font-medium text-white">{item.category}</td>
                                                    {projectNames.map(projectName => (
                                                        <td key={projectName} className="p-3 text-right text-red-400">
                                                            {item[projectName] > 0 
                                                                ? (filterCurrency === "ALL" ? formatCurrency(item[projectName]) : formatCurrency(item[projectName], filterCurrency))
                                                                : "-"
                                                            }
                                                        </td>
                                                    ))}
                                                    <td className="p-3 text-right font-bold text-red-400">
                                                        {filterCurrency === "ALL" ? formatCurrency(total) : formatCurrency(total, filterCurrency)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-[var(--muted)]">
                            <BarChart3 size={40} className="mx-auto mb-3 opacity-50" />
                            <p>Chưa có dữ liệu chi phí để so sánh</p>
                        </div>
                    );
                })()}
            </div>

            {/* Project Summary with Chart */}
            <div className="glass-card p-6 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">📁 Thu Chi theo Dự án ({getPeriodLabel()})</h3>
                    {projects.filter(p => projectStats[p.id] && (projectStats[p.id].in > 0 || projectStats[p.id].out > 0)).length > 5 && (
                        <button
                            onClick={() => setShowAllProjects(!showAllProjects)}
                            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            {showAllProjects ? "Thu gọn ↑" : `Xem tất cả ↓`}
                        </button>
                    )}
                </div>
                
                {/* Project Chart */}
                <div className="h-56 mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                            data={projects
                                .filter(p => !filterProject || p.id === filterProject)
                                .filter(p => projectStats[p.id] && (projectStats[p.id].in > 0 || projectStats[p.id].out > 0))
                                .slice(0, 6)
                                .map(p => ({
                                    name: p.name.length > 12 ? p.name.substring(0, 12) + '...' : p.name,
                                    thu: projectStats[p.id]?.in || 0,
                                    chi: projectStats[p.id]?.out || 0
                                }))}
                            layout="vertical"
                        >
                            <XAxis type="number" stroke="#525252" />
                            <YAxis type="category" dataKey="name" stroke="#525252" width={100} tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                formatter={(value: number) => filterCurrency === "ALL" ? formatCurrency(value) : formatCurrency(value, filterCurrency)}
                            />
                            <Legend />
                            <Bar dataKey="thu" name="Thu" fill="#4ade80" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="chi" name="Chi" fill="#f87171" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
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
