"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUsers } from "@/lib/users";
import { UserProfile } from "@/types/user";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, addDoc } from "firebase/firestore";
import { Search, UserPlus, Shield, ShieldOff, X, Check, History } from "lucide-react";

const ITEMS_PER_PAGE = 15;

const FINANCE_ROLES: { value: string; label: string; color: string }[] = [
    { value: "NONE", label: "Không có quyền", color: "bg-gray-500/20 text-gray-400" },
    { value: "STAFF", label: "Nhân viên", color: "bg-blue-500/20 text-blue-400" },
    { value: "TREASURER", label: "Thủ quỹ", color: "bg-yellow-500/20 text-yellow-400" },
    { value: "ACCOUNTANT", label: "Kế toán", color: "bg-green-500/20 text-green-400" },
    { value: "MANAGER", label: "Quản lý", color: "bg-purple-500/20 text-purple-400" },
    { value: "ADMIN", label: "Quản trị viên", color: "bg-red-500/20 text-red-400" },
];

export default function UsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [saving, setSaving] = useState(false);

    // Create user form
    const [newUser, setNewUser] = useState({
        email: "",
        password: "",
        displayName: "",
        phoneNumber: "",
        position: "",
        financeRole: "STAFF" as string,
    });
    const [showPassword, setShowPassword] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter users
    const filteredUsers = users.filter(u => {
        const name = u.employment?.fullName || u.displayName || "";
        const email = u.email || "";
        const matchSearch = !search || 
            name.toLowerCase().includes(search.toLowerCase()) ||
            email.toLowerCase().includes(search.toLowerCase());
        
        const userFinanceRole = u.financeRole || "NONE";
        const matchRole = !roleFilter || userFinanceRole === roleFilter;
        
        return matchSearch && matchRole;
    });

    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Update user finance role
    const updateFinanceRole = async (userId: string, newRole: string) => {
        setSaving(true);
        try {
            await updateDoc(doc(db, "users", userId), {
                financeRole: newRole,
                updatedAt: new Date()
            });
            setUsers(prev => prev.map(u => 
                u.uid === userId ? { ...u, financeRole: newRole as any } : u
            ));
            setEditingUser(null);
        } catch (error) {
            console.error("Failed to update role", error);
            alert("Lỗi khi cập nhật quyền");
        } finally {
            setSaving(false);
        }
    };

    // Generate random password
    const generatePassword = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
        let password = "";
        for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setNewUser({ ...newUser, password });
    };

    // Create new user
    const createUser = async () => {
        if (!newUser.email || !newUser.displayName || !newUser.password) {
            alert("Vui lòng nhập đầy đủ thông tin bắt buộc (Email, Họ tên, Mật khẩu)");
            return;
        }

        // Check if email exists
        const existingUser = users.find(u => u.email?.toLowerCase() === newUser.email.toLowerCase());
        if (existingUser) {
            alert("Email đã tồn tại trong hệ thống");
            return;
        }

        setSaving(true);
        try {
            const userData = {
                email: newUser.email.toLowerCase().trim(),
                password: newUser.password,
                displayName: newUser.displayName.trim(),
                phoneNumber: newUser.phoneNumber || "",
                position: newUser.position || "",
                financeRole: newUser.financeRole,
                role: "staff",
                approved: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            await addDoc(collection(db, "users"), userData);
            await fetchUsers();
            setShowCreateModal(false);
            setNewUser({ email: "", password: "", displayName: "", phoneNumber: "", position: "", financeRole: "STAFF" });
            alert(`Tạo người dùng thành công!\n\nEmail: ${userData.email}\nMật khẩu: ${userData.password}`);
        } catch (error) {
            console.error("Failed to create user", error);
            alert("Lỗi khi tạo người dùng");
        } finally {
            setSaving(false);
        }
    };

    const getRoleInfo = (role: string) => {
        return FINANCE_ROLES.find(r => r.value === role) || FINANCE_ROLES[0];
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-white">Quản lý Người dùng</h1>
                    <p className="text-[10px] text-[var(--muted)]">Phân quyền truy cập hệ thống tài chính</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                >
                    <UserPlus size={14} /> Thêm người dùng
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass-card p-3 rounded-xl border border-white/5">
                    <div className="text-[10px] text-[var(--muted)] uppercase">Tổng người dùng</div>
                    <div className="text-xl font-bold text-white">{users.length}</div>
                </div>
                <div className="glass-card p-3 rounded-xl border border-green-500/20">
                    <div className="text-[10px] text-[var(--muted)] uppercase">Có quyền truy cập</div>
                    <div className="text-xl font-bold text-green-400">
                        {users.filter(u => u.financeRole && u.financeRole !== "NONE").length}
                    </div>
                </div>
                <div className="glass-card p-3 rounded-xl border border-red-500/20">
                    <div className="text-[10px] text-[var(--muted)] uppercase">Chưa phân quyền</div>
                    <div className="text-xl font-bold text-red-400">
                        {users.filter(u => !u.financeRole || u.financeRole === "NONE").length}
                    </div>
                </div>
                <div className="glass-card p-3 rounded-xl border border-purple-500/20">
                    <div className="text-[10px] text-[var(--muted)] uppercase">Admin</div>
                    <div className="text-xl font-bold text-purple-400">
                        {users.filter(u => u.financeRole === "ADMIN").length}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                        type="text"
                        placeholder="Tìm theo tên hoặc email..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        className="glass-input w-full pl-8 pr-3 py-1.5 rounded-lg text-xs"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
                    className="glass-input px-2 py-1.5 rounded-lg text-xs"
                >
                    <option value="">Tất cả quyền</option>
                    {FINANCE_ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-[#1a1a1a] text-[var(--muted)] uppercase text-[10px] font-semibold tracking-wider">
                            <tr>
                                <th className="p-3 border-b border-white/10">Tên</th>
                                <th className="p-3 border-b border-white/10">Email</th>
                                <th className="p-3 border-b border-white/10">Chức vụ (HR)</th>
                                <th className="p-3 border-b border-white/10">Quyền Finance</th>
                                <th className="p-3 border-b border-white/10 text-center">Trạng thái</th>
                                <th className="p-3 border-b border-white/10 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-[var(--muted)]">Đang tải...</td></tr>
                            ) : paginatedUsers.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-[var(--muted)]">Không tìm thấy người dùng</td></tr>
                            ) : (
                                paginatedUsers.map((user) => {
                                    const displayName = user.employment?.fullName || user.displayName || "Unknown";
                                    const position = user.employment?.position || user.position || "-";
                                    const financeRole = user.financeRole || "NONE";
                                    const roleInfo = getRoleInfo(financeRole);
                                    const hasAccess = financeRole !== "NONE";
                                    const isAdmin = user.email?.toLowerCase() === "ceo.fata@gmail.com" || 
                                                   user.employment?.position?.toUpperCase() === "CEO&FOUNDER";

                                    return (
                                        <tr key={user.uid} className="hover:bg-white/5 transition-colors">
                                            <td 
                                                className="p-3 font-medium text-white cursor-pointer hover:text-blue-400"
                                                onClick={() => router.push(`/finance/users/${user.uid}`)}
                                                title="Click để xem chi tiết"
                                            >
                                                {displayName}
                                            </td>
                                            <td className="p-3 text-[var(--muted)]">{user.email}</td>
                                            <td className="p-3 text-[var(--muted)]">{position}</td>
                                            <td className="p-3">
                                                {editingUser?.uid === user.uid ? (
                                                    <select
                                                        value={editingUser.financeRole || "NONE"}
                                                        onChange={(e) => setEditingUser({ ...editingUser, financeRole: e.target.value as any })}
                                                        className="glass-input px-2 py-1 rounded text-xs"
                                                        disabled={isAdmin}
                                                    >
                                                        {FINANCE_ROLES.map(r => (
                                                            <option key={r.value} value={r.value}>{r.label}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${roleInfo.color}`}>
                                                        {roleInfo.label}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                {hasAccess || isAdmin ? (
                                                    <span className="flex items-center justify-center gap-1 text-green-400 text-[10px]">
                                                        <Shield size={12} /> Có quyền
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center justify-center gap-1 text-red-400 text-[10px]">
                                                        <ShieldOff size={12} /> Không
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex justify-center gap-1">
                                                    {editingUser?.uid === user.uid ? (
                                                        <>
                                                            <button
                                                                onClick={() => updateFinanceRole(user.uid, editingUser.financeRole || "NONE")}
                                                                disabled={saving || isAdmin}
                                                                className="p-1.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50"
                                                                title="Lưu"
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingUser(null)}
                                                                className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                                                title="Hủy"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => setEditingUser(user)}
                                                                disabled={isAdmin}
                                                                className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                title={isAdmin ? "Không thể sửa Admin" : "Phân quyền"}
                                                            >
                                                                <Shield size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => router.push(`/finance/transactions?user=${user.uid}`)}
                                                                className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-green-400 transition-colors"
                                                                title="Xem lịch sử giao dịch"
                                                            >
                                                                <History size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-3 border-t border-white/10">
                        <span className="text-[10px] text-[var(--muted)]">
                            Trang {currentPage}/{totalPages} ({filteredUsers.length} người dùng)
                        </span>
                        <div className="flex gap-1">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="px-2 py-1 rounded text-xs hover:bg-white/5 disabled:opacity-50"
                            >
                                Trước
                            </button>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="px-2 py-1 rounded text-xs hover:bg-white/5 disabled:opacity-50"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-5 rounded-xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setShowCreateModal(false)}
                            className="absolute top-3 right-3 p-1 rounded hover:bg-white/10 text-[var(--muted)] hover:text-white"
                        >
                            <X size={18} />
                        </button>

                        <h2 className="text-lg font-bold mb-4">Thêm người dùng mới</h2>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                                    Họ tên <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newUser.displayName}
                                    onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                                    className="glass-input w-full p-2 rounded-lg text-sm"
                                    placeholder="Nguyễn Văn A"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                                    Email <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    className="glass-input w-full p-2 rounded-lg text-sm"
                                    placeholder="email@company.com"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                                    Mật khẩu <span className="text-red-400">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={newUser.password}
                                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                            className="glass-input w-full p-2 rounded-lg text-sm pr-10"
                                            placeholder="Nhập mật khẩu"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white text-xs"
                                        >
                                            {showPassword ? "Ẩn" : "Hiện"}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={generatePassword}
                                        className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-[var(--muted)] hover:text-white transition-colors"
                                    >
                                        Tạo ngẫu nhiên
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-[var(--muted)] mb-1">Số điện thoại</label>
                                <input
                                    type="tel"
                                    value={newUser.phoneNumber}
                                    onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                                    className="glass-input w-full p-2 rounded-lg text-sm"
                                    placeholder="0912345678"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-[var(--muted)] mb-1">Chức vụ</label>
                                <input
                                    type="text"
                                    value={newUser.position}
                                    onChange={(e) => setNewUser({ ...newUser, position: e.target.value })}
                                    className="glass-input w-full p-2 rounded-lg text-sm"
                                    placeholder="VD: Nhân viên kế toán"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-[var(--muted)] mb-1">Quyền trong hệ thống Finance</label>
                                <select
                                    value={newUser.financeRole}
                                    onChange={(e) => setNewUser({ ...newUser, financeRole: e.target.value })}
                                    className="glass-input w-full p-2 rounded-lg text-sm"
                                >
                                    {FINANCE_ROLES.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-400">
                                <strong>Lưu ý:</strong> Sau khi tạo, hãy gửi thông tin đăng nhập (email + mật khẩu) cho người dùng.
                            </div>

                            <button
                                onClick={createUser}
                                disabled={saving || !newUser.email || !newUser.displayName || !newUser.password}
                                className="w-full p-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
                            >
                                {saving ? "Đang tạo..." : "Tạo người dùng"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
