"use client";

import { useState, useEffect } from "react";
import { getTransactions, getAccounts, getProjects } from "@/lib/finance";
import { Transaction, Account, Project, Fund } from "@/types/finance";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function ReportsPage() {
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [funds, setFunds] = useState<Fund[]>([]);

    // Filters
    const [filterAccount, setFilterAccount] = useState("");
    const [filterProject, setFilterProject] = useState("");
    const [filterFund, setFilterFund] = useState("");
    const [filterMonth, setFilterMonth] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [includeImages, setIncludeImages] = useState(false);

    useEffect(() => {
        const loadOptions = async () => {
            try {
                const [accs, projs, fundsData] = await Promise.all([
                    getAccounts(),
                    getProjects(),
                    getDocs(collection(db, "finance_funds")).then(s => s.docs.map(d => ({ id: d.id, ...d.data() } as Fund)))
                ]);
                setAccounts(accs);
                setProjects(projs);
                setFunds(fundsData);
            } catch (e) {
                console.error(e);
            }
        };
        loadOptions();
    }, []);

    const getFilteredTransactions = async () => {
        let txs = await getTransactions();

        if (filterAccount) {
            txs = txs.filter(t => t.accountId === filterAccount);
        }
        if (filterProject) {
            txs = txs.filter(t => t.projectId === filterProject);
        }
        if (filterFund) {
            txs = txs.filter(t => t.fundId === filterFund);
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

    const downloadCSV = async () => {
        setLoading(true);
        try {
            const filteredTxs = await getFilteredTransactions();

            // Define Headers
            const headers = [
                "ID", "Ngày", "Loại", "Số tiền", "Tiền tệ", "Danh mục",
                "Mô tả", "Trạng thái", "Tài khoản", "Dự án", "Quỹ", "Người tạo"
            ];
            if (includeImages) headers.push("Hình ảnh");

            // Map Data
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

            // Combine
            const csvContent =
                "data:text/csv;charset=utf-8," +
                [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

            // Trigger Download
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            const filename = `bao_cao_tai_chinh_${new Date().toISOString().split('T')[0]}.csv`;
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

            // Create printable HTML
            const printContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Báo cáo Tài chính</title>
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
                        ${includeImages ? '.img-cell img { max-width: 100px; max-height: 60px; }' : ''}
                    </style>
                </head>
                <body>
                    <h1>Báo cáo Tài chính</h1>
                    <div class="meta">
                        Xuất lúc: ${new Date().toLocaleString()}<br/>
                        ${filterAccount ? `Tài khoản: ${accounts.find(a => a.id === filterAccount)?.name}<br/>` : ""}
                        ${filterProject ? `Dự án: ${projects.find(p => p.id === filterProject)?.name}<br/>` : ""}
                        ${filterFund ? `Quỹ: ${funds.find(f => f.id === filterFund)?.name}<br/>` : ""}
                        ${filterMonth ? `Tháng: ${filterMonth}<br/>` : ""}
                        ${filterDateFrom || filterDateTo ? `Khoảng thời gian: ${filterDateFrom || "..."} đến ${filterDateTo || "..."}<br/>` : ""}
                    </div>
                    
                    <div class="summary">
                        <strong>Tổng giao dịch:</strong> ${filteredTxs.length}<br/>
                        <strong>Tổng thu:</strong> ${filteredTxs.filter(t => t.type === "IN").reduce((sum, t) => sum + t.amount, 0).toLocaleString()}<br/>
                        <strong>Tổng chi:</strong> ${filteredTxs.filter(t => t.type === "OUT").reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Ngày</th>
                                <th>Loại</th>
                                <th>Số tiền</th>
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
                                    <td>${new Date(tx.date).toLocaleDateString()}</td>
                                    <td class="${tx.type === "IN" ? "income" : "expense"}">${tx.type === "IN" ? "Thu" : "Chi"}</td>
                                    <td>${tx.amount.toLocaleString()} ${tx.currency}</td>
                                    <td>${tx.category}</td>
                                    <td>${tx.description || "-"}</td>
                                    <td>${tx.status}</td>
                                    ${includeImages ? `<td class="img-cell">${tx.images?.map(img => `<img src="${img}" />`).join("") || "-"}</td>` : ""}
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </body>
                </html>
            `;

            // Open print window
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
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Báo cáo</h1>
                <p className="text-[var(--muted)]">Xuất dữ liệu để phân tích bên ngoài</p>
            </div>

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
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tài khoản</label>
                        <select
                            value={filterAccount}
                            onChange={e => setFilterAccount(e.target.value)}
                            className="glass-input w-full p-2 rounded-lg"
                        >
                            <option value="">Tất cả</option>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
                <p className="text-[var(--muted)] text-sm">
                    Chọn bộ lọc và nhấn xuất để xem dữ liệu chi tiết. Báo cáo CSV có thể mở bằng Excel, Google Sheets.
                    Báo cáo PDF sử dụng chức năng in của trình duyệt.
                </p>
            </div>
        </div>
    );
}
