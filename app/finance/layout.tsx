"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
    canAccessApprovals,
    canAccessUsers,
    canViewAccounts,
    canManageFixedCosts,
    canManageProjects,
    canManageFunds,
    canManageRevenue,
    canViewReports,
    canViewLogs,
    canTransferMoney,
    getUserRole,
    Role
} from "@/lib/permissions";
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
    ChevronDown,
    ChevronRight,
    UserCircle
} from "lucide-react";

export default function FinanceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [userRole, setUserRole] = useState<Role>("STAFF");
    const [user, setUser] = useState<any>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    
    // Default all groups to collapsed
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
        "Tổng quan": true,
        "Thu & Chi": true,
        "Quản lý": true,
        "Hệ thống": true
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

    // Auto-expand group containing current page
    useEffect(() => {
        navGroups.forEach(group => {
            const hasActiveItem = group.items.some(item => pathname === item.href);
            if (hasActiveItem) {
                setCollapsedGroups(prev => ({ ...prev, [group.title]: false }));
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
            title: "Tổng quan",
            items: [
                { name: "Dashboard", href: "/finance", icon: <LayoutDashboard size={18} /> }
            ]
        },
        {
            title: "Thu & Chi",
            items: [
                { name: "Thu tiền", href: "/finance/income", icon: <ArrowDownToLine size={18} /> },
                { name: "Chi tiền", href: "/finance/expense", icon: <ArrowUpFromLine size={18} /> },
                ...(canTransferMoney(userRole) ? [{ name: "Chuyển tiền", href: "/finance/transfer", icon: <ArrowRightLeft size={18} /> }] : []),
                ...(canAccessApprovals(userRole) ? [{ name: "Phê duyệt", href: "/finance/approvals", icon: <CheckSquare size={18} /> }] : []),
                { name: "Giao dịch", href: "/finance/transactions", icon: <ArrowRightLeft size={18} /> },
            ]
        },
        {
            title: "Quản lý",
            items: [
                ...(canViewAccounts(userRole) ? [{ name: "Tài khoản", href: "/finance/accounts", icon: <CreditCard size={18} /> }] : []),
                ...(canManageProjects(userRole) ? [{ name: "Dự án", href: "/finance/projects", icon: <FolderOpen size={18} /> }] : []),
                ...(canManageFunds(userRole) ? [{ name: "Quỹ/Nhóm", href: "/finance/funds", icon: <PiggyBank size={18} /> }] : []),
                ...(canManageRevenue(userRole) ? [{ name: "Doanh thu", href: "/finance/revenue", icon: <TrendingUp size={18} /> }] : []),
                ...(canManageFixedCosts(userRole) ? [{ name: "Chi phí cố định", href: "/finance/fixed-costs", icon: <Pin size={18} /> }] : []),
            ]
        },
        {
            title: "Hệ thống",
            items: [
                ...(canViewReports(userRole) ? [{ name: "Báo cáo", href: "/finance/reports", icon: <FileBarChart size={18} /> }] : []),
                ...(canAccessUsers(userRole) ? [{ name: "Người dùng", href: "/finance/users", icon: <Users size={18} /> }] : []),
                ...(canViewLogs(userRole) ? [{ name: "Nhật ký", href: "/finance/logs", icon: <ScrollText size={18} /> }] : []),
                { name: "Tài khoản của tôi", href: "/finance/profile", icon: <UserCircle size={18} /> },
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
                {/* Close button - mobile only */}
                <button 
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden p-1 rounded hover:bg-white/10 transition-colors"
                >
                    <X size={20} />
                </button>
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
                                {userRole === "ADMIN" ? "Quản trị" : 
                                 userRole === "ACCOUNTANT" ? "Kế toán" :
                                 userRole === "TREASURER" ? "Thủ quỹ" :
                                 userRole === "MANAGER" ? "Quản lý" : "Nhân viên"}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Nav Links */}
            <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
                {navGroups.map((group) => {
                    if (group.items.length === 0) return null;
                    const isCollapsed = collapsedGroups[group.title];
                    const hasActiveItem = group.items.some(item => pathname === item.href);

                    return (
                        <div key={group.title}>
                            <button
                                onClick={() => toggleGroup(group.title)}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors ${
                                    hasActiveItem ? "text-blue-400 bg-blue-500/10" : "text-[var(--muted)] hover:text-white hover:bg-white/5"
                                }`}
                            >
                                <span>{group.title}</span>
                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                            
                            <div className={`overflow-hidden transition-all duration-200 ${
                                isCollapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
                            }`}>
                                <div className="mt-1 ml-2 space-y-0.5 border-l border-white/10">
                                    {group.items.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`flex items-center gap-2 px-3 py-2 ml-2 rounded-lg text-sm transition-all ${
                                                    isActive
                                                        ? "bg-blue-600/20 text-blue-400 font-medium"
                                                        : "text-[var(--muted)] hover:bg-white/5 hover:text-white"
                                                }`}
                                            >
                                                <span className="flex-shrink-0">{item.icon}</span>
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
                    <span>Đăng xuất</span>
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
                <div className="w-8" /> {/* Spacer */}
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
            <aside className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-[#121212] flex flex-col border-r border-white/5 z-50 transform transition-transform duration-300 ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
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
