"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import {
    getUserRole,
    getAccessibleProjects,
    hasProjectPermission,
    Role
} from "@/lib/permissions";
import { getProjects } from "@/lib/finance";
import { Project } from "@/types/finance";
import { LanguageProvider, useTranslation } from "@/lib/i18n";
import {
    LayoutDashboard,
    ArrowDownToLine,
    ArrowUpFromLine,
    CheckSquare,
    ArrowRightLeft,
    CreditCard,
    FolderOpen,
    PiggyBank,
    TrendingUp,
    Pin,
    FileBarChart,
    Users,
    ScrollText,
    Menu,
    X,
    ChevronRight,
    UserCircle
} from "lucide-react";
import LanguageToggle from "@/components/finance/LanguageToggle";
import { motion } from "framer-motion";

export default function FinanceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <LanguageProvider>
            <FinanceLayoutContent>{children}</FinanceLayoutContent>
        </LanguageProvider>
    );
}

function FinanceLayoutContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useTranslation();
    const [userRole, setUserRole] = useState<Role>("USER");
    const [user, setUser] = useState<any>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Default all groups to collapsed
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
        "overview": true,
        "income_expense": true,
        "management": true,
        "system": true
    });

    useEffect(() => {
        const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            setUserRole(getUserRole(parsed));
        } else {
            router.push("/login");
        }
    }, [router]);

    // Load projects để kiểm tra quyền
    useEffect(() => {
        const loadProjects = async () => {
            try {
                const projs = await getProjects();
                setProjects(projs);
            } catch (e) {
                console.error("Failed to load projects for permissions", e);
            }
        };
        if (user) loadProjects();
    }, [user]);

    // Kiểm tra user có quyền gì trong các dự án
    const userPermissions = useMemo(() => {
        if (!user || userRole === "ADMIN") {
            return {
                canCreateIncome: true,
                canCreateExpense: true,
                canViewTransactions: true,
                canApprove: userRole === "ADMIN",
                canTransfer: true,
                canViewReports: true,
                hasAccessibleProjects: true
            };
        }

        const userId = user?.uid || user?.id;
        if (!userId) return {
            canCreateIncome: false,
            canCreateExpense: false,
            canViewTransactions: false,
            canApprove: false,
            canTransfer: false,
            canViewReports: false,
            hasAccessibleProjects: false
        };

        const accessibleProjects = getAccessibleProjects(user, projects);

        // Kiểm tra xem user có quyền nào trong ít nhất 1 dự án
        let canCreateIncome = false;
        let canCreateExpense = false;
        let canViewTransactions = false;
        let canApprove = false;
        let canViewReports = false;

        for (const project of accessibleProjects) {
            if (hasProjectPermission(userId, project, "create_income", user)) canCreateIncome = true;
            if (hasProjectPermission(userId, project, "create_expense", user)) canCreateExpense = true;
            if (hasProjectPermission(userId, project, "view_transactions", user)) canViewTransactions = true;
            if (hasProjectPermission(userId, project, "approve_transactions", user)) canApprove = true;
            if (hasProjectPermission(userId, project, "view_reports", user)) canViewReports = true;

            // Nếu đã có tất cả quyền thì không cần check tiếp
            if (canCreateIncome && canCreateExpense && canViewTransactions && canApprove && canViewReports) break;
        }

        return {
            canCreateIncome,
            canCreateExpense,
            canViewTransactions: canViewTransactions, // Chỉ hiện khi có quyền view_transactions
            canApprove,
            canTransfer: canCreateIncome || canCreateExpense, // Có thể chuyển tiền nếu có quyền thu hoặc chi
            canViewReports,
            hasAccessibleProjects: accessibleProjects.length > 0 // Thêm để kiểm tra có dự án nào không
        };
    }, [user, userRole, projects]);

    // Auto-expand group containing current page
    useEffect(() => {
        navGroups.forEach(group => {
            const hasActiveItem = group.items.some(item => pathname === item.href);
            if (hasActiveItem) {
                setCollapsedGroups(prev => ({ ...prev, [group.id]: false }));
            }
        });
    }, [pathname]);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    const handleLogout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("isLoggedIn");
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("isLoggedIn");
        router.push("/login");
    };

    const toggleGroup = (id: string) => {
        setCollapsedGroups(prev => {
            const isCurrentlyCollapsed = prev[id];
            // If we're expanding this group, collapse all others
            if (isCurrentlyCollapsed) {
                const newState: Record<string, boolean> = {};
                Object.keys(prev).forEach(key => {
                    newState[key] = key !== id; // Collapse all except the one being expanded
                });
                return newState;
            }
            // If we're collapsing, just collapse this one
            return { ...prev, [id]: true };
        });
    };

    const navGroups = [
        {
            id: "overview",
            title: t("overview"),
            items: [
                { name: t("dashboard"), href: "/finance", icon: <LayoutDashboard size={18} /> }
            ]
        },
        {
            id: "income_expense",
            title: t("income_expense"),
            items: [
                ...(userPermissions.canCreateIncome ? [{ name: t("income"), href: "/finance/income", icon: <ArrowDownToLine size={18} /> }] : []),
                ...(userPermissions.canCreateExpense ? [{ name: t("expense"), href: "/finance/expense", icon: <ArrowUpFromLine size={18} /> }] : []),
                ...(userRole === "ADMIN" ? [{ name: t("transfer"), href: "/finance/transfer", icon: <ArrowRightLeft size={18} /> }] : []),
                ...(userPermissions.canApprove ? [{ name: t("approvals"), href: "/finance/approvals", icon: <CheckSquare size={18} /> }] : []),
                ...(userPermissions.canViewTransactions ? [{ name: t("transactions"), href: "/finance/transactions", icon: <ArrowRightLeft size={18} /> }] : []),
            ]
        },
        {
            id: "management",
            title: t("management"),
            items: [
                ...(userRole === "ADMIN" || userPermissions.hasAccessibleProjects ? [{ name: t("projects"), href: "/finance/projects", icon: <FolderOpen size={18} /> }] : []),
                ...(userRole === "ADMIN" ? [
                    { name: t("accounts"), href: "/finance/accounts", icon: <CreditCard size={18} /> },
                    { name: t("funds"), href: "/finance/funds", icon: <PiggyBank size={18} /> },
                    { name: t("categories"), href: "/finance/categories", icon: <ScrollText size={18} /> },
                    { name: t("fixed_costs"), href: "/finance/fixed-costs", icon: <Pin size={18} /> },
                ] : [])
            ]
        },
        {
            id: "system",
            title: t("system"),
            items: [
                ...(userPermissions.canViewReports ? [{ name: t("reports"), href: "/finance/reports", icon: <FileBarChart size={18} /> }] : []),
                ...(userRole === "ADMIN" ? [
                    { name: t("users"), href: "/finance/users", icon: <Users size={18} /> },
                    { name: t("logs"), href: "/finance/logs", icon: <ScrollText size={18} /> },
                ] : []),
                { name: t("my_profile"), href: "/finance/profile", icon: <UserCircle size={18} /> },
            ]
        }
    ];

    const SidebarContent = () => (
        <div className="h-full flex flex-col bg-[#080810] relative overflow-hidden">
            {/* Sci-fi Base Layer */}
            <div className="absolute inset-0 bg-grid-white pointer-events-none opacity-40" />

            {/* Drifting sci-fi orbs */}
            <motion.div
                animate={{
                    x: [0, 40, 0],
                    y: [0, -40, 0],
                    opacity: [0.1, 0.2, 0.1]
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-cyan-500/20 rounded-full blur-[80px] pointer-events-none"
            />

            {/* Data Particles */}
            {[...Array(5)].map((_, i) => (
                <motion.div
                    key={i}
                    animate={{
                        y: [-20, 1000],
                        opacity: [0, 0.5, 0]
                    }}
                    transition={{
                        duration: Math.random() * 10 + 10,
                        repeat: Infinity,
                        ease: "linear",
                        delay: Math.random() * i
                    }}
                    style={{ left: `${Math.random() * 100}%` }}
                    className="absolute w-[1px] h-12 bg-gradient-to-b from-blue-400/50 to-transparent pointer-events-none"
                />
            ))}

            {/* Brand */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.06] relative z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <TrendingUp size={16} className="text-white" />
                    </div>
                    <h1 className="text-xl font-black tracking-tight">
                        <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">UPCARE</span>
                    </h1>
                </div>
                <div className="flex items-center gap-1.5">
                    <LanguageToggle />
                    {/* Close button - mobile only */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 rounded-xl hover:bg-white/10 transition-all duration-200 hover:scale-105"
                    >
                        <X size={18} className="text-white/70" />
                    </button>
                </div>
            </div>



            {/* Nav Links */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2 relative z-10 scrollbar-thin">
                {navGroups.map((group) => {
                    if (group.items.length === 0) return null;
                    const isCollapsed = collapsedGroups[group.id];
                    const hasActiveItem = group.items.some(item => pathname === item.href);

                    // Group icons mapping with gradient colors
                    const groupStyles: Record<string, { icon: React.ReactNode; gradient: string; shadow: string }> = {
                        "overview": {
                            icon: <LayoutDashboard size={15} />,
                            gradient: "from-blue-500 to-cyan-500",
                            shadow: "shadow-blue-500/30"
                        },
                        "income_expense": {
                            icon: <ArrowRightLeft size={15} />,
                            gradient: "from-emerald-500 to-teal-500",
                            shadow: "shadow-emerald-500/30"
                        },
                        "management": {
                            icon: <FolderOpen size={15} />,
                            gradient: "from-purple-500 to-pink-500",
                            shadow: "shadow-purple-500/30"
                        },
                        "system": {
                            icon: <Users size={15} />,
                            gradient: "from-orange-500 to-amber-500",
                            shadow: "shadow-orange-500/30"
                        }
                    };

                    const style = groupStyles[group.id] || groupStyles["overview"];

                    return (
                        <div key={group.id} className="mb-1">
                            <button
                                onClick={() => toggleGroup(group.id)}
                                className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-bold uppercase tracking-wider rounded-2xl transition-all duration-300 group ${hasActiveItem
                                    ? `bg-gradient-to-r ${style.gradient}/10 text-white border border-white/10 shadow-lg ${style.shadow}`
                                    : "text-white/50 hover:text-white hover:bg-white/[0.03]"
                                    }`}
                            >
                                <span className={`p-2 rounded-xl transition-all duration-300 ${hasActiveItem
                                    ? `bg-gradient-to-br ${style.gradient} text-white shadow-lg ${style.shadow}`
                                    : "bg-white/[0.06] text-white/50 group-hover:bg-white/10 group-hover:text-white/70"
                                    }`}>
                                    {style.icon}
                                </span>
                                <span className="flex-1 text-left">{group.title}</span>
                                <span className={`transition-all duration-300 p-1 rounded-lg ${isCollapsed ? "" : "rotate-90 bg-white/5"}`}>
                                    <ChevronRight size={12} />
                                </span>
                            </button>

                            <div className={`overflow-hidden transition-all duration-400 ease-out ${isCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
                                }`}>
                                <div className="mt-2 ml-5 space-y-1 border-l border-white/[0.06] pl-3">
                                    {group.items.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group/item ${isActive
                                                    ? "bg-gradient-to-r from-white/10 to-white/5 text-white font-medium shadow-lg shadow-white/5 border-l-2 border-blue-400 -ml-[1px] pl-[11px]"
                                                    : "text-white/40 hover:bg-white/[0.04] hover:text-white/80 hover:pl-4"
                                                    }`}
                                            >
                                                <span className={`flex-shrink-0 transition-all duration-200 ${isActive
                                                    ? "text-blue-400 scale-110"
                                                    : "group-hover/item:text-white/60 group-hover/item:scale-105"
                                                    }`}>
                                                    {item.icon}
                                                </span>
                                                <span className="truncate">{item.name}</span>
                                                {isActive && (
                                                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50" />
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Footer with User & Logout */}
            <div className="border-t border-white/[0.06] relative z-10">
                {/* User Section */}
                {user && (
                    <div className="p-3 border-b border-white/[0.06]">
                        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-gradient-to-r from-white/[0.04] to-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-all duration-300 group">
                            {/* Avatar with animated ring */}
                            <div className="relative flex-shrink-0">
                                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-spin-slow opacity-75 blur-[2px]" style={{ animationDuration: '3s' }} />
                                <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-sm font-bold ring-2 ring-[#12121f] shadow-lg">
                                    {user.displayName?.charAt(0) || "U"}
                                </div>
                                {/* Online indicator */}
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-[#12121f] shadow-lg shadow-emerald-500/50" />
                            </div>
                            <div className="overflow-hidden min-w-0 flex-1">
                                <h4 className="font-semibold text-white text-sm truncate group-hover:text-blue-100 transition-colors">{user.displayName}</h4>
                                <div className="flex items-center gap-1.5">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${userRole === "ADMIN"
                                        ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/20"
                                        : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                                        }`}>
                                        {userRole === "ADMIN" ? t("approved") : t("members")}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Logout */}
                <div className="p-3">
                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-center gap-2 px-4 py-3 w-full rounded-2xl text-white/50 bg-white/[0.02] border border-white/[0.04] hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all duration-300 text-sm font-medium group"
                    >
                        <svg className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>{t("logout")}</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen w-full font-sans overflow-hidden text-white bg-[#121212]">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-gradient-to-r from-[#0f0f1a]/95 via-[#12121f]/95 to-[#0f0f1a]/95 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between px-4 z-40 shadow-lg shadow-black/20">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/10 transition-all duration-200 border border-white/[0.06]"
                >
                    <Menu size={20} className="text-white/80" />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-purple-500/20">
                        <TrendingUp size={12} className="text-white" />
                    </div>
                    <h1 className="text-lg font-black tracking-tight">
                        <span className="bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">UPCARE</span>
                    </h1>
                </div>
                <LanguageToggle />
            </div>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/60 z-40"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Desktop */}
            <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] z-30 shadow-2xl shadow-black/50">
                <SidebarContent />
            </aside>

            {/* Sidebar - Mobile (Slide-in) */}
            <aside className={`lg:hidden fixed top-0 left-0 h-full w-80 flex flex-col border-r border-white/[0.06] z-50 transform transition-transform duration-300 ease-out shadow-2xl shadow-black/50 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}>
                <SidebarContent />
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 relative bg-[#05050a] overflow-hidden">
                {/* Sci-fi Base Layers */}
                <div className="absolute inset-0 bg-grid-white pointer-events-none opacity-30" />
                <div className="absolute inset-0 scanlines opacity-[0.4] pointer-events-none" />

                {/* Plasma Glows */}
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.05, 0.15, 0.05],
                        x: [0, 100, 0]
                    }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[-10%] right-[-10%] w-[700px] h-[700px] bg-blue-600/20 rounded-full blur-[160px] pointer-events-none"
                />
                <motion.div
                    animate={{
                        rotate: [0, 360],
                    }}
                    transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none"
                />

                {/* Cyber Particles (Floating Squares) */}
                {[...Array(15)].map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{
                            opacity: [0, 0.6, 0],
                            scale: [0.5, 1, 0.5],
                            y: [0, -200],
                            x: [0, (i % 2 === 0 ? 30 : -30)]
                        }}
                        transition={{
                            duration: 10 + Math.random() * 8,
                            repeat: Infinity,
                            delay: i * 0.5
                        }}
                        style={{
                            top: `${10 + Math.random() * 80}%`,
                            left: `${5 + Math.random() * 90}%`
                        }}
                        className="absolute w-1.5 h-1.5 border border-cyan-400/40 rounded-sm pointer-events-none shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                    />
                ))}

                {/* Floating Circuit Lines */}
                <motion.div
                    animate={{ opacity: [0.1, 0.4, 0.1], x: [-100, 100] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[25%] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none"
                />
                <motion.div
                    animate={{ opacity: [0.1, 0.4, 0.1], x: [100, -100] }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear", delay: 3 }}
                    className="absolute bottom-[25%] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent pointer-events-none"
                />

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-4 pt-16 lg:pt-4 lg:p-6 relative z-10 scrollbar-thin">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
