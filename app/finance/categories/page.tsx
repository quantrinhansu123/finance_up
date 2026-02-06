"use client";

import { useState, useEffect, useMemo } from "react";
import { MasterCategory, Transaction, Project, MasterSubCategory } from "@/types/finance";
import { getUserRole, Role } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getTransactions, getProjects } from "@/lib/finance";

const formatCurrency = (val: number, currency?: string) => {
    return new Intl.NumberFormat('vi-VN').format(val) + " " + (currency || "VND");
};

import {
    Plus, Edit2, Trash2, TrendingUp, TrendingDown, Save, X,
    ChevronRight, ArrowLeft, BarChart3, Tag,
    Filter, Settings2
} from "lucide-react";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import DataTable, { ActionCell } from "@/components/finance/DataTable";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useTranslation } from "@/lib/i18n";

const MASTER_CATEGORIES_COL = "finance_master_categories";
const MASTER_SUB_CATEGORIES_COL = "finance_master_sub_categories";

type FilterType = "ALL" | "INCOME" | "EXPENSE";

interface CategoryStats {
    totalAmount: number;
    transactionCount: number;
    projectBreakdown: {
        projectId: string;
        projectName: string;
        amount: number;
        count: number;
        subCategories: string[]; // Danh mục con được sử dụng
    }[];
}

