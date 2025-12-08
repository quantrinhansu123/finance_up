export type Currency = "VND" | "USD" | "KHR";

export type TransactionType = "IN" | "OUT";

export type TransactionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Account {
    id: string;
    name: string;
    type: "BANK" | "CASH" | "E-WALLET";
    currency: Currency;
    balance: number;
    openingBalance: number; // Added: Initial balance
    projectId?: string; // Added: Assigned to project
    isLocked: boolean; // Added: Lock feature
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

export interface Project {
    id: string;
    name: string;
    description?: string;
    status: "ACTIVE" | "COMPLETED" | "PAUSED";
    budget?: number; // Added: Project budget
    currency?: Currency; // Added: Budget currency
    totalRevenue: number;
    totalExpense: number;
    memberIds?: string[]; // Added: List of User UIDs
    createdAt: number;
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
