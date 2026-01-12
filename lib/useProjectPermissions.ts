"use client";

import { useMemo } from "react";
import { Project, ProjectPermission, ProjectRole } from "@/types/finance";
import { 
    getProjectRole, 
    getProjectPermissions, 
    hasProjectPermission,
    PROJECT_ROLE_LABELS,
    PROJECT_ROLE_COLORS,
    getUserRole
} from "@/lib/permissions";

export interface ProjectPermissionState {
    userId: string | null;
    role: ProjectRole | null;
    roleLabel: string;
    roleColor: string;
    permissions: ProjectPermission[];
    
    // Permission checks
    canView: boolean;
    canCreateIncome: boolean;
    canCreateExpense: boolean;
    canApprove: boolean;
    canManageAccounts: boolean;
    canManageMembers: boolean;
    canViewReports: boolean;
    canEditProject: boolean;
    
    // Helper function
    hasPermission: (permission: ProjectPermission) => boolean;
}

export function useProjectPermissions(
    userId: string | null, 
    project: Project | null,
    user?: any // Truyền user object để kiểm tra ADMIN chính xác
): ProjectPermissionState {
    return useMemo(() => {
        if (!userId || !project) {
            return {
                userId: null,
                role: null,
                roleLabel: "",
                roleColor: "",
                permissions: [],
                canView: false,
                canCreateIncome: false,
                canCreateExpense: false,
                canApprove: false,
                canManageAccounts: false,
                canManageMembers: false,
                canViewReports: false,
                canEditProject: false,
                hasPermission: () => false
            };
        }

        const role = getProjectRole(userId, project);
        const permissions = getProjectPermissions(userId, project, user);

        return {
            userId,
            role,
            roleLabel: role ? PROJECT_ROLE_LABELS[role] : "",
            roleColor: role ? PROJECT_ROLE_COLORS[role] : "",
            permissions,
            canView: hasProjectPermission(userId, project, "view_transactions", user),
            canCreateIncome: hasProjectPermission(userId, project, "create_income", user),
            canCreateExpense: hasProjectPermission(userId, project, "create_expense", user),
            canApprove: hasProjectPermission(userId, project, "approve_transactions", user),
            canManageAccounts: hasProjectPermission(userId, project, "manage_accounts", user),
            canManageMembers: hasProjectPermission(userId, project, "manage_members", user),
            canViewReports: hasProjectPermission(userId, project, "view_reports", user),
            canEditProject: hasProjectPermission(userId, project, "edit_project", user),
            hasPermission: (permission: ProjectPermission) => 
                hasProjectPermission(userId, project, permission, user)
        };
    }, [userId, project, user]);
}

// Utility function to check if user can perform action
export function checkProjectAccess(
    userId: string | null,
    project: Project | null,
    requiredPermission: ProjectPermission,
    user?: any // Truyền user object để kiểm tra ADMIN chính xác
): { allowed: boolean; message: string } {
    if (!userId) {
        return { allowed: false, message: "Bạn cần đăng nhập để thực hiện thao tác này" };
    }
    
    if (!project) {
        return { allowed: false, message: "Không tìm thấy dự án" };
    }

    // ADMIN luôn có quyền
    if (user && getUserRole(user) === "ADMIN") {
        return { allowed: true, message: "" };
    }

    const role = getProjectRole(userId, project);
    if (!role) {
        return { allowed: false, message: "Bạn không phải thành viên của dự án này" };
    }

    const hasAccess = hasProjectPermission(userId, project, requiredPermission, user);
    if (!hasAccess) {
        const permissionLabels: Record<ProjectPermission, string> = {
            view_transactions: "xem giao dịch",
            create_income: "tạo khoản thu",
            create_expense: "tạo khoản chi",
            approve_transactions: "duyệt giao dịch",
            manage_accounts: "quản lý tài khoản",
            manage_members: "quản lý thành viên",
            view_reports: "xem báo cáo",
            edit_project: "sửa dự án"
        };
        return { 
            allowed: false, 
            message: `Bạn không có quyền ${permissionLabels[requiredPermission]} trong dự án này` 
        };
    }

    return { allowed: true, message: "" };
}
