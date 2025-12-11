export type Currency = "VND" | "USD" | "KHR" | "TRY"; // Added TRY (Lira)

export type TransactionType = "IN" | "OUT";

export type TransactionStatus = "PENDING" | "APPROVED" | "REJECTED";

// Expense categories for fixed costs and reporting
export type ExpenseCategory = 
    | "Lương nhân sự"
    | "Thuê văn phòng"
    | "Cước vận chuyển"
    | "Marketing/Ads"
    | "Vận hành"
    | "SIM"
    | "Thuế"
    | "Khác";

export interface Account {
    id: string;
    name: string;
    type: "BANK" | "CASH" | "E-WALLET";
    currency: Currency;
    balance: number;
    openingBalance: number; // Added: Initial balance
    projectId?: string; // Added: Assigned to project
    departmentId?: string; // NEW: Assigned to department
    isLocked: boolean; // Added: Lock feature
    
    // NEW: Currency restriction - account can only spend its own currency
    restrictCurrency: boolean; // If true, can only create transactions in account's currency
    
    // NEW: Category restriction - limit which categories this account can spend on
    allowedCategories?: string[]; // If set, only these categories are allowed
    
    // NEW: Assigned users - only these users can use this account
    assignedUserIds?: string[];
    
    createdAt: number;
}

export interface Transaction {
    id: string;
    amount: number;
    currency: Currency;
    type: TransactionType;
    category: string; // "Tax", "Logistics", "SIM", "Office", "Ads", "Salary", etc.
    description?: string;
    date: string; // ISO Date
    status: TransactionStatus;

    // Links
    accountId: string;
    projectId?: string; // Added
    fundId?: string;    // Added: Linked to Fund/Cost Group

    // Metadata
    source?: string; // Money In Source: "COD VET", "COD JNT", "Customer Transfer", "Other"
    images?: string[]; // Added: Array of image URLs/Base64

    // Approval
    warning?: boolean; // >5M or >100$
    rejectionReason?: string;
    approvedBy?: string;
    rejectedBy?: string;
    createdBy: string;
    userId: string; // Restored for RLS filtering

    createdAt: number;
    updatedAt: number;
}

export interface Fund {
    id: string;
    name: string; // "Ads Fund", "Ops Fund", "Salary", "SIM", "Logistics"
    description?: string;
    totalSpent: number; // Cache for performance
    targetBudget?: number; // Optional monthly budget
    keywords?: string[]; // Added: Keywords to auto-map expense categories
    createdAt: number;
}

// Project member roles
export type ProjectRole = "OWNER" | "MANAGER" | "MEMBER" | "VIEWER";

export interface ProjectMember {
    id: string;           // User UID
    role: ProjectRole;    // Role in this project
    permissions: ProjectPermission[];
    addedAt: number;
    addedBy?: string;
}

export type ProjectPermission = 
    | "view_transactions"      // Xem giao dịch
    | "create_income"          // Tạo khoản thu
    | "create_expense"         // Tạo khoản chi
    | "approve_transactions"   // Duyệt giao dịch
    | "manage_accounts"        // Quản lý tài khoản dự án
    | "manage_members"         // Quản lý thành viên
    | "view_reports"           // Xem báo cáo
    | "edit_project";          // Sửa thông tin dự án

// Default permissions for each project role
export const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, ProjectPermission[]> = {
    OWNER: [
        "view_transactions", "create_income", "create_expense", 
        "approve_transactions", "manage_accounts", "manage_members", 
        "view_reports", "edit_project"
    ],
    MANAGER: [
        "view_transactions", "create_income", "create_expense",
        "approve_transactions", "manage_accounts", "view_reports"
    ],
    MEMBER: [
        "view_transactions", "create_income", "create_expense"
    ],
    VIEWER: [
        "view_transactions", "view_reports"
    ]
};

export interface Project {
    id: string;
    name: string;
    description?: string;
    status: "ACTIVE" | "COMPLETED" | "PAUSED";
    budget?: number; // Added: Project budget
    currency?: Currency; // Added: Budget currency
    totalRevenue: number;
    totalExpense: number;
    memberIds?: string[]; // Added: List of User UIDs (backward compatible)
    
    // NEW: Project members with roles
    members?: ProjectMember[];
    
    // NEW: Default settings for project
    defaultCurrency?: Currency; // Default currency for transactions
    allowedCategories?: string[]; // Categories allowed for this project
    
    createdAt: number;
    createdBy?: string; // Owner user ID
}

export interface FixedCost {
    id: string;
    name: string; // "Basic Salary", "Office Rent", "Internet"
    amount: number;
    currency: Currency;
    cycle: "MONTHLY" | "QUARTERLY" | "YEARLY";
    status: "ON" | "OFF"; // Active/Inactive
    lastGenerated?: string; // "YYYY-MM"
    description?: string;
    accountId?: string; // Added: Link to Account for auto-payment
    
    // NEW: Category for grouping in reports
    category: ExpenseCategory;
    
    // NEW: Project assignment
    projectId?: string;
    
    // NEW: Payment tracking
    lastPaymentDate?: string; // ISO date of last payment
    nextPaymentDate?: string; // ISO date of next expected payment
}

export interface MonthlyRevenue {
    id: string; // "YYYY-MM"
    month: string; // "MM"
    year: string; // "YYYY"
    amount: number;
    currency: Currency;
    note?: string;
    createdAt: number;
}

export interface ActivityLog {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    userId: string;
    userName: string;
    details: string;
    timestamp: number;
    ip?: string;
    location?: string;
    device?: string;
}
