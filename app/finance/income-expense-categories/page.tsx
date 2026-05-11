"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, Plus, X, Edit2, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { MasterCategory, MasterSubCategory } from "@/types/finance";
import { getMasterCategories, getMasterSubCategories, insertMasterCategory, insertMasterSubCategory, updateMasterSubCategory, deleteMasterSubCategory } from "@/lib/master-categories";
import { getUserRole } from "@/lib/permissions";
import { useRouter } from "next/navigation";

export default function IncomeExpenseCategoriesPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [categoryTab, setCategoryTab] = useState<"INCOME" | "EXPENSE">("INCOME");
    const [masterCategories, setMasterCategories] = useState<MasterCategory[]>([]);
    const [subCategories, setSubCategories] = useState<MasterSubCategory[]>([]);
    const [currentUser, setCurrentUser] = useState<{ uid?: string; id?: string } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<MasterSubCategory | null>(null);
    const [parentCategoryName, setParentCategoryName] = useState("");
    const [isCreatingParent, setIsCreatingParent] = useState(false);
    const [subCategoryName, setSubCategoryName] = useState("");
    const [payerName, setPayerName] = useState("");
    const [isCreatingPayer, setIsCreatingPayer] = useState(false);

    const profileIdOrNull = (u: { uid?: string; id?: string } | null): string | null => {
        const id = u?.uid || u?.id;
        if (!id) return null;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [cats, subs] = await Promise.all([
                getMasterCategories(),
                getMasterSubCategories(),
            ]);
            setMasterCategories(cats.filter((c) => c.isActive));
            setSubCategories(subs.filter((s) => s.isActive));
        } catch (err) {
            console.error("Failed to load income/expense categories", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchData();
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (storedUser) {
            const u = JSON.parse(storedUser);
            setCurrentUser(u);
            if (getUserRole(u) !== "ADMIN") {
                router.push("/finance");
            }
        } else {
            router.push("/login");
        }
    }, []);

    const tableRows = useMemo(() => {
        const parentById = new Map(masterCategories.map((c) => [c.id, c]));
        return subCategories
            .filter((sub) => sub.type === categoryTab)
            .map((sub) => {
                const parent = parentById.get(sub.parentCategoryId);
                return {
                    id: sub.id,
                    parentId: sub.parentCategoryId,
                    parentName: parent?.name || sub.parentCategoryName || "N/A",
                    subName: sub.name,
                    extraCol: categoryTab === "EXPENSE" ? (sub.description || "-") : (sub.createdBy || "-"),
                    raw: sub,
                };
            });
    }, [masterCategories, subCategories, categoryTab]);
    const payerOptions = useMemo(() => {
        return Array.from(
            new Set(
                subCategories
                    .filter((s) => s.type === "EXPENSE")
                    .map((s) => (s.description || "").trim())
                    .filter(Boolean)
            )
        );
    }, [subCategories]);

    const handleOpenCreate = () => {
        setEditingSub(null);
        setParentCategoryName("");
        setIsCreatingParent(false);
        setSubCategoryName("");
        setPayerName("");
        setIsCreatingPayer(false);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (sub: MasterSubCategory) => {
        const parent = masterCategories.find((c) => c.id === sub.parentCategoryId);
        setEditingSub(sub);
        setParentCategoryName(parent?.name || sub.parentCategoryName || "");
        setIsCreatingParent(false);
        setSubCategoryName(sub.name);
        setPayerName(sub.type === "EXPENSE" ? (sub.description || "").trim() : "");
        setIsCreatingPayer(false);
        setIsModalOpen(true);
    };

    const handleDeleteRow = async (sub: MasterSubCategory) => {
        if (!confirm(`Xóa danh mục chi tiết "${sub.name}"?`)) return;
        setSaving(true);
        try {
            await deleteMasterSubCategory(sub.id);
            await fetchData();
        } catch (err) {
            console.error(err);
            alert("Không xóa được (có thể đang được sử dụng).");
        } finally {
            setSaving(false);
        }
    };

    const handleCreate = async () => {
        if (saving) return;
        if (!parentCategoryName.trim() || !subCategoryName.trim()) return;

        setSaving(true);
        try {
            const normalizedParentName = parentCategoryName.trim();
            const normalizedSubName = subCategoryName.trim();
            const normalizedPayerName = payerName.trim();
            const createdBy = undefined;

            let parent = masterCategories.find(
                (c) => c.type === categoryTab && c.name.toLowerCase() === normalizedParentName.toLowerCase()
            );

            if (!parent) {
                const parentId = await insertMasterCategory({
                    name: normalizedParentName,
                    type: categoryTab,
                    description: "",
                    isActive: true,
                    createdBy,
                });
                parent = {
                    id: parentId,
                    name: normalizedParentName,
                    type: categoryTab,
                    isActive: true,
                    createdAt: Date.now(),
                    createdBy: createdBy || "",
                };
            }

            if (editingSub) {
                await updateMasterSubCategory(editingSub.id, {
                    name: normalizedSubName,
                    description: categoryTab === "EXPENSE" ? normalizedPayerName : "",
                    parentCategoryId: parent.id,
                    parentCategoryName: parent.name,
                });
            } else {
                await insertMasterSubCategory({
                    name: normalizedSubName,
                    parentCategoryId: parent.id,
                    parentCategoryName: parent.name,
                    type: categoryTab,
                    description: categoryTab === "EXPENSE" ? normalizedPayerName : "",
                    createdBy,
                });
            }

            setIsModalOpen(false);
            setEditingSub(null);
            await fetchData();
        } catch (err) {
            console.error("Failed to save category", err);
            alert(editingSub ? "Lỗi khi cập nhật danh mục" : "Lỗi khi thêm mới danh mục");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                        <Layers className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{t("income_expense_categories")}</h1>
                        <p className="text-sm text-white/50">{t("income_expense_categories_desc")}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="px-4 py-2 rounded-xl bg-white text-black font-bold flex items-center gap-2 hover:bg-white/90 transition-all"
                >
                    <Plus size={18} />
                    {t("add_new")}
                </button>
            </div>

            <div className="glass-card rounded-2xl border border-white/10 p-5 space-y-4">
                <div className="inline-flex rounded-xl bg-white/5 p-1 border border-white/10">
                    <button
                        type="button"
                            onClick={() => { setCategoryTab("INCOME"); setParentCategoryName(""); setIsCreatingParent(false); }}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${categoryTab === "INCOME" ? "bg-green-600 text-white" : "text-[var(--muted)] hover:text-white"}`}
                    >
                        Danh mục thu
                    </button>
                    <button
                        type="button"
                            onClick={() => { setCategoryTab("EXPENSE"); setParentCategoryName(""); setIsCreatingParent(false); }}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${categoryTab === "EXPENSE" ? "bg-red-600 text-white" : "text-[var(--muted)] hover:text-white"}`}
                    >
                        Danh mục chi
                    </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 text-left">
                            <tr>
                                <th className="px-4 py-3 text-[var(--muted)] font-semibold">
                                    {categoryTab === "INCOME" ? "Danh mục Thu" : "Danh mục Chi"}
                                </th>
                                <th className="px-4 py-3 text-[var(--muted)] font-semibold">Danh mục chi tiết</th>
                                {categoryTab === "EXPENSE" && (
                                    <th className="px-4 py-3 text-[var(--muted)] font-semibold">Người TT</th>
                                )}
                                <th className="px-4 py-3 text-[var(--muted)] font-semibold text-right w-28">{t("actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && tableRows.map((row) => (
                                <tr key={row.id} className="border-t border-white/5">
                                    <td className="px-4 py-3 text-white font-medium">{row.parentName}</td>
                                    <td className="px-4 py-3 text-white/90">{row.subName}</td>
                                    {categoryTab === "EXPENSE" && (
                                        <td className="px-4 py-3 text-white/80">{row.extraCol}</td>
                                    )}
                                    <td className="px-4 py-3 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEdit(row.raw)}
                                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--muted)] hover:text-amber-300 transition-colors"
                                                title={t("edit")}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteRow(row.raw)}
                                                className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-[var(--muted)] hover:text-red-400 transition-colors"
                                                title={t("delete")}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {(loading || tableRows.length === 0) && (
                                <tr>
                                    <td className="px-4 py-4 text-[var(--muted)] text-center" colSpan={categoryTab === "EXPENSE" ? 4 : 3}>
                                        {loading ? t("loading") : "Chưa có dữ liệu danh mục."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md rounded-2xl border border-white/20 p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl font-bold text-white">{editingSub ? t("edit") + " danh mục" : "Thêm mới danh mục"}</h3>
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setEditingSub(null);
                                }}
                                className="text-[var(--muted)] hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--muted)] mb-1">{categoryTab === "INCOME" ? "Danh mục Thu" : "Danh mục Chi"}</label>
                                <select
                                    value={isCreatingParent ? "__NEW__" : parentCategoryName}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "__NEW__") {
                                            setIsCreatingParent(true);
                                            setParentCategoryName("");
                                            return;
                                        }
                                        setIsCreatingParent(false);
                                        setParentCategoryName(val);
                                    }}
                                    className="glass-input w-full p-2 rounded-lg disabled:opacity-50"
                                >
                                    <option value="" disabled>-- Chọn danh mục --</option>
                                    {masterCategories
                                        .filter((c) => c.type === categoryTab)
                                        .filter((c, idx, arr) => arr.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase()) === idx)
                                        .map((c) => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    {!editingSub && <option value="__NEW__">+ Thêm danh mục mới</option>}
                                </select>
                                {isCreatingParent && !editingSub && (
                                    <input
                                        value={parentCategoryName}
                                        onChange={(e) => setParentCategoryName(e.target.value)}
                                        className="glass-input w-full p-2 rounded-lg mt-2"
                                        placeholder="Nhập danh mục mới"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--muted)] mb-1">Danh mục chi tiết</label>
                                <input
                                    value={subCategoryName}
                                    onChange={(e) => setSubCategoryName(e.target.value)}
                                    className="glass-input w-full p-2 rounded-lg"
                                    placeholder="Nhập danh mục chi tiết"
                                />
                            </div>
                            {categoryTab === "EXPENSE" && (
                                <div>
                                    <label className="block text-sm text-[var(--muted)] mb-1">Người TT</label>
                                    <select
                                        value={isCreatingPayer ? "__NEW__" : payerName}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "__NEW__") {
                                                setIsCreatingPayer(true);
                                                setPayerName("");
                                                return;
                                            }
                                            setIsCreatingPayer(false);
                                            setPayerName(val);
                                        }}
                                        className="glass-input w-full p-2 rounded-lg"
                                    >
                                        <option value="">-- Chọn người thanh toán --</option>
                                        {payerOptions.map((name) => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                        <option value="__NEW__">+ Thêm người mới</option>
                                    </select>
                                    {isCreatingPayer && (
                                        <input
                                            value={payerName}
                                            onChange={(e) => setPayerName(e.target.value)}
                                            className="glass-input w-full p-2 rounded-lg mt-2"
                                            placeholder="Nhập người thanh toán"
                                        />
                                    )}
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        setEditingSub(null);
                                    }}
                                    className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-[var(--muted)] hover:text-white"
                                >
                                    {t("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCreate}
                                    disabled={saving || !parentCategoryName.trim() || !subCategoryName.trim()}
                                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50"
                                >
                                    {saving ? t("processing") : t("save")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

