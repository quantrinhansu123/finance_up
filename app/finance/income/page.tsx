"use client";

import { useState, useEffect, useMemo } from "react";
import { createTransaction, getAccounts, updateAccountBalance, getProjects, updateProject } from "@/lib/finance";
import { Account, Project, Transaction, MasterCategory, MasterSubCategory } from "@/types/finance";
import { uploadImage } from "@/lib/upload";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUserRole, getAccessibleProjects, getAccessibleAccounts, hasProjectPermission, Role } from "@/lib/permissions";
import { FolderOpen, CreditCard, Wallet, Upload, AlertCircle, Plus, Tag, Layers } from "lucide-react";
import CurrencyInput from "@/components/finance/CurrencyInput";
import SearchableSelect from "@/components/finance/SearchableSelect";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import TransactionDetailModal from "@/components/finance/TransactionDetailModal";
import { WizardProgress, WizardStepPanel, WizardSummaryItem } from "@/components/finance/TransactionWizard";
import DataTable, { AmountCell, DateCell, TextCell, ActionCell } from "@/components/finance/DataTable";
import { Eye, ChevronRight, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const CURRENCY_FLAGS: Record<string, string> = {
    "VND": "🇻🇳", "USD": "🇺🇸", "KHR": "🇰🇭", "TRY": "🇹🇷", "MMK": "🇲🇲", "THB": "🇹🇭", "LAK": "🇱🇦", "MYR": "🇲🇾", "IDR": "🇮🇩", "PHP": "🇵🇭", "SGD": "🇸🇬"
};

export default function IncomePage() {
    const { t } = useTranslation();

    const WIZARD_STEPS = useMemo(() => [
        { id: 1, label: t("project"), icon: FolderOpen, description: t("select_project") },
        { id: 2, label: t("account"), icon: CreditCard, description: t("select_account_income") },
        { id: 3, label: t("detail"), icon: Wallet, description: t("enter_info") },
    ], [t]);

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("USER");
    const [showForm, setShowForm] = useState(false);

    // Wizard step control
    const [wizardStep, setWizardStep] = useState(1);

    const [projectId, setProjectId] = useState("");
    const [accountId, setAccountId] = useState("");
    const [amount, setAmount] = useState("");
    const [source, setSource] = useState("");
    const [parentCategoryId, setParentCategoryId] = useState("");
    const [description, setDescription] = useState("");
    const [paymentType, setPaymentType] = useState<"FULL" | "PARTIAL">("FULL");
    const [files, setFiles] = useState<File[]>([]);

    // Categories
    const [masterCategories, setMasterCategories] = useState<MasterCategory[]>([]);
    const [globalSubCategories, setGlobalSubCategories] = useState<MasterSubCategory[]>([]);

    // Filters
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        startDate: "", endDate: "", date: "", projectId: "", accountId: ""
    });
    const [searchTerm, setSearchTerm] = useState("");

    // Modal state
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    useEffect(() => {
        const u = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (u) { const parsed = JSON.parse(u); setCurrentUser(parsed); setUserRole(getUserRole(parsed)); }
    }, []);

    useEffect(() => { if (currentUser !== null) fetchData(); }, [currentUser]);

    const accessibleProjects = useMemo(() => {
        const userId = currentUser?.uid || currentUser?.id;
        if (!userId) return [];
        const allAccessible = getAccessibleProjects(currentUser, projects);
        return allAccessible.filter(p => hasProjectPermission(userId, p, "create_income", currentUser));
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

    const canCreateIncome = useMemo(() => {
        if (!selectedProject || !currentUser) return false;
        const userId = currentUser?.uid || currentUser?.id;
        return hasProjectPermission(userId, selectedProject, "create_income", currentUser);
    }, [selectedProject, currentUser]);

    // Lọc danh mục con theo danh mục cha đã chọn
    const availableSubCategories = useMemo(() => {
        if (!parentCategoryId) return [];

        // Lấy danh mục con hệ thống
        const systemSubs = globalSubCategories.filter(s => s.parentCategoryId === parentCategoryId && s.isActive);

        // Lấy danh mục con riêng của dự án (nếu có)
        const projectSubs = (selectedProject?.incomeSubCategories || []).filter(s => s.parentCategoryId === parentCategoryId && s.isActive);

        // Gộp lại và loại bỏ trùng tên
        const combined = [...systemSubs, ...projectSubs];
        const unique = Array.from(new Set(combined.map(s => s.name)));
        return unique;
    }, [parentCategoryId, globalSubCategories, selectedProject]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [accs, projs] = await Promise.all([getAccounts(), getProjects()]);
            setAccounts(accs); setProjects(projs);

            const categoriesSnap = await getDocs(collection(db, "finance_master_categories"));
            setMasterCategories(categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as MasterCategory)).filter(c => c.isActive && c.type === "INCOME"));

            const subCategoriesSnap = await getDocs(collection(db, "finance_master_sub_categories"));
            setGlobalSubCategories(subCategoriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as MasterSubCategory)).filter(c => c.isActive));

            await fetchTransactions();
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const fetchTransactions = async () => {
        if (!currentUser) return;
        try {
            const snapshot = await getDocs(collection(db, "finance_transactions"));
            let txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)).filter(t => t.type === "IN");
            if (userRole !== "ADMIN") { const userId = currentUser.uid || currentUser.id; txs = txs.filter(t => t.userId === userId); }
            if (activeFilters.startDate) txs = txs.filter(t => t.date.split("T")[0] >= activeFilters.startDate);
            if (activeFilters.endDate) txs = txs.filter(t => t.date.split("T")[0] <= activeFilters.endDate);
            if (activeFilters.date) txs = txs.filter(t => t.date.startsWith(activeFilters.date));
            if (activeFilters.projectId) txs = txs.filter(t => t.projectId === activeFilters.projectId);
            if (activeFilters.accountId) txs = txs.filter(t => t.accountId === activeFilters.accountId);
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                txs = txs.filter(t => (t.source?.toLowerCase().includes(term)) || (t.category?.toLowerCase().includes(term)) || (t.description?.toLowerCase().includes(term)));
            }
            txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setTransactions(txs);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { if (!loading) fetchTransactions(); }, [activeFilters, searchTerm]);
    useEffect(() => { if (projectId && selectedAccount?.projectId && selectedAccount.projectId !== projectId) setAccountId(""); }, [projectId]);

    // Khi đổi parent category, reset source
    useEffect(() => {
        if (availableSubCategories.length > 0 && !availableSubCategories.includes(source)) {
            setSource(availableSubCategories[0]);
        }
    }, [parentCategoryId, availableSubCategories]);

    // Auto advance wizard step
    useEffect(() => {
        if (projectId && wizardStep === 1) setWizardStep(2);
    }, [projectId]);

    useEffect(() => {
        if (accountId && wizardStep === 2) setWizardStep(3);
    }, [accountId]);

    const resetForm = () => {
        setProjectId(""); setAccountId(""); setAmount(""); setDescription(""); setFiles([]);
        setSource(""); setParentCategoryId(""); setWizardStep(1);
        setPaymentType("FULL");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canCreateIncome) { alert(t("no_create_income_permission")); return; }
        if (!source) { alert("Vui lòng chọn danh mục con"); return; }
        setSubmitting(true);
        try {
            const numAmount = parseFloat(amount);
            const currency = selectedAccount?.currency || "USD";
            const imageUrls: string[] = [];
            if (files.length > 0) { for (const file of files.slice(0, 2)) { imageUrls.push(await uploadImage(file)); } }

            const parentCat = masterCategories.find(c => c.id === parentCategoryId);
            const parentCategoryName = parentCat?.name || "";

            await createTransaction({
                type: "IN", amount: numAmount, currency, category: source,
                parentCategory: parentCategoryName, parentCategoryId,
                source, accountId, projectId: projectId || undefined, description, date: new Date().toISOString(),
                status: "APPROVED", createdBy: currentUser?.name || currentUser?.displayName || "Unknown",
                userId: currentUser?.id || currentUser?.uid || "unknown", images: imageUrls,
                paymentType,
                createdAt: Date.now(), updatedAt: Date.now(),
            });
            await updateAccountBalance(accountId, selectedAccount!.balance + numAmount);
            await fetchData();
            resetForm();
            setShowForm(false);
            alert(t("create_income_success"));
        } catch (e) { console.error(e); alert(t("create_income_error")); } finally { setSubmitting(false); }
    };

    const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || "N/A";
    const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || "N/A";

    if (loading) return <div className="p-8 text-[var(--muted)]">{t("loading")}</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
                    <Wallet className="w-6 h-6 text-white" />
                </div>
                <div><h1 className="text-2xl font-bold text-white">{t("income")}</h1><p className="text-sm text-white/50">{t("manage_income")}</p></div>
                <button
                    onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }}
                    className={`ml-auto px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${showForm ? "bg-white/10 text-white hover:bg-white/20" : "bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-500/25"}`}
                >
                    {showForm ? t("close") : "＋ " + t("create_income_transaction")}
                </button>
            </div>

            {/* Wizard Form */}
            {showForm && (
                <div className="glass-card p-6 rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
                    <WizardProgress steps={WIZARD_STEPS} currentStep={wizardStep} />

                    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                        {/* Step 1: Project */}
                        <WizardStepPanel
                            isActive={wizardStep === 1}
                            title={t("project")}
                            description={t("select_project")}
                            icon={FolderOpen}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {accessibleProjects.map(p => (
                                    <button
                                        key={p.id} type="button" onClick={() => setProjectId(p.id)}
                                        className={`p-4 rounded-xl border text-left transition-all group ${projectId === p.id ? "bg-green-500/20 border-green-500/50 shadow-lg shadow-green-500/10" : "bg-white/5 border-white/10 hover:border-white/25"}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                <FolderOpen className={projectId === p.id ? "text-green-400" : "text-[var(--muted)]"} />
                                            </div>
                                            {projectId === p.id && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                                        </div>
                                        <h3 className="font-bold text-white truncate">{p.name}</h3>
                                        <p className="text-xs text-[var(--muted)] mt-1">{p.id}</p>
                                    </button>
                                ))}
                            </div>
                        </WizardStepPanel>

                        {/* Step 2: Account */}
                        <WizardStepPanel
                            isActive={wizardStep === 2}
                            title={t("account")}
                            description={t("select_account_income")}
                            icon={CreditCard}
                        >
                            {!projectId ? (
                                <div className="p-12 text-center text-[var(--muted)] border border-dashed border-white/10 rounded-2xl">
                                    <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                    <p>{t("select_project_first")}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {accessibleAccounts.map(acc => (
                                        <button
                                            key={acc.id} type="button" onClick={() => setAccountId(acc.id)}
                                            className={`p-4 rounded-xl border text-left transition-all group ${accountId === acc.id ? "bg-green-500/20 border-green-500/50 shadow-lg shadow-green-500/10" : "bg-white/5 border-white/10 hover:border-white/25"}`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                                                        <CreditCard className={accountId === acc.id ? "text-green-400" : "text-[var(--muted)]"} />
                                                    </div>
                                                    <span className="text-xl">{CURRENCY_FLAGS[acc.currency] || "💰"}</span>
                                                </div>
                                                {accountId === acc.id && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                                            </div>
                                            <h3 className="font-bold text-white truncate">{acc.name}</h3>
                                            <p className="text-sm font-bold text-green-400 mt-1">{new Intl.NumberFormat().format(acc.balance)} <span className="text-[10px] opacity-70 uppercase">{acc.currency}</span></p>
                                        </button>
                                    ))}
                                    {accessibleAccounts.length === 0 && (
                                        <div className="col-span-full p-8 text-center text-[var(--muted)]">
                                            <p>{t("no_data")}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </WizardStepPanel>

                        {/* Step 3: Details */}
                        <WizardStepPanel
                            isActive={wizardStep === 3}
                            title={t("detail")}
                            description={t("enter_info")}
                            icon={Wallet}
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <label className="block text-sm font-bold text-[var(--muted)] uppercase tracking-wider">{t("amount")} ({selectedAccount?.currency})</label>
                                            <CurrencyInput
                                                value={amount}
                                                onChange={setAmount}
                                                className="glass-input text-2xl font-bold py-4 px-6 rounded-2xl w-full border-green-500/30 text-green-400 focus:scale-[1.02] transition-transform"
                                                placeholder="0"
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <label className="block text-sm font-bold text-[var(--muted)] uppercase tracking-wider">{t("category_master")}</label>
                                            <SearchableSelect
                                                options={masterCategories.map(cat => ({ id: cat.id, label: cat.name }))}
                                                value={parentCategoryId}
                                                onChange={setParentCategoryId}
                                                placeholder={t("select_master_category")}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <label className="block text-sm font-bold text-[var(--muted)] uppercase tracking-wider">{t("source")}</label>
                                            <SearchableSelect
                                                options={availableSubCategories.map(cat => ({ id: cat, label: cat }))}
                                                value={source}
                                                onChange={setSource}
                                                placeholder={parentCategoryId ? t("select_sub_category") : t("select_master_category")}
                                                disabled={!parentCategoryId}
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <label className="block text-sm font-bold text-[var(--muted)] uppercase tracking-wider">{t("description")}</label>
                                            <input
                                                type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                                                className="glass-input w-full p-3.5 rounded-xl border-white/10"
                                                placeholder={t("describe_income_placeholder")}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="block text-sm font-bold text-[var(--muted)] uppercase tracking-wider">{t("payment_type")}</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setPaymentType("FULL")}
                                                className={`p-3 rounded-xl border font-bold transition-all flex items-center justify-center gap-2 ${paymentType === "FULL" ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-white/5 border-white/10 text-[var(--muted)] hover:text-white"}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentType === "FULL" ? "border-green-400" : "border-white/20"}`}>
                                                    {paymentType === "FULL" && <div className="w-2 h-2 rounded-full bg-green-400" />}
                                                </div>
                                                {t("full_payment")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPaymentType("PARTIAL")}
                                                className={`p-3 rounded-xl border font-bold transition-all flex items-center justify-center gap-2 ${paymentType === "PARTIAL" ? "bg-orange-500/20 border-orange-500/50 text-orange-400" : "bg-white/5 border-white/10 text-[var(--muted)] hover:text-white"}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentType === "PARTIAL" ? "border-orange-400" : "border-white/20"}`}>
                                                    {paymentType === "PARTIAL" && <div className="w-2 h-2 rounded-full bg-orange-400" />}
                                                </div>
                                                {t("partial_payment")}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="block text-sm font-bold text-[var(--muted)] uppercase tracking-wider">{t("attached_images")}</label>
                                        <div className="flex flex-wrap gap-4">
                                            {files.map((file, i) => (
                                                <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden group border border-white/10 shadow-lg hover:border-red-500/50 transition-colors">
                                                    <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="preview" />
                                                    <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 p-1 bg-red-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                                                </div>
                                            ))}
                                            {files.length < 2 && (
                                                <label className="w-24 h-24 rounded-xl border-2 border-dashed border-white/10 hover:border-green-500/50 hover:bg-green-500/5 flex flex-col items-center justify-center cursor-pointer transition-all group">
                                                    <Upload size={24} className="text-[var(--muted)] group-hover:text-green-400 transition-colors" />
                                                    <span className="text-[10px] text-[var(--muted)] mt-2">{t("upload")}</span>
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files) setFiles([...files, ...Array.from(e.target.files)].slice(0, 2)); }} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-1 border-l border-white/10 pl-8 space-y-6">
                                    <h3 className="font-bold text-white uppercase tracking-widest text-sm">{t("summary")}</h3>
                                    <div className="space-y-4">
                                        <WizardSummaryItem label={t("project")} value={getProjectName(projectId)} icon="📁" />
                                        <WizardSummaryItem label={t("account")} value={getAccountName(accountId)} icon="💳" />
                                        <WizardSummaryItem label={t("category")} value={masterCategories.find(c => c.id === parentCategoryId)?.name || t("unselected")} icon="🗂️" />
                                        <WizardSummaryItem label={t("source")} value={source || t("unselected")} icon="🏷️" />
                                        <WizardSummaryItem label={t("payment_type")} value={paymentType === "FULL" ? t("full_payment") : t("partial_payment")} icon="💰" />
                                        <div className="pt-4 border-t border-white/10">
                                            <p className="text-xs text-[var(--muted)] uppercase font-bold mb-1">{t("amount")}</p>
                                            <p className="text-3xl font-black text-green-400">{new Intl.NumberFormat().format(parseFloat(amount) || 0)} <span className="text-sm font-medium opacity-60">{selectedAccount?.currency}</span></p>
                                        </div>
                                    </div>

                                    <div className="pt-6 flex gap-3">
                                        <button type="button" onClick={() => setWizardStep(1)} className="flex-1 py-3 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold transition-all active:scale-95">{t("cancel")}</button>
                                        <button
                                            type="submit" disabled={submitting || !amount || !accountId || !projectId || !source}
                                            className="flex-[2] py-3 px-6 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold shadow-lg shadow-green-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                                        >
                                            {submitting ? t("processing") : t("save")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </WizardStepPanel>
                    </form>
                </div>
            )}

            {/* Detail Modal */}

            {/* List Header */}
            <div className="space-y-4">
                <DataTableToolbar
                    searchPlaceholder={t("search")}
                    onSearch={setSearchTerm}
                    activeFilters={activeFilters}
                    onFilterChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                    onReset={() => {
                        setActiveFilters({ startDate: "", endDate: "", date: "", projectId: "", accountId: "" });
                        setSearchTerm("");
                    }}
                    onExport={() => exportToCSV(transactions, "Giao_Dich_Thu_Nhap", {
                        date: t("date"),
                        source: t("source"),
                        amount: t("amount"),
                        currency: t("currency"),
                        accountName: t("account"),
                        projectName: t("project"),
                        description: t("description")
                    })}
                    filters={[
                        { id: "projectId", label: t("all_projects"), options: [{ value: "", label: t("all_projects") }, ...projects.map(p => ({ value: p.id, label: p.name }))] },
                        { id: "accountId", label: t("all_accounts"), options: [{ value: "", label: t("all_accounts") }, ...accounts.map(a => ({ value: a.id, label: a.name }))] }
                    ]}
                    enableDateRange={true}
                />

                <DataTable
                    data={transactions}
                    columns={[
                        {
                            key: "date",
                            header: t("date"),
                            render: (tx: Transaction) => <DateCell date={tx.date} />
                        },
                        {
                            key: "source",
                            header: t("source"),
                            render: (tx: Transaction) => (
                                <div className="space-y-0.5">
                                    <p className="font-bold text-white">{tx.source || tx.category}</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] text-[var(--muted)] uppercase tracking-tight">{tx.parentCategory || "N/A"}</p>
                                        {tx.paymentType && (
                                            <span className={`text-[8px] font-bold px-1 rounded uppercase ${tx.paymentType === "FULL" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                                                {tx.paymentType === "FULL" ? "FULL" : "PART"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        },
                        {
                            key: "amount",
                            header: t("amount"),
                            align: "right",
                            render: (tx: Transaction) => (
                                <AmountCell amount={tx.amount} currency={tx.currency} type="IN" />
                            )
                        },
                        {
                            key: "accountName",
                            header: t("account"),
                            render: (tx: Transaction) => (
                                <div className="flex items-center gap-2">
                                    <span className="text-base">{CURRENCY_FLAGS[tx.currency] || "💰"}</span>
                                    <TextCell primary={getAccountName(tx.accountId || "")} />
                                </div>
                            )
                        },
                        {
                            key: "projectName",
                            header: t("project"),
                            render: (tx: Transaction) => <TextCell primary={getProjectName(tx.projectId || "")} />
                        },
                        {
                            key: "actions",
                            header: t("actions"),
                            align: "right",
                            render: (tx: Transaction) => (
                                <ActionCell>
                                    <button
                                        onClick={() => { setSelectedTransaction(tx); setIsDetailModalOpen(true); }}
                                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--muted)] hover:text-white transition-all transform active:scale-90"
                                    >
                                        <Eye size={18} />
                                    </button>
                                </ActionCell>
                            )
                        }
                    ]}
                    onRowClick={(tx) => { setSelectedTransaction(tx); setIsDetailModalOpen(true); }}
                />
            </div>

            {selectedTransaction && (
                <TransactionDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    transaction={selectedTransaction}
                    projectName={getProjectName(selectedTransaction.projectId || "")}
                    accountName={getAccountName(selectedTransaction.accountId || "")}
                />
            )}
        </div>
    );
}
