"use client";

import { useState, useEffect } from "react";
import { MasterCategory } from "@/types/finance";
import { getUserRole, Role } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, Save, X } from "lucide-react";

const MASTER_CATEGORIES_COL = "finance_master_categories";

export default function MasterCategoriesPage() {
    const [categories, setCategories] = useState<MasterCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("USER");
    const router = useRouter();

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<MasterCategory | null>(null);
    const [categoryType, setCategoryType] = useState<"INCOME" | "EXPENSE">("INCOME");
    const [categoryName, setCategoryName] = useState("");
    const [categoryDescription, setCategoryDescription] = useState("");

    useEffect(() => {
        const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setCurrentUser(parsedUser);
            const role = getUserRole(parsedUser);
            setUserRole(role);
            
            if (role !== "ADMIN") {
                alert("Chỉ quản trị viên mới có quyền quản lý danh mục");
                router.push("/finance");
                return;
            }
        } else {
            router.push("/login");
        }
    }, [router]);

    useEffect(() => {
        if (userRole === "ADMIN") {
            fetchCategories();
        }
    }, [userRole]);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const snapshot = await getDocs(collection(db, MASTER_CATEGORIES_COL));
            const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MasterCategory));
            setCategories(cats);
        } catch (error) {
            console.error("Error fetching categories:", error);
        } finally {
            setLoading(false);
        }
    };

    const incomeCategories = categories.filter(c => c.type === "INCOME");
    const expenseCategories = categories.filter(c => c.type === "EXPENSE");

    const handleAddCategory = () => {
        setEditingCategory(null);
        setCategoryName("");
        setCategoryDescription("");
        setCategoryType("INCOME");
        setIsModalOpen(true);
    };

    const handleEditCategory = (category: MasterCategory) => {
        setEditingCategory(category);
        setCategoryName(category.name);
        setCategoryDescription(category.description || "");
        setCategoryType(category.type);
        setIsModalOpen(true);
    };

    const handleSaveCategory = async () => {
        if (!categoryName.trim()) return;

        setSaving(true);
        try {
            if (editingCategory) {
                // Update existing
                await updateDoc(doc(db, MASTER_CATEGORIES_COL, editingCategory.id), {
                    name: categoryName.trim(),
                    description: categoryDescription.trim() || null,
                    type: categoryType
                });
            } else {
                // Create new
                await addDoc(collection(db, MASTER_CATEGORIES_COL), {
                    name: categoryName.trim(),
                    type: categoryType,
                    description: categoryDescription.trim() || null,
                    isActive: true,
                    createdAt: Date.now(),
                    createdBy: currentUser?.uid || currentUser?.id || "unknown"
                });
            }

            await fetchCategories();
            setIsModalOpen(false);
            setCategoryName("");
            setCategoryDescription("");
        } catch (error) {
            console.error("Error saving category:", error);
            alert("Lỗi khi lưu danh mục");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCategory = async (category: MasterCategory) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${category.name}"?\n\nLưu ý: Các danh mục con trong dự án sẽ không bị xóa nhưng sẽ mất liên kết.`)) return;

        setSaving(true);
        try {
            await deleteDoc(doc(db, MASTER_CATEGORIES_COL, category.id));
            await fetchCategories();
        } catch (error) {
            console.error("Error deleting category:", error);
            alert("Lỗi khi xóa danh mục");
        } finally {
            setSaving(false);
        }
    };

    const handleToggleCategory = async (category: MasterCategory) => {
        setSaving(true);
        try {
            await updateDoc(doc(db, MASTER_CATEGORIES_COL, category.id), {
                isActive: !category.isActive
            });
            await fetchCategories();
        } catch (error) {
            console.error("Error toggling category:", error);
            alert("Lỗi khi cập nhật trạng thái");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="glass-card h-64 animate-pulse rounded-xl"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Danh mục Gốc</h1>
                    <p className="text-[var(--muted)]">Quản lý danh mục thu chi chung cho tất cả dự án</p>
                </div>
                <button
                    onClick={handleAddCategory}
                    className="glass-button px-6 py-3 rounded-xl font-medium flex items-center gap-2"
                >
                    <Plus size={20} />
                    Thêm danh mục
                </button>
            </div>

            {/* Info Box */}
            <div className="glass-card p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-400">
                    💡 <strong>Hướng dẫn:</strong> Đây là danh mục GỐC (parent). Mỗi dự án sẽ tạo danh mục CON (sub-category) dựa trên các danh mục gốc này.
                    <br />
                    Ví dụ: Danh mục gốc "Lương" → Dự án A tạo "Lương Sale", "Lương Marketing"
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Income Categories */}
                <div className="glass-card p-6 rounded-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <TrendingUp size={20} className="text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Danh mục Thu</h3>
                            <p className="text-sm text-[var(--muted)]">{incomeCategories.length} danh mục</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {incomeCategories.length > 0 ? (
                            incomeCategories.map(category => (
                                <div
                                    key={category.id}
                                    className={`p-4 rounded-xl border transition-all ${
                                        category.isActive 
                                            ? "bg-green-500/5 border-green-500/20" 
                                            : "bg-gray-500/5 border-gray-500/20 opacity-60"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-white">{category.name}</h4>
                                            {category.description && (
                                                <p className="text-sm text-[var(--muted)] mt-1">{category.description}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggleCategory(category)}
                                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                                    category.isActive
                                                        ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                                        : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                                                }`}
                                            >
                                                {category.isActive ? "Hoạt động" : "Tạm dừng"}
                                            </button>
                                            <button
                                                onClick={() => handleEditCategory(category)}
                                                className="p-2 rounded-lg hover:bg-white/10 text-[var(--muted)] hover:text-white transition-colors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCategory(category)}
                                                className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-[var(--muted)]">
                                <TrendingUp size={40} className="mx-auto mb-3 opacity-50" />
                                <p>Chưa có danh mục thu nào</p>
                                <button
                                    onClick={() => {
                                        setCategoryType("INCOME");
                                        handleAddCategory();
                                    }}
                                    className="mt-3 text-green-400 text-sm hover:underline"
                                >
                                    + Thêm danh mục thu đầu tiên
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Expense Categories */}
                <div className="glass-card p-6 rounded-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                            <TrendingDown size={20} className="text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Danh mục Chi</h3>
                            <p className="text-sm text-[var(--muted)]">{expenseCategories.length} danh mục</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {expenseCategories.length > 0 ? (
                            expenseCategories.map(category => (
                                <div
                                    key={category.id}
                                    className={`p-4 rounded-xl border transition-all ${
                                        category.isActive 
                                            ? "bg-red-500/5 border-red-500/20" 
                                            : "bg-gray-500/5 border-gray-500/20 opacity-60"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-white">{category.name}</h4>
                                            {category.description && (
                                                <p className="text-sm text-[var(--muted)] mt-1">{category.description}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggleCategory(category)}
                                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                                    category.isActive
                                                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                                        : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                                                }`}
                                            >
                                                {category.isActive ? "Hoạt động" : "Tạm dừng"}
                                            </button>
                                            <button
                                                onClick={() => handleEditCategory(category)}
                                                className="p-2 rounded-lg hover:bg-white/10 text-[var(--muted)] hover:text-white transition-colors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCategory(category)}
                                                className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-[var(--muted)]">
                                <TrendingDown size={40} className="mx-auto mb-3 opacity-50" />
                                <p>Chưa có danh mục chi nào</p>
                                <button
                                    onClick={() => {
                                        setCategoryType("EXPENSE");
                                        handleAddCategory();
                                    }}
                                    className="mt-3 text-red-400 text-sm hover:underline"
                                >
                                    + Thêm danh mục chi đầu tiên
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">
                                {editingCategory ? "Chỉnh sửa danh mục" : "Thêm danh mục gốc"}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 rounded-lg hover:bg-white/10 text-[var(--muted)] hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                                    Loại danh mục
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCategoryType("INCOME")}
                                        className={`flex-1 p-3 rounded-lg border transition-all ${
                                            categoryType === "INCOME"
                                                ? "bg-green-500/20 border-green-500/50 text-green-400"
                                                : "bg-white/5 border-white/10 text-[var(--muted)] hover:border-white/20"
                                        }`}
                                    >
                                        <TrendingUp size={20} className="mx-auto mb-1" />
                                        <div className="text-sm font-medium">Thu</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCategoryType("EXPENSE")}
                                        className={`flex-1 p-3 rounded-lg border transition-all ${
                                            categoryType === "EXPENSE"
                                                ? "bg-red-500/20 border-red-500/50 text-red-400"
                                                : "bg-white/5 border-white/10 text-[var(--muted)] hover:border-white/20"
                                        }`}
                                    >
                                        <TrendingDown size={20} className="mx-auto mb-1" />
                                        <div className="text-sm font-medium">Chi</div>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                                    Tên danh mục *
                                </label>
                                <input
                                    type="text"
                                    value={categoryName}
                                    onChange={(e) => setCategoryName(e.target.value)}
                                    className="glass-input w-full p-3 rounded-lg"
                                    placeholder="VD: Lương, Marketing, COD..."
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                                    Mô tả
                                </label>
                                <textarea
                                    value={categoryDescription}
                                    onChange={(e) => setCategoryDescription(e.target.value)}
                                    className="glass-input w-full p-3 rounded-lg"
                                    rows={3}
                                    placeholder="Mô tả chi tiết về danh mục..."
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-lg border border-white/20 text-[var(--muted)] hover:text-white hover:border-white/40 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSaveCategory}
                                    disabled={saving || !categoryName.trim()}
                                    className={`flex-1 px-4 py-3 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2 ${
                                        categoryType === "INCOME"
                                            ? "bg-green-500 hover:bg-green-600"
                                            : "bg-red-500 hover:bg-red-600"
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Đang lưu...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            {editingCategory ? "Cập nhật" : "Thêm mới"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}