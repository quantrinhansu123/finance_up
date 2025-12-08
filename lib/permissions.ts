export type Role = "ADMIN" | "TREASURER" | "MANAGER" | "ACCOUNTANT" | "STAFF";

export const PERMISSIONS = {
    ADMIN: {
        canApprove: true,
        canEditBalance: true,
        canViewUsers: true,
        canViewAllTransactions: true,
        canViewGlobalStats: true,
        canViewAccounts: true,
        canManageFixedCosts: true,
        canManageProjects: true,
        canManageFunds: true,
        canManageRevenue: true,
        canViewReports: true,
        canViewLogs: true,
        allowedCategories: ["ALL"],
    },
    ACCOUNTANT: { // Kế toán
        canApprove: false,
        canEditBalance: true,
        canViewUsers: false,
        canViewAllTransactions: true,
        canViewGlobalStats: true,
        canViewAccounts: true,
        canManageFixedCosts: true,
        canManageProjects: true,
        canManageFunds: true,
        canManageRevenue: true,
        canViewReports: true,
        canViewLogs: false,
        allowedCategories: ["ALL"],
    },
    TREASURER: { // Thủ quỹ - chỉ quản lý tài khoản và quỹ nhóm
        canApprove: false,
        canEditBalance: false,
        canViewUsers: false,
        canViewAllTransactions: false,
        canViewGlobalStats: false,
        canViewAccounts: true,
        canManageFixedCosts: false,
        canManageProjects: false,
        canManageFunds: true,
        canManageRevenue: false,
        canViewReports: false,
        canViewLogs: false,
        allowedCategories: [
            "Chi lương nhân viên",
            "Thanh toán cước vận chuyển VET",
            "Thanh toán cước vận chuyển J&T",
            "Mua đồ dùng văn phòng",
            "Chuyển nội bộ",
            "Cước vận chuyển HN-HCM",
            "Cước vận chuyển HCM-HN",
            "SIM Smart", "SIM CellCard", "SIM MetPhone"
        ],
    },
    MANAGER: {
        canApprove: false,
        canEditBalance: false,
        canViewUsers: false,
        canViewAllTransactions: false,
        canViewGlobalStats: false,
        canViewAccounts: false,
        canManageFixedCosts: false,
        canManageProjects: true,
        canManageFunds: true,
        canManageRevenue: true,
        canViewReports: true,
        canViewLogs: false,
        allowedCategories: ["ALL"],
    },
    STAFF: {
        canApprove: false,
        canEditBalance: false,
        canViewUsers: false,
        canViewAllTransactions: false,
        canViewGlobalStats: false,
        canViewAccounts: false,
        canManageFixedCosts: false,
        canManageProjects: false,
        canManageFunds: false,
        canManageRevenue: false,
        canViewReports: false,
        canViewLogs: false,
        allowedCategories: ["ALL"],
    }
};

export function getCategoriesForRole(role: Role = "ADMIN", allCategories: string[]) {
    const roleKey = role || "STAFF";
    // Safety check if role exists
    const permissions = PERMISSIONS[roleKey] || PERMISSIONS["STAFF"];

    if (permissions.allowedCategories[0] === "ALL") return allCategories;
    return allCategories.filter(cat => permissions.allowedCategories.includes(cat));
}

// Permission Helpers
export function canAccessApprovals(role: Role = "ADMIN") {
    return (PERMISSIONS[role] || PERMISSIONS["STAFF"]).canApprove;
}

export function canAccessUsers(role: Role = "ADMIN") {
    return (PERMISSIONS[role] || PERMISSIONS["STAFF"]).canViewUsers;
}

export function canViewAllTransactions(role: Role = "ADMIN") {
    return (PERMISSIONS[role] || PERMISSIONS["STAFF"]).canViewAllTransactions;
}

export function canViewGlobalStats(role: Role = "ADMIN") {
    return (PERMISSIONS[role] || PERMISSIONS["STAFF"]).canViewGlobalStats;
}

export function canViewAccounts(role: Role = "ADMIN") {
    return (PERMISSIONS[role] || PERMISSIONS["STAFF"]).canViewAccounts;
}

export function canManageFixedCosts(role: Role = "ADMIN") {
    return (PERMISSIONS[role] || PERMISSIONS["STAFF"]).canManageFixedCosts;
}

export function canManageProjects(role: Role = "ADMIN") {
    return (PERMISSIONS[role] || PERMISSIONS["STAFF"]).canManageProjects;
}

