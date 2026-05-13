"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createTransaction, getAccounts, updateAccountBalance, getProjects, getTransactions, updateTransaction, deleteTransaction } from "@/lib/finance";
import { getMasterCategories, getMasterSubCategories } from "@/lib/master-categories";
import { Account, Project, Transaction, MasterCategory, MasterSubCategory, PaidConfirmMeta } from "@/types/finance";
import { uploadImage } from "@/lib/upload";
import { getUserRole, getAccessibleProjects, getAccessibleAccounts, hasProjectPermission, Role } from "@/lib/permissions";
import { FolderOpen, CreditCard, Wallet, Upload, AlertCircle, Plus, Tag, Layers, Eye, Edit2, Trash2, ChevronRight, X } from "lucide-react";
import CurrencyInput from "@/components/finance/CurrencyInput";
import SearchableSelect from "@/components/finance/SearchableSelect";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import TransactionDetailModal from "@/components/finance/TransactionDetailModal";
import { WizardProgress, WizardStepPanel, WizardSummaryItem } from "@/components/finance/TransactionWizard";
import DataTable, { AmountCell, DateCell, TextCell, ActionCell } from "@/components/finance/DataTable";
import { useTranslation } from "@/lib/i18n";
import { projectLabelById, formatProjectListLabel, formatProjectMaLan } from "@/lib/project-display";
import { incomeMatchesDateRange, incomePrimarySortDay } from "@/lib/income-dates";
import { getUsers } from "@/lib/users";
import { UserProfile } from "@/types/user";

