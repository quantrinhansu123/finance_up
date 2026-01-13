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

export default function FinanceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [userRole, setUserRole] = useState<Role>("USER");
    const [user, setUser] = useState<any>(null);
    const [projects, setProjects] = useState<Project[]>([]);
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
                // Chỉ hiện Thu tiền nếu user có quyền create_income trong ít nhất 1 dự án
                ...(userPermissions.canCreateIncome ? [{ name: "Thu tiền", href: "/finance/income", icon: <ArrowDownToLine size={18} /> }] : []),
                // Chỉ hiện Chi tiền nếu user có quyền create_expense trong ít nhất 1 dự án
                ...(userPermissions.canCreateExpense ? [{ name: "Chi tiền", href: "/finance/expense", icon: <ArrowUpFromLine size={18} /> }] : []),
                // Chỉ hiện Chuyển tiền nếu là ADMIN
                ...(userRole === "ADMIN" ? [{ name: "Chuyển tiền", href: "/finance/transfer", icon: <ArrowRightLeft size={18} /> }] : []),
                // Chỉ hiện Phê duyệt nếu user có quyền approve trong ít nhất 1 dự án hoặc là ADMIN
                ...(userPermissions.canApprove ? [{ name: "Phê duyệt", href: "/finance/approvals", icon: <CheckSquare size={18} /> }] : []),
                // Chỉ hiện Giao dịch nếu user có quyền xem giao dịch
                ...(userPermissions.canViewTransactions ? [{ name: "Giao dịch", href: "/finance/transactions", icon: <ArrowRightLeft size={18} /> }] : []),
            ]
        },
        {
            title: "Quản lý",
            items: [
                // Dự án - hiện nếu user có quyền xem ít nhất 1 dự án hoặc là ADMIN
                ...(userRole === "ADMIN" || userPermissions.hasAccessibleProjects ? [{ name: "Dự án", href: "/finance/projects", icon: <FolderOpen size={18} /> }] : []),
                // Các mục khác chỉ ADMIN mới thấy
                ...(userRole === "ADMIN" ? [
                    { name: "Tài khoản", href: "/finance/accounts", icon: <CreditCard size={18} /> },
                    { name: "Quỹ/Nhóm", href: "/finance/funds", icon: <PiggyBank size={18} /> },
                    { name: "Doanh thu", href: "/finance/revenue", icon: <TrendingUp size={18} /> },
                    { name: "Chi phí cố định", href: "/finance/fixed-costs", icon: <Pin size={18} /> },
                ] : [])
            ]
        },
        {
            title: "Hệ thống",
            items: [
                // Báo cáo - hiện nếu user có quyền view_reports trong ít nhất 1 dự án hoặc là ADMIN
                ...(userPermissions.canViewReports ? [{ name: "Báo cáo", href: "/finance/reports", icon: <FileBarChart size={18} /> }] : []),
                // Chỉ ADMIN mới thấy Người dùng, Nhật ký
                ...(userRole === "ADMIN" ? [
                    { name: "Người dùng", href: "/finance/users", icon: <Users size={18} /> },
                    { name: "Nhật ký", href: "/finance/logs", icon: <ScrollText size={18} /> },
                ] : []),
                // Tài khoản của tôi - tất cả đều thấy
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
                                {userRole === "ADMIN" ? "Quản trị viên" : "Thành viên"}
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
                        "Tổng quan": <LayoutDashboard size={16} />,
                        "Thu & Chi": <ArrowRightLeft size={16} />,
                        "Quản lý": <FolderOpen size={16} />,
                        "Hệ thống": <Users size={16} />
                    };

                    return (
                        <div key={group.title} className="mb-1">
                            <button
                                onClick={() => toggleGroup(group.title)}
                                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 ${
                                    hasActiveItem 
                                        ? "bg-gradient-to-r from-blue-600/30 to-purple-600/20 text-white border border-blue-500/30 shadow-lg shadow-blue-500/10" 
                                        : "text-white/60 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                <span className={`p-1.5 rounded-lg transition-all ${
                                    hasActiveItem 
                                        ? "bg-blue-500 text-white shadow-md shadow-blue-500/50" 
                                        : "bg-white/10 text-white/60"
                                }`}>
                                    {groupIcons[group.title]}
                                </span>
                                <span className="flex-1 text-left">{group.title}</span>
                                <span className={`transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}>
                                    <ChevronRight size={14} />
                                </span>
                            </button>
                            
                            <div className={`overflow-hidden transition-all duration-300 ease-out ${
                                isCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
                            }`}>
                                <div className="mt-1.5 ml-4 space-y-0.5 border-l-2 border-white/10 pl-2">
                                    {group.items.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                                    isActive
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
