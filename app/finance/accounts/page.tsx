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
import { Plus, Lock, Unlock, Edit2, History, Wallet, Trash2, Building2, Banknote, Smartphone } from "lucide-react";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import DataTable, { ActionCell } from "@/components/finance/DataTable";

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [projects, setProjects] = useState<Record<string, string>>({});
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<Role>("USER");
    const [rates, setRates] = useState<any>({});

    // Filters
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        currency: "",
        type: "",
        projectId: ""
    });
    const [searchTerm, setSearchTerm] = useState("");

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
            if (activeFilters.currency && acc.currency !== activeFilters.currency) return false;
            if (activeFilters.type && acc.type !== activeFilters.type) return false;
            if (activeFilters.projectId && acc.projectId !== activeFilters.projectId) return false;
            return true;
        });
    }, [accounts, searchTerm, activeFilters]);

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

            {/* Dashboard Toolbar */}
            <DataTableToolbar
                searchPlaceholder="Tìm tên tài khoản..."
                onSearch={setSearchTerm}
                activeFilters={activeFilters}
                onFilterChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                onReset={() => {
                    setActiveFilters({ currency: "", type: "", projectId: "" });
                    setSearchTerm("");
                }}
                onExport={() => exportToCSV(filteredAccounts, "Danh_Sach_Tai_Khoan", {
                    name: "Tên tài khoản",
                    type: "Loại",
                    currency: "Tiền tệ",
                    balance: "Số dư",
                    projectId: "Mã dự án"
                })}
                onAdd={userRole === "ADMIN" ? () => setIsCreateModalOpen(true) : undefined}
                addLabel="Thêm tài khoản"
                filters={[
                    {
                        id: "type",
                        label: "Loại tài khoản",
                        options: types.map(t => ({ value: t, label: t }))
                    },
                    {
                        id: "currency",
                        label: "Tiền tệ",
                        options: currencies.map(c => ({ value: c, label: c }))
                    },
                    {
                        id: "projectId",
                        label: "Dự án",
                        options: Object.entries(projects).map(([id, name]) => ({ value: id, label: name as string })),
                        advanced: true
                    }
                ]}
            />

            {/* Table */}
            <DataTable
                data={filteredAccounts}
                colorScheme="green"
                emptyMessage={accounts.length === 0 ? "Chưa có tài khoản nào" : "Không tìm thấy tài khoản phù hợp"}
                showIndex={false}
                columns={[
                    {
                        key: "name",
                        header: "Tên tài khoản",
                        render: (acc) => (
                            <div className="flex items-center gap-2">
                                {acc.isLocked && <Lock size={12} className="text-red-400" />}
                                <span className="font-medium text-white">{acc.name}</span>
                            </div>
                        )
                    },
                    {
                        key: "type",
                        header: "Loại",
                        render: (acc) => (
                            <span className="flex items-center gap-1 text-white/70">
                                {getTypeIcon(acc.type)} {acc.type}
                            </span>
                        )
                    },
                    {
                        key: "currency",
                        header: "Tiền tệ",
                        render: (acc) => (
                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono">{acc.currency}</span>
                        )
                    },
                    {
                        key: "openingBalance",
                        header: "Đầu kỳ",
                        align: "right",
                        render: (acc) => (
                            <span className="text-white/70">{(acc.openingBalance || 0).toLocaleString()}</span>
                        )
                    },
                    {
                        key: "moneyIn",
                        header: "Tổng thu",
                        align: "right",
                        render: (acc) => {
                            const metrics = accountMetrics[acc.id] || { moneyIn: 0, moneyOut: 0, txCount: 0 };
                            return <span className="text-green-400 font-medium">+{metrics.moneyIn.toLocaleString()}</span>;
                        }
                    },
                    {
                        key: "moneyOut",
                        header: "Tổng chi",
                        align: "right",
                        render: (acc) => {
                            const metrics = accountMetrics[acc.id] || { moneyIn: 0, moneyOut: 0, txCount: 0 };
                            return <span className="text-red-400 font-medium">-{metrics.moneyOut.toLocaleString()}</span>;
                        }
                    },
                    {
                        key: "balance",
                        header: "Số dư",
                        align: "right",
                        render: (acc) => <span className="font-bold text-white">{acc.balance.toLocaleString()}</span>
                    },
                    {
                        key: "project",
                        header: "Dự án",
                        render: (acc) => acc.projectId ? (
                            <span className="text-blue-400 text-xs">{projects[acc.projectId] || "N/A"}</span>
                        ) : (
                            <span className="text-white/30">-</span>
                        )
                    },
                    {
                        key: "actions",
                        header: "Thao tác",
                        align: "center",
                        render: (acc) => (
                            <ActionCell>
                                <button
                                    onClick={() => setEditingAccount(acc)}
                                    className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-blue-400 transition-colors"
                                    title="Sửa"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => toggleLock(acc)}
                                    className={`p-1.5 rounded transition-colors ${acc.isLocked
                                            ? "text-red-400 hover:bg-red-500/20"
                                            : "text-white/40 hover:text-yellow-400 hover:bg-white/10"
                                        }`}
                                    title={acc.isLocked ? "Mở khóa" : "Khóa"}
                                >
                                    {acc.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>
                                <button
                                    onClick={() => deleteAccount(acc)}
                                    className="p-1.5 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                                    title="Xóa"
                                >
                                    <Trash2 size={14} />
                                </button>
                                <Link
                                    href={`/finance/transactions?account=${acc.id}`}
                                    className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-blue-400 transition-colors"
                                    title="Xem lịch sử"
                                >
                                    <History size={14} />
                                </Link>
                            </ActionCell>
                        )
                    }
                ]}
            />

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
