"use client";

import { useMemo } from "react";
import { Project, ProjectPermission, ProjectRole } from "@/types/finance";
import { 
    getProjectRole, 
    getProjectPermissions, 
    hasProjectPermission,
    PROJECT_ROLE_LABELS,
    PROJECT_ROLE_COLORS
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
    project: Project | null
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
        const permissions = getProjectPermissions(userId, project);

        return {
            userId,
            role,
            roleLabel: role ? PROJECT_ROLE_LABELS[role] : "",
            roleColor: role ? PROJECT_ROLE_COLORS[role] : "",
            permissions,
            canView: hasProjectPermission(userId, project, "view_transactions"),
            canCreateIncome: hasProjectPermission(userId, project, "create_income"),
            canCreateExpense: hasProjectPermission(userId, project, "create_expense"),
            canApprove: hasProjectPermission(userId, project, "approve_transactions"),
            canManageAccounts: hasProjectPermission(userId, project, "manage_accounts"),
            canManageMembers: hasProjectPermission(userId, project, "manage_members"),
            canViewReports: hasProjectPermission(userId, project, "view_reports"),
            canEditProject: hasProjectPermission(userId, project, "edit_project"),
            hasPermission: (permission: ProjectPermission) => 
                hasProjectPermission(userId, project, permission)
        };
    }, [userId, project]);
}

// Utility function to check if user can perform action
export function checkProjectAccess(
    userId: string | null,
    project: Project | null,
    requiredPermission: ProjectPermission
): { allowed: boolean; message: string } {
    if (!userId) {
        return { allowed: false, message: "Bạn cần đăng nhập để thực hiện thao tác này" };
    }
    
    if (!project) {
        return { allowed: false, message: "Không tìm thấy dự án" };
    }

    const role = getProjectRole(userId, project);
    if (!role) {
        return { allowed: false, message: "Bạn không phải thành viên của dự án này" };
    }

    const hasAccess = hasProjectPermission(userId, project, requiredPermission);
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
