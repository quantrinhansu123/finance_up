"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getUsers } from "@/lib/users";
import { UserProfile, FinanceRole, Position } from "@/types/user";
import { Plus, Edit2, Trash2, History, Save, X, User, Shield } from "lucide-react";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import SearchableSelect from "@/components/finance/SearchableSelect";
import { exportToCSV } from "@/lib/export";
import { doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUserRole, Role } from "@/lib/permissions";
import DataTable, { ActionCell } from "@/components/finance/DataTable";

const FINANCE_ROLES: { value: FinanceRole; label: string }[] = [
    { value: "ADMIN", label: "Quản trị viên" },
    { value: "ACCOUNTANT", label: "Kế toán" },
    { value: "TREASURER", label: "Thủ quỹ" },
    { value: "MANAGER", label: "Quản lý" },
    { value: "STAFF", label: "Nhân viên" },
    { value: "NONE", label: "Không có quyền" }
];

const POSITIONS: { value: Position; label: string }[] = [
    { value: "Nhân viên", label: "Nhân viên" },
    { value: "Trưởng nhóm", label: "Trưởng nhóm" },
    { value: "Phó phòng", label: "Phó phòng" },
    { value: "Trưởng phòng", label: "Trưởng phòng" },
    { value: "Phó giám đốc", label: "Phó giám đốc" },
    { value: "Giám đốc", label: "Giám đốc" }
];

