export const logAction = async (
    action: string,
    details: any,
    targetId?: string,
    userId: string = "system"
) => {
    try {
        // Fire and forget
        fetch('/api/log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action,
                details,
                targetId,
                userId
            }),
        });
    } catch (error) {
        console.error("Failed to dispatch log", error);
    }
};

// Keep for compatibility if needed, but redirect to new logger
export async function logActivity(
    user: { uid: string; displayName: string },
    action: string,
    entityType: string,
    entityId: string,
    details: string
) {
    return logAction(action, { entityType, details, userName: user.displayName }, entityId, user.uid);
}

