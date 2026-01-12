// Chỉ còn 2 role: ADMIN (full quyền hệ thống) và USER (phân quyền theo dự án)
export type Role = "ADMIN" | "USER";

// Permissions chỉ dành cho ADMIN - các user khác phân quyền theo dự án
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
    USER: {
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

export function getCategoriesForRole(role: Role = "USER", allCategories: string[]) {
    // Tất cả user đều có thể dùng mọi category - giới hạn theo project/account
    return allCategories;
}

// Permission Helpers - Chỉ ADMIN mới có quyền hệ thống
export function canAccessApprovals(role: Role = "USER") {
    return role === "ADMIN";
}

export function canAccessUsers(role: Role = "USER") {
    return role === "ADMIN";
}

export function canViewAllTransactions(role: Role = "USER") {
    return role === "ADMIN";
}

export function canViewGlobalStats(role: Role = "USER") {
    return role === "ADMIN";
}

export function canViewAccounts(role: Role = "USER") {
    return role === "ADMIN";
}

export function canManageFixedCosts(role: Role = "USER") {
    return role === "ADMIN";
}

export function canManageProjects(role: Role = "USER") {
    return role === "ADMIN";
}

export function canManageFunds(role: Role = "USER") {
    return role === "ADMIN";
}

export function canManageRevenue(role: Role = "USER") {
    return role === "ADMIN";
}

export function canViewReports(role: Role = "USER") {
    return role === "ADMIN";
}

export function canViewLogs(role: Role = "USER") {
    return role === "ADMIN";
}

export function getUserRole(user: any): Role {
    if (!user) return "USER";

    // Chỉ kiểm tra ADMIN - các trường hợp khác đều là USER (phân quyền theo dự án)
    
    // 1. Hardcode ADMIN cho CEO email
    if (user.email && user.email.toLowerCase() === "ceo.fata@gmail.com") {
        return "ADMIN";
    }

    // 2. Kiểm tra employment.position
    const employmentPosition = user.employment?.position ? user.employment.position.toUpperCase() : "";
    if (employmentPosition === "CEO&FOUNDER") {
        return "ADMIN";
    }

    // 3. Kiểm tra financeRole hoặc role = ADMIN
    if (user.financeRole === "ADMIN" || user.role?.toUpperCase() === "ADMIN") {
        return "ADMIN";
    }

    // 4. Kiểm tra position
    const position = user.position ? user.position.toUpperCase() : "";
    if (position.includes("CEO")) {
        return "ADMIN";
    }

    // Tất cả user khác đều là USER - quyền được phân theo dự án
    return "USER";
}

// Kiểm tra user có quyền truy cập hệ thống tài chính không
export function canAccessFinanceSystem(user: any): boolean {
    if (!user) return false;
    
    // Admin luôn được truy cập
    if (getUserRole(user) === "ADMIN") return true;
    
    // User được truy cập nếu có financeRole không phải NONE
    if (user.financeRole && user.financeRole !== "NONE") {
        return true;
    }
    
    // Nếu chưa được phân quyền financeRole -> không cho truy cập
    return false;
}

// Tất cả user đều có thể chuyển tiền nội bộ (nếu có quyền trong dự án)
export function canTransferMoney(role: Role): boolean {
    return true; // Quyền chuyển tiền được kiểm tra theo dự án
}

// Lấy danh sách project mà user được phép truy cập
export function getAccessibleProjects(user: any, allProjects: any[]): any[] {
    const role = getUserRole(user);
    
    // Admin có thể xem tất cả
    if (role === "ADMIN") {
        return allProjects;
    }
    
    // User chỉ xem project mình tham gia (trong members hoặc memberIds)
    const userId = user?.uid || user?.id;
    return allProjects.filter(p => 
        p.members?.some((m: any) => m.id === userId) ||
        p.memberIds?.includes(userId) || 
        p.createdBy === userId
    );
}

// Lấy danh sách account mà user được phép truy cập
export function getAccessibleAccounts(user: any, allAccounts: any[], accessibleProjectIds: string[]): any[] {
    const role = getUserRole(user);
    
    // Admin có thể xem tất cả
    if (role === "ADMIN") {
        return allAccounts;
    }
    
    // User chỉ xem account của project mình tham gia
    return allAccounts.filter(a => 
        a.projectId && accessibleProjectIds.includes(a.projectId)
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
    permission: ProjectPermission,
    user?: any // Truyền user object để kiểm tra ADMIN chính xác
): boolean {
    // System Admin luôn có full quyền - cần truyền user object đầy đủ
    if (user && getUserRole(user) === "ADMIN") return true;
    
    const projectRole = getProjectRole(userId, project);
    if (!projectRole) return false;
    
    // Kiểm tra custom permissions nếu có (phải có ít nhất 1 permission)
    if (project.members) {
        const member = project.members.find(m => m.id === userId);
        if (member?.permissions && member.permissions.length > 0) {
            return member.permissions.includes(permission);
        }
    }
    
    // Fallback to default role permissions
    return PROJECT_ROLE_PERMISSIONS[projectRole].includes(permission);
}

// Lấy tất cả permissions của user trong project
export function getProjectPermissions(userId: string, project: Project, user?: any): ProjectPermission[] {
    // Admin có full quyền - cần truyền user object đầy đủ
    if (user && getUserRole(user) === "ADMIN") {
        return PROJECT_ROLE_PERMISSIONS["OWNER"];
    }
    
    const projectRole = getProjectRole(userId, project);
    if (!projectRole) return [];
    
    // Kiểm tra custom permissions (phải có ít nhất 1 permission)
    if (project.members) {
        const member = project.members.find(m => m.id === userId);
        if (member?.permissions && member.permissions.length > 0) {
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
