"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getUserById } from "@/lib/users";
import { UserProfile } from "@/types/user";
import { getTransactions } from "@/lib/finance";
import { Transaction } from "@/types/finance";
import { getUserRole } from "@/lib/permissions";
import { db } from "@/lib/firebase";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { ArrowLeft, Edit2, Trash2, Save, X, Eye, EyeOff } from "lucide-react";

const FINANCE_ROLES = [
    { value: "NONE", label: "Không có quyền" },
    { value: "STAFF", label: "Nhân viên" },
    { value: "TREASURER", label: "Thủ quỹ" },
    { value: "ACCOUNTANT", label: "Kế toán" },
    { value: "MANAGER", label: "Quản lý" },
    { value: "ADMIN", label: "Quản trị viên" },
];

export default function UserDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const userId = params.id as string;

    const [user, setUser] = useState<UserProfile | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Edit form
    const [editForm, setEditForm] = useState({
        displayName: "",
        email: "",
        password: "",
        phoneNumber: "",
        position: "",
        financeRole: "NONE",
    });

    useEffect(() => {
        const fetchUserData = async () => {
            setLoading(true);
            try {
                const userData = await getUserById(userId);
                setUser(userData);
                if (userData) {
                    setEditForm({
                        displayName: userData.displayName || "",
                        email: userData.email || "",
                        password: userData.password || "",
                        phoneNumber: userData.phoneNumber || "",
                        position: userData.position || "",
                        financeRole: userData.financeRole || "NONE",
                    });
                }

                const allTxs = await getTransactions();
                const userTxs = allTxs.filter(tx => tx.userId === userId);
                setTransactions(userTxs);
            } catch (error) {
                console.error("Failed to fetch user details", error);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchUserData();
        }
    }, [userId]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "users", user.uid), {
                displayName: editForm.displayName,
                email: editForm.email,
                password: editForm.password,
                phoneNumber: editForm.phoneNumber,
                position: editForm.position,
                financeRole: editForm.financeRole,
                updatedAt: new Date(),
            });
            setUser({
                ...user,
                displayName: editForm.displayName,
                email: editForm.email,
                password: editForm.password,
                phoneNumber: editForm.phoneNumber,
                position: editForm.position as any,
                financeRole: editForm.financeRole as any,
            });
            setEditing(false);
            alert("Cập nhật thành công!");
        } catch (error) {
            console.error("Failed to update user", error);
            alert("Lỗi khi cập nhật");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!user) return;
        
        const confirmMsg = `Bạn có chắc muốn XÓA VĨNH VIỄN người dùng "${user.displayName || user.email}"?\n\nLưu ý:\n- Hành động này không thể hoàn tác\n- Các giao dịch của người dùng sẽ vẫn được giữ lại`;
        
        if (!confirm(confirmMsg)) return;
        
        // Double confirm
        const doubleConfirm = prompt(`Nhập "XOA" để xác nhận xóa người dùng:`);
        if (doubleConfirm !== "XOA") {
            alert("Đã hủy xóa");
            return;
        }

        try {
            await deleteDoc(doc(db, "users", user.uid));
            alert("Đã xóa người dùng");
            router.push("/finance/users");
        } catch (error) {
            console.error("Failed to delete user", error);
            alert("Lỗi khi xóa người dùng");
        }
    };

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
    };

    if (loading) return <div className="p-8 text-[var(--muted)]">Đang tải...</div>;
    if (!user) return <div className="p-8 text-red-400">Không tìm thấy người dùng</div>;

    const displayName = user.employment?.fullName || user.displayName || "Unknown";
    const position = user.employment?.position || user.position || "N/A";
    const role = getUserRole({ ...user, position });

    const totalsByCurrency = transactions.reduce((acc, tx) => {
        if (!acc[tx.currency]) acc[tx.currency] = { in: 0, out: 0 };
        if (tx.type === "IN") acc[tx.currency].in += tx.amount;
        else acc[tx.currency].out += tx.amount;
        return acc;
    }, {} as Record<string, { in: number, out: number }>);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push("/finance/users")}
                    className="flex items-center gap-2 text-[var(--muted)] hover:text-white transition-colors"
                >
                    <ArrowLeft size={18} /> Quay lại
                </button>
                <div className="flex gap-2">
                    {editing ? (
                        <>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-medium disabled:opacity-50"
                            >
                                <Save size={14} /> {saving ? "Đang lưu..." : "Lưu"}
                            </button>
                            <button
                                onClick={() => setEditing(false)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded-lg text-xs font-medium"
                            >
                                <X size={14} /> Hủy
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setEditing(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium"
                            >
                                <Edit2 size={14} /> Sửa
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-medium"
                            >
                                <Trash2 size={14} /> Xóa
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* User Profile */}
            <div className="glass-card p-6 rounded-xl">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">{displayName}</h1>
                        <p className="text-sm text-[var(--muted)]">{user.email}</p>
                        <div className="flex gap-2 mt-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400">
                                {role}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400">
                                {position}
                            </span>
                        </div>
                    </div>
                </div>

                {/* User Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] text-[var(--muted)] uppercase mb-1">Họ tên</label>
                        {editing ? (
                            <input
                                type="text"
                                value={editForm.displayName}
                                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                                className="glass-input w-full p-2 rounded-lg text-sm"
                            />
                        ) : (
                            <p className="text-white text-sm">{user.displayName || "-"}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-[10px] text-[var(--muted)] uppercase mb-1">Email</label>
                        {editing ? (
                            <input
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                className="glass-input w-full p-2 rounded-lg text-sm"
                            />
                        ) : (
                            <p className="text-white text-sm">{user.email || "-"}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-[10px] text-[var(--muted)] uppercase mb-1">Mật khẩu</label>
                        {editing ? (
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={editForm.password}
                                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                    className="glass-input w-full p-2 rounded-lg text-sm pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white"
                                >
                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <p className="text-white text-sm font-mono">
                                    {showPassword ? (user.password || "-") : "••••••••"}
                                </p>
                                <button
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="text-[var(--muted)] hover:text-white"
                                >
                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-[10px] text-[var(--muted)] uppercase mb-1">Số điện thoại</label>
                        {editing ? (
                            <input
                                type="tel"
                                value={editForm.phoneNumber}
                                onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                                className="glass-input w-full p-2 rounded-lg text-sm"
                            />
                        ) : (
                            <p className="text-white text-sm">{user.phoneNumber || "-"}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-[10px] text-[var(--muted)] uppercase mb-1">Chức vụ</label>
                        {editing ? (
                            <input
                                type="text"
                                value={editForm.position}
                                onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                                className="glass-input w-full p-2 rounded-lg text-sm"
                            />
                        ) : (
                            <p className="text-white text-sm">{user.position || "-"}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-[10px] text-[var(--muted)] uppercase mb-1">Quyền Finance</label>
                        {editing ? (
                            <select
                                value={editForm.financeRole}
                                onChange={(e) => setEditForm({ ...editForm, financeRole: e.target.value })}
                                className="glass-input w-full p-2 rounded-lg text-sm"
                            >
                                {FINANCE_ROLES.map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-white text-sm">
                                {FINANCE_ROLES.find(r => r.value === user.financeRole)?.label || "Không có quyền"}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-[10px] text-[var(--muted)] uppercase mb-1">Ngày tạo</label>
                        <p className="text-white text-sm">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString("vi-VN") : "-"}
                        </p>
                    </div>

                    <div>
                        <label className="block text-[10px] text-[var(--muted)] uppercase mb-1">UID</label>
                        <p className="text-white text-sm font-mono text-[10px]">{user.uid}</p>
                    </div>
                </div>
            </div>

            {/* Spending Summary */}
            {Object.keys(totalsByCurrency).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(totalsByCurrency).map(([currency, totals]) => (
                        <div key={currency} className="glass-card p-4 rounded-xl">
                            <h3 className="text-[var(--muted)] text-xs font-medium mb-3">{currency}</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-[var(--muted)]">Thu</span>
                                    <span className="text-green-400 font-bold">+{formatCurrency(totals.in, currency)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[var(--muted)]">Chi</span>
                                    <span className="text-red-400 font-bold">-{formatCurrency(totals.out, currency)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Transaction History */}
            <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                <div className="p-4 border-b border-white/10">
                    <h2 className="text-sm font-bold">Lịch sử giao dịch ({transactions.length})</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-[#1a1a1a] text-[var(--muted)] text-[10px] uppercase">
                            <tr>
                                <th className="p-3">Ngày</th>
                                <th className="p-3">Loại</th>
                                <th className="p-3">Danh mục</th>
                                <th className="p-3">Mô tả</th>
                                <th className="p-3 text-right">Số tiền</th>
                                <th className="p-3">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {transactions.slice(0, 20).map((tx) => (
                                <tr key={tx.id} className="hover:bg-white/5">
                                    <td className="p-3 text-[var(--muted)]">{new Date(tx.date).toLocaleDateString("vi-VN")}</td>
                                    <td className="p-3">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tx.type === "IN" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="p-3 text-white">{tx.category}</td>
                                    <td className="p-3 text-[var(--muted)] max-w-[150px] truncate">{tx.description}</td>
                                    <td className="p-3 text-right font-bold text-white">
                                        {formatCurrency(tx.amount, tx.currency)}
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            tx.status === "APPROVED" ? "bg-green-500/20 text-green-400" :
                                            tx.status === "REJECTED" ? "bg-red-500/20 text-red-400" :
                                            "bg-yellow-500/20 text-yellow-400"
                                        }`}>
                                            {tx.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-[var(--muted)]">
                                        Chưa có giao dịch nào
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {transactions.length > 20 && (
                    <div className="p-3 border-t border-white/10 text-center">
                        <button
                            onClick={() => router.push(`/finance/transactions?user=${userId}`)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                        >
                            Xem tất cả {transactions.length} giao dịch →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