const CURRENCY_FLAGS: Record<string, string> = {
    "VND": "🇻🇳", "USD": "🇺🇸", "KHR": "🇰🇭", "TRY": "🇹🇷", "MMK": "🇲🇲", "THB": "🇹🇭", "LAK": "🇱🇦", "MYR": "🇲🇾", "IDR": "🇮🇩", "PHP": "🇵🇭", "SGD": "🇸🇬"
};
const MAX_BILL_IMAGES = 10;

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
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [viewableProjectIds, setViewableProjectIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<{
        uid?: string;
        id?: string;
        role?: string;
        projectIds?: string[];
        email?: string;
        displayName?: string;
        name?: string;
    } | null>(null);
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
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [editAmount, setEditAmount] = useState("");
    const [editSource, setEditSource] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editSaving, setEditSaving] = useState(false);
    const [markPaidTx, setMarkPaidTx] = useState<Transaction | null>(null);
    const [markPaidFiles, setMarkPaidFiles] = useState<File[]>([]);
    const [markPaidSubmitting, setMarkPaidSubmitting] = useState(false);
    const skipNextTransactionsFilterEffectRef = useRef(false);

    useEffect(() => {
        const u = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (u) { const parsed = JSON.parse(u); setCurrentUser(parsed); setUserRole(getUserRole(parsed)); }
    }, []);

    useEffect(() => { if (currentUser !== null) fetchData(); }, [currentUser]);

    useEffect(() => {
        setSelectedTransaction((prev) => {
            if (!prev) return prev;
            const next = transactions.find((x) => x.id === prev.id);
            return next ?? prev;
        });
    }, [transactions]);

    const accessibleProjects = useMemo(() => {
        const userId = currentUser?.uid || currentUser?.id;
        if (!userId) return [];
        const allAccessible = getAccessibleProjects(currentUser, projects);
        return allAccessible.filter(p => hasProjectPermission(userId, p, "create_income", currentUser));
    }, [currentUser, projects]);

    const accessibleAccounts = useMemo(() => {
        let filtered = getAccessibleAccounts(currentUser, accounts, accessibleProjects.map(p => p.id));
        // Only show accounts assigned to the selected project (no shared accounts here)
        if (projectId) filtered = filtered.filter(acc => acc.projectId === projectId);
        else filtered = [];
        return filtered;
    }, [currentUser, accounts, accessibleProjects, projectId, userRole]);

    const selectedAccount = useMemo(() => accounts.find(a => a.id === accountId), [accounts, accountId]);
    const selectedProject = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

    const canCreateIncome = useMemo(() => {
        if (!selectedProject || !currentUser) return false;
        const userId = currentUser?.uid || currentUser?.id;
        if (!userId) return false;
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

    const computeViewableProjectIds = (projs: Project[]): string[] => {
        const userId = currentUser?.uid || currentUser?.id;
        if (!userId) return [];
        if (userRole === "ADMIN") return projs.map((p) => p.id);
        return getAccessibleProjects(currentUser, projs)
            .filter((p) => hasProjectPermission(userId, p, "view_transactions", currentUser))
            .map((p) => p.id);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [accs, projs, cats, subs, users] = await Promise.all([
                getAccounts(),
                getProjects(),
                getMasterCategories(),
                getMasterSubCategories(),
                getUsers(),
            ]);
            setAccounts(accs);
            setProjects(projs);
            setMasterCategories(cats.filter((c) => c.isActive && c.type === "INCOME"));
            setGlobalSubCategories(subs.filter((c) => c.isActive));
            setAllUsers(users);
            const ids = computeViewableProjectIds(projs);
            setViewableProjectIds(ids);

            await fetchTransactions(ids);
            skipNextTransactionsFilterEffectRef.current = true;
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const fetchTransactions = async (idsOverride?: string[]) => {
        if (!currentUser) return;
        try {
            const all = await getTransactions();
            let txs = all.filter((t) => t.type === "IN");
            if (userRole !== "ADMIN") {
                const userId = currentUser.uid || currentUser.id;
                const ids = idsOverride ?? viewableProjectIds;
                txs = txs.filter(t =>
                    (t.projectId && ids.includes(t.projectId)) ||
                    t.userId === userId
                );
            }
            if (activeFilters.startDate || activeFilters.endDate) {
                txs = txs.filter((t) =>
                    incomeMatchesDateRange(t, activeFilters.startDate || "", activeFilters.endDate || "")
                );
            }
            if (activeFilters.date) {
                const d = activeFilters.date;
                txs = txs.filter((t) => {
                    const onPosted = t.date.startsWith(d);
                    const onActual =
                        t.status === "PAID" &&
                        !!t.paidConfirmMeta?.at &&
                        t.paidConfirmMeta.at.startsWith(d);
                    return onPosted || onActual;
                });
            }
            if (activeFilters.projectId) txs = txs.filter(t => t.projectId === activeFilters.projectId);
            if (activeFilters.accountId) txs = txs.filter(t => t.accountId === activeFilters.accountId);
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                txs = txs.filter(t => (t.source?.toLowerCase().includes(term)) || (t.category?.toLowerCase().includes(term)) || (t.description?.toLowerCase().includes(term)));
            }
            txs.sort(
                (a, b) =>
                    new Date(incomePrimarySortDay(b)).getTime() - new Date(incomePrimarySortDay(a)).getTime()
            );
            setTransactions(txs);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (loading || !currentUser) return;
        if (skipNextTransactionsFilterEffectRef.current) {
            skipNextTransactionsFilterEffectRef.current = false;
            return;
        }
        void fetchTransactions();
    }, [activeFilters, searchTerm, viewableProjectIds.join("|"), loading, currentUser, userRole]);
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
    const handlePasteImages = (e: React.ClipboardEvent) => {
        const pastedImages = Array.from(e.clipboardData.items)
            .filter((item) => item.type.startsWith("image/"))
            .map((item) => item.getAsFile())
            .filter((f): f is File => !!f);
        if (pastedImages.length === 0) return;
        e.preventDefault();
        setFiles((prev) => [...prev, ...pastedImages].slice(0, MAX_BILL_IMAGES));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canCreateIncome) { alert(t("no_create_income_permission")); return; }
        if (availableSubCategories.length > 0 && !source) { alert("Vui lòng chọn danh mục con"); return; }
        setSubmitting(true);
        try {
            const numAmount = parseFloat(amount);
            const currency = selectedAccount?.currency || "USD";
            const imageUrls: string[] = [];
            if (files.length > 0) {
                for (const file of files.slice(0, MAX_BILL_IMAGES)) {
                    imageUrls.push(await uploadImage(file));
                }
            }

            const parentCat = masterCategories.find(c => c.id === parentCategoryId);
            const parentCategoryName = parentCat?.name || "";
            const finalSource = source || parentCategoryName || t("unselected");

            const uid = currentUser?.uid || currentUser?.id;
            await createTransaction({
                type: "IN", amount: numAmount, currency, category: finalSource,
                parentCategory: parentCategoryName, parentCategoryId,
                source: finalSource, accountId, projectId: projectId || undefined, description, date: new Date().toISOString(),
                status: "APPROVED", createdBy: uid || "",
                userId: uid || "", images: imageUrls,
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

    const openMarkPaidModal = (tx: Transaction) => {
        if (tx.type !== "IN" || tx.status === "PAID") return;
        setMarkPaidTx(tx);
        setMarkPaidFiles([]);
    };

    const closeMarkPaidModal = () => {
        setMarkPaidTx(null);
        setMarkPaidFiles([]);
        setMarkPaidSubmitting(false);
    };

    const handleMarkPaidPaste = (e: React.ClipboardEvent) => {
        const pastedImages = Array.from(e.clipboardData.items)
            .filter((item) => item.type.startsWith("image/"))
            .map((item) => item.getAsFile())
            .filter((f): f is File => !!f);
        if (pastedImages.length === 0) return;
        e.preventDefault();
        setMarkPaidFiles((prev) => [...prev, ...pastedImages].slice(0, MAX_BILL_IMAGES));
    };

    const handleConfirmMarkPaid = async () => {
        if (!markPaidTx) return;
        const loginLabel =
            [currentUser?.displayName, currentUser?.name, currentUser?.email]
                .map((s) => (typeof s === "string" ? s.trim() : ""))
                .find(Boolean) || "";
        if (!loginLabel) {
            alert("Phiên đăng nhập không có tên/email để ghi nhận. Vui lòng đăng nhập lại.");
            return;
        }
        const existing = Array.isArray(markPaidTx.images) ? markPaidTx.images.length : 0;
        if (existing === 0 && markPaidFiles.length === 0) {
            alert("Vui lòng tải ít nhất một ảnh chứng từ.");
            return;
        }
        if (!confirm("Xác nhận đã thu và lưu ảnh chứng từ?")) return;

        setMarkPaidSubmitting(true);
        try {
            const uploaded =
                markPaidFiles.length > 0
                    ? await Promise.all(markPaidFiles.slice(0, MAX_BILL_IMAGES).map((f) => uploadImage(f)))
                    : [];
            const merged = Array.from(new Set([...(markPaidTx.images || []), ...uploaded]));
            const meta: PaidConfirmMeta = { at: new Date().toISOString(), byName: loginLabel };
            await updateTransaction(markPaidTx.id, {
                status: "PAID",
                images: merged,
                paidConfirmMeta: meta,
            });
            await fetchData();
            closeMarkPaidModal();
        } catch (e) {
            console.error(e);
            alert("Lỗi khi cập nhật. Kiểm tra đã chạy migration cột paid_confirm_meta (jsonb) chưa.");
        } finally {
            setMarkPaidSubmitting(false);
        }
    };

    const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || "N/A";
    const userNameById = useMemo(() => {
        const m = new Map<string, string>();
        for (const u of allUsers) {
            const label = u.displayName || u.email || u.uid;
            m.set(u.uid, label);
            if (u.email) m.set(u.email, label);
        }
        return m;
    }, [allUsers]);
    const resolveUserName = (idOrName?: string) => {
        if (!idOrName) return "-";
        return userNameById.get(idOrName) || idOrName;
    };

    /** Tổng các phiếu thu đang hiển thị (theo bộ lọc / tìm kiếm), gom theo từng loại tiền — không cộng chéo tiền tệ khác nhau. */
    const filteredIncomeTotals = useMemo(() => {
        const byCurrency = new Map<string, number>();
        let count = 0;
        for (const tx of transactions) {
            if (tx.type !== "IN") continue;
            count += 1;
            const cur = tx.currency || "USD";
            byCurrency.set(cur, (byCurrency.get(cur) || 0) + Number(tx.amount || 0));
        }
        const rows = [...byCurrency.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        return { count, rows };
    }, [transactions]);

    /** Không sửa/xóa sau khi đã xác nhận Đã thu (PAID). */
    const canModifyIncomeTransaction = (tx: Transaction) => tx.status !== "PAID";

    const openEditModal = (tx: Transaction) => {
        if (!canModifyIncomeTransaction(tx)) {
            alert(t("cannot_modify_approved_transaction"));
            return;
        }
        setEditingTransaction(tx);
        setEditAmount(String(tx.amount || ""));
        setEditSource(tx.source || tx.category || "");
        setEditDescription(tx.description || "");
    };

    const closeEditModal = () => {
        setEditingTransaction(null);
        setEditAmount("");
        setEditSource("");
        setEditDescription("");
    };

    const handleSaveEdit = async () => {
        if (!editingTransaction) return;
        if (editingTransaction.status === "PAID") {
            alert(t("cannot_modify_approved_transaction"));
            return;
        }
        const newAmount = parseFloat(editAmount);
        if (!Number.isFinite(newAmount) || newAmount <= 0) {
            alert("Số tiền không hợp lệ");
            return;
        }

        setEditSaving(true);
        try {
            const oldAmount = Number(editingTransaction.amount || 0);
            const delta = newAmount - oldAmount;
            const account = accounts.find(a => a.id === editingTransaction.accountId);

            await updateTransaction(editingTransaction.id, {
                amount: newAmount,
                source: editSource.trim() || editingTransaction.source || editingTransaction.category,
                category: editSource.trim() || editingTransaction.category,
                description: editDescription.trim(),
            });

            if (account && delta !== 0) {
                await updateAccountBalance(account.id, account.balance + delta);
            }

            await fetchData();
            closeEditModal();
        } catch (e) {
            console.error(e);
            alert("Lỗi khi cập nhật giao dịch");
        } finally {
            setEditSaving(false);
        }
    };

    const handleDeleteTransaction = async (tx: Transaction) => {
        if (!canModifyIncomeTransaction(tx)) {
            alert(t("cannot_modify_approved_transaction"));
            return;
        }
        if (!confirm("Bạn có chắc muốn xóa giao dịch này?")) return;
        try {
            const account = accounts.find(a => a.id === tx.accountId);
            // Reverse credited income from account balance before deleting.
            if ((tx.status === "APPROVED" || tx.status === "PAID") && account) {
                await updateAccountBalance(account.id, account.balance - Number(tx.amount || 0));
            }
            await deleteTransaction(tx.id);
            await fetchData();
        } catch (e) {
            console.error(e);
            alert("Lỗi khi xóa giao dịch");
        }
    };

    if (loading) return <div className="p-8 text-[var(--muted)]">{t("loading")}</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
                    <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">{t("income")}</h1>
                    <p className="text-xs sm:text-sm text-white/50">{t("manage_income")}</p>
                </div>
                <div className="ml-auto flex items-center gap-2 sm:gap-3">
                    <button
                        onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }}
                        className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 ${showForm ? "bg-white/10 text-white hover:bg-white/20" : "bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-500/25"}`}
                    >
                        {showForm ? t("close") : "＋ " + t("create_income_transaction")}
                    </button>
                </div>
            </div>

            {/* Wizard Form */}
            {showForm && (
                <div className="glass-card p-4 sm:p-6 rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
                    <WizardProgress steps={WIZARD_STEPS} currentStep={wizardStep} />

                    <form onSubmit={handleSubmit} onPaste={handlePasteImages} className="mt-6 sm:mt-8 space-y-6">
                        {/* Step 1: Project */}
                        <WizardStepPanel
                            isActive={wizardStep === 1}
                            title={t("project")}
                            description={t("select_project")}
                            icon={FolderOpen}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                {accessibleProjects.map(p => (
                                    <button
                                        key={p.id} type="button" onClick={() => setProjectId(p.id)}
                                        className={`p-3 sm:p-4 rounded-xl border text-left transition-all group ${projectId === p.id ? "bg-green-500/20 border-green-500/50 shadow-lg shadow-green-500/10" : "bg-white/5 border-white/10 hover:border-white/25"}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/10 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
                                                <FolderOpen className={`w-4 h-4 sm:w-5 sm:h-5 ${projectId === p.id ? "text-green-400" : "text-[var(--muted)]"}`} />
                                            </div>
                                            {projectId === p.id && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                                        </div>
                                        <h3 className="text-sm sm:text-base font-bold text-white truncate">{formatProjectMaLan(p)}</h3>
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    {accessibleAccounts.map(acc => (
                                        <button
                                            key={acc.id} type="button" onClick={() => setAccountId(acc.id)}
                                            className={`p-3 sm:p-4 rounded-xl border text-left transition-all group ${accountId === acc.id ? "bg-green-500/20 border-green-500/50 shadow-lg shadow-green-500/10" : "bg-white/5 border-white/10 hover:border-white/25"}`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/10 flex items-center justify-center">
                                                        <CreditCard className={`w-4 h-4 sm:w-5 sm:h-5 ${accountId === acc.id ? "text-green-400" : "text-[var(--muted)]"}`} />
                                                    </div>
                                                    <span className="text-lg sm:text-xl">{CURRENCY_FLAGS[acc.currency] || "💰"}</span>
                                                </div>
                                                {accountId === acc.id && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                                            </div>
                                            <h3 className="text-sm sm:text-base font-bold text-white truncate">{acc.name}</h3>
                                            <p className="text-xs sm:text-sm font-bold text-green-400 mt-1">{new Intl.NumberFormat("vi-VN").format(acc.balance)} <span className="text-[10px] opacity-70 uppercase">{acc.currency}</span></p>
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
                                                currency={selectedAccount?.currency || "USD"}
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
                                        <label className="block text-sm font-bold text-[var(--muted)] uppercase tracking-wider">
                                            Tải bill ({files.length}/{MAX_BILL_IMAGES})
                                        </label>
                                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer w-fit transition-colors">
                                            <Upload size={18} className="text-green-400" />
                                            <span className="text-sm font-semibold text-white">Tải bill (nhiều ảnh)</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                className="hidden"
                                                onChange={(e) => {
                                                    const next = e.currentTarget.files;
                                                    if (!next) return;
                                                    setFiles((prev) => [...prev, ...Array.from(next)].slice(0, MAX_BILL_IMAGES));
                                                }}
                                            />
                                        </label>
                                        <div className="flex flex-wrap gap-4">
                                            {files.map((file, i) => (
                                                <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden group border border-white/10 shadow-lg hover:border-red-500/50 transition-colors">
                                                    <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="preview" />
                                                    <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 p-1 bg-red-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                                                </div>
                                            ))}
                                            {files.length < MAX_BILL_IMAGES && (
                                                <label className="w-24 h-24 rounded-xl border-2 border-dashed border-white/10 hover:border-green-500/50 hover:bg-green-500/5 flex flex-col items-center justify-center cursor-pointer transition-all group">
                                                    <Upload size={24} className="text-[var(--muted)] group-hover:text-green-400 transition-colors" />
                                                    <span className="text-[10px] text-[var(--muted)] mt-2">Tải bill / Ctrl+V</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const next = e.currentTarget.files;
                                                            if (!next) return;
                                                            setFiles((prev) => [...prev, ...Array.from(next)].slice(0, MAX_BILL_IMAGES));
                                                        }}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-1 border-l border-white/10 pl-8 space-y-6">
                                    <h3 className="font-bold text-white uppercase tracking-widest text-sm">{t("summary")}</h3>
                                    <div className="space-y-4">
                                        <WizardSummaryItem label={t("project")} value={projectLabelById(projects, projectId)} icon="📁" />
                                        <WizardSummaryItem label={t("account")} value={getAccountName(accountId)} icon="💳" />
                                        <WizardSummaryItem label={t("category")} value={masterCategories.find(c => c.id === parentCategoryId)?.name || t("unselected")} icon="🗂️" />
                                        <WizardSummaryItem label={t("source")} value={source || t("unselected")} icon="🏷️" />
                                        <WizardSummaryItem label={t("payment_type")} value={paymentType === "FULL" ? t("full_payment") : t("partial_payment")} icon="💰" />
                                        <div className="pt-4 border-t border-white/10">
                                            <p className="text-xs text-[var(--muted)] uppercase font-bold mb-1">{t("amount")}</p>
                                            <p className="text-3xl font-black text-green-400">{new Intl.NumberFormat("vi-VN").format(parseFloat(amount) || 0)} <span className="text-sm font-medium opacity-60">{selectedAccount?.currency}</span></p>
                                        </div>
                                    </div>

                                    <div className="pt-6 flex gap-3">
                                        <button type="button" onClick={() => setWizardStep(1)} className="flex-1 py-3 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold transition-all active:scale-95">{t("cancel")}</button>
                                        <button
                                            type="submit" disabled={submitting || !amount || !accountId || !projectId || (!source && availableSubCategories.length > 0)}
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
                    onExport={() => exportToCSV(
                        transactions.map(tx => ({
                            date: tx.date?.slice(0, 10) || "",
                            parentCategory: tx.parentCategory || "",
                            category: tx.category || tx.source || "",
                            amount: tx.amount,
                            currency: tx.currency,
                            accountName: getAccountName(tx.accountId || ""),
                            projectName: projectLabelById(projects, tx.projectId || ""),
                            description: tx.description || "",
                        })),
                        "Giao_Dich_Thu_Nhap",
                        {
                            date: "Ngày",
                            parentCategory: "Danh Mục Cha",
                            category: "Danh Mục Chi Tiết",
                            amount: "Số Tiền",
                            currency: "Tiền tệ",
                            accountName: "Tài khoản",
                            projectName: "Dự án",
                            description: "Mô tả"
                        }
                    )}
                    filters={[
                        { id: "projectId", label: t("all_projects"), options: [{ value: "", label: t("all_projects") }, ...projects.map(p => ({ value: p.id, label: formatProjectListLabel(p) }))] },
                        { id: "accountId", label: t("all_accounts"), options: [{ value: "", label: t("all_accounts") }, ...accounts.map(a => ({ value: a.id, label: a.name }))] }
                    ]}
                    enableDateRange={true}
                />

                {filteredIncomeTotals.count > 0 && (
                    <div className="glass-card rounded-xl border border-white/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
                        <p className="text-[var(--muted)]">
                            Số phiếu thu:{" "}
                            <span className="text-white font-bold tabular-nums">{filteredIncomeTotals.count}</span>
                            <span className="text-white/40 mx-2">·</span>
                            <span className="text-white/60 text-xs">Theo bộ lọc / tìm kiếm hiện tại</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <span className="text-[var(--muted)] text-xs uppercase tracking-wider shrink-0">Tổng tiền</span>
                            {filteredIncomeTotals.rows.map(([cur, sum]) => (
                                <span
                                    key={cur}
                                    className="font-bold text-green-400 whitespace-nowrap tabular-nums"
                                >
                                    {CURRENCY_FLAGS[cur] || "💰"}{" "}
                                    {new Intl.NumberFormat("vi-VN").format(sum)}{" "}
                                    <span className="text-[10px] font-semibold uppercase opacity-80">{cur}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <DataTable
                    data={transactions}
                    nowrapRows
                    columns={[
                        {
                            key: "date",
                            header: t("date"),
                            render: (tx: Transaction) => <DateCell date={tx.date} />
                        },
                        {
                            key: "paidAt",
                            header: "Ngày thu thực tế",
                            render: (tx: Transaction) =>
                                tx.status === "PAID" && tx.paidConfirmMeta?.at ? (
                                    <span className="text-xs text-purple-200/95 whitespace-nowrap">
                                        {new Date(tx.paidConfirmMeta.at).toLocaleString("vi-VN")}
                                    </span>
                                ) : (
                                    <span className="text-white/25 text-xs">—</span>
                                ),
                        },
                        {
                            key: "source",
                            header: t("source"),
                            render: (tx: Transaction) => (
                                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                                    <span className="font-bold text-white">{tx.source || tx.category}</span>
                                    <span className="text-[10px] text-[var(--muted)] uppercase tracking-tight">· {tx.parentCategory || "N/A"}</span>
                                    {tx.paymentType && (
                                        <span className={`text-[8px] font-bold px-1 rounded uppercase shrink-0 ${tx.paymentType === "FULL" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                                            {tx.paymentType === "FULL" ? "FULL" : "PART"}
                                        </span>
                                    )}
                                </span>
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
                                    <TextCell primary={getAccountName(tx.accountId || "")} nowrap />
                                </div>
                            )
                        },
                        {
                            key: "projectName",
                            header: t("project"),
                            render: (tx: Transaction) => <TextCell primary={projectLabelById(projects, tx.projectId || "")} nowrap />
                        },
                        {
                            key: "creator",
                            header: t("creator") || "Người nhập",
                            render: (tx: Transaction) => (
                                <span className="text-xs text-white/70 whitespace-nowrap">{resolveUserName(tx.createdBy)}</span>
                            )
                        },
                        {
                            key: "status",
                            header: t("status"),
                            render: (tx: Transaction) => {
                                if (tx.status === "PAID") {
                                    return (
                                        <span className="px-2 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/20">
                                            Đã thu
                                        </span>
                                    );
                                }
                                return <span className="text-white/25 text-xs">—</span>;
                            }
                        },
                        {
                            key: "actions",
                            header: t("actions"),
                            align: "right",
                            render: (tx: Transaction) => (
                                <ActionCell nowrap>
                                    <button
                                        onClick={() => { setSelectedTransaction(tx); setIsDetailModalOpen(true); }}
                                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--muted)] hover:text-white transition-all transform active:scale-90"
                                    >
                                        <Eye size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openMarkPaidModal(tx)}
                                        disabled={tx.status === "PAID"}
                                        className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-purple-500/15 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-purple-300 transition-all transform active:scale-90 disabled:opacity-40"
                                        title="Mở form tải ảnh và xác nhận Đã thu"
                                    >
                                        Đã thu
                                    </button>
                                    {canModifyIncomeTransaction(tx) && (
                                        <button
                                            onClick={() => openEditModal(tx)}
                                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--muted)] hover:text-amber-300 transition-all transform active:scale-90"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                    {canModifyIncomeTransaction(tx) && (
                                        <button
                                            onClick={() => handleDeleteTransaction(tx)}
                                            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-[var(--muted)] hover:text-red-400 transition-all transform active:scale-90"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
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
                    projectName={projectLabelById(projects, selectedTransaction.projectId || "")}
                    accountName={getAccountName(selectedTransaction.accountId || "")}
                />
            )}

            {editingTransaction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md rounded-2xl border border-white/20 p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Sửa giao dịch thu</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm text-[var(--muted)] mb-1">{t("amount")}</label>
                                <CurrencyInput value={editAmount} onChange={setEditAmount} currency={editingTransaction.currency || "USD"} />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--muted)] mb-1">{t("source")}</label>
                                <input value={editSource} onChange={(e) => setEditSource(e.target.value)} className="glass-input w-full p-2 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--muted)] mb-1">{t("description")}</label>
                                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="glass-input w-full p-2 rounded-lg" rows={3} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={closeEditModal} className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-[var(--muted)] hover:text-white">
                                    {t("cancel")}
                                </button>
                                <button type="button" onClick={handleSaveEdit} disabled={editSaving} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50">
                                    {editSaving ? t("processing") : t("save")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {markPaidTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onPaste={handleMarkPaidPaste}>
                    <div className="glass-card w-full max-w-lg rounded-2xl border border-white/20 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">Xác nhận Đã thu</h3>
                            <button type="button" onClick={closeMarkPaidModal} className="text-[var(--muted)] hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-xs text-[var(--muted)] mb-4">
                            Tải ảnh chứng từ (bắt buộc nếu giao dịch chưa có ảnh). Có thể chọn nhiều ảnh hoặc dán Ctrl+V. Tối đa {MAX_BILL_IMAGES} ảnh.
                        </p>
                        {markPaidTx.images && markPaidTx.images.length > 0 && (
                            <div className="mb-4">
                                <p className="text-[10px] font-bold text-white/50 uppercase mb-2">Ảnh hiện có ({markPaidTx.images.length})</p>
                                <div className="flex flex-wrap gap-2">
                                    {markPaidTx.images.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3 mb-4">
                            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors">
                                <Upload size={18} className="text-purple-400" />
                                <span className="text-sm font-semibold text-white">Thêm ảnh</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        const next = e.currentTarget.files;
                                        if (!next) return;
                                        setMarkPaidFiles((prev) => [...prev, ...Array.from(next)].slice(0, MAX_BILL_IMAGES));
                                    }}
                                />
                            </label>
                            <span className="text-xs text-white/60">Mới: {markPaidFiles.length}/{MAX_BILL_IMAGES}</span>
                        </div>
                        {markPaidFiles.length > 0 && (
                            <div className="flex flex-wrap gap-3 mb-5">
                                {markPaidFiles.map((file, i) => (
                                    <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/10">
                                        <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="preview" />
                                        <button
                                            type="button"
                                            onClick={() => setMarkPaidFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                            className="absolute top-1 right-1 p-1 bg-red-500 rounded-lg text-white"
                                            title="Xóa"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={closeMarkPaidModal}
                                className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-[var(--muted)] hover:text-white"
                            >
                                {t("cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmMarkPaid}
                                disabled={
                                    markPaidSubmitting ||
                                    ((markPaidTx.images?.length || 0) === 0 && markPaidFiles.length === 0)
                                }
                                className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold disabled:opacity-50"
                            >
                                {markPaidSubmitting ? t("processing") : "Xác nhận Đã thu"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
