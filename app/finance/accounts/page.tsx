"use client";

import { useEffect, useState, useMemo } from "react";
import CreateAccountModal from "@/components/finance/CreateAccountModal";
import EditAccountModal from "@/components/finance/EditAccountModal";
import { getAccounts, getTransactions, getProjects } from "@/lib/finance";
import { Account, Transaction } from "@/types/finance";
import { getExchangeRates, convertCurrency } from "@/lib/currency";
import { updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { getUserRole, Role } from "@/lib/permissions";
import { Plus, Lock, Unlock, Edit2, History, Wallet, Search, Trash2, Building2, Banknote, Smartphone } from "lucide-react";

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [projects, setProjects] = useState<Record<string, string>>({});
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<Role>("USER");
    const [rates, setRates] = useState<any>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCurrency, setFilterCurrency] = useState("");
    const [filterType, setFilterType] = useState("");

    const fetchData = async () => {
        setLoading(true);
        try {
            const [accs, txs, projs, exchangeRates] = await Promise.all([
                getAccounts(),
                getTransactions(),
                getProjects(),
                getExchangeRates()
            ]);
            setAccounts(accs);
            setTransactions(txs);
            const pMap: Record<string, string> = {};
            projs.forEach(p => pMap[p.id] = p.name);
            setProjects(pMap);
            setRates(exchangeRates);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const u = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (u) setUserRole(getUserRole(JSON.parse(u)));
        fetchData();
    }, []);

    const toggleLock = async (acc: Account) => {
        if (!confirm(`Bạn có chắc muốn ${acc.isLocked ? "MỞ KHÓA" : "KHÓA"} tài khoản "${acc.name}"?`)) return;
        try {
            await updateDoc(doc(db, "finance_accounts", acc.id), { isLocked: !acc.isLocked });
            fetchData();
        } catch (e) {
            console.error("Failed to toggle lock", e);
        }
    };

    const deleteAccount = async (acc: Account) => {
        const hasTransactions = transactions.some(tx => tx.accountId === acc.id);
        if (hasTransactions) {
            alert(`Không thể xóa tài khoản "${acc.name}" vì đã có giao dịch liên quan.\n\nBạn có thể KHÓA tài khoản thay vì xóa.`);
            return;
        }
        if (acc.balance !== 0) {
            alert(`Không thể xóa tài khoản "${acc.name}" vì số dư khác 0.`);
            return;
        }
        if (!confirm(`Bạn có chắc muốn XÓA VĨNH VIỄN tài khoản "${acc.name}"?\n\nHành động này không thể hoàn tác!`)) return;
        try {
            await deleteDoc(doc(db, "finance_accounts", acc.id));
            fetchData();
        } catch (e) {
            console.error("Failed to delete account", e);
            alert("Lỗi khi xóa tài khoản");
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "BANK": return <Building2 size={12} className="inline" />;
            case "CASH": return <Banknote size={12} className="inline" />;
            case "E-WALLET": return <Smartphone size={12} className="inline" />;
            default: return <Wallet size={12} className="inline" />;
        }
    };

    // Calculate metrics per account
    const accountMetrics = useMemo(() => {
        const metrics: Record<string, { moneyIn: number; moneyOut: number; txCount: number }> = {};
        accounts.forEach(acc => {
            metrics[acc.id] = { moneyIn: 0, moneyOut: 0, txCount: 0 };
        });
        transactions.forEach(tx => {
            if (tx.status === "APPROVED" && metrics[tx.accountId]) {
                metrics[tx.accountId].txCount++;
                if (tx.type === "IN") metrics[tx.accountId].moneyIn += tx.amount;
                else metrics[tx.accountId].moneyOut += tx.amount;
            }
        });
        return metrics;
    }, [accounts, transactions]);

    // Filter accounts
    const filteredAccounts = useMemo(() => {
        return accounts.filter(acc => {
            if (searchTerm && !acc.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            if (filterCurrency && acc.currency !== filterCurrency) return false;
            if (filterType && acc.type !== filterType) return false;
            return true;
        });
    }, [accounts, searchTerm, filterCurrency, filterType]);

    // Summary stats
    const totalBalanceUSD = accounts.reduce((sum, a) => sum + convertCurrency(a.balance, a.currency, "USD", rates), 0);

    const currencies = Array.from(new Set(accounts.map(a => a.currency)));
    const types = Array.from(new Set(accounts.map(a => a.type)));

    if (loading) return <div className="p-8 text-[var(--muted)] text-sm">Đang tải...</div>;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-white">Tài khoản Ngân hàng/Tiền mặt</h1>
                    <p className="text-[10px] text-[var(--muted)]">Quản lý số dư và phân quyền</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                >
                    <Plus size={14} /> Thêm tài khoản
                </button>
            </div>

            {/* Total Summary */}
            <div className="glass-card p-4 rounded-xl flex justify-between items-center bg-gradient-to-r from-emerald-900/30 to-transparent border border-emerald-500/20">
                <div>
                    <p className="text-[var(--muted)] text-xs uppercase font-semibold">Tổng thanh khoản (Quy đổi USD)</p>
                    <h2 className="text-2xl font-bold text-emerald-400 mt-1">${totalBalanceUSD.toLocaleString()}</h2>
                </div>
                <div className="text-right">
                    <p className="text-xs text-[var(--muted)]">{accounts.length} tài khoản</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[150px] max-w-[200px]">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                        type="text"
                        placeholder="Tìm tài khoản..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="glass-input w-full pl-8 pr-3 py-1.5 rounded-lg text-xs"
                    />
                </div>
                <select
                    value={filterCurrency}
                    onChange={e => setFilterCurrency(e.target.value)}
                    className="glass-input px-2 py-1.5 rounded-lg text-xs"
                >
                    <option value="">Tất cả tiền tệ</option>
                    {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="glass-input px-2 py-1.5 rounded-lg text-xs"
                >
                    <option value="">Tất cả loại</option>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {(searchTerm || filterCurrency || filterType) && (
                    <button
                        onClick={() => { setSearchTerm(""); setFilterCurrency(""); setFilterType(""); }}
                        className="text-[10px] text-[var(--muted)] hover:text-white"
                    >
                        Xóa lọc
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-[#1a1a1a] text-[var(--muted)] uppercase text-[10px] font-semibold tracking-wider">
                            <tr>
                                <th className="p-3 border-b border-white/10">Tên tài khoản</th>
                                <th className="p-3 border-b border-white/10">Loại</th>
                                <th className="p-3 border-b border-white/10">Tiền tệ</th>
                                <th className="p-3 border-b border-white/10 text-right">Đầu kỳ</th>
                                <th className="p-3 border-b border-white/10 text-right text-green-400">Tổng thu</th>
                                <th className="p-3 border-b border-white/10 text-right text-red-400">Tổng chi</th>
                                <th className="p-3 border-b border-white/10 text-right">Số dư</th>
                                <th className="p-3 border-b border-white/10">Dự án</th>
                                <th className="p-3 border-b border-white/10 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredAccounts.map(acc => {
                                const metrics = accountMetrics[acc.id] || { moneyIn: 0, moneyOut: 0, txCount: 0 };
                                return (
                                    <tr key={acc.id} className={`hover:bg-white/5 transition-colors ${acc.isLocked ? "bg-red-500/5" : ""}`}>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                {acc.isLocked && <Lock size={12} className="text-red-400" />}
                                                <span className="font-medium text-white">{acc.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <span className="flex items-center gap-1 text-[var(--muted)]">
                                                {getTypeIcon(acc.type)} {acc.type}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono">{acc.currency}</span>
                                        </td>
                                        <td className="p-3 text-right text-[var(--muted)]">
                                            {(acc.openingBalance || 0).toLocaleString()}
                                        </td>
                                        <td className="p-3 text-right text-green-400 font-medium">
                                            +{metrics.moneyIn.toLocaleString()}
                                        </td>
                                        <td className="p-3 text-right text-red-400 font-medium">
                                            -{metrics.moneyOut.toLocaleString()}
                                        </td>
                                        <td className="p-3 text-right font-bold text-white">
                                            {acc.balance.toLocaleString()}
                                        </td>
                                        <td className="p-3">
                                            {acc.projectId ? (
                                                <span className="text-blue-400 text-[10px]">{projects[acc.projectId] || "N/A"}</span>
                                            ) : (
                                                <span className="text-[var(--muted)]">-</span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex justify-center gap-1">
                                                <button
                                                    onClick={() => setEditingAccount(acc)}
                                                    className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-blue-400 transition-colors"
                                                    title="Sửa"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => toggleLock(acc)}
                                                    className={`p-1.5 rounded transition-colors ${
                                                        acc.isLocked 
                                                            ? "text-red-400 hover:bg-red-500/20" 
                                                            : "text-[var(--muted)] hover:text-yellow-400 hover:bg-white/10"
                                                    }`}
                                                    title={acc.isLocked ? "Mở khóa" : "Khóa"}
                                                >
                                                    {acc.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                                </button>
                                                <button
                                                    onClick={() => deleteAccount(acc)}
                                                    className="p-1.5 rounded hover:bg-red-500/20 text-[var(--muted)] hover:text-red-400 transition-colors"
                                                    title="Xóa"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                                <Link
                                                    href={`/finance/transactions?account=${acc.id}`}
                                                    className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-blue-400 transition-colors"
                                                    title="Xem lịch sử"
                                                >
                                                    <History size={14} />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredAccounts.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-[var(--muted)]">
                                        {accounts.length === 0 ? "Chưa có tài khoản nào" : "Không tìm thấy tài khoản phù hợp"}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            <CreateAccountModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchData}
            />
            <EditAccountModal
                isOpen={!!editingAccount}
                onClose={() => setEditingAccount(null)}
                onSuccess={fetchData}
                account={editingAccount}
            />
        </div>
    );
}