export function canManageFunds(role: Role = "ADMIN") {
    return (PERMISSIONS[role] || PERMISSIONS["STAFF"]).canManageFunds;
}

export function canManageRevenue(role: Role = "ADMIN") {
    return (PERMISSIONS[role] || PERMISSIONS["STAFF"]).canManageRevenue;
}

export function canViewReports(role: Role = "ADMIN") {
    return (PERMISSIONS[role] || PERMISSIONS["STAFF"]).canViewReports;
}

export function canViewLogs(role: Role = "ADMIN") {
    return (PERMISSIONS[role] || PERMISSIONS["STAFF"]).canViewLogs;
}

export function getUserRole(user: any): Role {
    if (!user) return "STAFF";

    // 1. Ưu tiên kiểm tra financeRole được phân quyền trực tiếp
    if (user.financeRole && user.financeRole !== "NONE") {
        const validRoles: Role[] = ["ADMIN", "ACCOUNTANT", "TREASURER", "MANAGER", "STAFF"];
        if (validRoles.includes(user.financeRole)) {
            return user.financeRole as Role;
        }
    }

    // 2. Hardcode ADMIN cho CEO email
    if (user.email && user.email.toLowerCase() === "ceo.fata@gmail.com") {
        return "ADMIN";
    }

    // 3. Kiểm tra employment.position từ hệ thống nhân sự
    const employmentPosition = user.employment?.position ? user.employment.position.toUpperCase() : "";
    
    if (employmentPosition === "CEO&FOUNDER") {
        return "ADMIN";
    }

    // 4. Fallback theo position/role cũ
    const position = user.position ? user.position.toUpperCase() : "";
    const role = user.role ? user.role.toUpperCase() : "";

    if (position.includes("CEO") || role === "ADMIN") {
        return "ADMIN";
    }

    if (employmentPosition.includes("KẾ TOÁN") || position.includes("KẾ TOÁN") || role === "ACCOUNTANT") {
        return "ACCOUNTANT";
    }

    if (employmentPosition.includes("THỦ QUỸ") || position.includes("THỦ QUỸ") || role === "TREASURER") {
        return "TREASURER";
    }

    if (role === "MANAGER" || employmentPosition.includes("QUẢN LÝ") || position.includes("QUẢN LÝ") || employmentPosition.includes("TRƯỞNG PHÒNG") || position.includes("TRƯỞNG PHÒNG")) {
        return "MANAGER";
    }

    // 5. Default to STAFF
    return "STAFF";
}

// Kiểm tra user có quyền truy cập hệ thống tài chính không
export function canAccessFinanceSystem(user: any): boolean {
    if (!user) return false;
    
    // Admin luôn được truy cập
    if (user.email?.toLowerCase() === "ceo.fata@gmail.com") return true;
    if (user.employment?.position?.toUpperCase() === "CEO&FOUNDER") return true;
    
    // Kiểm tra financeRole
    if (user.financeRole) {
        return user.financeRole !== "NONE";
    }
    
    // Nếu chưa được phân quyền financeRole -> không cho truy cập
    return false;
}

// Kiểm tra user có quyền chuyển tiền nội bộ không (STAFF không được)
export function canTransferMoney(role: Role): boolean {
    return role !== "STAFF";
}

// Lấy danh sách project mà user được phép truy cập
export function getAccessibleProjects(user: any, allProjects: any[]): any[] {
    const role = getUserRole(user);
    
    // Admin, Accountant, Manager có thể xem tất cả
    if (role === "ADMIN" || role === "ACCOUNTANT" || role === "MANAGER") {
        return allProjects;
    }
    
    // STAFF và TREASURER chỉ xem project mình tham gia
    const userId = user?.uid || user?.id;
    return allProjects.filter(p => 
        p.memberIds?.includes(userId) || 
        p.createdBy === userId
    );
}

// Lấy danh sách account mà user được phép truy cập
export function getAccessibleAccounts(user: any, allAccounts: any[], accessibleProjectIds: string[]): any[] {
    const role = getUserRole(user);
    
    // Admin, Accountant có thể xem tất cả
    if (role === "ADMIN" || role === "ACCOUNTANT") {
        return allAccounts;
    }
    
    // Các role khác chỉ xem account của project mình hoặc account chung
    return allAccounts.filter(a => 
        !a.projectId || // Account chung
        accessibleProjectIds.includes(a.projectId)
    );
}
