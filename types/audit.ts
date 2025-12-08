export interface AuditLog {
    id: string;
    userId: string; // "system" or user ID
    action: string; // e.g., "CREATE_PROJECT", "DELETE_COST"
    targetId?: string; // ID of the object being modified
    details?: any; // Snapshot of changes or key details
    ip: string;
    location?: string; // City, Country
    userAgent: string;
    timestamp: number;
}
