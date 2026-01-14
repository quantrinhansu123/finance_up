"use client";

import { useState, useEffect, useMemo } from "react";
import { createTransaction, getAccounts, updateAccountBalance, getProjects, updateProject } from "@/lib/finance";
import { Account, Project, Transaction, Fund, MasterCategory } from "@/types/finance";
import { uploadImage } from "@/lib/upload";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUserRole, getAccessibleProjects, getAccessibleAccounts, getCategoriesForRole, hasProjectPermission, Role } from "@/lib/permissions";
import { FolderOpen, CreditCard, Receipt, Upload, AlertCircle, Plus, Eye } from "lucide-react";
import CurrencyInput from "@/components/finance/CurrencyInput";
import SearchableSelect from "@/components/finance/SearchableSelect";
import SearchableSelectWithAdd from "@/components/finance/SearchableSelectWithAdd";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import TransactionDetailModal from "@/components/finance/TransactionDetailModal";
import { WizardProgress, WizardStepPanel, WizardSummaryItem } from "@/components/finance/TransactionWizard";

const EXPENSE_CATEGORIES = [
    "Thuế", "Long Heng", "Cước vận chuyển", "Cước vận chuyển HN-HCM", "Cước vận chuyển HCM-HN",
    "SIM", "SIM Smart", "SIM CellCard", "SIM MetPhone", "Văn phòng", "Thuê văn phòng",
    "Mua đồ dùng văn phòng", "Ads", "Marketing", "Lương", "Chi lương nhân viên",
    "Vận hành", "Chuyển nội bộ", "Khác"
];
const CURRENCY_FLAGS: Record<string, string> = { "VND": "🇻🇳", "USD": "🇺🇸", "KHR": "🇰🇭", "TRY": "🇹🇷" };

const WIZARD_STEPS = [
    { id: 1, label: "Dự án", icon: FolderOpen, description: "Chọn dự án" },
    { id: 2, label: "Tài khoản", icon: CreditCard, description: "Chọn tài khoản" },
    { id: 3, label: "Chi tiết", icon: Receipt, description: "Nhập thông tin" },
];

