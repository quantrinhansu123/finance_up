/** Tên hiển thị từ object user lưu ở local/session (employees sau đăng nhập). */
export function sessionUserDisplayLabel(
    user: { displayName?: string; name?: string; email?: string } | null | undefined
): string {
    if (!user) return "";
    const parts = [user.displayName, user.name, user.email].map((s) =>
        typeof s === "string" ? s.trim() : ""
    );
    return parts.find(Boolean) || "";
}
