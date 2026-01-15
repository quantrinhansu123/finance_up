"use client";

import { useState, useEffect, useMemo } from "react";
import { createTransaction, getAccounts, updateAccountBalance, getProjects, updateProject } from "@/lib/finance";
import { Account, Project, Transaction, Fund, MasterCategory } from "@/types/finance";
import { uploadImage } from "@/lib/upload";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUserRole, getAccessibleProjects, getAccessibleAccounts, getCategoriesForRole, hasProjectPermission, Role } from "@/lib/permissions";
import { FolderOpen, CreditCard, Receipt, Upload, AlertCircle, Plus } from "lucide-react";
import CurrencyInput from "@/components/finance/CurrencyInput";
import SearchableSelect from "@/components/finance/SearchableSelect";
import SearchableSelectWithAdd from "@/components/finance/SearchableSelectWithAdd";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import TransactionDetailModal from "@/components/finance/TransactionDetailModal";
import { WizardProgress, WizardStepPanel, WizardSummaryItem } from "@/components/finance/TransactionWizard";
import DataTable, { AmountCell, DateCell, TextCell, StatusBadge, ActionCell } from "@/components/finance/DataTable";
import { Eye } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const EXPENSE_CATEGORIES = [
    "Thuế", "Long Heng", "Cước vận chuyển", "Cước vận chuyển HN-HCM", "Cước vận chuyển HCM-HN",
    "SIM", "SIM Smart", "SIM CellCard", "SIM MetPhone", "Văn phòng", "Thuê văn phòng",
    "Mua đồ dùng văn phòng", "Ads", "Marketing", "Lương", "Chi lương nhân viên",
    "Vận hành", "Chuyển nội bộ", "Khác"
];
const CURRENCY_FLAGS: Record<string, string> = { "VND": "🇻🇳", "USD": "🇺🇸", "KHR": "🇰🇭", "TRY": "🇹🇷" };

