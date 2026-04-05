export const logAction = async (
    action: string,
    details: any,
    targetId?: string,
    userId: string = "system"
) => {
    try {
        let finalUserId = userId;
        let finalUserName = typeof details === 'object' ? details.userName : undefined;

        if (finalUserId === "system" && typeof window !== "undefined") {
            const userStr = localStorage.getItem("user") || sessionStorage.getItem("user");
            if (userStr) {
                try {
                    const u = JSON.parse(userStr);
                    finalUserId = u.uid || u.id || "system";
                    if (!finalUserName) finalUserName = u.displayName || u.name;
                } catch(e) {}
            }
        }

        fetch('/api/log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action,
                details,
                targetId,
                userId: finalUserId,
                userName: finalUserName
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

