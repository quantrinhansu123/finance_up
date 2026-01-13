"use client";

import { useState, useEffect, use } from "react";
import { getTransactions, getAccounts, updateProject, updateAccount, deleteProject } from "@/lib/finance";
import { Transaction, Account, Project, ProjectMember, ProjectRole, ProjectPermission } from "@/types/finance";
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
import { Users, Plus, Landmark, Shield, ChevronDown, Check, X } from "lucide-react";
import { 
    PROJECT_ROLE_LABELS, 
    PROJECT_ROLE_COLORS, 
    PROJECT_PERMISSION_LABELS,
    PROJECT_PERMISSION_DESCRIPTIONS,
    PROJECT_ROLE_PERMISSIONS,
    createProjectMember,
    getProjectRole,
    getUserRole,
    hasProjectPermission,
    Role
} from "@/lib/permissions";

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
    const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
    
    // User permissions
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("USER");
    const [userProjectRole, setUserProjectRole] = useState<ProjectRole | null>(null);
    const [canEdit, setCanEdit] = useState(false);
    const [canView, setCanView] = useState(false);

    // Account Modal
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
    
    // Permission Detail Modal
    const [permissionDetailMember, setPermissionDetailMember] = useState<ProjectMember | null>(null);

    // Stats
    const [totalIn, setTotalIn] = useState(0);
    const [totalOut, setTotalOut] = useState(0);
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [categoryData, setCategoryData] = useState<any[]>([]); // Chi theo danh mục
    const [incomeData, setIncomeData] = useState<any[]>([]); // Thu theo nguồn
    const [memberStats, setMemberStats] = useState<any[]>([]);

    // Load user info and check permissions
    useEffect(() => {
        const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setCurrentUser(parsedUser);
            setUserRole(getUserRole(parsedUser));
        } else {
            router.push("/login");
        }
    }, [router]);

    // Check project permissions when user and project are loaded
    useEffect(() => {
        if (currentUser && project) {
            const userId = currentUser?.uid || currentUser?.id;
            const role = getProjectRole(userId, project);
            setUserProjectRole(role);
            
            // Check permissions - cần quyền view_transactions để xem chi tiết dự án
            const canViewProject = userRole === "ADMIN" || hasProjectPermission(userId, project, "view_transactions", currentUser);
            const canEditProject = userRole === "ADMIN" || hasProjectPermission(userId, project, "manage_members", currentUser);
            
            setCanView(canViewProject);
            setCanEdit(canEditProject);
            
            // If user can't view project, redirect
            if (!canViewProject) {
                alert("Bạn không có quyền xem giao dịch của dự án này");
                router.push("/finance/projects");
                return;
            }
        }
    }, [currentUser, project, userRole, router]);

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
                    setProjectMembers(progData.members || []);
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
                const expenseCategories: Record<string, number> = {}; // Chi theo danh mục
                const incomeCategories: Record<string, number> = {}; // Thu theo nguồn
                const memberTxStats: Record<string, { in: number, out: number, count: number }> = {};

                projectTxs.forEach(tx => {
                    const amountUSD = convertCurrency(tx.amount, tx.currency, "USD", exchangeRates);
                    const d = new Date(tx.date);
                    const monthKey = `${d.getMonth() + 1}/${d.getFullYear()}`;
                    
                    // Member stats
                    const creator = tx.createdBy || "Unknown";
                    if (!memberTxStats[creator]) memberTxStats[creator] = { in: 0, out: 0, count: 0 };
                    memberTxStats[creator].count++;

                    const cat = tx.category || tx.source || "Khác";

                    if (tx.type === "IN") {
                        inTotal += amountUSD;
                        if (!monthly[monthKey]) monthly[monthKey] = { in: 0, out: 0 };
                        monthly[monthKey].in += amountUSD;
                        memberTxStats[creator].in += amountUSD;
                        // Thu theo nguồn
                        const source = tx.source || tx.category || "Khác";
                        incomeCategories[source] = (incomeCategories[source] || 0) + amountUSD;
                    } else {
                        outTotal += amountUSD;
                        if (!monthly[monthKey]) monthly[monthKey] = { in: 0, out: 0 };
                        monthly[monthKey].out += amountUSD;
                        memberTxStats[creator].out += amountUSD;
                        // Chi theo danh mục
                        expenseCategories[cat] = (expenseCategories[cat] || 0) + amountUSD;
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

                // Format income data (Thu theo nguồn)
                const iData = Object.entries(incomeCategories)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5);
                setIncomeData(iData);

                // Format expense data (Chi theo danh mục)
                const cData = Object.entries(expenseCategories)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5);
                setCategoryData(cData);

                // Format member stats
                const mStats = Object.entries(memberTxStats)
                    .map(([name, stats]) => ({ 
                        name: name.split('@')[0], // Shorten email
                        fullName: name,
                        ...stats,
                        total: stats.in + stats.out
                    }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 8);
                setMemberStats(mStats);

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
        if (!project || userRole !== "ADMIN") {
            alert("Chỉ quản trị viên mới có quyền chỉnh sửa thành viên dự án");
            return;
        }
        try {
            // Sync memberIds với projectMembers
            const memberIds = projectMembers.map(m => m.id);
            // Clean undefined values for Firebase
            const cleanMembers = projectMembers.map(m => ({
                id: m.id,
                role: m.role,
                permissions: m.permissions,
                addedAt: m.addedAt,
                ...(m.addedBy ? { addedBy: m.addedBy } : {})
            }));
            await updateProject(project.id, { 
                memberIds,
                members: cleanMembers 
            });
            setProject(prev => prev ? { 
                ...prev, 
                memberIds,
                members: cleanMembers 
            } : null);
            setSelectedMemberIds(memberIds);
            setIsMemberModalOpen(false);
        } catch (error) {
            console.error("Failed to update members", error);
        }
    };

    const handleAddMember = (userId: string, role: ProjectRole = "MEMBER") => {
        if (projectMembers.find(m => m.id === userId)) return;
        const newMember = createProjectMember(userId, role, project?.createdBy);
        setProjectMembers(prev => [...prev, newMember]);
    };

    const handleRemoveMember = (userId: string) => {
        setProjectMembers(prev => prev.filter(m => m.id !== userId));
    };

    const handleChangeMemberRole = (userId: string, newRole: ProjectRole) => {
        setProjectMembers(prev => prev.map(m => 
            m.id === userId 
                ? { ...m, role: newRole, permissions: PROJECT_ROLE_PERMISSIONS[newRole] }
                : m
        ));
    };

    const handleTogglePermission = (userId: string, permission: ProjectPermission) => {
        setProjectMembers(prev => prev.map(m => {
            if (m.id !== userId) return m;
            const hasPermission = m.permissions.includes(permission);
            return {
                ...m,
                permissions: hasPermission
                    ? m.permissions.filter(p => p !== permission)
                    : [...m.permissions, permission]
            };
        }));
        // Update detail modal if open
        if (permissionDetailMember?.id === userId) {
            setPermissionDetailMember(prev => {
                if (!prev) return null;
                const hasPermission = prev.permissions.includes(permission);
                return {
                    ...prev,
                    permissions: hasPermission
                        ? prev.permissions.filter(p => p !== permission)
                        : [...prev.permissions, permission]
                };
            });
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

    const toggleAccountSelection = (accId: string) => {
        setSelectedAccountIds(prev =>
            prev.includes(accId) ? prev.filter(id => id !== accId) : [...prev, accId]
        );
    };

    const handleDeleteProject = async () => {
        if (userRole !== "ADMIN") {
            alert("Chỉ quản trị viên mới có quyền xóa dự án");
            return;
        }
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
        if (userRole !== "ADMIN") {
            alert("Chỉ quản trị viên mới có quyền thay đổi trạng thái dự án");
            return;
        }
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

    const getProjectMembersWithInfo = () => {
        return projectMembers.map(member => {
            const user = allUsers.find(u => u.uid === member.id);
            return { ...member, user };
        }).filter(m => m.user);
    };

    if (loading) return <div className="p-8 text-[var(--muted)]">Đang tải...</div>;
    if (!project) return <div className="p-8 text-[var(--muted)]">Không tìm thấy dự án</div>;
    
    // Check if user has permission to view this project
    if (!canView && !loading) {
        return (
            <div className="space-y-8">
                <div className="glass-card p-8 rounded-xl text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                        <Shield size={32} className="text-red-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">Không có quyền xem giao dịch</h3>
                    <p className="text-[var(--muted)] mb-4">
                        Bạn cần có quyền <strong className="text-blue-400">"Xem lịch sử giao dịch"</strong> để truy cập trang chi tiết dự án này.
                    </p>
                    <Link 
                        href="/finance/projects"
                        className="inline-block px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                        ← Quay lại danh sách dự án
                    </Link>
                </div>
            </div>
        );
    }

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
                    {/* Show user's role in project */}
                    {userProjectRole && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
                            <span className="text-xs text-[var(--muted)]">Vai trò của bạn:</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${PROJECT_ROLE_COLORS[userProjectRole]}`}>
                                {PROJECT_ROLE_LABELS[userProjectRole]}
                            </span>
                        </div>
                    )}
                    
                    {/* Status change buttons - only if user is ADMIN */}
                    {userRole === "ADMIN" && (
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
                    )}

                    {/* Delete button - only if user is ADMIN */}
                    {userRole === "ADMIN" && (
                        <button
                            onClick={handleDeleteProject}
                            className="glass-button px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20 rounded-xl text-sm transition-colors"
                        >
                            Xóa dự án
                        </button>
                    )}
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
                        Thành viên dự án ({projectMembers.length})
                    </h3>
                    {/* Only show manage button if user is ADMIN */}
                    {userRole === "ADMIN" && (
                        <button
                            onClick={() => setIsMemberModalOpen(true)}
                            className="glass-button px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"
                        >
                            <Shield size={14} />
                            Phân quyền
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {getProjectMembersWithInfo().length > 0 ? (
                        getProjectMembersWithInfo().map(({ user, role, permissions }) => (
                            <div key={user!.uid} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-sm shrink-0">
                                    {user!.displayName ? user!.displayName[0].toUpperCase() : user!.email[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{user!.displayName || user!.email}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${PROJECT_ROLE_COLORS[role]}`}>
                                            {PROJECT_ROLE_LABELS[role]}
                                        </span>
                                        <span className="text-xs text-[var(--muted)]">
                                            {permissions.length} quyền
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-8">
                            <Users size={40} className="mx-auto text-[var(--muted)] mb-2 opacity-50" />
                            <p className="text-[var(--muted)] text-sm">Chưa có thành viên nào.</p>
                            {userRole === "ADMIN" && (
                                <button 
                                    onClick={() => setIsMemberModalOpen(true)}
                                    className="mt-3 text-blue-400 text-sm hover:underline"
                                >
                                    + Thêm thành viên
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Account Cards */}
            <div className="glass-card p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                        <Landmark size={16} />
                        Tài khoản dự án ({accounts.length})
                    </h3>
                    {/* Only show manage button if user can manage accounts */}
                    {(userRole === "ADMIN" || hasProjectPermission(currentUser?.uid || currentUser?.id, project, "manage_accounts", currentUser)) && (
                        <button
                            onClick={() => setIsAccountModalOpen(true)}
                            className="text-xs text-[var(--muted)] hover:text-white flex items-center gap-1"
                        >
                            <Plus size={12} />
                            Quản lý
                        </button>
                    )}
                </div>
                {accounts.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {accounts.map(acc => {
                            const accTxs = transactions.filter(tx => tx.accountId === acc.id);
                            const accIn = accTxs.filter(tx => tx.type === "IN").reduce((sum, tx) => sum + tx.amount, 0);
                            const accOut = accTxs.filter(tx => tx.type === "OUT").reduce((sum, tx) => sum + tx.amount, 0);
                            return (
                                <div key={acc.id} className="relative p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">🏦</span>
                                        <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">{acc.currency}</span>
                                        {acc.isLocked && <span className="text-xs">🔒</span>}
                                    </div>
                                    <div className="font-medium text-sm truncate mb-1">{acc.name}</div>
                                    <div className={`text-lg font-bold ${acc.balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                        {acc.balance.toLocaleString()}
                                    </div>
                                    <div className="flex gap-2 mt-2 text-xs">
                                        <span className="text-green-400">+{accIn.toLocaleString()}</span>
                                        <span className="text-red-400">-{accOut.toLocaleString()}</span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full"
                                            style={{ width: `${Math.min((acc.balance / (acc.openingBalance || acc.balance || 1)) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-6 text-[var(--muted)] text-sm">
                        Chưa có tài khoản nào được gán
                        {(userRole === "ADMIN" || hasProjectPermission(currentUser?.uid || currentUser?.id, project, "manage_accounts", currentUser)) && (
                            <button onClick={() => setIsAccountModalOpen(true)} className="block mx-auto mt-2 text-blue-400 hover:underline">
                                + Thêm tài khoản
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Charts Row 1: Monthly + Ratio */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Monthly Chart - Larger */}
                <div className="lg:col-span-2 glass-card p-6 rounded-xl">
                    <h3 className="text-lg font-bold mb-4">📊 Thu – Chi theo tháng</h3>
                    <div className="h-64">
                        {monthlyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData}>
                                    <XAxis dataKey="name" stroke="#525252" fontSize={12} />
                                    <YAxis stroke="#525252" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
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

                {/* Income Pie - Tỷ lệ Thu theo nguồn */}
                <div className="glass-card p-6 rounded-xl">
                    <h3 className="text-lg font-bold mb-4 text-green-400">💰 Tỷ lệ Thu</h3>
                    <div className="h-48">
                        {incomeData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={incomeData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={35}
                                        outerRadius={55}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {incomeData.map((_, index) => (
                                            <Cell key={`cell-in-${index}`} fill={["#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534"][index % 5]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-[var(--muted)] text-sm">
                                Chưa có dữ liệu thu
                            </div>
                        )}
                    </div>
                    <div className="text-center mt-2 text-lg font-bold text-green-400">
                        +{formatCurrency(totalIn)}
                    </div>
                </div>
            </div>

            {/* Charts Row 2: Expense Pie + Member Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expense Pie - Tỷ lệ Chi theo danh mục */}
                <div className="glass-card p-6 rounded-xl">
                    <h3 className="text-lg font-bold mb-4 text-red-400">💸 Tỷ lệ Chi</h3>
                    <div className="h-48">
                        {categoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={35}
                                        outerRadius={55}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {categoryData.map((_, index) => (
                                            <Cell key={`cell-out-${index}`} fill={["#f87171", "#ef4444", "#dc2626", "#b91c1c", "#991b1b"][index % 5]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-[var(--muted)] text-sm">
                                Chưa có dữ liệu chi
                            </div>
                        )}
                    </div>
                    <div className="text-center mt-2 text-lg font-bold text-red-400">
                        -{formatCurrency(totalOut)}
                    </div>
                </div>

                {/* Member Stats */}
                <div className="glass-card p-6 rounded-xl">
                    <h3 className="text-lg font-bold mb-4">👥 Thống kê theo nhân viên</h3>
                    <div className="h-64">
                        {memberStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={memberStats} layout="vertical">
                                    <XAxis type="number" stroke="#525252" fontSize={10} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                                    <YAxis type="category" dataKey="name" stroke="#525252" fontSize={10} width={80} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                        formatter={(value: number, name: string) => [formatCurrency(value), name === "in" ? "Thu" : "Chi"]}
                                        labelFormatter={(label) => memberStats.find(m => m.name === label)?.fullName || label}
                                    />
                                    <Legend />
                                    <Bar dataKey="in" name="Thu" fill="#4ade80" radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="out" name="Chi" fill="#f87171" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-[var(--muted)]">
                                Chưa có dữ liệu
                            </div>
                        )}
                    </div>
                    {/* Member summary */}
                    {memberStats.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                            {memberStats.slice(0, 4).map((m, i) => (
                                <div key={i} className="flex items-center justify-between bg-white/5 px-2 py-1 rounded">
                                    <span className="truncate">{m.name}</span>
                                    <span className="text-[var(--muted)]">{m.count} GD</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
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

            {/* Member Management Modal with Role Selection */}
            {isMemberModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-6xl p-8 rounded-2xl relative max-h-[95vh] flex flex-col">
                        <button onClick={() => setIsMemberModalOpen(false)} className="absolute top-6 right-6 text-[var(--muted)] hover:text-white text-2xl">✕</button>
                        
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                                <Shield size={24} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold">Phân quyền dự án</h2>
                                <p className="text-base text-[var(--muted)]">Quyền hạn này quyết định thành viên có thể làm gì trong dự án</p>
                            </div>
                        </div>

                        {/* Important Notice */}
                        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                            <p className="text-base text-blue-400">
                                <strong>💡 Lưu ý:</strong> Chỉ những người được thêm vào đây mới có thể truy cập dự án này. 
                                Quyền hạn được phân theo vai trò hoặc tùy chỉnh riêng cho từng người.
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto mt-8 space-y-8">
                            {/* Current Members */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Users size={20} />
                                    Thành viên dự án ({projectMembers.length})
                                </h3>
                                
                                {projectMembers.length > 0 ? (
                                    <div className="space-y-2">
                                        {projectMembers.map(member => {
                                            const user = allUsers.find(u => u.uid === member.id);
                                            if (!user) return null;
                                            return (
                                                <div key={member.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-base shrink-0">
                                                        {user.displayName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-white text-base truncate">{user.displayName || user.email}</div>
                                                        <div className="text-sm text-[var(--muted)]">{user.email}</div>
                                                    </div>
                                                    
                                                    {/* Role Selector */}
                                                    <select
                                                        value={member.role}
                                                        onChange={(e) => handleChangeMemberRole(member.id, e.target.value as ProjectRole)}
                                                        className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-base focus:outline-none focus:border-blue-500"
                                                    >
                                                        <option value="OWNER">👑 Chủ dự án</option>
                                                        <option value="MANAGER">🔧 Quản lý</option>
                                                        <option value="MEMBER">👤 Thành viên</option>
                                                        <option value="VIEWER">👁️ Người xem</option>
                                                    </select>
                                                    
                                                    {/* Permissions Badge - Click to edit */}
                                                    <button
                                                        onClick={() => setPermissionDetailMember(member)}
                                                        className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors border border-white/10"
                                                        title="Click để tùy chỉnh quyền chi tiết"
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            {member.permissions.slice(0, 4).map(p => (
                                                                <span key={p} className="text-sm" title={PROJECT_PERMISSION_LABELS[p]}>
                                                                    {p === "view_transactions" && "👁️"}
                                                                    {p === "create_income" && "💰"}
                                                                    {p === "create_expense" && "💸"}
                                                                    {p === "approve_transactions" && "✅"}
                                                                    {p === "manage_accounts" && "🏦"}
                                                                    {p === "manage_members" && "👥"}
                                                                    {p === "view_reports" && "📊"}
                                                                </span>
                                                            ))}
                                                            {member.permissions.length > 4 && (
                                                                <span className="text-sm text-[var(--muted)]">+{member.permissions.length - 4}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-[var(--muted)]">
                                                            {member.permissions.length} quyền
                                                        </div>
                                                        <ChevronDown size={16} className="text-[var(--muted)]" />
                                                    </button>
                                                    
                                                    {/* Edit Permissions Button (Mobile) */}
                                                    <button
                                                        onClick={() => setPermissionDetailMember(member)}
                                                        className="md:hidden p-2 rounded-lg hover:bg-white/10 text-[var(--muted)] transition-colors"
                                                        title="Tùy chỉnh quyền"
                                                    >
                                                        <Shield size={18} />
                                                    </button>
                                                    
                                                    {/* Remove Button */}
                                                    <button
                                                        onClick={() => handleRemoveMember(member.id)}
                                                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                                        title="Xóa khỏi dự án"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 bg-white/5 rounded-xl border border-dashed border-white/10">
                                        <p className="text-[var(--muted)] text-sm">Chưa có thành viên nào</p>
                                        <p className="text-xs text-yellow-400 mt-1">⚠️ Dự án cần ít nhất 1 thành viên để hoạt động</p>
                                    </div>
                                )}
                            </div>

                            {/* Role Legend - Updated descriptions */}
                            <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                                <h4 className="text-sm font-semibold text-[var(--muted)] uppercase mb-4">Vai trò & Quyền hạn mặc định</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div className="p-4 bg-white/5 rounded-lg">
                                        <span className={`inline-block px-3 py-1.5 rounded-full border mb-3 text-sm ${PROJECT_ROLE_COLORS["OWNER"]}`}>👑 Chủ dự án</span>
                                        <ul className="text-[var(--muted)] space-y-1.5 ml-1">
                                            <li>✓ Toàn quyền quản lý dự án</li>
                                            <li>✓ Phân quyền thành viên</li>
                                            <li>✓ Phê duyệt giao dịch</li>
                                            <li>✓ Quản lý tài khoản ngân hàng</li>
                                            <li className="text-yellow-400/70">⚠️ Không sửa/xóa dự án (chỉ Admin)</li>
                                        </ul>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-lg">
                                        <span className={`inline-block px-3 py-1.5 rounded-full border mb-3 text-sm ${PROJECT_ROLE_COLORS["MANAGER"]}`}>🔧 Quản lý</span>
                                        <ul className="text-[var(--muted)] space-y-1.5 ml-1">
                                            <li>✓ Phê duyệt giao dịch</li>
                                            <li>✓ Quản lý tài khoản dự án</li>
                                            <li>✓ Tạo phiếu thu/chi</li>
                                            <li>✓ Xem dashboard & báo cáo</li>
                                        </ul>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-lg">
                                        <span className={`inline-block px-3 py-1.5 rounded-full border mb-3 text-sm ${PROJECT_ROLE_COLORS["MEMBER"]}`}>👤 Thành viên</span>
                                        <ul className="text-[var(--muted)] space-y-1.5 ml-1">
                                            <li>✓ Tạo phiếu thu tiền</li>
                                            <li>✓ Tạo phiếu chi tiền</li>
                                            <li>✓ Xem lịch sử giao dịch</li>
                                            <li className="text-red-400/70">✗ Không phê duyệt được</li>
                                        </ul>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-lg">
                                        <span className={`inline-block px-3 py-1.5 rounded-full border mb-3 text-sm ${PROJECT_ROLE_COLORS["VIEWER"]}`}>👁️ Người xem</span>
                                        <ul className="text-[var(--muted)] space-y-1.5 ml-1">
                                            <li>✓ Xem lịch sử giao dịch</li>
                                            <li>✓ Xem dashboard & báo cáo</li>
                                            <li className="text-red-400/70">✗ Không tạo thu/chi</li>
                                            <li className="text-red-400/70">✗ Chỉ đọc</li>
                                        </ul>
                                    </div>
                                </div>
                                <p className="text-sm text-[var(--muted)] mt-4 italic">
                                    💡 <strong>Lưu ý:</strong> Để vào trang chi tiết dự án, cần có quyền <strong>"Xem lịch sử giao dịch"</strong>. 
                                    Chỉ có Quản trị viên mới có thể sửa/xóa thông tin dự án.
                                </p>
                            </div>

                            {/* Add New Members */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Plus size={20} />
                                    Thêm thành viên mới
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
                                    {allUsers
                                        .filter(u => !projectMembers.find(m => m.id === u.uid))
                                        .map(u => (
                                            <div 
                                                key={u.uid} 
                                                className="flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-white/20 hover:bg-white/5 transition-all"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center font-bold text-sm shrink-0">
                                                    {u.displayName?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-white text-base truncate">{u.displayName || u.email}</div>
                                                    <div className="text-sm text-[var(--muted)]">{u.position || "Nhân viên"}</div>
                                                </div>
                                                <button
                                                    onClick={() => handleAddMember(u.uid, "MEMBER")}
                                                    className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium transition-colors"
                                                >
                                                    + Thêm
                                                </button>
                                            </div>
                                        ))}
                                    {allUsers.filter(u => !projectMembers.find(m => m.id === u.uid)).length === 0 && (
                                        <div className="col-span-2 text-center py-4 text-[var(--muted)] text-sm">
                                            Tất cả người dùng đã được thêm vào dự án
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center gap-3 pt-4 border-t border-white/10 mt-6">
                            <div className="text-sm text-[var(--muted)]">
                                {projectMembers.length} thành viên
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setProjectMembers(project?.members || []);
                                        setIsMemberModalOpen(false);
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleUpdateMembers}
                                    className="glass-button px-6 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 text-white border-blue-500/30"
                                >
                                    <Check size={16} className="inline mr-1" />
                                    Lưu phân quyền
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Permission Detail Modal - Scrollable */}
            {permissionDetailMember && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-2xl p-6 rounded-2xl relative max-h-[90vh] flex flex-col">
                        <button 
                            onClick={() => setPermissionDetailMember(null)} 
                            className="absolute top-4 right-4 text-[var(--muted)] hover:text-white z-10 text-xl"
                        >
                            ✕
                        </button>
                        
                        {(() => {
                            const user = allUsers.find(u => u.uid === permissionDetailMember.id);
                            return (
                                <>
                                    {/* Header - Fixed */}
                                    <div className="flex items-center gap-4 mb-6 pr-8">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-lg">
                                            {user?.displayName?.[0]?.toUpperCase() || user?.email[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-lg truncate">{user?.displayName || user?.email}</h3>
                                            <span className={`text-sm px-3 py-1 rounded-full border ${PROJECT_ROLE_COLORS[permissionDetailMember.role]}`}>
                                                {PROJECT_ROLE_LABELS[permissionDetailMember.role]}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Scrollable Content */}
                                    <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                                        <h4 className="text-lg font-semibold text-white uppercase mb-4 sticky top-0 bg-[#1a1a1a] py-2">
                                            Quyền hạn ({permissionDetailMember.permissions.length}/7)
                                        </h4>
                                        <div className="space-y-4">
                                            {(Object.keys(PROJECT_PERMISSION_LABELS) as ProjectPermission[]).map(permission => {
                                                const hasPermission = permissionDetailMember.permissions.includes(permission);
                                                const icons: Record<ProjectPermission, string> = {
                                                    view_transactions: "👁️",
                                                    create_income: "💰",
                                                    create_expense: "💸",
                                                    approve_transactions: "✅",
                                                    manage_accounts: "🏦",
                                                    manage_members: "👥",
                                                    view_reports: "📊"
                                                };
                                                return (
                                                    <label 
                                                        key={permission}
                                                        className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer border transition-all ${
                                                            hasPermission 
                                                                ? "bg-green-500/10 border-green-500/30" 
                                                                : "bg-white/5 border-white/10 hover:border-white/20"
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={hasPermission}
                                                            onChange={() => handleTogglePermission(permissionDetailMember.id, permission)}
                                                            className="w-5 h-5 rounded border-gray-600 bg-transparent text-green-500 focus:ring-green-500 focus:ring-offset-0 mt-1"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-xl">{icons[permission]}</span>
                                                                <span className="font-medium text-white">{PROJECT_PERMISSION_LABELS[permission]}</span>
                                                            </div>
                                                            <p className="text-sm text-[var(--muted)] leading-relaxed">
                                                                {PROJECT_PERMISSION_DESCRIPTIONS[permission]}
                                                            </p>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Footer - Fixed */}
                                    <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
                                        <button
                                            onClick={() => {
                                                const defaultPerms = PROJECT_ROLE_PERMISSIONS[permissionDetailMember.role];
                                                setProjectMembers(prev => prev.map(m => 
                                                    m.id === permissionDetailMember.id 
                                                        ? { ...m, permissions: [...defaultPerms] }
                                                        : m
                                                ));
                                                setPermissionDetailMember(prev => prev ? { ...prev, permissions: [...defaultPerms] } : null);
                                            }}
                                            className="text-sm text-blue-400 hover:text-blue-300 underline"
                                        >
                                            Đặt lại về mặc định
                                        </button>
                                        <button
                                            onClick={() => setPermissionDetailMember(null)}
                                            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Xong
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Account Management Modal */}
            {isAccountModalOpen && (
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
            )}
        </div>
    );
}

// Sub-component for fetching and displaying accounts inside the modal
function AccountSelector({ selectedAccountIds, toggleSelection, currentProjectId }: {
    selectedAccountIds: string[],
    toggleSelection: (id: string) => void,
    currentProjectId: string
}) {
    const [allAccounts, setAllAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            getAccounts(),
            import("@/lib/finance").then(mod => mod.getProjects())
        ]).then(([accs, projs]) => {
            setAllAccounts(accs);
            setProjects(projs);
            setLoading(false);
        });
    }, []);

    const getProjectName = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        return project?.name || "Dự án khác";
    };

    if (loading) return <div className="text-center py-8">Đang tải danh sách tài khoản...</div>;

    // Separate available and unavailable accounts
    const availableAccounts = allAccounts.filter(acc => !acc.projectId || acc.projectId === currentProjectId);
    const unavailableAccounts = allAccounts.filter(acc => acc.projectId && acc.projectId !== currentProjectId);

    return (
        <div className="space-y-4">
            {/* Available accounts */}
            <div>
                <h4 className="text-sm font-medium text-white mb-2">Tài khoản có thể chọn ({availableAccounts.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableAccounts.map(acc => (
                        <label key={acc.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${selectedAccountIds.includes(acc.id)
                            ? "bg-blue-500/10 border-blue-500/50"
                            : "hover:bg-white/5 border-white/5"
                            }`}>
                            <input
                                type="checkbox"
                                checked={selectedAccountIds.includes(acc.id)}
                                onChange={() => toggleSelection(acc.id)}
                                className="w-5 h-5 rounded border-gray-600 bg-transparent text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                            />
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg shrink-0">
                                🏦
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-white truncate">{acc.name}</div>
                                <div className="text-xs text-[var(--muted)]">{acc.currency} • {acc.balance.toLocaleString()}</div>
                            </div>
                        </label>
                    ))}
                    {availableAccounts.length === 0 && (
                        <div className="col-span-2 text-center py-4 text-[var(--muted)]">Không có tài khoản khả dụng</div>
                    )}
                </div>
            </div>

            {/* Unavailable accounts - already assigned to other projects */}
            {unavailableAccounts.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium text-red-400 mb-2">Đã gán cho dự án khác ({unavailableAccounts.length})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {unavailableAccounts.map(acc => (
                            <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/5 opacity-50">
                                <div className="w-5 h-5 rounded border border-gray-600 bg-gray-700 flex items-center justify-center">
                                    <span className="text-xs text-gray-400">✕</span>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg shrink-0">
                                    🔒
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-white/60 truncate">{acc.name}</div>
                                    <div className="text-xs text-[var(--muted)]">{acc.currency} • {acc.balance.toLocaleString()}</div>
                                    <div className="text-xs text-red-400 mt-1">📁 {getProjectName(acc.projectId!)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
