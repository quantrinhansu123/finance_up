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

    const toggleGroup = (title: string) => {
        setCollapsedGroups(prev => ({ ...prev, [title]: !prev[title] }));
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
        <>
            {/* Brand */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/5">
                <h1 className="text-lg font-bold text-white tracking-widest uppercase">
                    Dolab<span className="text-blue-500">.</span>
                </h1>
                <div className="flex items-center gap-2">
                    <LanguageToggle />
                    {/* Close button - mobile only */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-1 rounded hover:bg-white/10 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* User Snippet */}
            {user && (
                <div className="p-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {user.displayName?.charAt(0) || "U"}
                        </div>
                        <div className="overflow-hidden min-w-0">
                            <h4 className="font-medium text-white text-xs truncate">{user.displayName}</h4>
                            <p className="text-[10px] text-white/40 uppercase tracking-wider">
                                {userRole === "ADMIN" ? t("approved") : t("members")}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Nav Links */}
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-2">
                {navGroups.map((group) => {
                    if (group.items.length === 0) return null;
                    const isCollapsed = collapsedGroups[group.title];
                    const hasActiveItem = group.items.some(item => pathname === item.href);

                    // Group icons mapping
                    const groupIcons: Record<string, React.ReactNode> = {
                        "overview": <LayoutDashboard size={16} />,
                        "income_expense": <ArrowRightLeft size={16} />,
                        "management": <FolderOpen size={16} />,
                        "system": <Users size={16} />
                    };

                    return (
                        <div key={group.id} className="mb-1">
                            <button
                                onClick={() => toggleGroup(group.id)}
                                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 ${hasActiveItem
                                    ? "bg-gradient-to-r from-blue-600/30 to-purple-600/20 text-white border border-blue-500/30 shadow-lg shadow-blue-500/10"
                                    : "text-white/60 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                <span className={`p-1.5 rounded-lg transition-all ${hasActiveItem
                                    ? "bg-blue-500 text-white shadow-md shadow-blue-500/50"
                                    : "bg-white/10 text-white/60"
                                    }`}>
                                    {groupIcons[group.id]}
                                </span>
                                <span className="flex-1 text-left">{group.title}</span>
                                <span className={`transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}>
                                    <ChevronRight size={14} />
                                </span>
                            </button>

                            <div className={`overflow-hidden transition-all duration-300 ease-out ${isCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
                                }`}>
                                <div className="mt-1.5 ml-4 space-y-0.5 border-l-2 border-white/10 pl-2">
                                    {group.items.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${isActive
                                                    ? "bg-white/10 text-white font-medium border-l-2 border-blue-400 -ml-[2px] pl-[14px]"
                                                    : "text-white/50 hover:bg-white/5 hover:text-white"
                                                    }`}
                                            >
                                                <span className={`flex-shrink-0 ${isActive ? "text-blue-400" : ""}`}>{item.icon}</span>
                                                <span className="truncate">{item.name}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Logout */}
            <div className="p-2 border-t border-white/5">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 w-full rounded-lg text-[var(--muted)] hover:bg-red-500/10 hover:text-red-400 transition-all text-sm"
                >
                    <span>{t("logout")}</span>
                </button>
            </div>
        </>
    );

    return (
        <div className="flex h-screen w-full font-sans overflow-hidden text-white bg-[#121212]">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-12 bg-[#121212] border-b border-white/5 flex items-center justify-between px-4 z-40">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <Menu size={22} />
                </button>
                <h1 className="text-base font-bold text-white tracking-widest uppercase">
                    Dolab<span className="text-blue-500">.</span>
                </h1>
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
            <aside className="hidden lg:flex w-56 bg-[#121212] flex-col border-r border-white/5 z-30">
                <SidebarContent />
            </aside>

            {/* Sidebar - Mobile (Slide-in) */}
            <aside className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-[#121212] flex flex-col border-r border-white/5 z-50 transform transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}>
                <SidebarContent />
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Content */}
                <main className="flex-1 overflow-y-auto p-4 pt-16 lg:pt-4 lg:p-6 relative z-10">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