export default function UsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("USER");

    // Filters
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        financeRole: "",
        position: "",
        approved: ""
    });
    const [searchTerm, setSearchTerm] = useState("");

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [saving, setSaving] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        displayName: "",
        email: "",
        phoneNumber: "",
        position: "" as Position | "",
        financeRole: "NONE" as FinanceRole,
        approved: true,
        monthlySalary: 0
    });

    useEffect(() => {
        const u = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (u) {
            const parsed = JSON.parse(u);
            setCurrentUser(parsed);
            setUserRole(getUserRole(parsed));
        }
    }, []);

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
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const name = u.employment?.fullName || u.displayName || "";
            const email = u.email || "";
            const matchSearch = !searchTerm ||
                name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                email.toLowerCase().includes(searchTerm.toLowerCase());

            const matchFinanceRole = !activeFilters.financeRole || u.financeRole === activeFilters.financeRole;
            const matchPosition = !activeFilters.position || u.position === activeFilters.position;
            const matchApproved = !activeFilters.approved ||
                (activeFilters.approved === "true" ? u.approved : !u.approved);

            return matchSearch && matchFinanceRole && matchPosition && matchApproved;
        });
    }, [users, searchTerm, activeFilters]);

    const openCreateModal = () => {
        setEditingUser(null);
        setFormData({
            displayName: "",
            email: "",
            phoneNumber: "",
            position: "",
            financeRole: "NONE",
            approved: true,
            monthlySalary: 0
        });
        setIsModalOpen(true);
    };

    const openEditModal = (user: UserProfile) => {
        setEditingUser(user);
        setFormData({
            displayName: user.displayName || "",
            email: user.email || "",
            phoneNumber: user.phoneNumber || "",
            position: user.position || "",
            financeRole: user.financeRole || "NONE",
            approved: user.approved ?? true,
            monthlySalary: user.monthlySalary || 0
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.displayName.trim() || !formData.email.trim()) {
            alert("Vui lòng nhập tên và email");
            return;
        }

        setSaving(true);
        try {
            if (editingUser) {
                // Update existing user
                await updateDoc(doc(db, "users", editingUser.uid), {
                    displayName: formData.displayName,
                    email: formData.email,
                    phoneNumber: formData.phoneNumber,
                    position: formData.position || null,
                    financeRole: formData.financeRole,
                    approved: formData.approved,
                    monthlySalary: formData.monthlySalary,
                    updatedAt: new Date()
                });
            } else {
                // Create new user
                const newUserId = `user_${Date.now()}`;
                await setDoc(doc(db, "users", newUserId), {
                    displayName: formData.displayName,
                    email: formData.email,
                    password: "default123", // Default password
                    phoneNumber: formData.phoneNumber,
                    position: formData.position || null,
                    financeRole: formData.financeRole,
                    approved: formData.approved,
                    monthlySalary: formData.monthlySalary,
                    role: "staff",
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }

            await fetchUsers();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save user", error);
            alert("Lỗi khi lưu người dùng");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (user: UserProfile) => {
        if (!confirm(`Bạn có chắc muốn xóa người dùng "${user.displayName}"?\n\nHành động này không thể hoàn tác!`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, "users", user.uid));
            await fetchUsers();
        } catch (error) {
            console.error("Failed to delete user", error);
            alert("Lỗi khi xóa người dùng");
        }
    };

    const canManageUsers = userRole === "ADMIN";

    if (loading) return <div className="p-8 text-[var(--muted)]">Đang tải...</div>;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Quản lý Người dùng</h1>
                    <p className="text-[var(--muted)]">Xem và quản lý thông tin người dùng hệ thống</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-4 rounded-xl border border-white/5">
                    <div className="text-xs text-[var(--muted)] uppercase">Tổng người dùng</div>
                    <div className="text-2xl font-bold text-white mt-1">{users.length}</div>
                </div>
                <div className="glass-card p-4 rounded-xl border border-blue-500/20">
                    <div className="text-xs text-[var(--muted)] uppercase">Đã duyệt</div>
                    <div className="text-2xl font-bold text-blue-400 mt-1">
                        {users.filter(u => u.approved).length}
                    </div>
                </div>
                <div className="glass-card p-4 rounded-xl border border-green-500/20">
                    <div className="text-xs text-[var(--muted)] uppercase">Đang hiển thị</div>
                    <div className="text-2xl font-bold text-green-400 mt-1">{filteredUsers.length}</div>
                </div>
            </div>

            {/* Toolbar */}
            <DataTableToolbar
                searchPlaceholder="Tìm tên hoặc email..."
                onSearch={setSearchTerm}
                activeFilters={activeFilters}
                onFilterChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                onReset={() => {
                    setActiveFilters({ financeRole: "", position: "", approved: "" });
                    setSearchTerm("");
                }}
                onExport={() => exportToCSV(filteredUsers, "Danh_Sach_Nguoi_Dung", {
                    displayName: "Tên",
                    email: "Email",
                    phoneNumber: "Số điện thoại",
                    position: "Chức vụ",
                    financeRole: "Vai trò tài chính",
                    approved: "Trạng thái duyệt"
                })}
                onAdd={canManageUsers ? openCreateModal : undefined}
                addLabel="Thêm người dùng"
                filters={[
                    {
                        id: "financeRole",
                        label: "Vai trò tài chính",
                        options: FINANCE_ROLES.map(r => ({ value: r.value, label: r.label }))
                    },
                    {
                        id: "position",
                        label: "Chức vụ",
                        options: POSITIONS.map(p => ({ value: p.value, label: p.label })),
                        advanced: true
                    },
                    {
                        id: "approved",
                        label: "Trạng thái",
                        options: [
                            { value: "true", label: "Đã duyệt" },
                            { value: "false", label: "Chưa duyệt" }
                        ],
                        advanced: true
                    }
                ]}
            />

            {/* Table */}
            <DataTable<UserProfile & { id: string }>
                data={filteredUsers.map(u => ({ ...u, id: u.uid }))}
                onRowClick={(user) => router.push(`/finance/users/${user.uid}`)}
                columns={[
                    {
                        key: "displayName",
                        header: "Tên",
                        render: (user: UserProfile) => {
                            const displayName = user.employment?.fullName || user.displayName || "Unknown";
                            return (
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                                        {displayName[0]?.toUpperCase()}
                                    </div>
                                    <div className="font-medium text-white group-hover:text-blue-400">
                                        {displayName}
                                    </div>
                                </div>
                            );
                        }
                    },
                    {
                        key: "email",
                        header: "Email",
                        className: "text-[var(--muted)]"
                    },
                    {
                        key: "position",
                        header: "Chức vụ",
                        render: (user: UserProfile) => (
                            <span className="text-[var(--muted)]">
                                {user.employment?.position || user.position || "-"}
                            </span>
                        )
                    },
                    {
                        key: "phoneNumber",
                        header: "Số điện thoại",
                        render: (user: UserProfile) => (
                            <span className="text-[var(--muted)]">
                                {user.employment?.phone || user.phoneNumber || "-"}
                            </span>
                        )
                    },
                    {
                        key: "approved",
                        header: "Trạng thái",
                        align: "center",
                        render: (user: UserProfile) => (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${user.approved
                                ? "bg-green-500/20 text-green-400"
                                : "bg-yellow-500/20 text-yellow-400"
                                }`}>
                                {user.approved ? "Đã duyệt" : "Chờ duyệt"}
                            </span>
                        )
                    },
                    {
                        key: "actions",
                        header: "Thao tác",
                        align: "center",
                        render: (user: UserProfile) => (
                            <ActionCell>
                                {canManageUsers && (
                                    <>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openEditModal(user); }}
                                            className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-blue-400 transition-colors"
                                            title="Sửa"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(user); }}
                                            className="p-1.5 rounded hover:bg-red-500/20 text-[var(--muted)] hover:text-red-400 transition-colors"
                                            title="Xóa"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); router.push(`/finance/transactions?user=${user.uid}`); }}
                                    className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-green-400 transition-colors"
                                    title="Xem lịch sử giao dịch"
                                >
                                    <History size={14} />
                                </button>
                            </ActionCell>
                        )
                    }
                ]}
                emptyMessage="Không tìm thấy người dùng"
            />

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-2xl p-6 rounded-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-[var(--muted)] hover:text-white text-xl"
                        >
                            ✕
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <User size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">
                                    {editingUser ? "Sửa thông tin người dùng" : "Thêm người dùng mới"}
                                </h2>
                                <p className="text-sm text-[var(--muted)]">
                                    {editingUser ? "Cập nhật thông tin người dùng" : "Tạo tài khoản người dùng mới"}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Display Name */}
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">
                                    Tên hiển thị <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.displayName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                                    className="glass-input w-full px-4 py-2 rounded-lg"
                                    placeholder="Nhập tên người dùng"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">
                                    Email <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    className="glass-input w-full px-4 py-2 rounded-lg"
                                    placeholder="email@example.com"
                                    disabled={!!editingUser}
                                />
                                {editingUser && (
                                    <p className="text-xs text-[var(--muted)] mt-1">Email không thể thay đổi</p>
                                )}
                            </div>

                            {/* Phone Number */}
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">
                                    Số điện thoại
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phoneNumber}
                                    onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                    className="glass-input w-full px-4 py-2 rounded-lg"
                                    placeholder="0123456789"
                                />
                            </div>

                            {/* Position */}
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">
                                    Chức vụ
                                </label>
                                <SearchableSelect
                                    options={POSITIONS.map(p => ({
                                        id: p.value,
                                        label: p.label,
                                        icon: "👤"
                                    }))}
                                    value={formData.position}
                                    onChange={(val) => setFormData(prev => ({ ...prev, position: val as Position }))}
                                    placeholder="Chọn chức vụ"
                                    searchPlaceholder="Tìm chức vụ..."
                                />
                            </div>

                            {/* Finance Role */}
                            <div>
                                <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                                    <Shield size={16} />
                                    Vai trò tài chính
                                </label>
                                <SearchableSelect
                                    options={FINANCE_ROLES.map(r => ({
                                        id: r.value,
                                        label: r.label,
                                        icon: r.value === "ADMIN" ? "👑" : r.value === "ACCOUNTANT" ? "📊" : r.value === "TREASURER" ? "💰" : r.value === "MANAGER" ? "🔧" : "👤"
                                    }))}
                                    value={formData.financeRole}
                                    onChange={(val) => setFormData(prev => ({ ...prev, financeRole: val as FinanceRole }))}
                                    placeholder="Chọn vai trò"
                                    searchPlaceholder="Tìm vai trò..."
                                />
                            </div>

                            {/* Monthly Salary */}
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">
                                    Lương tháng (VND)
                                </label>
                                <input
                                    type="number"
                                    value={formData.monthlySalary}
                                    onChange={(e) => setFormData(prev => ({ ...prev, monthlySalary: Number(e.target.value) }))}
                                    className="glass-input w-full px-4 py-2 rounded-lg"
                                    placeholder="0"
                                    min="0"
                                />
                            </div>

                            {/* Approved Status */}
                            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="approved"
                                    checked={formData.approved}
                                    onChange={(e) => setFormData(prev => ({ ...prev, approved: e.target.checked }))}
                                    className="w-5 h-5 rounded border-gray-600 bg-transparent text-green-500 focus:ring-green-500"
                                />
                                <label htmlFor="approved" className="text-sm font-medium text-white cursor-pointer">
                                    Tài khoản đã được duyệt
                                </label>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formData.displayName.trim() || !formData.email.trim()}
                                className="glass-button px-6 py-2 rounded-lg text-sm font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30 disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                        Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        {editingUser ? "Cập nhật" : "Tạo mới"}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}