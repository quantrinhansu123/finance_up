"use client";

import { useState, useEffect, useMemo } from "react";
import { createTransaction, getAccounts, updateAccountBalance, getProjects } from "@/lib/finance";
import { Account, Currency, Project, Transaction } from "@/types/finance";
import { uploadImage } from "@/lib/upload";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUserRole, getAccessibleProjects, getAccessibleAccounts, hasProjectPermission, Role } from "@/lib/permissions";
import { FolderOpen, CreditCard, Wallet, Upload, Check, ChevronRight, AlertCircle, Lock } from "lucide-react";
import CurrencyInput from "@/components/finance/CurrencyInput";

const INCOME_SOURCES = ["COD VET", "COD JNT", "Khách CK", "Khác"];
const CURRENCY_FLAGS: Record<string, string> = { "VND": "🇻🇳", "USD": "🇺🇸", "KHR": "🇰🇭", "TRY": "🇹🇷" };

export default function IncomePage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("USER");

    const [projectId, setProjectId] = useState("");
    const [accountId, setAccountId] = useState("");
    const [amount, setAmount] = useState("");
    const [source, setSource] = useState(INCOME_SOURCES[0]);
    const [description, setDescription] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [filterDate, setFilterDate] = useState("");
    const [filterProject, setFilterProject] = useState("");

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
        if (userId) filtered = filtered.filter(acc => !acc.assignedUserIds || acc.assignedUserIds.length === 0 || acc.assignedUserIds.includes(userId));
        if (projectId) filtered = filtered.filter(acc => acc.projectId === projectId || !acc.projectId);
        return filtered;
    }, [currentUser, accounts, accessibleProjects, projectId]);
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
            setAccounts(accs); setProjects(projs); await fetchTransactions();
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const fetchTransactions = async () => {
        if (!currentUser) return;
        try {
            const snapshot = await getDocs(collection(db, "finance_transactions"));
            let txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)).filter(t => t.type === "IN");
            // User thường chỉ xem giao dịch của mình, ADMIN xem tất cả
            if (userRole !== "ADMIN") { const userId = currentUser.uid || currentUser.id; txs = txs.filter(t => t.userId === userId); }
            if (filterDate) txs = txs.filter(t => t.date.startsWith(filterDate));
            if (filterProject) txs = txs.filter(t => t.projectId === filterProject);
            txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setTransactions(txs);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { if (!loading) fetchTransactions(); }, [filterDate, filterProject]);
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
            const account = accounts.find(a => a.id === accountId);
            if (account) await updateAccountBalance(accountId, account.balance + numAmount);
            setAmount(""); setDescription(""); setFiles([]); setProjectId(""); setAccountId("");
            fetchTransactions(); alert("✓ Đã thêm khoản thu thành công!");
        } catch (error) { console.error(error); alert("Lỗi khi thêm khoản thu"); } finally { setSubmitting(false); }
    };

    const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || "-";
    const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || "-";
    const currentStep = !projectId ? 1 : !accountId ? 2 : 3;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
                    <Wallet className="w-6 h-6 text-white" />
                </div>
                <div><h1 className="text-2xl font-bold text-white">Thu tiền</h1><p className="text-sm text-white/50">Nhập khoản thu mới</p></div>
            </div>

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
                    <select value={projectId} onChange={e => { setProjectId(e.target.value); setAccountId(""); }} className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-white focus:border-green-500/50 focus:outline-none" required>
                        <option value="">Chọn dự án...</option>
                        {accessibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
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
                        <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-white focus:border-green-500/50 focus:outline-none" required>
                            <option value="">Chọn tài khoản...</option>
                            {accessibleAccounts.map(acc => <option key={acc.id} value={acc.id}>{CURRENCY_FLAGS[acc.currency]} {acc.name} • {acc.balance.toLocaleString()} {acc.currency}</option>)}
                        </select>
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
                                <select value={source} onChange={e => setSource(e.target.value)} className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-white focus:border-green-500/50 focus:outline-none">
                                    {incomeCategories.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                {incomeCategories.length === 0 && (
                                    <p className="text-xs text-yellow-400 mt-1">
                                        Dự án chưa có danh mục thu. Liên hệ admin để thêm danh mục.
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

            <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10 flex flex-wrap justify-between items-center gap-3">
                    <h3 className="font-semibold text-white">Lịch sử thu tiền</h3>
                    <div className="flex gap-2">
                        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                            <option value="">Tất cả dự án</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-black/30 text-white/50 text-xs uppercase">
                            <tr><th className="p-3">Ngày</th><th className="p-3">Số tiền</th><th className="p-3">Nguồn</th><th className="p-3">Tài khoản</th><th className="p-3">Dự án</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {transactions.slice(0, 20).map(tx => (
                                <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-3 text-white/70">{new Date(tx.date).toLocaleDateString('vi-VN')}</td>
                                    <td className="p-3 text-green-400 font-semibold">+{tx.amount.toLocaleString()} {tx.currency}</td>
                                    <td className="p-3 text-white/70">{tx.source || tx.category}</td>
                                    <td className="p-3 text-white/70">{getAccountName(tx.accountId)}</td>
                                    <td className="p-3 text-white/70">{tx.projectId ? getProjectName(tx.projectId) : "-"}</td>
                                </tr>
                            ))}
                            {transactions.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-white/30">Chưa có dữ liệu</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
