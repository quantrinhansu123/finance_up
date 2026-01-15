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
import {
    Users, Plus, Landmark, Shield, ChevronDown, Check, X, LayoutGrid, Tag,
    ArrowLeft, Receipt, BarChart3, Settings, PieChart as PieChartIcon,
    Calendar, TrendingUp, DollarSign, ListFilter,
    Info
} from "lucide-react";
import {
    PROJECT_ROLE_LABELS,
    PROJECT_ROLE_COLORS,
    PROJECT_PERMISSION_LABELS,
    PROJECT_PERMISSION_DESCRIPTIONS,
    PROJECT_ROLE_DESCRIPTIONS,
    PROJECT_ROLE_PERMISSIONS,
    createProjectMember,
    getProjectRole,
    getUserRole,
    hasProjectPermission,
    Role
} from "@/lib/permissions";
import ProjectSubCategoriesTab from "@/components/finance/ProjectSubCategoriesTab";
import DataTable from "@/components/finance/DataTable";

const COLORS = ["#4ade80", "#f87171", "#60a5fa", "#fbbf24", "#a78bfa"];

type TabType = "overview" | "transactions" | "accounts" | "members" | "categories";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const projectId = resolvedParams.id;
    const router = useRouter();

    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>("overview");

    const [project, setProject] = useState<Project | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [rates, setRates] = useState<any>({});

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

    const [isAddMemberExpanded, setIsAddMemberExpanded] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isPermissionInfoModalOpen, setIsPermissionInfoModalOpen] = useState(false);

    // Permission Detail Modal


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

                // Determine target currency
                const progData = projectDoc.exists() ? { id: projectDoc.id, ...projectDoc.data() } as Project : null;
                const targetCurrency = progData?.defaultCurrency || progData?.currency || "VND";

                // Calculate stats
                let inTotal = 0;
                let outTotal = 0;
                const monthly: Record<string, { in: number, out: number }> = {};
                const expenseCategories: Record<string, number> = {}; // Chi theo danh mục cha
                const incomeCategories: Record<string, number> = {}; // Thu theo danh mục cha
                const memberTxStats: Record<string, { in: number, out: number, count: number }> = {};

                projectTxs.forEach(tx => {
                    // Convert to target currency
                    const amountConverted = convertCurrency(tx.amount, tx.currency, targetCurrency, exchangeRates);
                    const d = new Date(tx.date);
                    const monthKey = `${d.getMonth() + 1}/${d.getFullYear()}`;

                    // Member stats
                    const creator = tx.createdBy || "Unknown";
                    if (!memberTxStats[creator]) memberTxStats[creator] = { in: 0, out: 0, count: 0 };
                    memberTxStats[creator].count++;

                    // Sử dụng parentCategory để nhóm thống kê, fallback về category
                    const cat = tx.parentCategory || tx.category || tx.source || "Khác";

                    if (tx.type === "IN") {
                        inTotal += amountConverted;
                        if (!monthly[monthKey]) monthly[monthKey] = { in: 0, out: 0 };
                        monthly[monthKey].in += amountConverted;
                        memberTxStats[creator].in += amountConverted;
                        // Thu theo danh mục cha
                        incomeCategories[cat] = (incomeCategories[cat] || 0) + amountConverted;
                    } else {
                        outTotal += amountConverted;
                        if (!monthly[monthKey]) monthly[monthKey] = { in: 0, out: 0 };
                        monthly[monthKey].out += amountConverted;
                        memberTxStats[creator].out += amountConverted;
                        // Chi theo danh mục cha
                        expenseCategories[cat] = (expenseCategories[cat] || 0) + amountConverted;
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

                // Format income data (Thu theo danh mục cha)
                const iData = Object.entries(incomeCategories)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5);
                setIncomeData(iData);

                // Format expense data (Chi theo danh mục cha)
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
        const currency = project?.defaultCurrency || project?.currency || "VND";
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 }).format(val);
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
        <div className="space-y-6">
            {/* Header / Breadcrumbs */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-extrabold text-white tracking-tight">{project.name}</h1>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${project.status === "ACTIVE" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                            project.status === "COMPLETED" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                "bg-gray-500/10 text-gray-400 border-gray-500/20"
                            }`}>
                            {project.status}
                        </span>
                    </div>
                    <p className="text-sm text-[var(--muted)] max-w-2xl leading-relaxed">
                        {project.description || "Dự án hiện chưa có mô tả chi tiết từ người quản trị."}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Profile Prompt / Role */}
                    {userProjectRole && (
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl">
                            <span className="text-[10px] uppercase font-bold text-[var(--muted)]">Quyền hạn</span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-lg border ${PROJECT_ROLE_COLORS[userProjectRole]}`}>
                                {PROJECT_ROLE_LABELS[userProjectRole]}
                            </span>
                        </div>
                    )}

                    {/* Actions Group */}
                    <div className="flex items-center gap-2 bg-[#1a1a1a] p-1 rounded-xl border border-white/5">
                        {userRole === "ADMIN" && (
                            <>
                                <button
                                    onClick={() => handleStatusChange("ACTIVE")}
                                    className={`p-2 rounded-lg transition-all ${project.status === "ACTIVE" ? "bg-green-500 text-white shadow-lg" : "text-[var(--muted)] hover:text-white"}`}
                                    title="Mark as Doing"
                                >
                                    <TrendingUp size={16} />
                                </button>
                                <button
                                    onClick={() => handleStatusChange("COMPLETED")}
                                    className={`p-2 rounded-lg transition-all ${project.status === "COMPLETED" ? "bg-blue-500 text-white shadow-lg" : "text-[var(--muted)] hover:text-white"}`}
                                    title="Mark as Completed"
                                >
                                    <Check size={16} />
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => router.push(`/finance/transactions/create?project=${projectId}`)}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
                            title="Thêm giao dịch"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Sticky Tab Navigator */}
            <div className="sticky top-0 z-30 flex items-center gap-6 overflow-x-auto pb-1 border-b border-white/5 no-scrollbar bg-[#121212]/80 backdrop-blur-md -mx-4 px-4 sm:mx-0 sm:px-0">
                {[
                    { id: "overview", label: "Tổng quan", icon: LayoutGrid },
                    { id: "transactions", label: "Giao dịch", icon: Receipt, count: transactions.length },
                    { id: "accounts", label: "Tài khoản", icon: Landmark, count: accounts.length },
                    { id: "members", label: "Nhân sự", icon: Users, count: projectMembers.length },
                    { id: "categories", label: "Danh mục", icon: Tag, count: (project.incomeSubCategories?.length || 0) + (project.expenseSubCategories?.length || 0) }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`flex items-center gap-2 py-4 px-1 text-sm font-medium transition-all relative shrink-0 ${activeTab === tab.id ? "text-blue-400" : "text-[var(--muted)] hover:text-white"
                            }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className={`text-[10px] px-1.5 py-px rounded-full ${activeTab === tab.id ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-[var(--muted)]"
                                }`}>
                                {tab.count}
                            </span>
                        )}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Contents */}

            <div className="mt-6 animation-fade-in transition-all duration-300">
                {activeTab === "overview" && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden group">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 blur-3xl rounded-full group-hover:bg-green-500/20 transition-all" />
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-green-500/10 rounded-lg text-green-400"><TrendingUp size={16} /></div>
                                    <p className="text-[var(--muted)] text-[10px] uppercase font-bold tracking-widest">Tổng thu nhập</p>
                                </div>
                                <h3 className="text-2xl font-bold text-white leading-none">
                                    {formatCurrency(totalIn)}
                                </h3>
                                <p className="text-[10px] text-green-400 mt-2 font-medium">Bao gồm {transactions.filter(t => t.type === "IN").length} giao dịch</p>
                            </div>

                            <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden group">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/10 blur-3xl rounded-full group-hover:bg-red-500/20 transition-all" />
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-red-500/10 rounded-lg text-red-400"><Calendar size={16} /></div>
                                    <p className="text-[var(--muted)] text-[10px] uppercase font-bold tracking-widest">Tổng chi phí</p>
                                </div>
                                <h3 className="text-2xl font-bold text-white leading-none">
                                    {formatCurrency(totalOut)}
                                </h3>
                                <p className="text-[10px] text-red-400 mt-2 font-medium">Bao gồm {transactions.filter(t => t.type === "OUT").length} giao dịch</p>
                            </div>

                            <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden group">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 blur-3xl rounded-full group-hover:bg-blue-500/20 transition-all" />
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><DollarSign size={16} /></div>
                                    <p className="text-[var(--muted)] text-[10px] uppercase font-bold tracking-widest">Lợi nhuận ròng</p>
                                </div>
                                <h3 className={`text-2xl font-bold leading-none ${profit >= 0 ? "text-white" : "text-red-400"}`}>
                                    {profit >= 0 ? "+" : ""}{formatCurrency(profit)}
                                </h3>
                                <p className={`text-[10px] mt-2 font-medium ${profit >= 0 ? "text-blue-400" : "text-red-400"}`}>
                                    {profit >= 0 ? "Tăng trưởng dương" : "Thâm hụt ngân sách"}
                                </p>
                            </div>

                            <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden group text-center flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all"
                                onClick={() => setActiveTab("transactions")}>
                                <div className="text-3xl font-bold text-white mb-1">{transactions.length}</div>
                                <div className="text-[10px] uppercase font-bold text-[var(--muted)] tracking-wider">Giao dịch đã duyệt</div>
                                <div className="mt-3 text-[10px] text-blue-400 flex items-center gap-1">Xem chi tiết <ArrowLeft size={8} className="rotate-180" /></div>
                            </div>
                        </div>

                        {/* Summary Chart + Recent Activity */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-white/5">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-sm font-bold flex items-center gap-2">
                                        <BarChart3 size={16} className="text-blue-400" />
                                        Biến động thu chi (6 tháng gần đây)
                                    </h3>
                                </div>
                                <div className="h-72">
                                    {monthlyData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={monthlyData} barGap={8}>
                                                <XAxis dataKey="name" stroke="#525252" fontSize={10} axisLine={false} tickLine={false} />
                                                <YAxis stroke="#525252" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                                                <Tooltip
                                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                                                    itemStyle={{ fontSize: '12px' }}
                                                    labelStyle={{ color: '#888', marginBottom: '4px', fontSize: '10px' }}
                                                    formatter={(value: number) => [formatCurrency(value), ""]}
                                                />
                                                <Bar dataKey="income" name="Thu" fill="#4ade80" radius={[10, 10, 10, 10]} barSize={20} />
                                                <Bar dataKey="expense" name="Chi" fill="#f87171" radius={[10, 10, 10, 10]} barSize={20} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] border-2 border-dashed border-white/5 rounded-2xl">
                                            <BarChart3 size={40} className="mb-2 opacity-20" />
                                            <p className="text-xs">Dữ liệu đang được cập nhật...</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="glass-card p-6 rounded-2xl border border-white/5">
                                <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
                                    <TrendingUp size={16} className="text-blue-400" />
                                    Giao dịch mới nhất
                                </h3>
                                <div className="space-y-4">
                                    {transactions.slice(0, 5).length > 0 ? (
                                        transactions.slice(0, 5).map(tx => (
                                            <div key={tx.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/5">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tx.type === "IN" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                                                    }`}>
                                                    {tx.type === "IN" ? <Plus size={14} /> : <Receipt size={14} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[11px] font-medium truncate text-white">{tx.category}</div>
                                                    <div className="text-[9px] text-[var(--muted)]">{new Date(tx.date).toLocaleDateString()}</div>
                                                </div>
                                                <div className={`text-xs font-bold ${tx.type === "IN" ? "text-green-400" : "text-white"}`}>
                                                    {tx.type === "IN" ? "+" : "-"}{tx.amount.toLocaleString()}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-12 text-center text-[var(--muted)] text-xs">Chưa có hoạt động nào</div>
                                    )}
                                </div>
                                <button onClick={() => setActiveTab("transactions")} className="w-full mt-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--muted)] text-[10px] font-bold uppercase tracking-widest transition-all">
                                    Tất cả lịch sử
                                </button>
                            </div>
                        </div>

                        {/* Analytic Charts Merged */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Income Pie */}
                            <div className="glass-card p-6 rounded-2xl border border-white/5">
                                <h3 className="text-sm font-bold mb-6 text-green-400 flex items-center gap-2 uppercase tracking-widest">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                    Cơ cấu thu nhập
                                </h3>
                                <div className="h-64">
                                    {incomeData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={incomeData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={0}
                                                    outerRadius={85}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {incomeData.map((_, index) => (
                                                        <Cell key={`cell-in-${index}`} fill={["#4ade80", "#60a5fa", "#a78bfa", "#2dd4bf", "#fbbf24"][index % 5]} strokeWidth={0} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '12px', color: '#fff' }}
                                                    itemStyle={{ color: '#fff' }}
                                                    formatter={(value: number) => formatCurrency(value)}
                                                />
                                                <Legend iconType="circle" />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-[var(--muted)] text-xs italic">Không có dữ liệu thu</div>
                                    )}
                                </div>
                                <div className="text-center mt-4">
                                    <span className="text-[10px] text-[var(--muted)] uppercase font-bold block mb-1">Tổng cộng</span>
                                    <span className="text-2xl font-black text-green-400">-{formatCurrency(totalIn)}</span>
                                </div>
                            </div>

                            {/* Expense Pie */}
                            <div className="glass-card p-6 rounded-2xl border border-white/5">
                                <h3 className="text-sm font-bold mb-6 text-red-400 flex items-center gap-2 uppercase tracking-widest">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                    Cơ cấu chi phí
                                </h3>
                                <div className="h-64">
                                    {categoryData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={categoryData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={0}
                                                    outerRadius={85}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {categoryData.map((_, index) => (
                                                        <Cell key={`cell-out-${index}`} fill={["#f87171", "#fb923c", "#facc15", "#e879f9", "#22d3ee"][index % 5]} strokeWidth={0} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '12px', color: '#fff' }}
                                                    itemStyle={{ color: '#fff' }}
                                                    formatter={(value: number) => formatCurrency(value)}
                                                />
                                                <Legend iconType="circle" />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-[var(--muted)] text-xs italic">Không có dữ liệu chi</div>
                                    )}
                                </div>
                                <div className="text-center mt-4">
                                    <span className="text-[10px] text-[var(--muted)] uppercase font-bold block mb-1">Tổng cộng</span>
                                    <span className="text-2xl font-black text-red-400">-{formatCurrency(totalOut)}</span>
                                </div>
                            </div>

                            {/* Member Stats Bar */}
                            <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-white/5 overflow-hidden relative">
                                <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 blur-[100px] pointer-events-none" />
                                <h3 className="text-sm font-bold mb-6 flex items-center gap-2 uppercase tracking-widest">
                                    Hiệu suất nhân sự (Thu & Chi)
                                </h3>
                                <div className="h-72">
                                    {memberStats.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={memberStats} layout="vertical" barSize={12}>
                                                <XAxis type="number" stroke="#525252" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                                                <YAxis type="category" dataKey="name" stroke="#525252" fontSize={10} width={100} axisLine={false} tickLine={false} />
                                                <Tooltip
                                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                                    contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '12px', color: '#fff' }}
                                                    itemStyle={{ color: '#fff' }}
                                                    formatter={(value: number, name: string) => [formatCurrency(value), name === "in" ? "Thu" : "Chi"]}
                                                />
                                                <Bar dataKey="in" name="Thu" fill="#4ade80" radius={[0, 10, 10, 0]} />
                                                <Bar dataKey="out" name="Chi" fill="#f87171" radius={[0, 10, 10, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-[var(--muted)] text-xs italic">Chưa có thống kê nhân sự</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "transactions" && (
                    <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <Receipt size={16} className="text-blue-400" />
                                Nhật ký giao dịch
                            </h3>
                            <button
                                onClick={() => router.push(`/finance/transactions?project=${projectId}`)}
                                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest flex items-center gap-1"
                            >
                                <ListFilter size={12} />
                                Bộ lọc chi tiết
                            </button>
                        </div>
                        <div className="p-2">
                            <DataTable
                                data={transactions}
                                columns={[
                                    {
                                        header: "Thời gian",
                                        key: "date",
                                        render: (row: Transaction) => (
                                            <div className="flex flex-col">
                                                <span className="text-xs text-white font-medium">{new Date(row.date).toLocaleDateString("vi-VN")}</span>
                                                <span className="text-[10px] text-[var(--muted)]">{new Date(row.date).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        )
                                    },
                                    {
                                        header: "Loại",
                                        key: "type",
                                        render: (row: Transaction) => (
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.type === "IN" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                                                }`}>
                                                {row.type === "IN" ? "THU" : "CHI"}
                                            </span>
                                        )
                                    },
                                    {
                                        header: "Số tiền",
                                        key: "amount",
                                        render: (row: Transaction) => (
                                            <div className="flex flex-col items-end">
                                                <span className={`text-sm font-bold ${row.type === "IN" ? "text-green-400" : "text-red-400"}`}>
                                                    {row.type === "IN" ? "+" : "-"}{row.amount.toLocaleString()}
                                                </span>
                                                <span className="text-[10px] text-[var(--muted)] font-medium">{row.currency}</span>
                                            </div>
                                        )
                                    },
                                    {
                                        header: "Danh mục",
                                        key: "category",
                                        render: (row: Transaction) => (
                                            <div className="flex flex-col">
                                                <span className="text-xs text-white">{row.category}</span>
                                                {row.description && <span className="text-[10px] text-[var(--muted)] truncate max-w-[150px]">{row.description}</span>}
                                            </div>
                                        )
                                    },
                                    {
                                        header: "Tài khoản",
                                        key: "accountId",
                                        render: (row: Transaction) => {
                                            const acc = accounts.find(a => a.id === row.accountId);
                                            return <span className="text-xs text-[var(--muted)]">{acc?.name || "N/A"}</span>;
                                        }
                                    },
                                    {
                                        header: "Người tạo",
                                        key: "createdBy",
                                        render: (row: Transaction) => <span className="text-xs text-[var(--muted)]">{row.createdBy?.split('@')[0]}</span>
                                    }
                                ]}
                                itemsPerPage={15}
                                isLoading={loading}
                            />
                        </div>
                    </div>
                )}

                {activeTab === "accounts" && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Landmark size={20} className="text-blue-400" />
                                Tài khoản ngân hàng ({accounts.length})
                            </h3>
                            {(userRole === "ADMIN" || hasProjectPermission(currentUser?.uid || currentUser?.id, project, "manage_accounts", currentUser)) && (
                                <button
                                    onClick={() => setIsAccountModalOpen(true)}
                                    className="glass-button px-4 py-2 rounded-xl text-xs font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/20 flex items-center gap-2 transition-all"
                                >
                                    <Settings size={14} />
                                    Cấu hình tài khoản
                                </button>
                            )}
                        </div>

                        {accounts.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {accounts.map(acc => {
                                    const accTxs = transactions.filter(tx => tx.accountId === acc.id);
                                    const accIn = accTxs.filter(tx => tx.type === "IN").reduce((sum, tx) => sum + tx.amount, 0);
                                    const accOut = accTxs.filter(tx => tx.type === "OUT").reduce((sum, tx) => sum + tx.amount, 0);
                                    return (
                                        <div key={acc.id} className="relative p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-blue-500/30 transition-all group overflow-hidden">
                                            <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-blue-500/5 blur-2xl rounded-full group-hover:bg-blue-500/15 transition-all" />

                                            <div className="flex items-start justify-between mb-4">
                                                <div className="p-2.5 bg-white/5 rounded-xl text-xl">🏦</div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-tighter">Số dư hiện tại</span>
                                                    <div className={`text-xl font-black tracking-tight ${acc.balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                                        {acc.balance.toLocaleString()}
                                                        <span className="ml-1 text-xs font-medium text-[var(--muted)]">{acc.currency}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="font-bold text-sm text-white mb-4 group-hover:text-blue-400 transition-colors truncate">{acc.name}</div>

                                            <div className="grid grid-cols-2 gap-2 mb-4">
                                                <div className="bg-white/5 rounded-xl p-2">
                                                    <span className="text-[9px] text-[var(--muted)] block mb-1 uppercase font-bold">Tổng thu</span>
                                                    <span className="text-xs font-bold text-green-400 tracking-tight">+{accIn.toLocaleString()}</span>
                                                </div>
                                                <div className="bg-white/5 rounded-xl p-2">
                                                    <span className="text-[9px] text-[var(--muted)] block mb-1 uppercase font-bold">Tổng chi</span>
                                                    <span className="text-xs font-bold text-red-400 tracking-tight">-{accOut.toLocaleString()}</span>
                                                </div>
                                            </div>

                                            {/* Minimalist Progress */}
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full"
                                                    style={{ width: `${Math.min((acc.balance / (acc.openingBalance || acc.balance || 1)) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-white/[0.02] border-2 border-dashed border-white/5 rounded-3xl">
                                <Landmark size={48} className="mx-auto text-[var(--muted)] mb-4 opacity-20" />
                                <p className="text-[var(--muted)] text-sm mb-6">Chưa có tài khoản ngân hàng nào được gán cho dự án này.</p>
                                {(userRole === "ADMIN" || hasProjectPermission(currentUser?.uid || currentUser?.id, project, "manage_accounts", currentUser)) && (
                                    <button onClick={() => setIsAccountModalOpen(true)} className="glass-button px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/20">
                                        + Liên kết tài khoản ngay
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "members" && (
                    <div className="space-y-8">
                        {/* Summary Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-2xl font-bold flex items-center gap-2">
                                    <Users size={24} className="text-blue-400" />
                                    Đội ngũ & Phân quyền
                                </h3>
                                <p className="text-[var(--muted)] text-sm mt-1">
                                    Quản lý thành viên và quyền hạn trực tiếp ({projectMembers.length} thành viên)
                                </p>
                            </div>

                            {/* Permission Info Button */}
                            <button
                                onClick={() => setIsPermissionInfoModalOpen(true)}
                                className="glass-button px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-white border border-white/10 flex items-center gap-2 transition-all self-start md:self-auto"
                            >
                                <Info size={18} className="text-blue-400" />
                                Chi tiết quyền hạn
                            </button>

                            {/* Save Button (Optional if updates are instant, but good for batch/confirm feeling) */}
                            {userRole === "ADMIN" && (
                                <button
                                    onClick={handleUpdateMembers}
                                    className="glass-button px-6 py-2.5 rounded-xl text-sm font-bold bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/20 flex items-center gap-2 transition-all self-start md:self-auto"
                                >
                                    <Check size={18} />
                                    Lưu thay đổi phân quyền
                                </button>
                            )}
                        </div>

                        {/* Member List Grid */}
                        <div className="space-y-4">
                            {getProjectMembersWithInfo().length > 0 ? (
                                getProjectMembersWithInfo().map(({ user, role, permissions }) => (
                                    <div key={user!.uid} className="flex flex-col xl:flex-row xl:items-center gap-4 p-5 bg-white/[0.03] border border-white/5 rounded-2xl hover:border-blue-500/20 transition-all group">

                                        {/* User Info & Role */}
                                        <div className="flex items-center gap-4 min-w-[300px]">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-black text-white shadow-lg shrink-0">
                                                {user!.displayName ? user!.displayName[0].toUpperCase() : user!.email[0].toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-base font-bold truncate text-white">{user!.displayName || user!.email}</div>
                                                <div className="text-xs text-[var(--muted)] mb-1.5">{user!.email}</div>

                                                {/* Inline Role Selector */}
                                                {userRole === "ADMIN" ? (
                                                    <select
                                                        value={role}
                                                        onChange={(e) => handleChangeMemberRole(user!.uid, e.target.value as ProjectRole)}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500 text-blue-300 w-full max-w-[140px]"
                                                    >
                                                        <option value="OWNER">👑 Chủ dự án</option>
                                                        <option value="MANAGER">🔧 Quản lý</option>
                                                        <option value="MEMBER">👤 Thành viên</option>
                                                        <option value="VIEWER">👁️ Người xem</option>
                                                    </select>
                                                ) : (
                                                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-lg border inline-block font-bold tracking-widest ${PROJECT_ROLE_COLORS[role]}`}>
                                                        {PROJECT_ROLE_LABELS[role]}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Permissions Matrix - Clickable Icons */}
                                        <div className="flex-1 overflow-x-auto pb-2 xl:pb-0">
                                            <div className="flex items-center gap-1 min-w-max">
                                                {(Object.keys(PROJECT_PERMISSION_LABELS) as ProjectPermission[]).map(permission => {
                                                    const hasPermission = permissions.includes(permission);
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
                                                        <div
                                                            key={permission}
                                                            onClick={() => userRole === "ADMIN" && handleTogglePermission(user!.uid, permission)}
                                                            className={`
                                                                relative group/icon flex items-center justify-center w-10 h-10 rounded-xl border transition-all cursor-pointer
                                                                ${hasPermission
                                                                    ? "bg-blue-500/10 border-blue-500/30 text-white shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                                                                    : "bg-white/5 border-white/5 text-[var(--muted)] hover:bg-white/10 hover:border-white/10"
                                                                }
                                                                ${userRole !== "ADMIN" ? "pointer-events-none opacity-80" : ""}
                                                            `}
                                                            title={PROJECT_PERMISSION_LABELS[permission]}
                                                        >
                                                            <span className="text-lg">{icons[permission]}</span>

                                                            {/* Tooltip */}
                                                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 border border-white/10 text-xs text-white rounded-lg opacity-0 group-hover/icon:opacity-100 pointer-events-none whitespace-nowrap z-10">
                                                                {PROJECT_PERMISSION_LABELS[permission]}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="text-[10px] text-[var(--muted)] mt-1.5 flex gap-4 px-1">
                                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Đã cấp quyền</span>
                                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span> Chưa cấp</span>
                                            </div>
                                        </div>

                                        {/* Remove Button */}
                                        {userRole === "ADMIN" && (
                                            <button
                                                onClick={() => handleRemoveMember(user!.uid)}
                                                className="p-3 rounded-xl hover:bg-red-500/10 text-[var(--muted)] hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20 shrink-0 self-start xl:self-center"
                                                title="Xóa khỏi dự án"
                                            >
                                                <X size={20} />
                                            </button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 text-center bg-white/[0.02] border-2 border-dashed border-white/5 rounded-3xl">
                                    <Users size={48} className="mx-auto text-[var(--muted)] mb-4 opacity-20" />
                                    <p className="text-[var(--muted)] text-sm mb-4">Dự án chưa có thành viên chính thức.</p>
                                </div>
                            )}
                        </div>

                        {/* Add New Member Section - Collapsible */}
                        {userRole === "ADMIN" && (
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden transition-all">
                                <button
                                    onClick={() => setIsAddMemberExpanded(!isAddMemberExpanded)}
                                    className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
                                >
                                    <h4 className="text-lg font-bold flex items-center gap-2">
                                        <Plus size={20} className="text-green-400" />
                                        Thêm thành viên mới
                                    </h4>
                                    <ChevronDown
                                        size={20}
                                        className={`text-[var(--muted)] transition-transform duration-300 ${isAddMemberExpanded ? "rotate-180" : ""}`}
                                    />
                                </button>

                                {isAddMemberExpanded && (
                                    <div className="p-6 pt-0 border-t border-white/5 mt-2">
                                        <div className="mb-4">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Tìm kiếm nhân viên theo tên hoặc email..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all placeholder:text-[var(--muted)]"
                                                />
                                                <Users size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {allUsers
                                                .filter(u => !projectMembers.find(m => m.id === u.uid))
                                                .filter(u =>
                                                    !searchTerm ||
                                                    (u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                        u.email.toLowerCase().includes(searchTerm.toLowerCase()))
                                                )
                                                .map(u => (
                                                    <div
                                                        key={u.uid}
                                                        className="flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:border-green-500/30 hover:bg-green-500/5 transition-all group bg-[#121212]"
                                                    >
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center font-bold text-sm shrink-0">
                                                            {u.displayName?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-sm text-white truncate">{u.displayName || u.email}</div>
                                                            <div className="text-xs text-[var(--muted)]">{u.position || "Nhân viên"}</div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleAddMember(u.uid, "MEMBER")}
                                                            className="p-2 rounded-lg bg-white/5 hover:bg-green-500 text-green-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                            title="Thêm vào dự án"
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            {allUsers.filter(u => !projectMembers.find(m => m.id === u.uid))
                                                .filter(u => !searchTerm || (u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())))
                                                .length === 0 && (
                                                    <div className="col-span-full text-center py-4 text-[var(--muted)] text-sm italic">
                                                        {searchTerm ? "Không tìm thấy kết quả phù hợp." : "Tất cả nhân viên đã tham gia dự án này."}
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}


                    </div>
                )}



                {activeTab === "categories" && (
                    <ProjectSubCategoriesTab
                        project={project}
                        onProjectUpdate={(updatedProject) => setProject(updatedProject)}
                        canEdit={canEdit || userRole === "ADMIN"}
                        currentUserId={currentUser?.uid || currentUser?.id || ""}
                    />
                )}
            </div>

            {/* Member Management Modal - REMOVED (Inlined) */}

            {/* Permission Info Modal */}
            {isPermissionInfoModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-4xl p-8 rounded-2xl relative max-h-[90vh] flex flex-col">
                        <button onClick={() => setIsPermissionInfoModalOpen(false)} className="absolute top-6 right-6 text-[var(--muted)] hover:text-white text-2xl">✕</button>

                        <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                            <Shield size={28} className="text-blue-500" />
                            Chi tiết quyền hạn dự án
                        </h2>
                        <p className="text-[var(--muted)] mb-6">Giải thích chi tiết về các vai trò và quyền hạn trong hệ thống</p>

                        <div className="flex-1 overflow-y-auto pr-2">
                            {/* Roles Section */}
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-white mb-3">Vai trò trong dự án</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(Object.keys(PROJECT_ROLE_LABELS) as ProjectRole[]).map(role => (
                                        <div key={role} className={`p-4 rounded-xl border ${PROJECT_ROLE_COLORS[role]} bg-opacity-10 border-opacity-30`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-xs font-bold px-2 py-1 rounded border ${PROJECT_ROLE_COLORS[role]} bg-opacity-20`}>
                                                    {PROJECT_ROLE_LABELS[role]}
                                                </span>
                                            </div>
                                            <ul className="list-disc list-inside space-y-1">
                                                {PROJECT_ROLE_DESCRIPTIONS[role]?.map((desc, idx) => (
                                                    <li key={idx} className="text-sm opacity-80">{desc}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Permissions Section */}
                            <div>
                                <h3 className="text-lg font-bold text-white mb-3">Chi tiết từng quyền hạn</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(Object.keys(PROJECT_PERMISSION_LABELS) as ProjectPermission[]).map(p => (
                                        <div key={p} className="flex gap-4 items-start p-4 rounded-xl bg-white/[0.03] border border-white/5">
                                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-2xl shrink-0">
                                                {{
                                                    view_transactions: "👁️",
                                                    create_income: "💰",
                                                    create_expense: "💸",
                                                    approve_transactions: "✅",
                                                    manage_accounts: "🏦",
                                                    manage_members: "👥",
                                                    view_reports: "📊"
                                                }[p]}
                                            </div>
                                            <div>
                                                <div className="text-base font-bold text-white mb-1">{PROJECT_PERMISSION_LABELS[p]}</div>
                                                <div className="text-sm text-[var(--muted)] leading-relaxed">{PROJECT_PERMISSION_DESCRIPTIONS[p]}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-6 mt-6 border-t border-white/10">
                            <button
                                onClick={() => setIsPermissionInfoModalOpen(false)}
                                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
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
                                projectMembers={projectMembers}
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
function AccountSelector({ selectedAccountIds, toggleSelection, currentProjectId, projectMembers }: {
    selectedAccountIds: string[],
    toggleSelection: (id: string) => void,
    currentProjectId: string,
    projectMembers: ProjectMember[]
}) {
    const [allAccounts, setAllAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
    const [accountUserAssignments, setAccountUserAssignments] = useState<Record<string, string[]>>({});

    // Get project member IDs
    const memberIds = projectMembers.map(m => m.id);

    useEffect(() => {
        Promise.all([
            getAccounts(),
            import("@/lib/finance").then(mod => mod.getProjects()),
            import("@/lib/users").then(mod => mod.getUsers())
        ]).then(([accs, projs, users]) => {
            setAllAccounts(accs);
            setProjects(projs);
            setAllUsers(users);
            // Initialize assignments from existing data only
            // Default is empty (no one assigned) - admin must explicitly assign
            const assignments: Record<string, string[]> = {};
            accs.forEach(acc => {
                if (acc.assignedUserIds && acc.assignedUserIds.length > 0) {
                    assignments[acc.id] = acc.assignedUserIds;
                }
                // Default: empty array (no one assigned)
            });
            setAccountUserAssignments(assignments);
            setLoading(false);
        });
    }, [currentProjectId]);

    const getProjectName = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        return project?.name || "Dự án khác";
    };

    const getUserName = (userId: string) => {
        const user = allUsers.find(u => u.uid === userId);
        return user?.displayName || user?.email || userId;
    };

    const toggleUserAssignment = async (accountId: string, userId: string) => {
        const currentAssignments = accountUserAssignments[accountId] || [];
        let newAssignments: string[];

        if (currentAssignments.includes(userId)) {
            newAssignments = currentAssignments.filter(id => id !== userId);
        } else {
            newAssignments = [...currentAssignments, userId];
        }

        setAccountUserAssignments(prev => ({
            ...prev,
            [accountId]: newAssignments
        }));

        // Update in Firebase
        try {
            await updateAccount(accountId, {
                assignedUserIds: newAssignments
            });
        } catch (error) {
            console.error("Failed to update account assignments", error);
        }
    };

    const selectAllUsers = async (accountId: string) => {
        setAccountUserAssignments(prev => ({
            ...prev,
            [accountId]: [...memberIds]
        }));
        try {
            await updateAccount(accountId, { assignedUserIds: [...memberIds] });
        } catch (error) {
            console.error("Failed to update account assignments", error);
        }
    };

    const deselectAllUsers = async (accountId: string) => {
        setAccountUserAssignments(prev => ({
            ...prev,
            [accountId]: []
        }));
        try {
            await updateAccount(accountId, { assignedUserIds: [] });
        } catch (error) {
            console.error("Failed to update account assignments", error);
        }
    };

    // When selecting an account for project, don't auto-assign anyone
    const handleToggleSelection = (accId: string) => {
        toggleSelection(accId);
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
                <div className="space-y-3">
                    {availableAccounts.map(acc => {
                        const isSelected = selectedAccountIds.includes(acc.id);
                        const assignedUsers = accountUserAssignments[acc.id] || [];
                        const isEditing = editingAccountId === acc.id;
                        const isAllAssigned = assignedUsers.length === memberIds.length && memberIds.every(id => assignedUsers.includes(id));

                        return (
                            <div key={acc.id} className={`rounded-xl border transition-all ${isSelected
                                ? "bg-blue-500/10 border-blue-500/50"
                                : "border-white/5 hover:border-white/10"
                                }`}>
                                {/* Account Header */}
                                <label className="flex items-center gap-3 p-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggleSelection(acc.id)}
                                        className="w-5 h-5 rounded border-gray-600 bg-transparent text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                                    />
                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg shrink-0">
                                        🏦
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-white truncate">{acc.name}</div>
                                        <div className="text-xs text-[var(--muted)]">{acc.currency} • {acc.balance.toLocaleString()}</div>
                                    </div>
                                    {isSelected && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setEditingAccountId(isEditing ? null : acc.id);
                                            }}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1"
                                        >
                                            <Users size={14} />
                                            {isAllAssigned ? "Tất cả" : assignedUsers.length === 0 ? "Không ai" : `${assignedUsers.length}/${memberIds.length} NV`}
                                        </button>
                                    )}
                                </label>

                                {/* User Assignment Panel */}
                                {isSelected && isEditing && (
                                    <div className="px-3 pb-3 border-t border-white/10 mt-2 pt-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium text-[var(--muted)]">
                                                Nhân viên được sử dụng tài khoản này:
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => selectAllUsers(acc.id)}
                                                    className="text-xs text-blue-400 hover:text-blue-300"
                                                >
                                                    Chọn tất cả
                                                </button>
                                                <span className="text-white/20">|</span>
                                                <button
                                                    type="button"
                                                    onClick={() => deselectAllUsers(acc.id)}
                                                    className="text-xs text-red-400 hover:text-red-300"
                                                >
                                                    Bỏ chọn tất cả
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {memberIds.map(memberId => {
                                                const isAssigned = assignedUsers.includes(memberId);
                                                return (
                                                    <button
                                                        key={memberId}
                                                        type="button"
                                                        onClick={() => toggleUserAssignment(acc.id, memberId)}
                                                        className={`px-2 py-1 rounded-lg text-xs transition-all flex items-center gap-1 ${isAssigned
                                                            ? "bg-green-500/20 text-green-400 border border-green-500/50"
                                                            : "bg-white/5 text-[var(--muted)] border border-white/10 hover:border-white/20"
                                                            }`}
                                                    >
                                                        {isAssigned && <Check size={12} />}
                                                        {getUserName(memberId)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {assignedUsers.length === 0 && (
                                            <p className="mt-2 text-xs text-yellow-400">
                                                ⚠️ Chưa có ai được gán - không ai có thể sử dụng tài khoản này
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Show assigned users summary when not editing */}
                                {isSelected && !isEditing && (
                                    <div className="px-3 pb-2">
                                        <div className="flex flex-wrap gap-1">
                                            {isAllAssigned ? (
                                                <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-xs">
                                                    ✓ Tất cả thành viên
                                                </span>
                                            ) : assignedUsers.length === 0 ? (
                                                <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-xs">
                                                    ⚠️ Chưa gán ai
                                                </span>
                                            ) : (
                                                <>
                                                    {assignedUsers.slice(0, 3).map(userId => (
                                                        <span key={userId} className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-xs">
                                                            {getUserName(userId)}
                                                        </span>
                                                    ))}
                                                    {assignedUsers.length > 3 && (
                                                        <span className="px-2 py-0.5 rounded bg-white/10 text-[var(--muted)] text-xs">
                                                            +{assignedUsers.length - 3}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {availableAccounts.length === 0 && (
                        <div className="text-center py-4 text-[var(--muted)]">Không có tài khoản khả dụng</div>
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