export default function ExpensePage() {
    const { t } = useTranslation();

    const WIZARD_STEPS = useMemo(() => [
        { id: 1, label: t("project"), icon: FolderOpen, description: t("select_project") },
        { id: 2, label: t("account"), icon: CreditCard, description: t("select_account_expense") },
        { id: 3, label: t("detail"), icon: Receipt, description: t("enter_info") },
    ], [t]);

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
        if (!canCreateExpense) { alert(t("no_create_expense_permission")); return; }
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
            alert(needsApproval ? t("large_expense_warning") : t("create_expense_success"));
        } catch (error) { console.error(error); alert(t("create_expense_error")); }
        finally { setSubmitting(false); }
    };

    const handleAddNewCategory = async () => {
        if (!newCategoryName.trim()) { alert(t("enter_category_name")); return; }
        if (!selectedParentCategoryId) { alert(t("select_parent_category")); return; }
        if (!selectedProject) { alert(t("select_project_first")); return; }
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

    if (loading) return <div className="p-8 text-[var(--muted)]">{t("loading")}</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 shadow-lg shadow-red-500/25">
                    <Receipt className="w-6 h-6 text-white" />
                </div>
                <div><h1 className="text-2xl font-bold text-white">{t("create_expense_transaction")}</h1><p className="text-sm text-white/50">{t("manage_expense")}</p></div>
                <button
                    onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }}
                    className={`ml-auto px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${showForm ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-500/25"}`}
                >
                    {showForm ? t("close") : "－ " + t("create_expense_transaction")}
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
                            title={t("select_project")}
                            description={t("project_expense_desc")}
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
                                placeholder={t("search_projects")}
                                required
                            />
                            {userRole !== "ADMIN" && accessibleProjects.length === 0 && (
                                <p className="flex items-center gap-2 mt-3 text-xs text-yellow-400"><AlertCircle size={14} /> {t("no_assigned_project")}</p>
                            )}
                        </WizardStepPanel>

                        {/* Step 2: Account */}
                        <WizardStepPanel
                            title={t("select_account_expense")}
                            description={t("account_expense_desc")}
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
                                placeholder={t("search_accounts")}
                                required
                            />
                            {selectedAccount && (
                                <div className="mt-3 p-3 bg-black/20 rounded-xl flex items-center justify-between">
                                    <span className="text-sm text-white/60">{t("current_balance")}</span>
                                    <span className={`font-bold ${selectedAccount.balance >= 0 ? "text-green-400" : "text-red-400"}`}>
                                        {selectedAccount.balance.toLocaleString()} {selectedAccount.currency}
                                    </span>
                                </div>
                            )}
                        </WizardStepPanel>

                        {/* Step 3: Details */}
                        <WizardStepPanel
                            title={t("enter_expense_details")}
                            description={t("expense_details_desc")}
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
                                        <WizardSummaryItem label={t("project")} value={selectedProject?.name || ""} icon="📁" />
                                        <WizardSummaryItem label={t("account")} value={selectedAccount?.name || ""} icon="💳" />
                                        <WizardSummaryItem label={t("balance")} value={`${selectedAccount?.balance.toLocaleString()} ${selectedAccount?.currency}`} icon="💰" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-white/50 mb-1.5">{t("amount")} <span className="text-red-400">*</span></label>
                                        <CurrencyInput
                                            value={amount}
                                            onChange={setAmount}
                                            currency={selectedAccount?.currency}
                                            className={isOverBalance ? "border-red-500 focus:border-red-500" : ""}
                                            required
                                        />
                                        {isOverBalance && (
                                            <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                                                <p className="flex items-center gap-2 text-sm text-red-400 font-medium"><AlertCircle size={16} /> {t("exceed_balance_warning")}</p>
                                                <p className="text-xs text-red-400/70 mt-1">{t("balance")}: {selectedAccount?.balance.toLocaleString()} {selectedAccount?.currency} • {t("missing_amount")}: {Math.abs(remainingBalance).toLocaleString()} {selectedAccount?.currency}</p>
                                            </div>
                                        )}
                                        {!isOverBalance && requiresApproval() && (
                                            <p className="flex items-center gap-1 mt-1.5 text-xs text-yellow-400"><AlertCircle size={12} /> {t("large_amount_approval")}</p>
                                        )}
                                        {!isOverBalance && amount && parseFloat(amount) > 0 && (
                                            <p className="mt-1.5 text-xs text-white/40">{t("balance_after_expense")}: <span className={`font-medium ${remainingBalance >= 0 ? "text-green-400" : "text-red-400"}`}>{remainingBalance.toLocaleString()} {selectedAccount?.currency}</span></p>
                                        )}
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs text-white/50 mb-1.5">{t("category")} <span className="text-red-400">*</span></label>
                                            <SearchableSelectWithAdd
                                                options={allowedCategories.map(cat => ({ id: cat, label: cat }))}
                                                value={category}
                                                onChange={setCategory}
                                                onAddNew={() => setIsAddCategoryModalOpen(true)}
                                                placeholder={t("select_source_placeholder")}
                                                addNewLabel={"➕ " + t("add_new_source")}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-white/50 mb-1.5">{t("expense_fund_optional")}</label>
                                            <SearchableSelect
                                                options={funds.map(f => ({ id: f.id, label: f.name }))}
                                                value={fundId}
                                                onChange={setFundId}
                                                placeholder={t("select_fund")}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs text-white/50 mb-1.5">{t("attached_documents")}</label>
                                    <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-red-500/30 hover:bg-red-500/5 transition-colors">
                                        <Upload size={20} className="text-white/40" />
                                        <span className="text-sm text-white/40">{files.length > 0 ? t("files_selected").replace("{count}", files.length.toString()) : t("select_voucher_images").replace("{count}", "2")}</span>
                                        <input type="file" multiple accept="image/*" onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 2))} className="hidden" />
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-xs text-white/50 mb-1.5">{t("description")}</label>
                                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-white focus:border-red-500/50 focus:outline-none" placeholder={t("describe_expense_placeholder")} />
                                </div>

                                <button type="submit" disabled={submitting || !amount || parseFloat(amount) <= 0 || (selectedAccount && parseFloat(amount) > selectedAccount.balance)} className="w-full p-4 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/25 flex items-center justify-center gap-2">
                                    {submitting ? (
                                        <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t("saving")}</>
                                    ) : (
                                        <>✓ {t("save_expense")}</>
                                    )}
                                </button>
                            </div>
                        </WizardStepPanel>
                    </form>
                </div>
            )}

            {/* Transaction History */}
            <div className="space-y-4">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <DataTableToolbar
                        searchPlaceholder={t("search_placeholder")}
                        onSearch={setSearchTerm}
                        activeFilters={activeFilters}
                        onFilterChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                        enableDateRange={true}
                        onReset={() => { setActiveFilters({ startDate: "", endDate: "", date: "", projectId: "", accountId: "", status: "", fundId: "", category: "" }); setSearchTerm(""); }}
                        onExport={() => exportToCSV(transactions, "Chi_Tien", { date: t("date"), amount: t("amount"), currency: t("currency"), category: t("category"), description: t("description"), status: t("status") })}
                        filters={[
                            { id: "status", label: t("status"), options: [{ value: "APPROVED", label: t("approved") }, { value: "PENDING", label: t("pending") }, { value: "REJECTED", label: t("rejected") }] },
                            { id: "projectId", label: t("project"), options: projects.map(p => ({ value: p.id, label: p.name })) },
                            { id: "accountId", label: t("account"), options: accounts.map(a => ({ value: a.id, label: a.name })), advanced: true },
                            { id: "category", label: t("category"), options: Array.from(new Set(transactions.map(t => t.category))).filter(Boolean).map(c => ({ value: c!, label: c! })), advanced: true },
                            { id: "fundId", label: t("expense_fund_optional"), options: funds.map(f => ({ value: f.id, label: f.name })), advanced: true },
                            { id: "date", label: t("date"), options: Array.from(new Set(transactions.map(t => t.date.split("T")[0]))).sort().reverse().map(d => ({ value: d, label: d })), advanced: true }
                        ]}
                    />
                </div>

                <DataTable
                    data={transactions}
                    colorScheme="red"
                    onRowClick={(tx) => { setSelectedTransaction(tx); setIsDetailModalOpen(true); }}
                    emptyMessage={t("no_expense_records")}
                    columns={[
                        {
                            key: "date",
                            header: t("date"),
                            render: (tx) => <DateCell date={tx.date} />
                        },
                        {
                            key: "amount",
                            header: t("amount"),
                            align: "right",
                            render: (tx) => <AmountCell amount={tx.amount} type="OUT" currency={tx.currency} />
                        },
                        {
                            key: "category",
                            header: t("category"),
                            render: (tx) => <TextCell primary={tx.category || ""} secondary={tx.description} />
                        },
                        {
                            key: "account",
                            header: t("account"),
                            render: (tx) => <span className="text-white/70">{getAccountName(tx.accountId)}</span>
                        },
                        {
                            key: "project",
                            header: t("project"),
                            render: (tx) => <span className="text-white/70">{tx.projectId ? getProjectName(tx.projectId) : "-"}</span>
                        },
                        {
                            key: "status",
                            header: t("status"),
                            align: "center",
                            render: (tx) => <StatusBadge status={tx.status} />
                        },
                        {
                            key: "actions",
                            header: t("detail"),
                            align: "center",
                            render: (tx) => (
                                <ActionCell>
                                    <button
                                        onClick={() => { setSelectedTransaction(tx); setIsDetailModalOpen(true); }}
                                        className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-blue-400 transition-colors"
                                    >
                                        <Eye size={16} />
                                    </button>
                                </ActionCell>
                            )
                        }
                    ]}
                />
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
                            <div><h2 className="text-2xl font-bold text-white">{t("add_category")}</h2><p className="text-sm text-[var(--muted)]">{t("project")}: {selectedProject?.name}</p></div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">{t("parent_category")} <span className="text-red-400">*</span></label>
                                <select value={selectedParentCategoryId} onChange={(e) => setSelectedParentCategoryId(e.target.value)} className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white focus:border-red-500/50 focus:outline-none" required>
                                    <option value="">{t("parent_category")}...</option>
                                    {masterCategories.filter(c => c.type === "EXPENSE").map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">{t("category_name")} <span className="text-red-400">*</span></label>
                                <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="glass-input w-full px-4 py-3 rounded-lg" placeholder={t("category_name_placeholder")} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && newCategoryName.trim()) handleAddNewCategory(); }} />
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                <p className="text-xs text-blue-400" dangerouslySetInnerHTML={{ __html: "💡 " + t("add_category_hint").replace("{project}", selectedProject?.name || "") }} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                            <button onClick={() => { setIsAddCategoryModalOpen(false); setNewCategoryName(""); }} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">{t("cancel")}</button>
                            <button onClick={handleAddNewCategory} disabled={savingCategory || !newCategoryName.trim()} className="glass-button px-6 py-2 rounded-lg text-sm font-bold bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30 disabled:opacity-50 flex items-center gap-2">
                                {savingCategory ? (<><div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />{t("saving")}</>) : (<><Plus size={16} />{t("add_new")}</>)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