export default function MasterCategoriesPage() {
    const { t } = useTranslation();
    const [categories, setCategories] = useState<MasterCategory[]>([]);
    const [masterSubCategories, setMasterSubCategories] = useState<MasterSubCategory[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("USER");
    const router = useRouter();

    // Filter state
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        type: "ALL"
    });
    const [searchTerm, setSearchTerm] = useState("");

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<MasterCategory | null>(null);
    const [categoryType, setCategoryType] = useState<"INCOME" | "EXPENSE">("INCOME");
    const [categoryName, setCategoryName] = useState("");
    const [categoryDescription, setCategoryDescription] = useState("");

    // Detail panel state
    const [selectedCategory, setSelectedCategory] = useState<MasterCategory | null>(null);

    // Sub-category modal states
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [editingSubCategory, setEditingSubCategory] = useState<MasterSubCategory | null>(null);
    const [subName, setSubName] = useState("");
    const [subDescription, setSubDescription] = useState("");

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
            fetchData();
        }
    }, [userRole]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [catsSnapshot, subCatsSnapshot, txs, projs] = await Promise.all([
                getDocs(collection(db, MASTER_CATEGORIES_COL)),
                getDocs(collection(db, MASTER_SUB_CATEGORIES_COL)),
                getTransactions(),
                getProjects()
            ]);

            const cats = catsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as MasterCategory));
            const subCats = subCatsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as MasterSubCategory));

            setCategories(cats);
            setMasterSubCategories(subCats);
            setTransactions(txs);
            setProjects(projs);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate stats for a category
    const getCategoryStats = (category: MasterCategory): CategoryStats => {
        const categoryTxs = transactions.filter(tx =>
            tx.parentCategory === category.name || tx.parentCategoryId === category.id
        );

        const projectBreakdown: CategoryStats["projectBreakdown"] = [];

        projects.forEach(project => {
            const projectTxs = categoryTxs.filter(tx => tx.projectId === project.id);
            if (projectTxs.length > 0) {
                const amount = projectTxs.reduce((sum, tx) => sum + tx.amount, 0);

                // Lấy danh sách danh mục con được sử dụng
                const subCategories = [...new Set(projectTxs.map(tx => tx.category))];

                projectBreakdown.push({
                    projectId: project.id,
                    projectName: project.name,
                    amount,
                    count: projectTxs.length,
                    subCategories
                });
            }
        });

        // Sort by amount desc
        projectBreakdown.sort((a, b) => b.amount - a.amount);

        return {
            totalAmount: categoryTxs.reduce((sum, tx) => sum + tx.amount, 0),
            transactionCount: categoryTxs.length,
            projectBreakdown
        };
    };

    // Filter categories
    const filteredCategories = categories.filter(c => {
        const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.description || "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchType = activeFilters.type === "ALL" || c.type === activeFilters.type;
        return matchSearch && matchType;
    });

    // Pre-calculate stats for the table
    const displayCategories = useMemo(() => {
        return filteredCategories.map(cat => {
            const stats = getCategoryStats(cat);
            return {
                ...cat,
                totalAmount: stats.totalAmount,
                transactionCount: stats.transactionCount
            };
        });
    }, [filteredCategories, transactions, projects]);

    const handleAddCategory = () => {
        setEditingCategory(null);
        setCategoryName("");
        setCategoryDescription("");
        setCategoryType("INCOME");
        setIsModalOpen(true);
    };

    const handleEditCategory = (category: MasterCategory, e: React.MouseEvent) => {
        e.stopPropagation();
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
                await updateDoc(doc(db, MASTER_CATEGORIES_COL, editingCategory.id), {
                    name: categoryName.trim(),
                    description: categoryDescription.trim() || "",
                    type: categoryType
                });
            } else {
                await addDoc(collection(db, MASTER_CATEGORIES_COL), {
                    name: categoryName.trim(),
                    type: categoryType,
                    description: categoryDescription.trim() || "",
                    isActive: true,
                    createdAt: Date.now(),
                    createdBy: currentUser?.uid || currentUser?.id || "unknown"
                });
            }

            await fetchData();
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

    const handleDeleteCategory = async (category: MasterCategory, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(t('confirm_delete').replace('?', ` "${category.name}"?`))) return;

        setSaving(true);
        try {
            await deleteDoc(doc(db, MASTER_CATEGORIES_COL, category.id));
            await fetchData();
            if (selectedCategory?.id === category.id) {
                setSelectedCategory(null);
            }
        } catch (error) {
            console.error("Error deleting category:", error);
            alert(t('delete_failed'));
        } finally {
            setSaving(false);
        }
    };

    const handleToggleCategory = async (category: MasterCategory, e: React.MouseEvent) => {
        e.stopPropagation();
        setSaving(true);
        try {
            await updateDoc(doc(db, MASTER_CATEGORIES_COL, category.id), {
                isActive: !category.isActive
            });
            await fetchData();
        } catch (error) {
            console.error("Error toggling category:", error);
        } finally {
            setSaving(false);
        }
    };

    // Sub-category Handlers
    const handleAddSubCategory = () => {
        setEditingSubCategory(null);
        setSubName("");
        setSubDescription("");
        setIsSubModalOpen(true);
    };

    const handleEditSubCategory = (sub: MasterSubCategory) => {
        setEditingSubCategory(sub);
        setSubName(sub.name);
        setSubDescription(sub.description || "");
        setIsSubModalOpen(true);
    };

    const handleSaveSubCategory = async () => {
        if (!selectedCategory || !subName.trim()) return;

        setSaving(true);
        try {
            if (editingSubCategory) {
                await updateDoc(doc(db, MASTER_SUB_CATEGORIES_COL, editingSubCategory.id), {
                    name: subName.trim(),
                    description: subDescription.trim() || ""
                });
            } else {
                await addDoc(collection(db, MASTER_SUB_CATEGORIES_COL), {
                    name: subName.trim(),
                    parentCategoryId: selectedCategory.id,
                    parentCategoryName: selectedCategory.name,
                    type: selectedCategory.type,
                    description: subDescription.trim() || "",
                    isActive: true,
                    createdAt: Date.now(),
                    createdBy: currentUser?.uid || currentUser?.id || "unknown"
                });
            }

            await fetchData();
            setIsSubModalOpen(false);
            setSubName("");
            setSubDescription("");
        } catch (error) {
            console.error("Error saving sub-category:", error);
            alert("Lỗi khi lưu danh mục con");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSubCategory = async (sub: MasterSubCategory) => {
        if (!confirm(`Bạn có chắc muốn xóa danh mục con "${sub.name}"?`)) return;

        setSaving(true);
        try {
            await deleteDoc(doc(db, MASTER_SUB_CATEGORIES_COL, sub.id));
            await fetchData();
        } catch (error) {
            console.error("Error deleting sub-category:", error);
            alert("Lỗi khi xóa danh mục con");
        } finally {
            setSaving(false);
        }
    };

    const handleToggleSubCategory = async (sub: MasterSubCategory) => {
        setSaving(true);
        try {
            await updateDoc(doc(db, MASTER_SUB_CATEGORIES_COL, sub.id), {
                isActive: !sub.isActive
            });
            await fetchData();
        } catch (error) {
            console.error("Error toggling sub-category:", error);
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

    // Detail Panel View
    if (selectedCategory) {
        const stats = getCategoryStats(selectedCategory);
        const currentSubCategories = masterSubCategories.filter(s => s.parentCategoryId === selectedCategory.id);

        // Prepare chart data
        const pieData = stats.projectBreakdown.map((item, idx) => ({
            name: item.projectName,
            value: item.amount,
            color: `hsl(${(idx * 137.5) % 360}, 70%, 50%)`
        }));

        const barData = stats.projectBreakdown.map(item => ({
            name: item.projectName.length > 10 ? item.projectName.substring(0, 10) + "..." : item.projectName,
            amount: item.amount,
            count: item.count
        }));

        const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899'];

        return (
            <div className="space-y-6">
                {/* Back Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className="p-2 rounded-lg hover:bg-white/10 text-[var(--muted)] hover:text-white transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedCategory.type === "INCOME"
                                ? "bg-green-500/20"
                                : "bg-red-500/20"
                                }`}>
                                {selectedCategory.type === "INCOME"
                                    ? <TrendingUp size={20} className="text-green-400" />
                                    : <TrendingDown size={20} className="text-red-400" />
                                }
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">{selectedCategory.name}</h1>
                                <p className="text-sm text-[var(--muted)]">
                                    {selectedCategory.type === "INCOME" ? t("income_cat") : t("expense_cat")}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grid for Stats and Sub-categories */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sidebar: Sub-categories management */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="glass-card p-5 rounded-xl border border-white/10">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <Tag size={18} className="text-[var(--muted)]" />
                                    Danh mục con (Hệ thống)
                                </h3>
                                <button
                                    onClick={handleAddSubCategory}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>

                            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {currentSubCategories.length > 0 ? (
                                    currentSubCategories.map(sub => (
                                        <div
                                            key={sub.id}
                                            className={`p-3 rounded-lg border transition-all ${sub.isActive
                                                ? "bg-white/5 border-white/10"
                                                : "bg-white/0 border-dashed border-white/5 opacity-50"
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate">{sub.name}</p>
                                                    {sub.description && (
                                                        <p className="text-xs text-[var(--muted)] truncate mt-1">{sub.description}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleToggleSubCategory(sub)}
                                                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${sub.isActive ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"
                                                            }`}
                                                    >
                                                        {sub.isActive ? "ON" : "OFF"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditSubCategory(sub)}
                                                        className="p-1 text-[var(--muted)] hover:text-white transition-colors"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSubCategory(sub)}
                                                        className="p-1 text-[var(--muted)] hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-[var(--muted)] border border-dashed border-white/10 rounded-xl">
                                        <p className="text-xs">Chưa có danh mục con hệ thống</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="glass-card p-5 rounded-xl border border-white/10">
                            <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Thông tin dự án sử dụng</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-[var(--muted)]">Tổng chi phí:</span>
                                    <span className="font-bold text-white">{formatCurrency(stats.totalAmount, "VND")}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-[var(--muted)]">Số giao dịch:</span>
                                    <span className="font-bold text-white">{stats.transactionCount}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-[var(--muted)]">Số dự án:</span>
                                    <span className="font-bold text-white">{stats.projectBreakdown.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content: Stats and Charts */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="glass-card p-4 rounded-xl">
                                <p className="text-sm text-[var(--muted)]">{t("total_amount")}</p>
                                <p className={`text-2xl font-bold ${selectedCategory.type === "INCOME" ? "text-green-400" : "text-red-400"}`}>
                                    {formatCurrency(stats.totalAmount, "VND")}
                                </p>
                            </div>
                            <div className="glass-card p-4 rounded-xl">
                                <p className="text-sm text-[var(--muted)]">{t("transaction_count")}</p>
                                <p className="text-2xl font-bold text-white">{stats.transactionCount}</p>
                            </div>
                        </div>

                        {/* Charts */}
                        {stats.projectBreakdown.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="glass-card p-6 rounded-xl min-h-[300px]">
                                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                        <BarChart3 size={16} />
                                        {t("project_allocation")}
                                    </h3>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={60}
                                                    dataKey="value"
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value: number) => formatCurrency(value, "VND")} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="glass-card p-6 rounded-xl min-h-[300px]">
                                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                        <BarChart3 size={16} />
                                        {t("amount_comparison")}
                                    </h3>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={barData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                                <XAxis dataKey="name" hide />
                                                <YAxis hide />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }}
                                                    formatter={(value: number) => [formatCurrency(value, "VND"), ""]}
                                                />
                                                <Bar dataKey="amount" fill={selectedCategory.type === "INCOME" ? "#10b981" : "#ef4444"} radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Project Breakdown Table */}
                        <div className="glass-card rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-white/10">
                                <h3 className="text-sm font-semibold text-white">Chi tiết theo dự án</h3>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-white/5">
                                            <th className="text-left p-3 text-[var(--muted)]">Dự án</th>
                                            <th className="text-right p-3 text-[var(--muted)]">Số tiền</th>
                                            <th className="text-right p-3 text-[var(--muted)]">Tỷ lệ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.projectBreakdown.map((item, idx) => {
                                            const percentage = stats.totalAmount > 0 ? (item.amount / stats.totalAmount) * 100 : 0;
                                            return (
                                                <tr key={item.projectId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    <td className="p-3">
                                                        <span className="font-medium text-white">{item.projectName}</span>
                                                    </td>
                                                    <td className={`p-3 text-right font-bold ${selectedCategory.type === "INCOME" ? "text-green-400" : "text-red-400"}`}>
                                                        {formatCurrency(item.amount, "VND")}
                                                    </td>
                                                    <td className="p-3 text-right text-white">
                                                        {percentage.toFixed(1)}%
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sub-category Creation Modal */}
                {isSubModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md">
                        <div className="glass-card w-full max-w-sm p-6 rounded-2xl border border-white/20">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-white">
                                    {editingSubCategory ? "Sửa danh mục con" : "Thêm danh mục con hệ thống"}
                                </h2>
                                <button onClick={() => setIsSubModalOpen(false)} className="text-[var(--muted)] hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--muted)] mb-2 uppercase tracking-wider">Tên danh mục con</label>
                                    <input
                                        type="text"
                                        value={subName}
                                        onChange={(e) => setSubName(e.target.value)}
                                        className="glass-input w-full p-3 rounded-lg text-sm"
                                        placeholder="VD: Lương, Marketing, Thu khác..."
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--muted)] mb-2 uppercase tracking-wider">Mô tả</label>
                                    <textarea
                                        value={subDescription}
                                        onChange={(e) => setSubDescription(e.target.value)}
                                        className="glass-input w-full p-3 rounded-lg text-sm"
                                        rows={2}
                                        placeholder="Ghi chú thêm về danh mục này..."
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setIsSubModalOpen(false)}
                                        className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-sm text-[var(--muted)] hover:text-white transition-colors"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={handleSaveSubCategory}
                                        disabled={saving || !subName.trim()}
                                        className={`flex-1 px-4 py-2.5 rounded-lg font-bold text-white text-sm transition-all shadow-lg ${selectedCategory.type === 'INCOME'
                                            ? 'bg-green-600 hover:bg-green-500 shadow-green-600/20'
                                            : 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                                            } disabled:opacity-50`}
                                    >
                                        {saving ? "..." : (editingSubCategory ? "Cập nhật" : "Lưu")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Main Table View
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">{t("root_category")}</h1>
                    <p className="text-[var(--muted)]">{t("categories_desc")}</p>
                </div>
                <button
                    onClick={handleAddCategory}
                    className="px-5 py-2.5 rounded-xl bg-white text-black font-bold flex items-center gap-2 hover:bg-white/90 transition-all shadow-lg active:scale-95"
                >
                    <Plus size={18} />
                    {t("add_category")}
                </button>
            </div>

            {/* Toolbar */}
            <div className="glass-card p-4 rounded-xl border border-white/10">
                <DataTableToolbar
                    searchPlaceholder={t("search_category")}
                    onSearch={setSearchTerm}
                    activeFilters={activeFilters}
                    onFilterChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                    onReset={() => {
                        setActiveFilters({ type: "ALL" });
                        setSearchTerm("");
                    }}
                    onExport={() => exportToCSV(filteredCategories, "Danh_Sach_Danh_Muc", {
                        name: t("name"),
                        type: t("type"),
                        description: t("description"),
                        isActive: t("status")
                    })}
                    filters={[
                        {
                            id: "type",
                            label: t("all_types"),
                            options: [
                                { value: "ALL", label: t("all_types") },
                                { value: "INCOME", label: t("income") },
                                { value: "EXPENSE", label: t("expense") }
                            ]
                        }
                    ]}
                />
            </div>

            {/* Table */}
            <DataTable
                data={displayCategories}
                onRowClick={setSelectedCategory}
                columns={[
                    {
                        key: "name",
                        header: t("categories"),
                        render: (cat: any) => (
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat.type === "INCOME"
                                    ? "bg-green-500/10 border border-green-500/20"
                                    : "bg-red-500/10 border border-red-500/20"
                                    }`}>
                                    {cat.type === "INCOME"
                                        ? <TrendingUp size={18} className="text-green-400" />
                                        : <TrendingDown size={18} className="text-red-400" />
                                    }
                                </div>
                                <div className="overflow-hidden">
                                    <p className="font-bold text-white truncate text-base">{cat.name}</p>
                                    {cat.description && (
                                        <p className="text-xs text-[var(--muted)] truncate max-w-[200px]">{cat.description}</p>
                                    )}
                                </div>
                            </div>
                        )
                    },
                    {
                        key: "type",
                        header: t("type"),
                        render: (cat: any) => (
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider uppercase border ${cat.type === "INCOME"
                                ? "bg-green-500/5 text-green-400 border-green-500/20"
                                : "bg-red-500/5 text-red-400 border-red-500/20"
                                }`}>
                                {cat.type === "INCOME" ? t("inc") : t("exp")}
                            </span>
                        )
                    },
                    {
                        key: "totalAmount",
                        header: t("total_amount"),
                        align: "right",
                        render: (cat: any) => (
                            <span className={`font-bold text-base ${cat.type === "INCOME" ? "text-green-400" : "text-red-400"}`}>
                                {formatCurrency(cat.totalAmount, "VND")}
                            </span>
                        )
                    },
                    {
                        key: "isActive",
                        header: t("status"),
                        align: "center",
                        render: (cat: any) => (
                            <button
                                onClick={(e) => handleToggleCategory(cat, e)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${cat.isActive
                                    ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
                                    : "bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20"
                                    }`}
                            >
                                {cat.isActive ? t("active") : t("inactive")}
                            </button>
                        )
                    },
                    {
                        key: "actions",
                        header: "",
                        align: "right",
                        sortable: false,
                        render: (cat: any) => (
                            <ActionCell>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); }}
                                    className="p-2 rounded-lg hover:bg-white/5 text-[var(--muted)] hover:text-white transition-all"
                                    title="Quản lý danh mục con"
                                >
                                    <Settings2 size={18} />
                                </button>
                                <button
                                    onClick={(e) => handleEditCategory(cat, e)}
                                    className="p-2 rounded-lg hover:bg-white/5 text-[var(--muted)] hover:text-white transition-all"
                                >
                                    <Edit2 size={18} />
                                </button>
                                <button
                                    onClick={(e) => handleDeleteCategory(cat, e)}
                                    className="p-2 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </ActionCell>
                        )
                    }
                ]}
                emptyMessage={t("no_data")}
            />

            {/* Master Category Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
                    <div className="glass-card w-full max-w-sm p-6 rounded-2xl border border-white/20">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-white">
                                {editingCategory ? "Sửa danh mục gốc" : "Thêm danh mục gốc"}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-[var(--muted)] hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-medium text-[var(--muted)] mb-3 uppercase tracking-widest">Loại danh mục</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setCategoryType("INCOME")}
                                        className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${categoryType === "INCOME"
                                            ? "bg-green-500/20 border-green-500/50 text-green-400 shadow-lg shadow-green-500/10"
                                            : "bg-white/5 border-white/10 text-[var(--muted)] hover:border-white/20"
                                            }`}
                                    >
                                        <TrendingUp size={20} />
                                        <div className="text-xs font-bold uppercase">{t("inc")}</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCategoryType("EXPENSE")}
                                        className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${categoryType === "EXPENSE"
                                            ? "bg-red-500/20 border-red-500/50 text-red-400 shadow-lg shadow-red-500/10"
                                            : "bg-white/5 border-white/10 text-[var(--muted)] hover:border-white/20"
                                            }`}
                                    >
                                        <TrendingDown size={20} />
                                        <div className="text-xs font-bold uppercase">{t("exp")}</div>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-[var(--muted)] mb-2 uppercase tracking-widest">Tên danh mục</label>
                                <input
                                    type="text"
                                    value={categoryName}
                                    onChange={(e) => setCategoryName(e.target.value)}
                                    className="glass-input w-full p-3 rounded-xl text-white font-medium"
                                    placeholder="Lương, Marketing, COD..."
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-[var(--muted)] mb-2 uppercase tracking-widest">Mô tả</label>
                                <textarea
                                    value={categoryDescription}
                                    onChange={(e) => setCategoryDescription(e.target.value)}
                                    className="glass-input w-full p-3 rounded-xl text-white text-sm"
                                    rows={3}
                                    placeholder="Ghi chú thêm..."
                                />
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-white/10">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-sm font-bold text-[var(--muted)] hover:text-white transition-all"
                                >
                                    {t("cancel")}
                                </button>
                                <button
                                    onClick={handleSaveCategory}
                                    disabled={saving || !categoryName.trim()}
                                    className={`flex-1 px-4 py-3 rounded-xl font-bold text-white text-sm transition-all shadow-lg active:scale-95 ${categoryType === "INCOME" ? "bg-green-600 hover:bg-green-500 shadow-green-600/20" : "bg-red-600 hover:bg-red-500 shadow-red-600/20"
                                        } disabled:opacity-50`}
                                >
                                    {saving ? "..." : (editingCategory ? "Cập nhật" : "Tạo mới")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