export default function ExpensePage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [funds, setFunds] = useState<Fund[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("USER");
    const [showForm, setShowForm] = useState(false);

    // Wizard step control
    const [wizardStep, setWizardStep] = useState(1);

    // Form State
    const [projectId, setProjectId] = useState("");
    const [accountId, setAccountId] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
    const [fundId, setFundId] = useState("");
    const [description, setDescription] = useState("");
    const [files, setFiles] = useState<File[]>([]);

    // Filters
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        startDate: "", endDate: "", date: "", projectId: "", accountId: "", status: "", fundId: "", category: ""
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

    const accessibleProjects = useMemo(() => {
        const userId = currentUser?.uid || currentUser?.id;
        if (!userId) return [];
        const allAccessible = getAccessibleProjects(currentUser, projects);
        return allAccessible.filter(p => hasProjectPermission(userId, p, "create_expense", currentUser));
    }, [currentUser, projects]);

    const accessibleAccounts = useMemo(() => {
        let filtered = getAccessibleAccounts(currentUser, accounts, accessibleProjects.map(p => p.id));
        const userId = currentUser?.uid || currentUser?.id;
        if (projectId) filtered = filtered.filter(acc => acc.projectId === projectId);
        if (userRole === "ADMIN") return filtered;
        if (userId) filtered = filtered.filter(acc => !acc.assignedUserIds || acc.assignedUserIds.length === 0 || acc.assignedUserIds.includes(userId));
        return filtered;
    }, [currentUser, accounts, accessibleProjects, projectId, userRole]);

    const selectedAccount = useMemo(() => accounts.find(a => a.id === accountId), [accounts, accountId]);
    const selectedProject = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

    const canCreateExpense = useMemo(() => {
        if (!selectedProject || !currentUser) return false;
        const userId = currentUser?.uid || currentUser?.id;
        return hasProjectPermission(userId, selectedProject, "create_expense", currentUser);
    }, [selectedProject, currentUser]);

    const expenseSubCategories = useMemo(() => {
        if (!selectedProject?.expenseSubCategories || selectedProject.expenseSubCategories.length === 0) return [];
        return selectedProject.expenseSubCategories.filter(cat => cat.isActive);
    }, [selectedProject]);

    const expenseCategories = useMemo(() => {
        if (expenseSubCategories.length === 0) return EXPENSE_CATEGORIES;
        return expenseSubCategories.map(cat => cat.name);
    }, [expenseSubCategories]);

    const selectedSubCategory = useMemo(() => {
        return expenseSubCategories.find(cat => cat.name === category);
    }, [expenseSubCategories, category]);

    const allowedCategories = useMemo(() => {
        if (expenseSubCategories.length > 0) return expenseCategories;
        const roleCategories = getCategoriesForRole(userRole, expenseCategories);
        if (selectedAccount?.allowedCategories && selectedAccount.allowedCategories.length > 0) {
            return roleCategories.filter(cat => selectedAccount.allowedCategories!.includes(cat));
        }
        return roleCategories;
    }, [userRole, selectedAccount, expenseCategories, expenseSubCategories]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [accs, projs] = await Promise.all([getAccounts(), getProjects()]);
            setAccounts(accs); setProjects(projs);
            const fundsSnap = await getDocs(collection(db, "finance_funds"));
            setFunds(fundsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Fund)));
            const categoriesSnap = await getDocs(collection(db, "finance_master_categories"));
            setMasterCategories(categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as MasterCategory)).filter(c => c.isActive));
            await fetchTransactions();
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const fetchTransactions = async () => {
        if (!currentUser) return;
        try {
            const snapshot = await getDocs(collection(db, "finance_transactions"));
            let txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)).filter(t => t.type === "OUT");
            if (userRole !== "ADMIN") { const userId = currentUser.uid || currentUser.id; txs = txs.filter(t => t.userId === userId); }
            if (activeFilters.startDate) txs = txs.filter(t => t.date.split("T")[0] >= activeFilters.startDate);
            if (activeFilters.endDate) txs = txs.filter(t => t.date.split("T")[0] <= activeFilters.endDate);
            if (activeFilters.date) txs = txs.filter(t => t.date.startsWith(activeFilters.date));
            if (activeFilters.projectId) txs = txs.filter(t => t.projectId === activeFilters.projectId);
            if (activeFilters.accountId) txs = txs.filter(t => t.accountId === activeFilters.accountId);
            if (activeFilters.status) txs = txs.filter(t => t.status === activeFilters.status);
            if (activeFilters.fundId) txs = txs.filter(t => t.fundId === activeFilters.fundId);
            if (activeFilters.category) txs = txs.filter(t => t.category === activeFilters.category);
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                txs = txs.filter(t => (t.category?.toLowerCase().includes(term)) || (t.description?.toLowerCase().includes(term)));
            }
            txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setTransactions(txs);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { if (!loading) fetchTransactions(); }, [activeFilters, searchTerm]);
    useEffect(() => { if (projectId && selectedAccount?.projectId && selectedAccount.projectId !== projectId) setAccountId(""); }, [projectId]);
    useEffect(() => {
        if (selectedAccount?.allowedCategories && selectedAccount.allowedCategories.length > 0) {
            if (!selectedAccount.allowedCategories.includes(category)) setCategory(selectedAccount.allowedCategories[0]);
        } else if (allowedCategories.length > 0 && !allowedCategories.includes(category)) {
            setCategory(allowedCategories[0]);
        }
    }, [selectedAccount, allowedCategories, category]);

    // Auto advance wizard step
    useEffect(() => { if (projectId && wizardStep === 1) setWizardStep(2); }, [projectId]);
    useEffect(() => { if (accountId && wizardStep === 2) setWizardStep(3); }, [accountId]);

    const requiresApproval = () => {
        const numAmount = parseFloat(amount) || 0;
        const cur = selectedAccount?.currency || "USD";
        if (cur === "VND" && numAmount > 5000000) return true;
        if ((cur === "USD" || cur === "KHR" || cur === "TRY") && numAmount > 100) return true;
        return false;
    };

    const isOverBalance = useMemo(() => {
        const numAmount = parseFloat(amount) || 0;
        if (!selectedAccount || numAmount <= 0) return false;
        return numAmount > selectedAccount.balance;
    }, [amount, selectedAccount]);

    const remainingBalance = useMemo(() => {
        const numAmount = parseFloat(amount) || 0;
        if (!selectedAccount) return 0;
        return selectedAccount.balance - numAmount;
    }, [amount, selectedAccount]);

    const resetForm = () => {
        setProjectId(""); setAccountId(""); setAmount(""); setCategory(EXPENSE_CATEGORIES[0]);
        setFundId(""); setDescription(""); setFiles([]); setWizardStep(1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canCreateExpense) { alert("Bạn không có quyền tạo khoản chi trong dự án này"); return; }
        setSubmitting(true);
        try {
            const numAmount = parseFloat(amount);
            const currency = selectedAccount?.currency || "USD";
            const needsApproval = requiresApproval();
            const status = needsApproval ? "PENDING" : "APPROVED";
            const imageUrls: string[] = [];
            if (files.length > 0) { for (const file of files.slice(0, 2)) { imageUrls.push(await uploadImage(file)); } }
            const parentCategory = selectedSubCategory?.parentCategoryName || category;
            const parentCategoryId = selectedSubCategory?.parentCategoryId || "";

            await createTransaction({
                type: "OUT", amount: numAmount, currency, category, parentCategory, parentCategoryId,
                fundId: fundId || undefined, accountId, projectId: projectId || undefined, description,
                date: new Date().toISOString(), status, warning: needsApproval,
                createdBy: currentUser?.name || currentUser?.displayName || "Unknown",
                userId: currentUser?.id || currentUser?.uid || "unknown", images: imageUrls,
                createdAt: Date.now(), updatedAt: Date.now(),
            });

            if (status === "APPROVED") {
                const account = accounts.find(a => a.id === accountId);
                if (account) await updateAccountBalance(accountId, account.balance - numAmount);
            }

            resetForm();
            fetchTransactions();
            alert(needsApproval ? "⚠️ Khoản chi lớn - Đã chuyển sang CHỜ DUYỆT" : "✓ Đã thêm khoản chi thành công!");
        } catch (error) { console.error(error); alert("Lỗi khi thêm khoản chi"); }
        finally { setSubmitting(false); }
    };

    const handleAddNewCategory = async () => {
        if (!newCategoryName.trim()) { alert("Vui lòng nhập tên danh mục"); return; }
        if (!selectedParentCategoryId) { alert("Vui lòng chọn danh mục cha"); return; }
        if (!selectedProject) { alert("Vui lòng chọn dự án trước"); return; }
        setSavingCategory(true);
        try {
            const userId = currentUser?.uid || currentUser?.id || "unknown";
            const parentCategory = masterCategories.find(c => c.id === selectedParentCategoryId);
            const newSubCategory: any = {
                id: `expense_sub_${Date.now()}`, name: newCategoryName.trim(),
                parentCategoryId: selectedParentCategoryId, parentCategoryName: parentCategory?.name || "Chi khác",
                type: "EXPENSE" as const, projectId: selectedProject.id, isActive: true, createdAt: Date.now(), createdBy: userId
            };
            const updatedExpenseSubCategories = [...(selectedProject.expenseSubCategories || []), newSubCategory];
            await updateProject(selectedProject.id, { expenseSubCategories: updatedExpenseSubCategories });
            await fetchData();
            setCategory(newCategoryName.trim());
            setNewCategoryName(""); setSelectedParentCategoryId(""); setIsAddCategoryModalOpen(false);
            alert("Thêm danh mục thành công!");
        } catch (error) { console.error("Failed to add category", error); alert("Lỗi khi thêm danh mục"); }
        finally { setSavingCategory(false); }
    };

    const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || "-";
    const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || "-";

    if (loading) return <div className="p-8 text-[var(--muted)]">Đang tải...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 shadow-lg shadow-red-500/25">
                    <Receipt className="w-6 h-6 text-white" />
                </div>
                <div><h1 className="text-2xl font-bold text-white">Chi tiền</h1><p className="text-sm text-white/50">Quản lý khoản chi</p></div>
                <button
                    onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }}
                    className={`ml-auto px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${showForm ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-500/25"}`}
                >
                    {showForm ? "Đóng" : "＋ Tạo khoản chi"}
                </button>
            </div>

            {/* Wizard Form */}
            {showForm && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    {/* Progress Steps */}
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                        <WizardProgress steps={WIZARD_STEPS} currentStep={wizardStep} colorScheme="red" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Step 1: Project */}
                        <WizardStepPanel
                            title="Chọn dự án"
                            description="Dự án sẽ ghi nhận khoản chi"
                            icon={FolderOpen}
                            isActive={wizardStep === 1}
                            isCompleted={wizardStep > 1}
                            colorScheme="red"
                            summary={selectedProject?.name}
                            onNext={() => projectId && setWizardStep(2)}
                            nextDisabled={!projectId}
                            onEdit={() => setWizardStep(1)}
                        >
                            <SearchableSelect
                                options={accessibleProjects.map(p => ({ id: p.id, label: p.name, subLabel: p.status === "ACTIVE" ? "" : p.status }))}
                                value={projectId}
                                onChange={val => { setProjectId(val); setAccountId(""); }}
                                placeholder="Tìm và chọn dự án..."
                                required
                            />
                            {userRole !== "ADMIN" && accessibleProjects.length === 0 && (
                                <p className="flex items-center gap-2 mt-3 text-xs text-yellow-400"><AlertCircle size={14} /> Bạn chưa được gán vào dự án nào</p>
                            )}
                        </WizardStepPanel>

                        {/* Step 2: Account */}
                        <WizardStepPanel
                            title="Chọn tài khoản chi"
                            description="Tài khoản sẽ trừ tiền"
                            icon={CreditCard}
                            isActive={wizardStep === 2}
                            isCompleted={wizardStep > 2}
                            colorScheme="red"
                            summary={selectedAccount && `${selectedAccount.name} • ${selectedAccount.balance.toLocaleString()} ${selectedAccount.currency}`}
                            onNext={() => accountId && setWizardStep(3)}
                            onBack={() => setWizardStep(1)}
                            showBack={true}
                            nextDisabled={!accountId}
                            onEdit={() => setWizardStep(2)}
                        >
                            <SearchableSelect
                                options={accessibleAccounts.map(acc => ({
                                    id: acc.id, label: acc.name,
                                    subLabel: `${acc.balance.toLocaleString()} ${acc.currency}`,
                                    icon: CURRENCY_FLAGS[acc.currency]
                                }))}
                                value={accountId}
                                onChange={setAccountId}
                                placeholder="Tìm và chọn tài khoản..."
                                required
                            />
                            {selectedAccount && (
                                <div className="mt-3 p-3 bg-black/20 rounded-xl flex items-center justify-between">
                                    <span className="text-sm text-white/60">Số dư hiện tại</span>
                                    <span className={`font-bold ${selectedAccount.balance >= 0 ? "text-green-400" : "text-red-400"}`}>
                                        {selectedAccount.balance.toLocaleString()} {selectedAccount.currency}
                                    </span>
                                </div>
                            )}
                        </WizardStepPanel>

                        {/* Step 3: Details */}
                        <WizardStepPanel
                            title="Nhập chi tiết khoản chi"
                            description="Thông tin số tiền và hạng mục"
                            icon={Receipt}
                            isActive={wizardStep === 3}
                            colorScheme="red"
                            onBack={() => setWizardStep(2)}
                            showBack={true}
                            isLastStep={true}
                        >
                            <div className="space-y-4">
                                {/* Summary of previous steps */}
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <div className="flex flex-wrap gap-4 text-sm">
                                        <WizardSummaryItem label="Dự án" value={selectedProject?.name || ""} icon="📁" />
                                        <WizardSummaryItem label="Tài khoản" value={selectedAccount?.name || ""} icon="💳" />
                                        <WizardSummaryItem label="Số dư" value={`${selectedAccount?.balance.toLocaleString()} ${selectedAccount?.currency}`} icon="💰" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-white/50 mb-1.5">Số tiền <span className="text-red-400">*</span></label>
                                        <CurrencyInput
                                            value={amount}
                                            onChange={setAmount}
                                            currency={selectedAccount?.currency}
                                            className={isOverBalance ? "border-red-500 focus:border-red-500" : ""}
                                            required
                                        />
                                        {isOverBalance && (
                                            <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                                                <p className="flex items-center gap-2 text-sm text-red-400 font-medium"><AlertCircle size={16} /> Vượt quá số dư tài khoản!</p>
                                                <p className="text-xs text-red-400/70 mt-1">Số dư: {selectedAccount?.balance.toLocaleString()} {selectedAccount?.currency} • Thiếu: {Math.abs(remainingBalance).toLocaleString()} {selectedAccount?.currency}</p>
                                            </div>
                                        )}
                                        {!isOverBalance && requiresApproval() && (
                                            <p className="flex items-center gap-1 mt-1.5 text-xs text-yellow-400"><AlertCircle size={12} /> Số tiền lớn - Cần Admin duyệt</p>
                                        )}
                                        {!isOverBalance && amount && parseFloat(amount) > 0 && (
                                            <p className="mt-1.5 text-xs text-white/40">Số dư sau chi: <span className={`font-medium ${remainingBalance >= 0 ? "text-green-400" : "text-red-400"}`}>{remainingBalance.toLocaleString()} {selectedAccount?.currency}</span></p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/50 mb-1.5">Hạng mục <span className="text-red-400">*</span></label>
                                        <SearchableSelectWithAdd
                                            options={allowedCategories.map(cat => ({ id: cat, label: cat }))}
                                            value={category}
                                            onChange={setCategory}
                                            onAddNew={() => setIsAddCategoryModalOpen(true)}
                                            placeholder="Chọn hạng mục..."
                                            addNewLabel="➕ Thêm hạng mục mới"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs text-white/50 mb-1.5">Quỹ chi (tùy chọn)</label>
                                    <select value={fundId} onChange={e => setFundId(e.target.value)} className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-white focus:border-red-500/50 focus:outline-none">
                                        <option value="">Không chọn</option>
                                        {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs text-white/50 mb-1.5">Chứng từ đính kèm</label>
                                    <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-red-500/30 hover:bg-red-500/5 transition-colors">
                                        <Upload size={20} className="text-white/40" />
                                        <span className="text-sm text-white/40">{files.length > 0 ? `${files.length} file đã chọn` : "Chọn ảnh chứng từ (tối đa 2)"}</span>
                                        <input type="file" multiple accept="image/*" onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 2))} className="hidden" />
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-xs text-white/50 mb-1.5">Ghi chú</label>
                                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-white focus:border-red-500/50 focus:outline-none" placeholder="Mô tả khoản chi..." />
                                </div>

                                <button type="submit" disabled={submitting || !amount || parseFloat(amount) <= 0} className="w-full p-4 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/25 flex items-center justify-center gap-2">
                                    {submitting ? (
                                        <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang lưu...</>
                                    ) : (
                                        <>✓ Hoàn tất - Lưu khoản chi</>
                                    )}
                                </button>
                            </div>
                        </WizardStepPanel>
                    </form>
                </div>
            )}

            {/* Transaction History */}
            <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                    <DataTableToolbar
                        searchPlaceholder="Tìm kiếm hạng mục, nội dung..."
                        onSearch={setSearchTerm}
                        activeFilters={activeFilters}
                        onFilterChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                        enableDateRange={true}
                        onReset={() => { setActiveFilters({ startDate: "", endDate: "", date: "", projectId: "", accountId: "", status: "", fundId: "", category: "" }); setSearchTerm(""); }}
                        onExport={() => exportToCSV(transactions, "Chi_Tien", { date: "Ngày", amount: "Số tiền", currency: "Tiền tệ", category: "Tiêu đề", description: "Ghi chú", status: "Trạng thái" })}
                        filters={[
                            { id: "status", label: "Trạng thái", options: [{ value: "APPROVED", label: "Đã duyệt" }, { value: "PENDING", label: "Chờ duyệt" }, { value: "REJECTED", label: "Từ chối" }] },
                            { id: "projectId", label: "Dự án", options: projects.map(p => ({ value: p.id, label: p.name })) },
                            { id: "accountId", label: "Tài khoản", options: accounts.map(a => ({ value: a.id, label: a.name })), advanced: true },
                            { id: "category", label: "Hạng mục", options: Array.from(new Set(transactions.map(t => t.category))).filter(Boolean).map(c => ({ value: c!, label: c! })), advanced: true },
                            { id: "fundId", label: "Quỹ chi", options: funds.map(f => ({ value: f.id, label: f.name })), advanced: true },
                            { id: "date", label: "Ngày", options: Array.from(new Set(transactions.map(t => t.date.split("T")[0]))).sort().reverse().map(d => ({ value: d, label: d })), advanced: true }
                        ]}
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-black/30 text-white/50 text-xs uppercase">
                            <tr>
                                <th className="p-3">Ngày</th>
                                <th className="p-3">Số tiền</th>
                                <th className="p-3">Hạng mục</th>
                                <th className="p-3">Tài khoản</th>
                                <th className="p-3">Dự án</th>
                                <th className="p-3">Trạng thái</th>
                                <th className="p-3 text-center">Chi tiết</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {transactions.slice(0, 20).map(tx => (
                                <tr key={tx.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => { setSelectedTransaction(tx); setIsDetailModalOpen(true); }}>
                                    <td className="p-3 text-white/70">{new Date(tx.date).toLocaleDateString('vi-VN')}</td>
                                    <td className="p-3 text-red-400 font-semibold">-{tx.amount.toLocaleString()} {tx.currency}</td>
                                    <td className="p-3 text-white/70">{tx.category}</td>
                                    <td className="p-3 text-white/70">{getAccountName(tx.accountId)}</td>
                                    <td className="p-3 text-white/70">{tx.projectId ? getProjectName(tx.projectId) : "-"}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${tx.status === "APPROVED" ? "bg-green-500/20 text-green-400" : tx.status === "PENDING" ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                                            {tx.status === "APPROVED" ? "Đã duyệt" : tx.status === "PENDING" ? "Chờ duyệt" : "Từ chối"}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button onClick={(e) => { e.stopPropagation(); setSelectedTransaction(tx); setIsDetailModalOpen(true); }} className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-blue-400 transition-colors" title="Xem chi tiết">
                                            <Eye size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-white/30">Chưa có dữ liệu</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Transaction Detail Modal */}
            <TransactionDetailModal
                transaction={selectedTransaction}
                isOpen={isDetailModalOpen}
                onClose={() => { setIsDetailModalOpen(false); setSelectedTransaction(null); }}
                accountName={selectedTransaction ? getAccountName(selectedTransaction.accountId) : undefined}
                projectName={selectedTransaction?.projectId ? getProjectName(selectedTransaction.projectId) : undefined}
            />

            {/* Add New Category Modal */}
            {isAddCategoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                        <button onClick={() => { setIsAddCategoryModalOpen(false); setNewCategoryName(""); }} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white text-xl">✕</button>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center"><Plus size={24} className="text-white" /></div>
                            <div><h2 className="text-2xl font-bold text-white">Thêm hạng mục chi mới</h2><p className="text-sm text-[var(--muted)]">Dự án: {selectedProject?.name}</p></div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">Danh mục cha <span className="text-red-400">*</span></label>
                                <select value={selectedParentCategoryId} onChange={(e) => setSelectedParentCategoryId(e.target.value)} className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white focus:border-red-500/50 focus:outline-none" required>
                                    <option value="">Chọn danh mục cha...</option>
                                    {masterCategories.filter(c => c.type === "EXPENSE").map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">Tên hạng mục <span className="text-red-400">*</span></label>
                                <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="glass-input w-full px-4 py-3 rounded-lg" placeholder="VD: Thuê văn phòng, Marketing,..." autoFocus onKeyDown={(e) => { if (e.key === "Enter" && newCategoryName.trim()) handleAddNewCategory(); }} />
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                <p className="text-xs text-blue-400">💡 Danh mục này sẽ được thêm vào dự án <strong>{selectedProject?.name}</strong> và có thể sử dụng cho các khoản chi sau.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                            <button onClick={() => { setIsAddCategoryModalOpen(false); setNewCategoryName(""); }} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">Hủy</button>
                            <button onClick={handleAddNewCategory} disabled={savingCategory || !newCategoryName.trim()} className="glass-button px-6 py-2 rounded-lg text-sm font-bold bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30 disabled:opacity-50 flex items-center gap-2">
                                {savingCategory ? (<><div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />Đang lưu...</>) : (<><Plus size={16} />Thêm mới</>)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
