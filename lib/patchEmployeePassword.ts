/** Gọi API server (Supabase service role) để ghi pass/password — client anon thường bị RLS chặn cột mật khẩu. */
export async function patchEmployeePassword(employeeId: string, password: string): Promise<void> {
    const res = await fetch(`/api/employees/${encodeURIComponent(employeeId)}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
        throw new Error(j.error || "Không lưu được mật khẩu");
    }
}
