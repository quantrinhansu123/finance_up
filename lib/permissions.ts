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

// ============================================
// PROJECT-LEVEL PERMISSIONS
// ============================================

import { ProjectRole, ProjectPermission, ProjectMember, PROJECT_ROLE_PERMISSIONS, Project } from "@/types/finance";

// Lấy role của user trong một project cụ thể
export function getProjectRole(userId: string, project: Project): ProjectRole | null {
    if (!project || !userId) return null;
    
    // Kiểm tra trong members array mới
    if (project.members) {
        const member = project.members.find(m => m.id === userId);
        if (member) return member.role;
    }
    
    // Fallback: nếu là creator thì là OWNER
    if (project.createdBy === userId) return "OWNER";
    
    // Fallback: nếu có trong memberIds cũ thì là MEMBER
    if (project.memberIds?.includes(userId)) return "MEMBER";
    
    return null;
}

// Kiểm tra user có permission cụ thể trong project không
export function hasProjectPermission(
    userId: string, 
    project: Project, 
    permission: ProjectPermission
): boolean {
    // System Admin luôn có full quyền
    const systemRole = getUserRole({ uid: userId });
    if (systemRole === "ADMIN") return true;
    
    const projectRole = getProjectRole(userId, project);
    if (!projectRole) return false;
    
    // Kiểm tra custom permissions nếu có
    if (project.members) {
        const member = project.members.find(m => m.id === userId);
        if (member?.permissions) {
            return member.permissions.includes(permission);
        }
    }
    
    // Fallback to default role permissions
    return PROJECT_ROLE_PERMISSIONS[projectRole].includes(permission);
}

// Lấy tất cả permissions của user trong project
export function getProjectPermissions(userId: string, project: Project): ProjectPermission[] {
    const systemRole = getUserRole({ uid: userId });
    if (systemRole === "ADMIN") {
        return PROJECT_ROLE_PERMISSIONS["OWNER"]; // Admin có full quyền
    }
    
    const projectRole = getProjectRole(userId, project);
    if (!projectRole) return [];
    
    // Kiểm tra custom permissions
    if (project.members) {
        const member = project.members.find(m => m.id === userId);
        if (member?.permissions) {
            return member.permissions;
        }
    }
    
    return PROJECT_ROLE_PERMISSIONS[projectRole];
}

// Kiểm tra user có thể quản lý thành viên project không
export function canManageProjectMembers(userId: string, project: Project): boolean {
    return hasProjectPermission(userId, project, "manage_members");
}

// Kiểm tra user có thể duyệt giao dịch trong project không
export function canApproveProjectTransactions(userId: string, project: Project): boolean {
    return hasProjectPermission(userId, project, "approve_transactions");
}

// Kiểm tra user có thể tạo thu/chi trong project không
export function canCreateProjectTransaction(
    userId: string, 
    project: Project, 
    type: "IN" | "OUT"
): boolean {
    const permission = type === "IN" ? "create_income" : "create_expense";
    return hasProjectPermission(userId, project, permission);
}

// Kiểm tra user có thể xem báo cáo project không
export function canViewProjectReports(userId: string, project: Project): boolean {
    return hasProjectPermission(userId, project, "view_reports");
}

// Kiểm tra user có thể quản lý tài khoản project không
export function canManageProjectAccounts(userId: string, project: Project): boolean {
    return hasProjectPermission(userId, project, "manage_accounts");
}

// Tạo ProjectMember mới với default permissions theo role
export function createProjectMember(
    userId: string, 
    role: ProjectRole, 
    addedBy?: string
): ProjectMember {
    return {
        id: userId,
        role,
        permissions: [...PROJECT_ROLE_PERMISSIONS[role]],
        addedAt: Date.now(),
        addedBy
    };
}

// Cập nhật role của member (sẽ reset permissions về default)
export function updateMemberRole(member: ProjectMember, newRole: ProjectRole): ProjectMember {
    return {
        ...member,
        role: newRole,
        permissions: [...PROJECT_ROLE_PERMISSIONS[newRole]]
    };
}

// Thêm/bỏ permission cho member
export function toggleMemberPermission(
    member: ProjectMember, 
    permission: ProjectPermission
): ProjectMember {
    const hasPermission = member.permissions.includes(permission);
    return {
        ...member,
        permissions: hasPermission
            ? member.permissions.filter(p => p !== permission)
            : [...member.permissions, permission]
    };
}

// Label tiếng Việt cho ProjectRole
export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
    OWNER: "Chủ dự án",
    MANAGER: "Quản lý",
    MEMBER: "Thành viên",
    VIEWER: "Người xem"
};

// Label tiếng Việt cho ProjectPermission
export const PROJECT_PERMISSION_LABELS: Record<ProjectPermission, string> = {
    view_transactions: "Xem giao dịch",
    create_income: "Tạo khoản thu",
    create_expense: "Tạo khoản chi",
    approve_transactions: "Duyệt giao dịch",
    manage_accounts: "Quản lý tài khoản",
    manage_members: "Quản lý thành viên",
    view_reports: "Xem báo cáo",
    edit_project: "Sửa dự án"
};

// Màu sắc cho từng role
export const PROJECT_ROLE_COLORS: Record<ProjectRole, string> = {
    OWNER: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    MANAGER: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    MEMBER: "bg-green-500/20 text-green-400 border-green-500/30",
    VIEWER: "bg-gray-500/20 text-gray-400 border-gray-500/30"
};
