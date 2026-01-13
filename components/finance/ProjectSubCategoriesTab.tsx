"use client";

import { useState, useEffect } from "react";
import { Project, MasterCategory, ProjectSubCategory } from "@/types/finance";
import { updateProject } from "@/lib/finance";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, Save, X, ChevronDown } from "lucide-react";

interface Props {
    project: Project;
    onProjectUpdate: (updatedProject: Project) => void;
    canEdit: boolean;
    currentUserId: string;
}

const MASTER_CATEGORIES_COL = "finance_master_categories";

export default function ProjectSubCategoriesTab({ project, onProjectUpdate, canEdit, currentUserId }: Props) {
    const [masterCategories, setMasterCategories] = useState<MasterCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubCategory, setEditingSubCategory] = useState<ProjectSubCategory | null>(null);
    const [categoryType, setCategoryType] = useState<"INCOME" | "EXPENSE">("INCOME");
    const [selectedParentId, setSelectedParentId] = useState("");
    const [subCategoryName, setSubCategoryName] = useState("");
    const [subCategoryDescription, setSubCategoryDescription] = useState("");

    useEffect(() => {
        fetchMasterCategories();
    }, []);

    const fetchMasterCategories = async () => {
        setLoading(true);
        try {
            const snapshot = await getDocs(collection(db, MASTER_CATEGORIES_COL));
            const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MasterCategory));
            setMasterCategories(cats.filter(c => c.isActive));
        } catch (error) {
            console.error("Error fetching master categories:", error);
        } finally {
            setLoading(false);
        }
    };

    const incomeSubCategories = project.incomeSubCategories || [];
    const expenseSubCategories = project.expenseSubCategories || [];

    const incomeMasterCategories = masterCategories.filter(c => c.type === "INCOME");
    const expenseMasterCategories = masterCategories.filter(c => c.type === "EXPENSE");

    const handleAddSubCategory = (type: "INCOME" | "EXPENSE") => {
        setEditingSubCategory(null);
        setSubCategoryName("");
        setSubCategoryDescription("");
        setCategoryType(type);
        setSelectedParentId("");
        setIsModalOpen(true);
    };

    const handleEditSubCategory = (subCategory: ProjectSubCategory) => {
        setEditingSubCategory(subCategory);
        setSubCategoryName(subCategory.name);
        setSubCategoryDescription(subCategory.description || "");
        setCategoryType(subCategory.type);
        setSelectedParentId(subCategory.parentCategoryId);
        setIsModalOpen(true);
    };

    const handleSaveSubCategory = async () => {
        if (!subCategoryName.trim() || !selectedParentId) return;

        setSaving(true);
        try {
            const parentCategory = masterCategories.find(c => c.id === selectedParentId);
            
            // Clean object - remove undefined values for Firebase
            const newSubCategory: ProjectSubCategory = {
                id: editingSubCategory?.id || `subcat_${Date.now()}`,
                name: subCategoryName.trim(),
                parentCategoryId: selectedParentId,
                parentCategoryName: parentCategory?.name || "",
                type: categoryType,
                projectId: project.id,
                description: subCategoryDescription.trim() || "",
                isActive: true,
                createdAt: editingSubCategory?.createdAt || Date.now(),
                createdBy: editingSubCategory?.createdBy || currentUserId
            };

            let updatedIncomeSubCategories = [...incomeSubCategories];
            let updatedExpenseSubCategories = [...expenseSubCategories];

            if (categoryType === "INCOME") {
                if (editingSubCategory) {
                    updatedIncomeSubCategories = updatedIncomeSubCategories.map(cat => 
                        cat.id === editingSubCategory.id ? newSubCategory : cat
                    );
                } else {
                    updatedIncomeSubCategories.push(newSubCategory);
                }
            } else {
                if (editingSubCategory) {
                    updatedExpenseSubCategories = updatedExpenseSubCategories.map(cat => 
                        cat.id === editingSubCategory.id ? newSubCategory : cat
                    );
                } else {
                    updatedExpenseSubCategories.push(newSubCategory);
                }
            }

            // Clean arrays - ensure no undefined values
            const cleanIncomeSubCategories = updatedIncomeSubCategories.map(cat => ({
                id: cat.id,
                name: cat.name,
                parentCategoryId: cat.parentCategoryId,
                parentCategoryName: cat.parentCategoryName || "",
                type: cat.type,
                projectId: cat.projectId,
                description: cat.description || "",
                isActive: cat.isActive,
                createdAt: cat.createdAt,
                createdBy: cat.createdBy
            }));

            const cleanExpenseSubCategories = updatedExpenseSubCategories.map(cat => ({
                id: cat.id,
                name: cat.name,
                parentCategoryId: cat.parentCategoryId,
                parentCategoryName: cat.parentCategoryName || "",
                type: cat.type,
                projectId: cat.projectId,
                description: cat.description || "",
                isActive: cat.isActive,
                createdAt: cat.createdAt,
                createdBy: cat.createdBy
            }));

            await updateProject(project.id, {
                incomeSubCategories: cleanIncomeSubCategories,
                expenseSubCategories: cleanExpenseSubCategories
            });

            const updatedProject = {
                ...project,
                incomeSubCategories: cleanIncomeSubCategories,
                expenseSubCategories: cleanExpenseSubCategories
            };
            onProjectUpdate(updatedProject);

            setIsModalOpen(false);
            setSubCategoryName("");
            setSubCategoryDescription("");
            setSelectedParentId("");
        } catch (error) {
            console.error("Error saving sub-category:", error);
            alert("Lỗi khi lưu danh mục con");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSubCategory = async (subCategory: ProjectSubCategory) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${subCategory.name}"?`)) return;

        setSaving(true);
        try {
            let updatedIncomeSubCategories = [...incomeSubCategories];
            let updatedExpenseSubCategories = [...expenseSubCategories];

            if (subCategory.type === "INCOME") {
                updatedIncomeSubCategories = updatedIncomeSubCategories.filter(cat => cat.id !== subCategory.id);
            } else {
                updatedExpenseSubCategories = updatedExpenseSubCategories.filter(cat => cat.id !== subCategory.id);
            }

            // Clean arrays for Firebase
            const cleanIncomeSubCategories = updatedIncomeSubCategories.map(cat => ({
                id: cat.id,
                name: cat.name,
                parentCategoryId: cat.parentCategoryId,
                parentCategoryName: cat.parentCategoryName || "",
                type: cat.type,
                projectId: cat.projectId,
                description: cat.description || "",
                isActive: cat.isActive,
                createdAt: cat.createdAt,
                createdBy: cat.createdBy
            }));

            const cleanExpenseSubCategories = updatedExpenseSubCategories.map(cat => ({
                id: cat.id,
                name: cat.name,
                parentCategoryId: cat.parentCategoryId,
                parentCategoryName: cat.parentCategoryName || "",
                type: cat.type,
                projectId: cat.projectId,
                description: cat.description || "",
                isActive: cat.isActive,
                createdAt: cat.createdAt,
                createdBy: cat.createdBy
            }));

            await updateProject(project.id, {
                incomeSubCategories: cleanIncomeSubCategories,
                expenseSubCategories: cleanExpenseSubCategories
            });

            const updatedProject = {
                ...project,
                incomeSubCategories: cleanIncomeSubCategories,
                expenseSubCategories: cleanExpenseSubCategories
            };
            onProjectUpdate(updatedProject);
        } catch (error) {
            console.error("Error deleting sub-category:", error);
            alert("Lỗi khi xóa danh mục con");
        } finally {
            setSaving(false);
        }
    };

    const handleToggleSubCategory = async (subCategory: ProjectSubCategory) => {
        setSaving(true);
        try {
            const updatedSubCategory = { ...subCategory, isActive: !subCategory.isActive };
            
            let updatedIncomeSubCategories = [...incomeSubCategories];
            let updatedExpenseSubCategories = [...expenseSubCategories];

            if (subCategory.type === "INCOME") {
                updatedIncomeSubCategories = updatedIncomeSubCategories.map(cat => 
                    cat.id === subCategory.id ? updatedSubCategory : cat
                );
            } else {
                updatedExpenseSubCategories = updatedExpenseSubCategories.map(cat => 
                    cat.id === subCategory.id ? updatedSubCategory : cat
                );
            }

            // Clean arrays for Firebase
            const cleanIncomeSubCategories = updatedIncomeSubCategories.map(cat => ({
                id: cat.id,
                name: cat.name,
                parentCategoryId: cat.parentCategoryId,
                parentCategoryName: cat.parentCategoryName || "",
                type: cat.type,
                projectId: cat.projectId,
                description: cat.description || "",
                isActive: cat.isActive,
                createdAt: cat.createdAt,
                createdBy: cat.createdBy
            }));

            const cleanExpenseSubCategories = updatedExpenseSubCategories.map(cat => ({
                id: cat.id,
                name: cat.name,
                parentCategoryId: cat.parentCategoryId,
                parentCategoryName: cat.parentCategoryName || "",
                type: cat.type,
                projectId: cat.projectId,
                description: cat.description || "",
                isActive: cat.isActive,
                createdAt: cat.createdAt,
                createdBy: cat.createdBy
            }));

            await updateProject(project.id, {
                incomeSubCategories: cleanIncomeSubCategories,
                expenseSubCategories: cleanExpenseSubCategories
            });

            const updatedProject = {
                ...project,
                incomeSubCategories: cleanIncomeSubCategories,
                expenseSubCategories: cleanExpenseSubCategories
            };
            onProjectUpdate(updatedProject);
        } catch (error) {
            console.error("Error toggling sub-category:", error);
            alert("Lỗi khi cập nhật trạng thái");
        } finally {
            setSaving(false);
        }
    };

    // Group sub-categories by parent
    const groupByParent = (subCategories: ProjectSubCategory[]) => {
        const grouped: Record<string, ProjectSubCategory[]> = {};
        subCategories.forEach(sub => {
            const parentName = sub.parentCategoryName || "Khác";
            if (!grouped[parentName]) grouped[parentName] = [];
            grouped[parentName].push(sub);
        });
        return grouped;
    };

    const groupedIncome = groupByParent(incomeSubCategories);
    const groupedExpense = groupByParent(expenseSubCategories);

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="glass-card h-32 animate-pulse rounded-xl"></div>
                <div className="glass-card h-32 animate-pulse rounded-xl"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Info Box */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-400">
                    💡 Tạo danh mục con cho dự án này. Danh mục con phải thuộc một danh mục gốc (do Admin tạo).
                    <br />
                    Khi tạo thu/chi, nhân viên sẽ chọn từ các danh mục con này.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Income Sub-Categories */}
                <div className="glass-card p-5 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <TrendingUp size={18} className="text-green-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Danh mục Thu</h3>
                                <p className="text-xs text-[var(--muted)]">{incomeSubCategories.length} danh mục con</p>
                            </div>
                        </div>
                        {canEdit && (
                            <button
                                onClick={() => handleAddSubCategory("INCOME")}
                                className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors"
                            >
                                <Plus size={18} />
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {Object.keys(groupedIncome).length > 0 ? (
                            Object.entries(groupedIncome).map(([parentName, subs]) => (
                                <div key={parentName} className="space-y-2">
                                    <div className="text-xs font-medium text-green-400 uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                        {parentName}
                                    </div>
                                    {subs.map(sub => (
                                        <div
                                            key={sub.id}
                                            className={`p-3 rounded-lg border ml-4 transition-all ${
                                                sub.isActive 
                                                    ? "bg-green-500/5 border-green-500/20" 
                                                    : "bg-gray-500/5 border-gray-500/20 opacity-60"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-white text-sm truncate">{sub.name}</h4>
                                                    {sub.description && (
                                                        <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{sub.description}</p>
                                                    )}
                                                </div>
                                                {canEdit && (
                                                    <div className="flex items-center gap-1 ml-2">
                                                        <button
                                                            onClick={() => handleToggleSubCategory(sub)}
                                                            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                                                sub.isActive
                                                                    ? "bg-green-500/20 text-green-400"
                                                                    : "bg-gray-500/20 text-gray-400"
                                                            }`}
                                                        >
                                                            {sub.isActive ? "ON" : "OFF"}
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditSubCategory(sub)}
                                                            className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-white transition-colors"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSubCategory(sub)}
                                                            className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6 text-[var(--muted)]">
                                <TrendingUp size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Chưa có danh mục thu</p>
                                {canEdit && (
                                    <button
                                        onClick={() => handleAddSubCategory("INCOME")}
                                        className="mt-2 text-green-400 text-sm hover:underline"
                                    >
                                        + Thêm danh mục thu
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Expense Sub-Categories */}
                <div className="glass-card p-5 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center">
                                <TrendingDown size={18} className="text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Danh mục Chi</h3>
                                <p className="text-xs text-[var(--muted)]">{expenseSubCategories.length} danh mục con</p>
                            </div>
                        </div>
                        {canEdit && (
                            <button
                                onClick={() => handleAddSubCategory("EXPENSE")}
                                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                            >
                                <Plus size={18} />
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {Object.keys(groupedExpense).length > 0 ? (
                            Object.entries(groupedExpense).map(([parentName, subs]) => (
                                <div key={parentName} className="space-y-2">
                                    <div className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                        {parentName}
                                    </div>
                                    {subs.map(sub => (
                                        <div
                                            key={sub.id}
                                            className={`p-3 rounded-lg border ml-4 transition-all ${
                                                sub.isActive 
                                                    ? "bg-red-500/5 border-red-500/20" 
                                                    : "bg-gray-500/5 border-gray-500/20 opacity-60"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-white text-sm truncate">{sub.name}</h4>
                                                    {sub.description && (
                                                        <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{sub.description}</p>
                                                    )}
                                                </div>
                                                {canEdit && (
                                                    <div className="flex items-center gap-1 ml-2">
                                                        <button
                                                            onClick={() => handleToggleSubCategory(sub)}
                                                            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                                                sub.isActive
                                                                    ? "bg-red-500/20 text-red-400"
                                                                    : "bg-gray-500/20 text-gray-400"
                                                            }`}
                                                        >
                                                            {sub.isActive ? "ON" : "OFF"}
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditSubCategory(sub)}
                                                            className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-white transition-colors"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSubCategory(sub)}
                                                            className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6 text-[var(--muted)]">
                                <TrendingDown size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Chưa có danh mục chi</p>
                                {canEdit && (
                                    <button
                                        onClick={() => handleAddSubCategory("EXPENSE")}
                                        className="mt-2 text-red-400 text-sm hover:underline"
                                    >
                                        + Thêm danh mục chi
                                    </button>
                                )}
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
                                {editingSubCategory ? "Chỉnh sửa danh mục con" : "Thêm danh mục con"}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 rounded-lg hover:bg-white/10 text-[var(--muted)] hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Parent Category Selector */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                                    Danh mục gốc *
                                </label>
                                <select
                                    value={selectedParentId}
                                    onChange={(e) => setSelectedParentId(e.target.value)}
                                    className="glass-input w-full p-3 rounded-lg"
                                    required
                                >
                                    <option value="">Chọn danh mục gốc...</option>
                                    {(categoryType === "INCOME" ? incomeMasterCategories : expenseMasterCategories).map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                                {(categoryType === "INCOME" ? incomeMasterCategories : expenseMasterCategories).length === 0 && (
                                    <p className="text-xs text-yellow-400 mt-1">
                                        ⚠️ Chưa có danh mục gốc. Liên hệ Admin để tạo.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                                    Tên danh mục con *
                                </label>
                                <input
                                    type="text"
                                    value={subCategoryName}
                                    onChange={(e) => setSubCategoryName(e.target.value)}
                                    className="glass-input w-full p-3 rounded-lg"
                                    placeholder="VD: Lương Sale, COD VET..."
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                                    Mô tả
                                </label>
                                <textarea
                                    value={subCategoryDescription}
                                    onChange={(e) => setSubCategoryDescription(e.target.value)}
                                    className="glass-input w-full p-3 rounded-lg"
                                    rows={2}
                                    placeholder="Mô tả chi tiết..."
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
                                    onClick={handleSaveSubCategory}
                                    disabled={saving || !subCategoryName.trim() || !selectedParentId}
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
                                            {editingSubCategory ? "Cập nhật" : "Thêm mới"}
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