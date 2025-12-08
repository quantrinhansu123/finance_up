"use client";

import { useState, useEffect, use } from "react";
import { getTransactions, getAccounts, updateProject, updateAccount, deleteProject } from "@/lib/finance";
import { Transaction, Account, Project } from "@/types/finance";
import { getExchangeRates, convertCurrency } from "@/lib/currency";
import { getUsers } from "@/lib/users";
import { UserProfile } from "@/types/user";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { Users, Plus, Landmark } from "lucide-react";

const COLORS = ["#4ade80", "#f87171", "#60a5fa", "#fbbf24", "#a78bfa"];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const projectId = resolvedParams.id;
    const router = useRouter();

    const [project, setProject] = useState<Project | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [rates, setRates] = useState<any>({});
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

    // Account Modal
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

    // Stats
    const [totalIn, setTotalIn] = useState(0);
    const [totalOut, setTotalOut] = useState(0);
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [categoryData, setCategoryData] = useState<any[]>([]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [projectDoc, txs, accs, exchangeRates, usersList] = await Promise.all([
                    getDoc(doc(db, "finance_projects", projectId)),
                    getTransactions(),
                    getAccounts(),
                    getExchangeRates(),
                    getUsers()
                ]);

                if (projectDoc.exists()) {
                    const progData = { id: projectDoc.id, ...projectDoc.data() } as Project;
                    setProject(progData);
                    setSelectedMemberIds(progData.memberIds || []);
                }
                setAllUsers(usersList);

                // Filter transactions for this project
                const projectTxs = txs.filter(t => t.projectId === projectId && t.status === "APPROVED");
                setTransactions(projectTxs);

                // Filter accounts assigned to this project
                const projectAccs = accs.filter(a => a.projectId === projectId);
                setAccounts(projectAccs);
                setSelectedAccountIds(projectAccs.map(a => a.id));

                setRates(exchangeRates);

                // Calculate stats
                let inTotal = 0;
                let outTotal = 0;
                const monthly: Record<string, { in: number, out: number }> = {};
                const categories: Record<string, number> = {};

                projectTxs.forEach(tx => {
                    const amountUSD = convertCurrency(tx.amount, tx.currency, "USD", exchangeRates);
                    const d = new Date(tx.date);
                    const monthKey = `${d.getMonth() + 1}/${d.getFullYear()}`;

                    if (tx.type === "IN") {
                        inTotal += amountUSD;
                        if (!monthly[monthKey]) monthly[monthKey] = { in: 0, out: 0 };
                        monthly[monthKey].in += amountUSD;
                    } else {
                        outTotal += amountUSD;
                        if (!monthly[monthKey]) monthly[monthKey] = { in: 0, out: 0 };
                        monthly[monthKey].out += amountUSD;

                        const cat = tx.category || "Khác";
                        categories[cat] = (categories[cat] || 0) + amountUSD;
                    }
                });

                setTotalIn(inTotal);
                setTotalOut(outTotal);

                // Format monthly data
                const mData = Object.entries(monthly)
                    .map(([name, val]) => ({ name, income: val.in, expense: val.out }))
                    .sort((a, b) => {
                        const [m1, y1] = a.name.split('/').map(Number);
                        const [m2, y2] = b.name.split('/').map(Number);
                        return new Date(y1, m1).getTime() - new Date(y2, m2).getTime();
                    })
                    .slice(-6);
                setMonthlyData(mData);

                // Format category data
                const cData = Object.entries(categories)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5);
                setCategoryData(cData);

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [projectId]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    };

    const handleUpdateMembers = async () => {
        if (!project) return;
        try {
            await updateProject(project.id, { memberIds: selectedMemberIds });
            setProject(prev => prev ? { ...prev, memberIds: selectedMemberIds } : null);
            setIsMemberModalOpen(false);
        } catch (error) {
            console.error("Failed to update members", error);
        }
    };

    const handleUpdateAccounts = async () => {
        try {
            // Find which accounts to update
            // 1. Accounts that should be in project but aren't currently
            const added = selectedAccountIds.filter(id => !accounts.find(a => a.id === id));
            // 2. Accounts that are in project but shouldn't be anymore
            const removed = accounts.filter(a => !selectedAccountIds.includes(a.id));

            await Promise.all([
                ...added.map(id => updateAccount(id, { projectId })),
                ...removed.map(acc => updateAccount(acc.id, { projectId: "" })) // Assuming empty string as null or field deletion
            ]);

            // Refresh logic: Optimistic or re-fetch? Let's re-fetch mostly for consistency or just update local state if simple
            // Simple re-fetch of accounts list to get updated list
            const updatedAccs = await getAccounts();
            const newProjectAccs = updatedAccs.filter(a => a.projectId === projectId);
            setAccounts(newProjectAccs);

            setIsAccountModalOpen(false);
        } catch (error) {
            console.error("Failed to update accounts", error);
        }
    };

    const handleDeleteProject = async () => {
        if (!confirm("Bạn có chắc chắn muốn xóa dự án này? Hành động này không thể hoàn tác.")) return;
        try {
            await deleteProject(projectId);
            router.push("/finance/projects");
        } catch (error) {
            console.error("Failed to delete project", error);
            alert("Xóa dự án thất bại");
        }
    };

    const handleStatusChange = async (newStatus: Project["status"]) => {
        try {
            await updateProject(projectId, { status: newStatus });
            setProject(prev => prev ? { ...prev, status: newStatus } : null);
        } catch (error) {
            console.error("Failed to update status", error);
        }
    };

    const toggleMemberSelection = (uid: string) => {
        setSelectedMemberIds(prev =>
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    const toggleAccountSelection = (accId: string) => {
        setSelectedAccountIds(prev =>
            prev.includes(accId) ? prev.filter(id => id !== accId) : [...prev, accId]
        );
    };

    const getProjectMembers = () => {
        if (!project || !project.memberIds) return [];
        return allUsers.filter(u => (project.memberIds || []).includes(u.uid));
    };

    if (loading) return <div className="p-8 text-[var(--muted)]">Đang tải...</div>;
    if (!project) return <div className="p-8 text-[var(--muted)]">Không tìm thấy dự án</div>;

    const profit = totalIn - totalOut;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <Link href="/finance/projects" className="text-sm text-[var(--muted)] hover:text-white mb-2 inline-block">
                        ← Quay lại danh sách
                    </Link>
                    <h1 className="text-3xl font-bold text-white">{project.name}</h1>
                    <p className="text-[var(--muted)]">{project.description || "Không có mô tả"}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white/5 p-1 rounded-xl">
                        <button
                            onClick={() => handleStatusChange("ACTIVE")}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${project.status === "ACTIVE"
                                    ? "bg-green-500 text-white shadow-lg"
                                    : "text-[var(--muted)] hover:text-white"
                                }`}
                        >
                            Doing
                        </button>

                        <button
                            onClick={() => handleStatusChange("COMPLETED")}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${project.status === "COMPLETED"
                                    ? "bg-blue-500 text-white shadow-lg"
                                    : "text-[var(--muted)] hover:text-white"
                                }`}
                        >
                            Completed
                        </button>

                        <button
                            onClick={() => handleStatusChange("PAUSED")}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${project.status === "PAUSED"
                                    ? "bg-gray-500 text-white shadow-lg"
                                    : "text-[var(--muted)] hover:text-white"
                                }`}
                        >
                            Paused
                        </button>
                    </div>

                    <button
                        onClick={handleDeleteProject}
                        className="glass-button px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20 rounded-xl text-sm transition-colors"
                    >
                        Xóa dự án
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-card p-6 rounded-xl">
                    <p className="text-[var(--muted)] text-sm uppercase">Tổng thu</p>
                    <h3 className="text-2xl font-bold text-green-400 mt-1">{formatCurrency(totalIn)}</h3>
                </div>
                <div className="glass-card p-6 rounded-xl">
                    <p className="text-[var(--muted)] text-sm uppercase">Tổng chi</p>
                    <h3 className="text-2xl font-bold text-red-400 mt-1">{formatCurrency(totalOut)}</h3>
                </div>
                <div className="glass-card p-6 rounded-xl">
                    <p className="text-[var(--muted)] text-sm uppercase">Lợi nhuận</p>
                    <h3 className={`text-2xl font-bold mt-1 ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {profit >= 0 ? "+" : ""}{formatCurrency(profit)}
                    </h3>
                </div>
                <div className="glass-card p-6 rounded-xl">
                    <p className="text-[var(--muted)] text-sm uppercase">Giao dịch</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{transactions.length}</h3>
                </div>
            </div>

            {/* Members Section */}
            <div className="glass-card rounded-xl overflow-hidden p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Users size={20} />
                        Thành viên dự án
                    </h3>
                    <button
                        onClick={() => setIsMemberModalOpen(true)}
                        className="glass-button px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"
                    >
                        <Plus size={14} />
                        Quản lý thành viên
                    </button>
                </div>

                <div className="flex flex-wrap gap-3">
                    {getProjectMembers().length > 0 ? (
                        getProjectMembers().map(member => (
                            <div key={member.uid} className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-xs">
                                    {member.displayName ? member.displayName[0].toUpperCase() : member.email[0].toUpperCase()}
                                </div>
                                <div>
                                    <div className="text-sm font-medium">{member.displayName || member.email}</div>
                                    <div className="text-xs text-[var(--muted)]">{member.position || 'Thành viên'}</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-[var(--muted)] text-sm">Chưa có thành viên nào.</p>
                    )}
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Monthly Chart */}
                <div className="glass-card p-6 rounded-xl">
                    <h3 className="text-lg font-bold mb-4">Thu – Chi theo tháng</h3>
                    <div className="h-64">
                        {monthlyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData}>
                                    <XAxis dataKey="name" stroke="#525252" />
                                    <YAxis stroke="#525252" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                        formatter={(value: number) => formatCurrency(value)}
                                    />
                                    <Legend />
                                    <Bar dataKey="income" name="Thu" fill="#4ade80" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expense" name="Chi" fill="#f87171" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-[var(--muted)]">
                                Chưa có dữ liệu
                            </div>
                        )}
                    </div>
                </div>

                {/* Category Pie */}
                <div className="glass-card p-6 rounded-xl">
                    <h3 className="text-lg font-bold mb-4">Phân bố chi phí</h3>
                    <div className="h-64">
                        {categoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-[var(--muted)]">
                                Chưa có dữ liệu chi
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Assigned Accounts */}
            <div className="glass-card rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-lg font-bold">Tài khoản được gán</h3>
                    <button
                        onClick={() => setIsAccountModalOpen(true)}
                        className="glass-button px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"
                    >
                        <Landmark size={14} />
                        Quản lý
                    </button>
                </div>
                {accounts.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/5 text-[var(--muted)] text-xs uppercase">
                                <tr>
                                    <th className="p-4">Tên tài khoản</th>
                                    <th className="p-4">Loại tiền</th>
                                    <th className="p-4 text-right">Số dư</th>
                                    <th className="p-4">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {accounts.map(acc => (
                                    <tr key={acc.id} className="hover:bg-white/5">
                                        <td className="p-4 font-medium text-white">{acc.name}</td>
                                        <td className="p-4">
                                            <span className="bg-white/10 px-2 py-1 rounded text-xs">{acc.currency}</span>
                                        </td>
                                        <td className="p-4 text-right font-bold text-white">
                                            {acc.balance.toLocaleString()}
                                        </td>
                                        <td className="p-4">
                                            {acc.isLocked ? (
                                                <span className="text-red-400">🔒 Khóa</span>
                                            ) : (
                                                <span className="text-green-400">🔓 Hoạt động</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center text-[var(--muted)]">
                        Chưa có tài khoản nào được gán cho dự án này
                    </div>
                )}
            </div>

            {/* Recent Transactions */}
            <div className="glass-card rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-lg font-bold">Giao dịch gần đây</h3>
                    <Link href={`/finance/transactions?project=${projectId}`} className="text-sm text-blue-400 hover:text-blue-300">
                        Xem tất cả
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-[var(--muted)] text-xs uppercase">
                            <tr>
                                <th className="p-4">Ngày</th>
                                <th className="p-4">Loại</th>
                                <th className="p-4">Số tiền</th>
                                <th className="p-4">Danh mục</th>
                                <th className="p-4">Người tạo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {transactions.slice(0, 10).map(tx => (
                                <tr key={tx.id} className="hover:bg-white/5">
                                    <td className="p-4 text-[var(--muted)]">{new Date(tx.date).toLocaleDateString()}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === "IN" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                            }`}>
                                            {tx.type === "IN" ? "THU" : "CHI"}
                                        </span>
                                    </td>
                                    <td className={`p-4 font-bold ${tx.type === "IN" ? "text-green-400" : "text-red-400"}`}>
                                        {tx.type === "IN" ? "+" : "-"}{tx.amount.toLocaleString()} {tx.currency}
                                    </td>
                                    <td className="p-4">{tx.category}</td>
                                    <td className="p-4 text-[var(--muted)]">{tx.createdBy}</td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-[var(--muted)]">
                                        Chưa có giao dịch nào
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Member Management Modal */}
            {
                isMemberModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="glass-card w-full max-w-2xl p-6 rounded-2xl relative max-h-[90vh] flex flex-col">
                            <button onClick={() => setIsMemberModalOpen(false)} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white">✕</button>
                            <h2 className="text-2xl font-bold mb-2">Quản lý thành viên</h2>
                            <p className="text-sm text-[var(--muted)] mb-6">Chọn người dùng để thêm vào dự án này.</p>

                            <div className="flex-1 overflow-y-auto mb-6 pr-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {allUsers.map(u => (
                                        <label key={u.uid} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${selectedMemberIds.includes(u.uid)
                                            ? "bg-blue-500/10 border-blue-500/50"
                                            : "hover:bg-white/5 border-white/5"
                                            }`}>
                                            <input
                                                type="checkbox"
                                                checked={selectedMemberIds.includes(u.uid)}
                                                onChange={() => toggleMemberSelection(u.uid)}
                                                className="w-5 h-5 rounded border-gray-600 bg-transparent text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                                            />
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center font-bold text-sm shrink-0">
                                                {u.displayName ? u.displayName[0].toUpperCase() : u.email[0].toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-white truncate">{u.displayName || u.email}</div>
                                                <div className="text-xs text-[var(--muted)] truncate">{u.email}</div>
                                                <div className="text-xs text-[var(--muted)] mt-0.5">{u.position || "Thành viên"}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-auto">
                                <button
                                    onClick={() => setIsMemberModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleUpdateMembers}
                                    className="glass-button px-6 py-2 rounded-lg text-sm font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30"
                                >
                                    Lưu thay đổi ({selectedMemberIds.length})
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Account Management Modal */}
            {
                isAccountModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="glass-card w-full max-w-2xl p-6 rounded-2xl relative max-h-[90vh] flex flex-col">
                            <button onClick={() => setIsAccountModalOpen(false)} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white">✕</button>
                            <h2 className="text-2xl font-bold mb-2">Quản lý tài khoản ngân hàng</h2>
                            <p className="text-sm text-[var(--muted)] mb-6">Chọn tài khoản ngân hàng để gán cho dự án này.</p>

                            <div className="flex-1 overflow-y-auto mb-6 pr-2">
                                <AccountSelector
                                    selectedAccountIds={selectedAccountIds}
                                    toggleSelection={toggleAccountSelection}
                                    currentProjectId={projectId}
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-auto">
                                <button
                                    onClick={() => setIsAccountModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleUpdateAccounts}
                                    className="glass-button px-6 py-2 rounded-lg text-sm font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30"
                                >
                                    Lưu thay đổi
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

// Sub-component for fetching and displaying accounts inside the modal
function AccountSelector({ selectedAccountIds, toggleSelection, currentProjectId }: {
    selectedAccountIds: string[],
    toggleSelection: (id: string) => void,
    currentProjectId: string
}) {
    const [allAccounts, setAllAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getAccounts().then(accs => {
            setAllAccounts(accs);
            setLoading(false);
        });
    }, []);

    if (loading) return <div className="text-center py-8">Đang tải danh sách tài khoản...</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allAccounts.map(acc => {
                const isAssignedToOther = acc.projectId && acc.projectId !== currentProjectId;
                return (
                    <label key={acc.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedAccountIds.includes(acc.id)
                        ? "bg-blue-500/10 border-blue-500/50"
                        : isAssignedToOther ? "opacity-50 cursor-not-allowed border-white/5 bg-white/5" : "hover:bg-white/5 border-white/5 cursor-pointer"
                        }`}>
                        <input
                            type="checkbox"
                            checked={selectedAccountIds.includes(acc.id)}
                            onChange={() => !isAssignedToOther && toggleSelection(acc.id)}
                            disabled={!!(isAssignedToOther)}
                            className="w-5 h-5 rounded border-gray-600 bg-transparent text-blue-500 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50"
                        />
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg shrink-0">
                            🏦
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-white truncate">{acc.name}</div>
                            <div className="text-xs text-[var(--muted)]">{acc.currency} • {acc.type}</div>
                            {isAssignedToOther && <div className="text-xs text-red-400 mt-1">Đã gán cho dự án khác</div>}
                        </div>
                    </label>
                );
            })}
        </div>
    );
}
