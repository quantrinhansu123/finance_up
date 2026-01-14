"use client";

import { useState, useEffect, useMemo } from "react";
import { createTransaction, getAccounts, updateAccountBalance, getProjects, updateProject } from "@/lib/finance";
import { Account, Currency, Project, Transaction, MasterCategory } from "@/types/finance";
import { uploadImage } from "@/lib/upload";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUserRole, getAccessibleProjects, getAccessibleAccounts, hasProjectPermission, Role } from "@/lib/permissions";
import { FolderOpen, CreditCard, Wallet, Upload, Check, ChevronRight, AlertCircle, Lock, Plus } from "lucide-react";
import CurrencyInput from "@/components/finance/CurrencyInput";
import SearchableSelect from "@/components/finance/SearchableSelect";
import SearchableSelectWithAdd from "@/components/finance/SearchableSelectWithAdd";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";

const INCOME_SOURCES = ["COD VET", "COD JNT", "Khách CK", "Khác"];
const CURRENCY_FLAGS: Record<string, string> = { "VND": "🇻🇳", "USD": "🇺🇸", "KHR": "🇰🇭", "TRY": "🇹🇷" };
import TransactionDetailModal from "@/components/finance/TransactionDetailModal";
import { Eye } from "lucide-react";

export default function IncomePage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("USER");
    const [showForm, setShowForm] = useState(false);

    const [projectId, setProjectId] = useState("");
    const [accountId, setAccountId] = useState("");
    const [amount, setAmount] = useState("");
    const [source, setSource] = useState(INCOME_SOURCES[0]);
    const [description, setDescription] = useState("");
    const [files, setFiles] = useState<File[]>([]);

    // Filters
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        startDate: "",
        endDate: "",
        date: "",
        projectId: "",
        accountId: ""
    });
    const [searchTerm, setSearchTerm] = useState("");

    // Modal state
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [selectedParentCategoryId, setSelectedParentCategoryId] = useState("");
    const [savingCategory, setSavingCategory] = useState(false);
    const [masterCategories, setMasterCategories] = useState<MasterCategory[]>([]);

    useEffect(() => {
        const u = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (u) { const parsed = JSON.parse(u); setCurrentUser(parsed); setUserRole(getUserRole(parsed)); }
    }, []);

    useEffect(() => { if (currentUser !== null) fetchData(); }, [currentUser]);

    // Lọc dự án user có quyền tạo thu (create_income)
    const accessibleProjects = useMemo(() => {
        const userId = currentUser?.uid || currentUser?.id;
        if (!userId) return [];

        const allAccessible = getAccessibleProjects(currentUser, projects);
        // Chỉ hiện dự án mà user có quyền create_income
        return allAccessible.filter(p => hasProjectPermission(userId, p, "create_income", currentUser));
    }, [currentUser, projects]);

    const accessibleAccounts = useMemo(() => {
        let filtered = getAccessibleAccounts(currentUser, accounts, accessibleProjects.map(p => p.id));
        const userId = currentUser?.uid || currentUser?.id;

        // Filter by projectId first - only show accounts assigned to selected project
        if (projectId) {
            filtered = filtered.filter(acc => acc.projectId === projectId);
        }

        // Admin can use all accounts in the project, no need to check assignedUserIds
        if (userRole === "ADMIN") {
            return filtered;
        }

        // For non-admin: filter by assignedUserIds - only show accounts user is assigned to
        if (userId) {
            filtered = filtered.filter(acc => !acc.assignedUserIds || acc.assignedUserIds.length === 0 || acc.assignedUserIds.includes(userId));
        }

        return filtered;
    }, [currentUser, accounts, accessibleProjects, projectId, userRole]);
    const selectedAccount = useMemo(() => accounts.find(a => a.id === accountId), [accounts, accountId]);

    // Kiểm tra quyền tạo thu cho dự án đã chọn
    const selectedProject = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);
    const canCreateIncome = useMemo(() => {
        if (!selectedProject || !currentUser) return false;
        const userId = currentUser?.uid || currentUser?.id;
        return hasProjectPermission(userId, selectedProject, "create_income", currentUser);
    }, [selectedProject, currentUser]);

    // Lấy danh mục thu con từ dự án đã chọn
    const incomeSubCategories = useMemo(() => {
        if (!selectedProject?.incomeSubCategories || selectedProject.incomeSubCategories.length === 0) {
            return [];
        }
        return selectedProject.incomeSubCategories.filter(cat => cat.isActive);
    }, [selectedProject]);

    // Fallback danh mục nếu chưa có sub-categories
    const incomeCategories = useMemo(() => {
        if (incomeSubCategories.length === 0) {
            return INCOME_SOURCES;
        }
        return incomeSubCategories.map(cat => cat.name);
    }, [incomeSubCategories]);

    // Lấy thông tin danh mục cha từ danh mục con đã chọn
    const selectedSubCategory = useMemo(() => {
        return incomeSubCategories.find(cat => cat.name === source);
    }, [incomeSubCategories, source]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [accs, projs] = await Promise.all([getAccounts(), getProjects()]);
            setAccounts(accs); setProjects(projs);
            const categoriesSnap = await getDocs(collection(db, "finance_master_categories"));
            setMasterCategories(categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as MasterCategory)).filter(c => c.isActive));
            await fetchTransactions();
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const fetchTransactions = async () => {
        if (!currentUser) return;
        try {
            const snapshot = await getDocs(collection(db, "finance_transactions"));
            let txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)).filter(t => t.type === "IN");
            // User thường chỉ xem giao dịch của mình, ADMIN xem tất cả
            if (userRole !== "ADMIN") { const userId = currentUser.uid || currentUser.id; txs = txs.filter(t => t.userId === userId); }
            if (activeFilters.startDate) txs = txs.filter(t => t.date.split("T")[0] >= activeFilters.startDate);
            if (activeFilters.endDate) txs = txs.filter(t => t.date.split("T")[0] <= activeFilters.endDate);
            if (activeFilters.date) txs = txs.filter(t => t.date.startsWith(activeFilters.date));
            if (activeFilters.projectId) txs = txs.filter(t => t.projectId === activeFilters.projectId);
            if (activeFilters.accountId) txs = txs.filter(t => t.accountId === activeFilters.accountId);
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                txs = txs.filter(t =>
                    (t.source?.toLowerCase().includes(term)) ||
                    (t.category?.toLowerCase().includes(term)) ||
                    (t.description?.toLowerCase().includes(term))
                );
            }
            txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setTransactions(txs);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { if (!loading) fetchTransactions(); }, [activeFilters, searchTerm]);
    useEffect(() => { if (projectId && selectedAccount?.projectId && selectedAccount.projectId !== projectId) setAccountId(""); }, [projectId]);

    useEffect(() => {
        // Reset source khi chọn dự án mới
        if (projectId && incomeCategories.length > 0) {
            if (!incomeCategories.includes(source)) {
                setSource(incomeCategories[0]);
            }
        }
    }, [projectId, incomeCategories, source]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Kiểm tra quyền trước khi submit
        if (!canCreateIncome) {
            alert("Bạn không có quyền tạo khoản thu trong dự án này");
            return;
        }

        setSubmitting(true);
        try {
            const numAmount = parseFloat(amount);
            const currency = selectedAccount?.currency || "USD";
            const imageUrls: string[] = [];
            if (files.length > 0) { for (const file of files.slice(0, 2)) { imageUrls.push(await uploadImage(file)); } }

            // Lấy thông tin danh mục cha từ sub-category
            const parentCategory = selectedSubCategory?.parentCategoryName || source;
            const parentCategoryId = selectedSubCategory?.parentCategoryId || "";

            await createTransaction({
                type: "IN", amount: numAmount, currency,
                category: source, // Danh mục con
                parentCategory, // Danh mục cha (để thống kê)
                parentCategoryId,
                source, accountId,
                projectId: projectId || undefined, description, date: new Date().toISOString(),
                status: "APPROVED", createdBy: currentUser?.name || currentUser?.displayName || "Unknown",
                userId: currentUser?.id || currentUser?.uid || "unknown", images: imageUrls,
                createdAt: Date.now(), updatedAt: Date.now(),
            });
            await updateAccountBalance(accountId, selectedAccount!.balance + numAmount);
            await fetchData();
            setAmount(""); setDescription(""); setFiles([]); setSource(incomeCategories[0] || "");
            alert("Tạo khoản thu thành công!");
        } catch (e) { console.error(e); alert("Lỗi khi tạo khoản thu"); } finally { setSubmitting(false); }
    };

    const handleAddNewCategory = async () => {
        if (!newCategoryName.trim()) {
            alert("Vui lòng nhập tên danh mục");
            return;
        }

        if (!selectedParentCategoryId) {
            alert("Vui lòng chọn danh mục cha");
            return;
        }

        if (!selectedProject) {
            alert("Vui lòng chọn dự án trước");
            return;
        }

        setSavingCategory(true);
        try {
            const userId = currentUser?.uid || currentUser?.id || "unknown";
            const parentCategory = masterCategories.find(c => c.id === selectedParentCategoryId);

            const newSubCategory: any = {
                id: `income_sub_${Date.now()}`,
                name: newCategoryName.trim(),
                parentCategoryId: selectedParentCategoryId,
                parentCategoryName: parentCategory?.name || "Thu khác",
                type: "INCOME" as const,
                projectId: selectedProject.id,
                isActive: true,
                createdAt: Date.now(),
                createdBy: userId
            };

            const updatedIncomeSubCategories = [
                ...(selectedProject.incomeSubCategories || []),
                newSubCategory
            ];

            await updateProject(selectedProject.id, {
                incomeSubCategories: updatedIncomeSubCategories
            });

            // Refresh data first
            await fetchData();

            // Set source to new category
            const newCatName = newCategoryName.trim();
            setSource(newCatName);
            setNewCategoryName("");
            setSelectedParentCategoryId("");
            setIsAddCategoryModalOpen(false);

            alert("Thêm danh mục thành công!");
        } catch (error) {
            console.error("Failed to add category", error);
            alert("Lỗi khi thêm danh mục");
        } finally {
            setSavingCategory(false);
        }
    };

    const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || "N/A";
    const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || "N/A";

    if (loading) return <div className="p-8 text-[var(--muted)]">Đang tải...</div>;

    const currentStep = !projectId ? 1 : !accountId ? 2 : 3;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
                    <Wallet className="w-6 h-6 text-white" />
                </div>
                <div><h1 className="text-2xl font-bold text-white">Thu tiền</h1><p className="text-sm text-white/50">Quản lý khoản thu</p></div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className={`ml-auto px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${showForm ? "bg-white/10 text-white hover:bg-white/20" : "bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-500/25"}`}
                >
                    {showForm ? "Đóng" : "＋ Tạo khoản thu"}
                </button>
            </div>

            {showForm && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-2 p-4 bg-white/5 rounded-2xl">
                        {[{ step: 1, label: "Dự án", icon: FolderOpen }, { step: 2, label: "Tài khoản", icon: CreditCard }, { step: 3, label: "Chi tiết", icon: Wallet }].map((item, idx) => (
                            <div key={item.step} className="flex items-center flex-1">
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${currentStep >= item.step ? "bg-green-500/20 text-green-400" : "text-white/30"}`}>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentStep >= item.step ? "bg-green-500 text-white" : "bg-white/10"}`}>
                                        {currentStep > item.step ? <Check size={16} /> : <item.icon size={16} />}
                                    </div>
                                    <span className="text-sm font-medium hidden sm:block">{item.label}</span>
                                </div>
                                {idx < 2 && <ChevronRight className="mx-2 text-white/20" size={16} />}
                            </div>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className={`p-5 rounded-2xl border transition-all ${projectId ? "bg-green-500/5 border-green-500/20" : "bg-white/5 border-white/10"}`}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${projectId ? "bg-green-500 text-white" : "bg-green-500/20 text-green-400"}`}>
                                    {projectId ? <Check size={20} /> : <FolderOpen size={20} />}
                                </div>
                                <div><h3 className="font-semibold text-white">Chọn dự án</h3><p className="text-xs text-white/40">Dự án sẽ ghi nhận khoản thu</p></div>
                            </div>
                            <SearchableSelect
                                options={accessibleProjects.map(p => ({
                                    id: p.id,
                                    label: p.name,
                                    subLabel: p.status === "ACTIVE" ? "" : p.status
                                }))}
                                value={projectId}
                                onChange={val => { setProjectId(val); setAccountId(""); }}
                                placeholder="Chọn dự án..."
                                required
                            />
                            {userRole !== "ADMIN" && accessibleProjects.length === 0 && <p className="flex items-center gap-2 mt-2 text-xs text-yellow-400"><AlertCircle size={14} /> Bạn chưa được gán vào dự án nào</p>}
                        </div>

                        {projectId && (
                            <div className={`p-5 rounded-2xl border transition-all ${accountId ? "bg-green-500/5 border-green-500/20" : "bg-white/5 border-white/10"}`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accountId ? "bg-green-500 text-white" : "bg-green-500/20 text-green-400"}`}>
                                        {accountId ? <Check size={20} /> : <CreditCard size={20} />}
                                    </div>
                                    <div><h3 className="font-semibold text-white">Chọn tài khoản nhận</h3><p className="text-xs text-white/40">Tài khoản sẽ cộng tiền</p></div>
                                </div>
                                <SearchableSelect
                                    options={accessibleAccounts.map(acc => ({
                                        id: acc.id,
                                        label: acc.name,
                                        subLabel: `${acc.balance.toLocaleString()} ${acc.currency}`,
                                        icon: CURRENCY_FLAGS[acc.currency]
                                    }))}
                                    value={accountId}
                                    onChange={setAccountId}
                                    placeholder="Chọn tài khoản..."
                                    required
                                />
                                {selectedAccount && <div className="mt-3 p-3 bg-black/20 rounded-xl flex items-center justify-between"><span className="text-sm text-white/60">Số dư hiện tại</span><span className="font-bold text-green-400">{selectedAccount.balance.toLocaleString()} {selectedAccount.currency}</span></div>}
                            </div>
                        )}

                        {accountId && (
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center"><Wallet size={20} /></div>
                                    <div><h3 className="font-semibold text-white">Nhập chi tiết</h3><p className="text-xs text-white/40">Thông tin khoản thu</p></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-white/50 mb-1.5">Số tiền</label>
                                        <CurrencyInput
                                            value={amount}
                                            onChange={setAmount}
                                            currency={selectedAccount?.currency}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/50 mb-1.5">Nguồn tiền</label>
                                        <SearchableSelectWithAdd
                                            options={incomeCategories.map(cat => ({
                                                id: cat,
                                                label: cat
                                            }))}
                                            value={source}
                                            onChange={setSource}
                                            onAddNew={() => setIsAddCategoryModalOpen(true)}
                                            placeholder="Chọn nguồn tiền..."
                                            addNewLabel="➕ Thêm nguồn mới"
                                        />
                                        {incomeCategories.length === 0 && (
                                            <p className="text-xs text-yellow-400 mt-1">
                                                Dự án chưa có danh mục thu. Click "Thêm nguồn mới" để tạo.
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-white/50 mb-1.5">Ảnh đính kèm</label>
                                    <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-white/20 transition-colors">
                                        <Upload size={20} className="text-white/40" />
                                        <span className="text-sm text-white/40">{files.length > 0 ? `${files.length} file đã chọn` : "Chọn ảnh"}</span>
                                        <input type="file" multiple accept="image/*" onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 2))} className="hidden" />
                                    </label>
                                </div>
                                <div>
                                    <label className="block text-xs text-white/50 mb-1.5">Ghi chú</label>
                                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-white focus:border-green-500/50 focus:outline-none" placeholder="Mô tả khoản thu..." />
                                </div>
                                <button type="submit" disabled={submitting || !amount || parseFloat(amount) <= 0} className="w-full p-4 rounded-xl font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 transition-all shadow-lg shadow-green-500/25">
                                    {submitting ? "Đang lưu..." : "Lưu khoản thu"}
                                </button>
                            </div>
                        )}
                        {!projectId && <div className="text-center py-12 text-white/30"><FolderOpen size={48} className="mx-auto mb-3 opacity-50" /><p>Chọn dự án để bắt đầu</p></div>}
                    </form>
                </div>
            )}

            <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                    <DataTableToolbar
                        searchPlaceholder="Tìm kiếm nguồn, nội dung..."
                        onSearch={setSearchTerm}
                        activeFilters={activeFilters}
                        onFilterChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                        enableDateRange={true}
                        onReset={() => {
                            setActiveFilters({ startDate: "", endDate: "", date: "", projectId: "", accountId: "" });
                            setSearchTerm("");
                        }}
                        onExport={() => exportToCSV(transactions, "Thu_Tien", {
                            date: "Ngày",
                            amount: "Số tiền",
                            currency: "Tiền tệ",
                            source: "Nguồn",
                            category: "Hạng mục",
                            description: "Ghi chú"
                        })}
                        filters={[
                            {
                                id: "projectId",
                                label: "Dự án",
                                options: projects.map(p => ({ value: p.id, label: p.name }))
                            },
                            {
                                id: "accountId",
                                label: "Tài khoản",
                                options: accounts.map(a => ({ value: a.id, label: a.name })),
                                advanced: true
                            },
                            {
                                id: "date",
                                label: "Ngày",
                                options: Array.from(new Set(transactions.map(t => t.date.split("T")[0]))).sort().reverse().map(d => ({ value: d, label: d })),
                                advanced: true
                            }
                        ]}
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-black/30 text-white/50 text-xs uppercase">
                            <tr>
                                <th className="p-3">Ngày</th>
                                <th className="p-3">Số tiền</th>
                                <th className="p-3">Nguồn</th>
                                <th className="p-3">Tài khoản</th>
                                <th className="p-3">Dự án</th>
                                <th className="p-3 text-center">Chi tiết</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {transactions.slice(0, 20).map(tx => (
                                <tr
                                    key={tx.id}
                                    className="hover:bg-white/5 transition-colors cursor-pointer"
                                    onClick={() => {
                                        setSelectedTransaction(tx);
                                        setIsDetailModalOpen(true);
                                    }}
                                >
                                    <td className="p-3 text-white/70">{new Date(tx.date).toLocaleDateString('vi-VN')}</td>
                                    <td className="p-3 text-green-400 font-semibold">+{tx.amount.toLocaleString()} {tx.currency}</td>
                                    <td className="p-3 text-white/70">{tx.source || tx.category}</td>
                                    <td className="p-3 text-white/70">{getAccountName(tx.accountId)}</td>
                                    <td className="p-3 text-white/70">{tx.projectId ? getProjectName(tx.projectId) : "-"}</td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedTransaction(tx);
                                                setIsDetailModalOpen(true);
                                            }}
                                            className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-blue-400 transition-colors inline-flex items-center gap-1"
                                            title="Xem chi tiết"
                                        >
                                            <Eye size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-white/30">Chưa có dữ liệu</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Transaction Detail Modal */}
            <TransactionDetailModal
                transaction={selectedTransaction}
                isOpen={isDetailModalOpen}
                onClose={() => {
                    setIsDetailModalOpen(false);
                    setSelectedTransaction(null);
                }}
                accountName={selectedTransaction ? getAccountName(selectedTransaction.accountId) : undefined}
                projectName={selectedTransaction?.projectId ? getProjectName(selectedTransaction.projectId) : undefined}
            />

            {/* Add New Category Modal */}
            {isAddCategoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                        <button
                            onClick={() => {
                                setIsAddCategoryModalOpen(false);
                                setNewCategoryName("");
                            }}
                            className="absolute top-4 right-4 text-[var(--muted)] hover:text-white text-xl"
                        >
                            ✕
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                <Plus size={24} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Thêm nguồn thu mới</h2>
                                <p className="text-sm text-[var(--muted)]">
                                    Dự án: {selectedProject?.name}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">
                                    Danh mục cha <span className="text-red-400">*</span>
                                </label>
                                <select
                                    value={selectedParentCategoryId}
                                    onChange={(e) => setSelectedParentCategoryId(e.target.value)}
                                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white focus:border-green-500/50 focus:outline-none"
                                    required
                                >
                                    <option value="">Chọn danh mục cha...</option>
                                    {masterCategories
                                        .filter(c => c.type === "INCOME")
                                        .map(cat => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white mb-2">
                                    Tên nguồn thu <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    className="glass-input w-full px-4 py-3 rounded-lg"
                                    placeholder="VD: COD Shopee, Chuyển khoản,..."
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && newCategoryName.trim()) {
                                            handleAddNewCategory();
                                        }
                                    }}
                                />
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                <p className="text-xs text-blue-400">
                                    💡 Danh mục này sẽ được thêm vào dự án <strong>{selectedProject?.name}</strong> và có thể sử dụng cho các khoản thu sau.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                            <button
                                onClick={() => {
                                    setIsAddCategoryModalOpen(false);
                                    setNewCategoryName("");
                                }}
                                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleAddNewCategory}
                                disabled={savingCategory || !newCategoryName.trim()}
                                className="glass-button px-6 py-2 rounded-lg text-sm font-bold bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/30 disabled:opacity-50 flex items-center gap-2"
                            >
                                {savingCategory ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                                        Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <Plus size={16} />
                                        Thêm mới
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
