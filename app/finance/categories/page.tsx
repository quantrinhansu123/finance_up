"use client";

import { useState, useEffect } from "react";
import { MasterCategory, Transaction, Project } from "@/types/finance";
import { getUserRole, Role } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getTransactions, getProjects } from "@/lib/finance";

const formatCurrency = (val: number, currency?: string) => {
    if (currency && currency !== "USD") {
        return new Intl.NumberFormat('vi-VN').format(val) + " " + currency;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
};

import {
    Plus, Edit2, Trash2, TrendingUp, TrendingDown, Save, X,
    ChevronRight, ArrowLeft, BarChart3, Tag,
    Filter
} from "lucide-react";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const MASTER_CATEGORIES_COL = "finance_master_categories";

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
    const [categories, setCategories] = useState<MasterCategory[]>([]);
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
            const [catsSnapshot, txs, projs] = await Promise.all([
                getDocs(collection(db, MASTER_CATEGORIES_COL)),
                getTransactions(),
                getProjects()
            ]);

            const cats = catsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as MasterCategory));
            setCategories(cats);
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
        if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${category.name}"?`)) return;

        setSaving(true);
        try {
            await deleteDoc(doc(db, MASTER_CATEGORIES_COL, category.id));
            await fetchData();
            if (selectedCategory?.id === category.id) {
                setSelectedCategory(null);
            }
        } catch (error) {
            console.error("Error deleting category:", error);
            alert("Lỗi khi xóa danh mục");
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
                                    {selectedCategory.type === "INCOME" ? "Danh mục Thu" : "Danh mục Chi"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-card p-4 rounded-xl">
                        <p className="text-sm text-[var(--muted)]">Tổng số tiền</p>
                        <p className={`text-2xl font-bold ${selectedCategory.type === "INCOME" ? "text-green-400" : "text-red-400"
                            }`}>
                            {formatCurrency(stats.totalAmount, "VND")}
                        </p>
                    </div>
                    <div className="glass-card p-4 rounded-xl">
                        <p className="text-sm text-[var(--muted)]">Số giao dịch</p>
                        <p className="text-2xl font-bold text-white">{stats.transactionCount}</p>
                    </div>
                    <div className="glass-card p-4 rounded-xl">
                        <p className="text-sm text-[var(--muted)]">Số dự án</p>
                        <p className="text-2xl font-bold text-white">{stats.projectBreakdown.length}</p>
                    </div>
                </div>

                {/* Charts */}
                {stats.projectBreakdown.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Pie Chart */}
                        <div className="glass-card p-6 rounded-xl">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <BarChart3 size={20} />
                                Phân bổ theo dự án
                            </h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            dataKey="value"
                                            label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
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

                        {/* Bar Chart */}
                        <div className="glass-card p-6 rounded-xl">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <BarChart3 size={20} />
                                So sánh số tiền
                            </h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={barData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fill: '#9CA3AF', fontSize: 12 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1f2937',
                                                border: '1px solid #374151',
                                                borderRadius: '8px',
                                                color: '#fff'
                                            }}
                                            formatter={(value: number) => [formatCurrency(value, "VND"), "Số tiền"]}
                                        />
                                        <Bar
                                            dataKey="amount"
                                            fill={selectedCategory.type === "INCOME" ? "#10b981" : "#ef4444"}
                                            radius={[4, 4, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {/* Project Comparison Table */}
                <div className="glass-card rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <BarChart3 size={20} />
                            So sánh chi tiết giữa các dự án
                        </h3>
                    </div>

                    {stats.projectBreakdown.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left p-4 text-sm font-medium text-[var(--muted)]">Dự án</th>
                                        <th className="text-right p-4 text-sm font-medium text-[var(--muted)]">Số tiền</th>
                                        <th className="text-right p-4 text-sm font-medium text-[var(--muted)]">Số GD</th>
                                        <th className="text-right p-4 text-sm font-medium text-[var(--muted)]">Tỷ lệ</th>
                                        <th className="text-left p-4 text-sm font-medium text-[var(--muted)]">Danh mục con</th>
                                        <th className="p-4 text-sm font-medium text-[var(--muted)]">Biểu đồ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.projectBreakdown.map((item, idx) => {
                                        const percentage = stats.totalAmount > 0
                                            ? (item.amount / stats.totalAmount) * 100
                                            : 0;
                                        return (
                                            <tr
                                                key={item.projectId}
                                                className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-[var(--muted)]">#{idx + 1}</span>
                                                        <span className="font-medium text-white">{item.projectName}</span>
                                                    </div>
                                                </td>
                                                <td className={`p-4 text-right font-medium ${selectedCategory.type === "INCOME" ? "text-green-400" : "text-red-400"
                                                    }`}>
                                                    {formatCurrency(item.amount, "VND")}
                                                </td>
                                                <td className="p-4 text-right text-[var(--muted)]">
                                                    {item.count}
                                                </td>
                                                <td className="p-4 text-right text-white">
                                                    {percentage.toFixed(1)}%
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.subCategories.map((subCat, subIdx) => (
                                                            <span
                                                                key={subIdx}
                                                                className="px-2 py-1 bg-white/10 text-xs rounded-md text-[var(--muted)] flex items-center gap-1"
                                                            >
                                                                <Tag size={10} />
                                                                {subCat}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-4 w-40">
                                                    <div className="w-full bg-white/10 rounded-full h-2">
                                                        <div
                                                            className={`h-2 rounded-full ${selectedCategory.type === "INCOME"
                                                                ? "bg-green-500"
                                                                : "bg-red-500"
                                                                }`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-[var(--muted)]">
                            <BarChart3 size={40} className="mx-auto mb-3 opacity-50" />
                            <p>Chưa có giao dịch nào thuộc danh mục này</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Main Table View
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Danh mục Gốc</h1>
                    <p className="text-[var(--muted)]">Quản lý danh mục thu chi chung</p>
                </div>
            </div>

            <DataTableToolbar
                searchPlaceholder="Tìm tên danh mục..."
                onSearch={setSearchTerm}
                activeFilters={activeFilters}
                onFilterChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                onReset={() => {
                    setActiveFilters({ type: "ALL" });
                    setSearchTerm("");
                }}
                onExport={() => exportToCSV(filteredCategories, "Danh_Sach_Danh_Muc", {
                    name: "Tên danh mục",
                    type: "Loại",
                    description: "Mô tả",
                    isActive: "Trạng thái"
                })}
                onAdd={handleAddCategory}
                addLabel="Thêm danh mục"
                filters={[
                    {
                        id: "type",
                        label: "Tất cả loại",
                        options: [
                            { value: "ALL", label: "Tất cả loại" },
                            { value: "INCOME", label: "Thu tiền" },
                            { value: "EXPENSE", label: "Chi tiền" }
                        ]
                    }
                ]}
            />

            {/* Table */}
            <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="text-left p-4 text-sm font-medium text-[var(--muted)]">Danh mục</th>
                                <th className="text-left p-4 text-sm font-medium text-[var(--muted)]">Loại</th>
                                <th className="text-right p-4 text-sm font-medium text-[var(--muted)]">Tổng tiền</th>
                                <th className="text-right p-4 text-sm font-medium text-[var(--muted)]">Số GD</th>
                                <th className="text-center p-4 text-sm font-medium text-[var(--muted)]">Trạng thái</th>
                                <th className="text-right p-4 text-sm font-medium text-[var(--muted)]">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCategories.length > 0 ? (
                                filteredCategories.map(category => {
                                    const stats = getCategoryStats(category);
                                    return (
                                        <tr
                                            key={category.id}
                                            onClick={() => setSelectedCategory(category)}
                                            className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                                        >
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${category.type === "INCOME"
                                                        ? "bg-green-500/20"
                                                        : "bg-red-500/20"
                                                        }`}>
                                                        {category.type === "INCOME"
                                                            ? <TrendingUp size={16} className="text-green-400" />
                                                            : <TrendingDown size={16} className="text-red-400" />
                                                        }
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-white">{category.name}</p>
                                                        {category.description && (
                                                            <p className="text-xs text-[var(--muted)]">{category.description}</p>
                                                        )}
                                                    </div>
                                                    <ChevronRight size={16} className="text-[var(--muted)] ml-auto" />
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${category.type === "INCOME"
                                                    ? "bg-green-500/20 text-green-400"
                                                    : "bg-red-500/20 text-red-400"
                                                    }`}>
                                                    {category.type === "INCOME" ? "Thu" : "Chi"}
                                                </span>
                                            </td>
                                            <td className={`p-4 text-right font-medium ${category.type === "INCOME" ? "text-green-400" : "text-red-400"
                                                }`}>
                                                {formatCurrency(stats.totalAmount, "VND")}
                                            </td>
                                            <td className="p-4 text-right text-[var(--muted)]">
                                                {stats.transactionCount}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={(e) => handleToggleCategory(category, e)}
                                                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${category.isActive
                                                        ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                                        : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                                                        }`}
                                                >
                                                    {category.isActive ? "Hoạt động" : "Tạm dừng"}
                                                </button>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={(e) => handleEditCategory(category, e)}
                                                        className="p-2 rounded-lg hover:bg-white/10 text-[var(--muted)] hover:text-white transition-colors"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteCategory(category, e)}
                                                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-[var(--muted)]">
                                        <Filter size={40} className="mx-auto mb-3 opacity-50" />
                                        <p>Không có danh mục nào</p>
                                        <button
                                            onClick={handleAddCategory}
                                            className="mt-3 text-blue-400 text-sm hover:underline"
                                        >
                                            + Thêm danh mục đầu tiên
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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
                                        className={`flex-1 p-3 rounded-lg border transition-all ${categoryType === "INCOME"
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
                                        className={`flex-1 p-3 rounded-lg border transition-all ${categoryType === "EXPENSE"
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
                                    className={`flex-1 px-4 py-3 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2 ${categoryType === "INCOME"
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
