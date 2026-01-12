"use client";

import { useState, useEffect, useMemo } from "react";
import { getTransactions, getAccounts, getProjects, getFixedCosts } from "@/lib/finance";
import { Transaction, Account, Project, Fund, FixedCost, Currency } from "@/types/finance";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { getUserRole, getAccessibleProjects, hasProjectPermission, Role } from "@/lib/permissions";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];
const CURRENCY_COLORS: Record<string, string> = {
    "VND": "#ef4444",
    "USD": "#3b82f6",
    "KHR": "#22c55e",
    "TRY": "#f59e0b"
};

type ReportType = "overview" | "currency" | "salary" | "fixed-costs" | "project";

export default function ReportsPage() {
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [funds, setFunds] = useState<Fund[]>([]);
    const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("USER");

    // Report Type
    const [reportType, setReportType] = useState<ReportType>("overview");

    // Filters
    const [filterAccount, setFilterAccount] = useState("");
    const [filterProject, setFilterProject] = useState("");
    const [filterFund, setFilterFund] = useState("");
    const [filterMonth, setFilterMonth] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [filterCurrency, setFilterCurrency] = useState<Currency | "ALL">("ALL");
    const [includeImages, setIncludeImages] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            setCurrentUser(parsed);
            setUserRole(getUserRole(parsed));
        }
    }, []);

    // Lọc dự án user có quyền xem báo cáo
    const accessibleProjects = useMemo(() => {
        if (!currentUser) return [];
        if (userRole === "ADMIN") return projects;
        
        const userId = currentUser?.uid || currentUser?.id;
        if (!userId) return [];
        
        return getAccessibleProjects(currentUser, projects).filter(p => 
            hasProjectPermission(userId, p, "view_reports", currentUser)
        );
    }, [currentUser, userRole, projects]);

    const accessibleProjectIds = useMemo(() => accessibleProjects.map(p => p.id), [accessibleProjects]);

    useEffect(() => {
        const loadOptions = async () => {
            try {
                const [accs, projs, fundsData, fcData] = await Promise.all([
                    getAccounts(),
                    getProjects(),
                    getDocs(collection(db, "finance_funds")).then(s => s.docs.map(d => ({ id: d.id, ...d.data() } as Fund))),
                    getFixedCosts()
                ]);
                setAccounts(accs);
                setProjects(projs);
                setFunds(fundsData);
                setFixedCosts(fcData);
            } catch (e) {
                console.error(e);
            }
        };
        loadOptions();
    }, []);

    const getFilteredTransactions = async () => {
        let txs = await getTransactions();

        // Filter theo dự án user có quyền view_reports
        if (userRole !== "ADMIN") {
            const userId = currentUser?.uid || currentUser?.id;
            txs = txs.filter(tx => 
                (tx.projectId && accessibleProjectIds.includes(tx.projectId)) ||
                tx.userId === userId
            );
        }

        if (filterAccount) {
            txs = txs.filter(t => t.accountId === filterAccount);
        }
        if (filterProject) {
            txs = txs.filter(t => t.projectId === filterProject);
        }
        if (filterFund) {
            txs = txs.filter(t => t.fundId === filterFund);
        }
        if (filterCurrency !== "ALL") {
            txs = txs.filter(t => t.currency === filterCurrency);
        }
        if (filterMonth) {
            const [year, month] = filterMonth.split("-");
            txs = txs.filter(t => {
                const d = new Date(t.date);
                return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
            });
        }
        if (filterDateFrom) {
            txs = txs.filter(t => new Date(t.date) >= new Date(filterDateFrom));
        }
        if (filterDateTo) {
            txs = txs.filter(t => new Date(t.date) <= new Date(filterDateTo));
        }

        return txs;
    };

    // Calculate currency breakdown
    const currencyBreakdown = useMemo(() => {
        const breakdown: Record<Currency, { in: number, out: number, count: number }> = {
            VND: { in: 0, out: 0, count: 0 },
            USD: { in: 0, out: 0, count: 0 },
            KHR: { in: 0, out: 0, count: 0 },
            TRY: { in: 0, out: 0, count: 0 }
        };

        transactions.forEach(tx => {
            if (tx.status === "APPROVED") {
                breakdown[tx.currency].count++;
                if (tx.type === "IN") {
                    breakdown[tx.currency].in += tx.amount;
                } else {
                    breakdown[tx.currency].out += tx.amount;
                }
            }
        });

        return breakdown;
    }, [transactions]);

    // Calculate salary report
    const salaryReport = useMemo(() => {
        return transactions
            .filter(tx => 
                tx.status === "APPROVED" && 
                tx.type === "OUT" &&
                (tx.category?.toLowerCase().includes("lương") || tx.category?.toLowerCase().includes("salary"))
            )
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions]);

    const downloadCSV = async () => {
        setLoading(true);
        try {
            const filteredTxs = await getFilteredTransactions();

            const headers = [
                "ID", "Ngày", "Loại", "Số tiền", "Tiền tệ", "Danh mục",
                "Mô tả", "Trạng thái", "Tài khoản", "Dự án", "Quỹ", "Người tạo"
            ];
            if (includeImages) headers.push("Hình ảnh");

            const rows = filteredTxs.map(tx => {
                const row = [
                    tx.id,
                    new Date(tx.date).toLocaleDateString(),
                    tx.type === "IN" ? "Thu" : "Chi",
                    tx.amount,
                    tx.currency,
                    `"${tx.category}"`,
                    `"${tx.description || ""}"`,
                    tx.status,
                    accounts.find(a => a.id === tx.accountId)?.name || tx.accountId,
                    projects.find(p => p.id === tx.projectId)?.name || tx.projectId || "",
                    funds.find(f => f.id === tx.fundId)?.name || tx.fundId || "",
                    tx.createdBy
                ];
                if (includeImages) {
                    row.push(tx.images?.join("; ") || "");
                }
                return row;
            });

            const csvContent =
                "data:text/csv;charset=utf-8," +
                [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            const filename = `bao_cao_tai_chinh_${filterCurrency !== "ALL" ? filterCurrency + "_" : ""}${new Date().toISOString().split('T')[0]}.csv`;
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error("Export failed", error);
            alert("Lỗi khi xuất báo cáo");
        } finally {
            setLoading(false);
        }
    };

    const downloadPDF = async () => {
        setLoading(true);
        try {
            const filteredTxs = await getFilteredTransactions();

            const printContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Báo cáo Tài chính ${filterCurrency !== "ALL" ? `- ${filterCurrency}` : ""}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #333; margin-bottom: 10px; }
                        .meta { color: #666; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                        th { background-color: #f5f5f5; font-weight: bold; }
                        tr:nth-child(even) { background-color: #fafafa; }
                        .income { color: green; }
                        .expense { color: red; }
                        .summary { margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
                        .currency-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
                        .currency-VND { background: #fee2e2; color: #dc2626; }
                        .currency-USD { background: #dbeafe; color: #2563eb; }
                        .currency-KHR { background: #dcfce7; color: #16a34a; }
                        .currency-TRY { background: #fef3c7; color: #d97706; }
                        ${includeImages ? '.img-cell img { max-width: 100px; max-height: 60px; }' : ''}
                    </style>
                </head>
                <body>
                    <h1>Báo cáo Tài chính ${filterCurrency !== "ALL" ? `- Tiền ${filterCurrency}` : ""}</h1>
                    <div class="meta">
                        Xuất lúc: ${new Date().toLocaleString()}<br/>
                        ${filterCurrency !== "ALL" ? `<strong>Loại tiền:</strong> ${filterCurrency}<br/>` : ""}
                        ${filterAccount ? `Tài khoản: ${accounts.find(a => a.id === filterAccount)?.name}<br/>` : ""}
                        ${filterProject ? `Dự án: ${projects.find(p => p.id === filterProject)?.name}<br/>` : ""}
                        ${filterFund ? `Quỹ: ${funds.find(f => f.id === filterFund)?.name}<br/>` : ""}
                        ${filterMonth ? `Tháng: ${filterMonth}<br/>` : ""}
                        ${filterDateFrom || filterDateTo ? `Khoảng thời gian: ${filterDateFrom || "..."} đến ${filterDateTo || "..."}<br/>` : ""}
                    </div>
                    
                    <div class="summary">
                        <strong>Tổng giao dịch:</strong> ${filteredTxs.length}<br/>
                        <strong>Tổng thu:</strong> ${filteredTxs.filter(t => t.type === "IN").reduce((sum, t) => sum + t.amount, 0).toLocaleString()} ${filterCurrency !== "ALL" ? filterCurrency : ""}<br/>
                        <strong>Tổng chi:</strong> ${filteredTxs.filter(t => t.type === "OUT").reduce((sum, t) => sum + t.amount, 0).toLocaleString()} ${filterCurrency !== "ALL" ? filterCurrency : ""}
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Ngày</th>
                                <th>Loại</th>
                                <th>Số tiền</th>
                                <th>Tiền tệ</th>
                                <th>Danh mục</th>
                                <th>Mô tả</th>
                                <th>Trạng thái</th>
                                ${includeImages ? '<th>Ảnh</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredTxs.map((tx, idx) => `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td>${new Date(tx.date).toLocaleDateString('vi-VN')}</td>
                                    <td class="${tx.type === "IN" ? "income" : "expense"}">${tx.type === "IN" ? "Thu" : "Chi"}</td>
                                    <td>${tx.amount.toLocaleString()}</td>
                                    <td><span class="currency-badge currency-${tx.currency}">${tx.currency}</span></td>
                                    <td>${tx.category}</td>
                                    <td>${tx.description || "-"}</td>
                                    <td>${tx.status === "APPROVED" ? "Đã duyệt" : tx.status === "PENDING" ? "Chờ duyệt" : "Từ chối"}</td>
                                    ${includeImages ? `<td class="img-cell">${tx.images?.map(img => `<img src="${img}" />`).join("") || "-"}</td>` : ""}
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </body>
                </html>
            `;

            const printWindow = window.open("", "_blank");
            if (printWindow) {
                printWindow.document.write(printContent);
                printWindow.document.close();
                printWindow.print();
            }

        } catch (error) {
            console.error("PDF export failed", error);
            alert("Lỗi khi xuất PDF");
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        setFilterAccount("");
        setFilterProject("");
        setFilterFund("");
        setFilterMonth("");
        setFilterDateFrom("");
        setFilterDateTo("");
        setFilterCurrency("ALL");
    };

    // Load transactions for preview - filter theo quyền
    useEffect(() => {
        const loadTxs = async () => {
            if (!currentUser) return;
            
            let txs = await getTransactions();
            
            // Filter theo dự án user có quyền view_reports
            if (userRole !== "ADMIN") {
                const userId = currentUser?.uid || currentUser?.id;
                txs = txs.filter(tx => 
                    (tx.projectId && accessibleProjectIds.includes(tx.projectId)) ||
                    tx.userId === userId
                );
            }
            
            setTransactions(txs);
        };
        if (currentUser && projects.length > 0) {
            loadTxs();
        }
    }, [currentUser, userRole, accessibleProjectIds, projects]);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Báo cáo</h1>
                <p className="text-[var(--muted)]">Xuất dữ liệu và xem báo cáo chi tiết</p>
            </div>

            {/* Report Type Tabs */}
            <div className="flex gap-2 flex-wrap">
                {[
                    { key: "overview", label: "Tổng quan", icon: "📊" },
                    { key: "currency", label: "Theo Tiền tệ", icon: "💱" },
                    { key: "salary", label: "Chi Lương", icon: "💰" },
                    { key: "fixed-costs", label: "Chi phí Cố định", icon: "📋" },
                    { key: "project", label: "Theo Dự án", icon: "📁" }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setReportType(tab.key as ReportType)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            reportType === tab.key
                                ? "bg-gradient-to-r from-[#FF5E62] to-[#FF9966] text-white shadow-lg"
                                : "bg-white/5 text-[var(--muted)] hover:text-white hover:bg-white/10"
                        }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Currency Report - Tách riêng theo tiền tệ */}
            {reportType === "currency" && (
                <div className="space-y-6">
                    <div className="glass-card p-6 rounded-xl border border-white/5">
                        <h3 className="text-lg font-bold mb-6">📊 Báo cáo theo Loại tiền (Không quy đổi)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {(["VND", "USD", "KHR", "TRY"] as Currency[]).map(currency => {
                                const data = currencyBreakdown[currency];
                                const net = data.in - data.out;
                                return (
                                    <div 
                                        key={currency} 
                                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                                            filterCurrency === currency 
                                                ? 'border-white/40 bg-white/10' 
                                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                                        }`}
                                        onClick={() => setFilterCurrency(filterCurrency === currency ? "ALL" : currency)}
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            <div 
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: CURRENCY_COLORS[currency] }}
                                            />
                                            <span className="text-xl font-bold text-white">{currency}</span>
                                            {filterCurrency === currency && (
                                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Đang lọc</span>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-[var(--muted)]">Thu:</span>
                                                <span className="font-bold text-green-400">+{data.in.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-[var(--muted)]">Chi:</span>
                                                <span className="font-bold text-red-400">-{data.out.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between pt-2 border-t border-white/10">
                                                <span className="text-[var(--muted)]">Ròng:</span>
                                                <span className={`font-bold ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {net >= 0 ? '+' : ''}{net.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="text-xs text-[var(--muted)] mt-2">
                                                {data.count} giao dịch
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Currency Chart */}
                    <div className="glass-card p-6 rounded-xl border border-white/5">
                        <h3 className="text-lg font-bold mb-4">Biểu đồ Thu Chi theo Tiền tệ</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={Object.entries(currencyBreakdown).map(([currency, data]) => ({
                                    currency,
                                    Thu: data.in,
                                    Chi: data.out
                                }))}>
                                    <XAxis dataKey="currency" stroke="#525252" />
                                    <YAxis stroke="#525252" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                        formatter={(value: number) => value.toLocaleString()}
                                    />
                                    <Legend />
                                    <Bar dataKey="Thu" fill="#4ade80" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Chi" fill="#f87171" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Salary Report - Báo cáo lương chi tiết */}
            {reportType === "salary" && (
                <div className="glass-card p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold mb-4">💰 Báo cáo Chi Lương Chi tiết</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#1a1a1a] text-[var(--muted)] text-xs uppercase">
                                <tr>
                                    <th className="p-4 border-b border-white/10">STT</th>
                                    <th className="p-4 border-b border-white/10">Ngày thanh toán</th>
                                    <th className="p-4 border-b border-white/10 text-right">Số tiền</th>
                                    <th className="p-4 border-b border-white/10">Tiền tệ</th>
                                    <th className="p-4 border-b border-white/10">Mô tả</th>
                                    <th className="p-4 border-b border-white/10">Người tạo</th>
                                    <th className="p-4 border-b border-white/10">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {salaryReport.map((tx, idx) => (
                                    <tr key={tx.id} className="hover:bg-white/5">
                                        <td className="p-4 text-[var(--muted)]">{idx + 1}</td>
                                        <td className="p-4 font-medium text-white">
                                            {new Date(tx.date).toLocaleDateString('vi-VN', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="p-4 text-right font-bold text-red-400">
                                            {tx.amount.toLocaleString()}
                                        </td>
                                        <td className="p-4">
                                            <span 
                                                className="px-2 py-1 rounded text-xs font-medium"
                                                style={{ 
                                                    backgroundColor: CURRENCY_COLORS[tx.currency] + '30', 
                                                    color: CURRENCY_COLORS[tx.currency] 
                                                }}
                                            >
                                                {tx.currency}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[var(--muted)] max-w-[250px] truncate">
                                            {tx.description || "-"}
                                        </td>
                                        <td className="p-4 text-[var(--muted)]">{tx.createdBy}</td>
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
                                {salaryReport.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-[var(--muted)]">
                                            Chưa có dữ liệu chi lương
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Salary Summary by Currency */}
                    {salaryReport.length > 0 && (
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                            {(["VND", "USD", "KHR", "TRY"] as Currency[]).map(currency => {
                                const total = salaryReport
                                    .filter(tx => tx.currency === currency)
                                    .reduce((sum, tx) => sum + tx.amount, 0);
                                const count = salaryReport.filter(tx => tx.currency === currency).length;
                                if (total === 0) return null;
                                return (
                                    <div key={currency} className="p-4 bg-white/5 rounded-lg border border-white/10">
                                        <div className="text-xs text-[var(--muted)] mb-1">Tổng lương {currency}</div>
                                        <div className="text-xl font-bold text-red-400">
                                            {total.toLocaleString()} {currency}
                                        </div>
                                        <div className="text-xs text-[var(--muted)] mt-1">{count} giao dịch</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Fixed Costs Report */}
            {reportType === "fixed-costs" && (
                <div className="glass-card p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold mb-4">📋 Báo cáo Chi phí Cố định</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#1a1a1a] text-[var(--muted)] text-xs uppercase">
                                <tr>
                                    <th className="p-4 border-b border-white/10">Tên</th>
                                    <th className="p-4 border-b border-white/10">Hạng mục</th>
                                    <th className="p-4 border-b border-white/10 text-right">Số tiền</th>
                                    <th className="p-4 border-b border-white/10">Tiền tệ</th>
                                    <th className="p-4 border-b border-white/10">Chu kỳ</th>
                                    <th className="p-4 border-b border-white/10">Trạng thái</th>
                                    <th className="p-4 border-b border-white/10">Thanh toán gần nhất</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {fixedCosts.map(fc => (
                                    <tr key={fc.id} className="hover:bg-white/5">
                                        <td className="p-4 font-medium text-white">{fc.name}</td>
                                        <td className="p-4 text-[var(--muted)]">{fc.category || "Khác"}</td>
                                        <td className="p-4 text-right font-bold text-white">
                                            {fc.amount.toLocaleString()}
                                        </td>
                                        <td className="p-4">
                                            <span 
                                                className="px-2 py-1 rounded text-xs font-medium"
                                                style={{ 
                                                    backgroundColor: CURRENCY_COLORS[fc.currency] + '30', 
                                                    color: CURRENCY_COLORS[fc.currency] 
                                                }}
                                            >
                                                {fc.currency}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[var(--muted)]">
                                            {fc.cycle === "MONTHLY" ? "Hàng tháng" : fc.cycle === "QUARTERLY" ? "Hàng quý" : "Hàng năm"}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                fc.status === "ON" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                            }`}>
                                                {fc.status === "ON" ? "Hoạt động" : "Tạm dừng"}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[var(--muted)]">
                                            {fc.lastPaymentDate ? new Date(fc.lastPaymentDate).toLocaleDateString('vi-VN') : "-"}
                                        </td>
                                    </tr>
                                ))}
                                {fixedCosts.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-[var(--muted)]">
                                            Chưa có chi phí cố định
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Fixed Cost Summary by Category */}
                    {fixedCosts.length > 0 && (
                        <div className="mt-6">
                            <h4 className="text-sm font-bold mb-4 text-[var(--muted)]">Tổng hợp theo Hạng mục</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.entries(
                                    fixedCosts
                                        .filter(fc => fc.status === "ON")
                                        .reduce((acc, fc) => {
                                            const cat = fc.category || "Khác";
                                            if (!acc[cat]) acc[cat] = { VND: 0, USD: 0, KHR: 0, TRY: 0 };
                                            acc[cat][fc.currency] += fc.amount;
                                            return acc;
                                        }, {} as Record<string, Record<Currency, number>>)
                                ).map(([category, amounts]) => (
                                    <div key={category} className="p-4 bg-white/5 rounded-lg border border-white/10">
                                        <div className="text-sm font-medium text-white mb-2">{category}</div>
                                        {Object.entries(amounts)
                                            .filter(([_, amount]) => amount > 0)
                                            .map(([currency, amount]) => (
                                                <div key={currency} className="flex justify-between text-sm">
                                                    <span className="text-[var(--muted)]">{currency}:</span>
                                                    <span className="font-bold" style={{ color: CURRENCY_COLORS[currency] }}>
                                                        {amount.toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Overview & Export */}
            {(reportType === "overview" || reportType === "project") && (
                <>
                    {/* Filters */}
                    <div className="glass-card p-6 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">Bộ lọc</h3>
                            <button
                                onClick={clearFilters}
                                className="text-sm text-[var(--muted)] hover:text-white"
                            >
                                Xóa bộ lọc
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {/* Currency Filter - NEW */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Loại tiền</label>
                                <select
                                    value={filterCurrency}
                                    onChange={e => setFilterCurrency(e.target.value as Currency | "ALL")}
                                    className="glass-input w-full p-2 rounded-lg"
                                >
                                    <option value="ALL">Tất cả tiền tệ</option>
                                    <option value="VND">🇻🇳 VND</option>
                                    <option value="USD">🇺🇸 USD</option>
                                    <option value="KHR">🇰🇭 KHR</option>
                                    <option value="TRY">🇹🇷 TRY (Lira)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tài khoản</label>
                                <select
                                    value={filterAccount}
                                    onChange={e => setFilterAccount(e.target.value)}
                                    className="glass-input w-full p-2 rounded-lg"
                                >
                                    <option value="">Tất cả</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Dự án</label>
                                <select
                                    value={filterProject}
                                    onChange={e => setFilterProject(e.target.value)}
                                    className="glass-input w-full p-2 rounded-lg"
                                >
                                    <option value="">Tất cả</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Quỹ</label>
                                <select
                                    value={filterFund}
                                    onChange={e => setFilterFund(e.target.value)}
                                    className="glass-input w-full p-2 rounded-lg"
                                >
                                    <option value="">Tất cả</option>
                                    {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tháng</label>
                                <input
                                    type="month"
                                    value={filterMonth}
                                    onChange={e => setFilterMonth(e.target.value)}
                                    className="glass-input w-full p-2 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Từ ngày</label>
                                <input
                                    type="date"
                                    value={filterDateFrom}
                                    onChange={e => setFilterDateFrom(e.target.value)}
                                    className="glass-input w-full p-2 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Đến ngày</label>
                                <input
                                    type="date"
                                    value={filterDateTo}
                                    onChange={e => setFilterDateTo(e.target.value)}
                                    className="glass-input w-full p-2 rounded-lg"
                                />
                            </div>
                            <div className="flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={includeImages}
                                        onChange={e => setIncludeImages(e.target.checked)}
                                        className="w-4 h-4 rounded"
                                    />
                                    <span className="text-sm text-[var(--muted)]">Bao gồm hình ảnh</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Export Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="glass-card p-6 rounded-xl">
                            <h3 className="text-xl font-bold text-white mb-2">Xuất Excel (CSV)</h3>
                            <p className="text-[var(--muted)] text-sm mb-6">
                                Tải file CSV chứa tất cả giao dịch theo bộ lọc đã chọn.
                                {filterCurrency !== "ALL" && (
                                    <span className="block mt-1 text-blue-400">
                                        Đang lọc: Chỉ tiền {filterCurrency}
                                    </span>
                                )}
                            </p>
                            <button
                                onClick={downloadCSV}
                                disabled={loading}
                                className="glass-button w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white border-none"
                            >
                                {loading ? "Đang xuất..." : "📊 Tải CSV"}
                            </button>
                        </div>

                        <div className="glass-card p-6 rounded-xl">
                            <h3 className="text-xl font-bold text-white mb-2">Xuất PDF</h3>
                            <p className="text-[var(--muted)] text-sm mb-6">
                                Tạo báo cáo PDF có định dạng với bảng biểu và tổng kết.
                                {filterCurrency !== "ALL" && (
                                    <span className="block mt-1 text-blue-400">
                                        Đang lọc: Chỉ tiền {filterCurrency}
                                    </span>
                                )}
                            </p>
                            <button
                                onClick={downloadPDF}
                                disabled={loading}
                                className="glass-button w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white border-none"
                            >
                                {loading ? "Đang xuất..." : "📄 Tải PDF"}
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="glass-card p-6 rounded-xl">
                        <h3 className="text-lg font-bold mb-4">Thống kê nhanh</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-white/5 rounded-lg">
                                <div className="text-xs text-[var(--muted)] mb-1">Tổng giao dịch</div>
                                <div className="text-2xl font-bold text-white">{transactions.length}</div>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                                <div className="text-xs text-[var(--muted)] mb-1">Đã duyệt</div>
                                <div className="text-2xl font-bold text-green-400">
                                    {transactions.filter(t => t.status === "APPROVED").length}
                                </div>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                                <div className="text-xs text-[var(--muted)] mb-1">Chờ duyệt</div>
                                <div className="text-2xl font-bold text-yellow-400">
                                    {transactions.filter(t => t.status === "PENDING").length}
                                </div>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                                <div className="text-xs text-[var(--muted)] mb-1">Từ chối</div>
                                <div className="text-2xl font-bold text-red-400">
                                    {transactions.filter(t => t.status === "REJECTED").length}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
