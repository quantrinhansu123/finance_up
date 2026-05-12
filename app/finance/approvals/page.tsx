"use client";

import { useState, useEffect } from "react";
import {
    getTransactions,
    updateTransactionStatus,
    updateTransaction,
    updateAccountBalance,
    getAccounts,
    getProjects,
    getBudgetRequests,
    updateBudgetStatus,
    approveBudgetByDirector,
    approveBudgetByAccountant,
    disburseBudgetRequest,
    hasBudgetExpenseVoucher,
    createExpenseVoucherFromBudgetRequest,
} from "@/lib/finance";
import { Transaction, Account, Project, BudgetRequest, TransactionStatus } from "@/types/finance";
import { logActivity } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { uploadImage } from "@/lib/upload";
import { getUserRole, hasProjectPermission } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { ShieldX, Eye } from "lucide-react";
import DataTable, { DateCell } from "@/components/finance/DataTable";
import TransactionDetailModal from "@/components/finance/TransactionDetailModal";
import { useTranslation } from "@/lib/i18n";
import { sessionUserDisplayLabel } from "@/lib/session-user-label";

type ApprovalTab = "all" | "high_value" | "processed";
type MainApprovalTab = "transactions" | "budgets";

interface ApprovalLog {
    id: string;
    action: string;
    transactionId: string;
    userName: string;
    reason?: string;
    details?: string;
    timestamp: number;
}

export default function ApprovalsPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
    const [processedTransactions, setProcessedTransactions] = useState<Transaction[]>([]);
    const [viewDetailTx, setViewDetailTx] = useState<Transaction | null>(null);
    const [viewingBudget, setViewingBudget] = useState<BudgetRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeMainTab, setActiveMainTab] = useState<MainApprovalTab>("transactions");
    const [activeTab, setActiveTab] = useState<ApprovalTab>("all");
    const [approvalLogs, setApprovalLogs] = useState<ApprovalLog[]>([]);
    const [canApprove, setCanApprove] = useState(false);
    const [approvalProjectIds, setApprovalProjectIds] = useState<string[]>([]);
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [budgetRequests, setBudgetRequests] = useState<BudgetRequest[]>([]);
    /** Toàn bộ giao dịch — dùng tra cứu từ lịch sử phê duyệt */
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

    // Rejection Modal
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectingTx, setRejectingTx] = useState<Transaction | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    // Budget rejection modal
    const [showBudgetRejectModal, setShowBudgetRejectModal] = useState(false);
    const [rejectingBudget, setRejectingBudget] = useState<BudgetRequest | null>(null);
    const [budgetRejectionReason, setBudgetRejectionReason] = useState("");
    const [showDisburseModal, setShowDisburseModal] = useState(false);
    const [disbursingBudget, setDisbursingBudget] = useState<BudgetRequest | null>(null);
    const [disburseFiles, setDisburseFiles] = useState<File[]>([]);
    const [isDisbursing, setIsDisbursing] = useState(false);

    useEffect(() => {
        const u = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (u) setCurrentUser(JSON.parse(u));

        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const u = localStorage.getItem("user") || sessionStorage.getItem("user");
            if (!u) {
                setLoading(false);
                return;
            }

            const parsed = JSON.parse(u);
            const role = getUserRole(parsed);
            const userId = parsed.uid || parsed.id;

            const [txs, accs, allProjects, budgetReqs] = await Promise.all([
                getTransactions(),
                getAccounts(),
                getProjects(),
                getBudgetRequests()
            ]);

            setAccounts(accs);
            setAllProjects(allProjects);
            setAllTransactions(txs);

            const PROCESSED_STATUSES: TransactionStatus[] = ["APPROVED", "REJECTED", "PAID", "COMPLETED"];
            const cutoffProcessed = Date.now() - 90 * 24 * 60 * 60 * 1000;

            const buildProcessed = (projectIds: string[] | null) => {
                let list = txs.filter(
                    (t) =>
                        PROCESSED_STATUSES.includes(t.status) &&
                        new Date(t.date).getTime() >= cutoffProcessed
                );
                if (projectIds !== null) {
                    list = list.filter((t) => t.projectId && projectIds.includes(t.projectId));
                }
                list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                return list.slice(0, 100);
            };

            // ADMIN có full quyền
            if (role === "ADMIN") {
                setCanApprove(true);
                setPendingTransactions(txs.filter(t => t.status === "PENDING"));
                setApprovalProjectIds(allProjects.map(p => p.id));
                setBudgetRequests(budgetReqs);
                setProcessedTransactions(buildProcessed(null));
            } else {
                // Lấy các project mà user có quyền approve_transactions
                const projectsWithApproval = allProjects.filter(p =>
                    hasProjectPermission(userId, p, "approve_transactions", parsed)
                );

                if (projectsWithApproval.length > 0) {
                    setCanApprove(true);
                    const projectIds = projectsWithApproval.map(p => p.id);
                    setApprovalProjectIds(projectIds);

                    // Lọc giao dịch PENDING thuộc các project có quyền
                    const filteredTxs = txs.filter(t =>
                        t.status === "PENDING" && t.projectId && projectIds.includes(t.projectId)
                    );
                    setPendingTransactions(filteredTxs);

                    const filteredBudgetRequests = budgetReqs.filter(br =>
                        !br.id_du_an || projectIds.includes(br.id_du_an)
                    );
                    setBudgetRequests(filteredBudgetRequests);
                    setProcessedTransactions(buildProcessed(projectIds));
                } else {
                    setCanApprove(false);
                    setPendingTransactions([]);
                    setBudgetRequests([]);
                    setProcessedTransactions([]);
                }
            }

            // Fetch recent approval logs from Supabase
            const { data: activityLogs, error: logsError } = await supabase
                .from("finance_activity_logs")
                .select("id, action, entity_id, user_name, details, logged_at")
                .in("action", [
                    "APPROVE",
                    "REJECT",
                    "APPROVE_BUDGET",
                    "REJECT_BUDGET",
                    "DIRECTOR_APPROVE_BUDGET",
                    "ACCOUNTANT_APPROVE_BUDGET",
                    "DISBURSE_BUDGET"
                ])
                .order("logged_at", { ascending: false })
                .limit(120);

            if (logsError) {
                console.error("Failed to fetch approval logs", logsError);
                setApprovalLogs([]);
            } else {
                const mappedLogs: ApprovalLog[] = (activityLogs || []).map((log: any) => {
                    let normalizedDetails = typeof log.details === "string" ? log.details : "";
                    let reason: string | undefined;

                    if (normalizedDetails.startsWith("{")) {
                        try {
                            const parsed = JSON.parse(normalizedDetails);
                            normalizedDetails = parsed.details || normalizedDetails;
                            reason = parsed.reason;
                        } catch (e) {
                            console.error("Failed to parse log details", e);
                        }
                    }

                    return {
                        id: log.id,
                        action: log.action,
                        transactionId: log.entity_id || "",
                        userName: log.user_name || "System",
                        reason,
                        details: normalizedDetails,
                        timestamp: new Date(log.logged_at).getTime()
                    };
                });

                setApprovalLogs(mappedLogs);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatMoneyVND = (amount: number) => {
        return `${Number(amount || 0).toLocaleString("vi-VN")} VND`;
    };

    const getCurrentUserName = () => {
        return currentUser?.name || currentUser?.displayName || currentUser?.email || "Unknown";
    };

    const canDirectorApproveBudget = (request: BudgetRequest) => {
        const role = getUserRole(currentUser);
        const financeRole = currentUser?.financeRole;
        if (role === "ADMIN" || financeRole === "ADMIN" || financeRole === "DIRECTOR" || financeRole === "MANAGER") return true;

        const projectId = request.id_du_an;
        const project = allProjects.find((p) => p.id === projectId);
        if (!project) return false;

        return hasProjectPermission(currentUser?.uid || currentUser?.id, project, "approve_transactions", currentUser);
    };

    const canAccountantApproveBudget = (request: BudgetRequest) => {
        const role = getUserRole(currentUser);
        const financeRole = currentUser?.financeRole;
        if (role === "ADMIN" || financeRole === "ADMIN" || financeRole === "ACCOUNTANT") return true;

        const projectId = request.id_du_an;
        const project = allProjects.find((p) => p.id === projectId);
        if (!project) return false;

        return hasProjectPermission(currentUser?.uid || currentUser?.id, project, "pay_transactions", currentUser);
    };

    const getFilteredTransactions = () => {
        if (activeTab === "processed") {
            return processedTransactions;
        }
        if (activeTab === "high_value") {
            return pendingTransactions.filter(tx => {
                const isHighVND = tx.currency === "VND" && tx.amount > 5000000;
                const isHighOther = tx.currency !== "VND" && tx.amount > 100;
                return isHighVND || isHighOther;
            });
        }
        return pendingTransactions;
    };

    const txAccountLabel = (tx: Transaction) =>
        accounts.find((a) => a.id === tx.accountId)?.name || (tx.accountId ? tx.accountId : undefined);

    const txProjectLabel = (tx: Transaction) =>
        tx.projectId ? allProjects.find((p) => p.id === tx.projectId)?.name : undefined;

    const LOG_TX_ACTIONS = new Set(["APPROVE", "REJECT"]);
    const LOG_BUDGET_ACTIONS = new Set([
        "APPROVE_BUDGET",
        "REJECT_BUDGET",
        "DIRECTOR_APPROVE_BUDGET",
        "ACCOUNTANT_APPROVE_BUDGET",
        "DISBURSE_BUDGET",
    ]);

    const handleViewApprovalLog = async (log: ApprovalLog) => {
        if (!log.transactionId?.trim()) {
            alert("Không có mã tham chiếu để mở chi tiết.");
            return;
        }
        const id = log.transactionId.trim();

        if (LOG_TX_ACTIONS.has(log.action)) {
            const tx = allTransactions.find((t) => t.id === id);
            if (tx) {
                setViewDetailTx(tx);
                return;
            }
            alert("Không tìm thấy giao dịch (có thể đã xóa).");
            return;
        }

        if (LOG_BUDGET_ACTIONS.has(log.action)) {
            const { data, error } = await supabase
                .from("budget_requests")
                .select("*, du_an(ten_du_an), crm_agencies(ten_agency)")
                .eq("id", id)
                .maybeSingle();
            if (error || !data) {
                alert("Không tìm thấy báo giá / yêu cầu ngân sách.");
                return;
            }
            setViewingBudget(data as BudgetRequest);
            return;
        }

        alert("Loại nhật ký này chưa hỗ trợ xem chi tiết.");
    };

    /** Xin ngân sách (mới + bản cũ có hạng mục Nạp Quỹ + thụ hưởng): admin duyệt → tự tạo phiếu chi OUT, không trừ quỹ trên dòng yêu cầu. */
    const isBudgetRequestApprovalFlow = (tx: Transaction) => {
        if (tx.type !== "OUT" || tx.status !== "PENDING") return false;
        if (tx.isBudgetRequest) return true;
        const c = (tx.category || "").toLowerCase();
        return !!tx.beneficiary?.trim() && c.includes("nạp quỹ");
    };

    const handleApprove = async (tx: Transaction) => {
        if (!currentUser) return alert("Error: User not found");
        if (!confirm(t("verify_approve_tx"))) return;

        const approverId = currentUser.uid || currentUser.id;
        const approverLabel = sessionUserDisplayLabel(currentUser);

        try {
            if (isBudgetRequestApprovalFlow(tx)) {
                if (await hasBudgetExpenseVoucher(tx.id)) {
                    alert("Phiếu chi đã được tạo cho yêu cầu này.");
                    return;
                }
                if (!approverId) return alert("Error: User not found");

                await createExpenseVoucherFromBudgetRequest(tx, {
                    approvedBy: approverId,
                    approverDisplayName: approverLabel || undefined,
                });

                await updateTransaction(tx.id, {
                    status: "APPROVED",
                    ...(approverId ? { approvedBy: approverId } : {}),
                    ...(approverLabel ? { approverDisplayName: approverLabel } : {}),
                    warning: false,
                });

                const proj = allProjects.find(p => p.id === tx.projectId);
                const logMsg = `Duyệt xin ngân sách & tạo phiếu chi: ${tx.amount.toLocaleString("vi-VN")} ${tx.currency} | ${proj?.name || "N/A"}`;
                await logActivity(
                    { uid: currentUser.id || currentUser.uid || "admin", displayName: currentUser.name || currentUser.displayName || "Admin" },
                    "APPROVE",
                    "TRANSACTION",
                    tx.id,
                    logMsg
                );
                fetchData();
                return;
            }

            // 1. Update Status
            await updateTransactionStatus(tx.id, "APPROVED");

            // 2. Update transaction with approver info
            await updateTransaction(tx.id, {
                ...(approverId ? { approvedBy: approverId } : {}),
                ...(approverLabel ? { approverDisplayName: approverLabel } : {}),
                ...(tx.type === "OUT" ? { warning: true } : {}),
            });

            // 3. Log Activity
            const proj = allProjects.find(p => p.id === tx.projectId);
            const logMsg = `Đã duyệt: ${tx.category} - ${tx.amount.toLocaleString("vi-VN")} ${tx.currency} | Dự án: ${proj?.name || "N/A"}`;

            await logActivity(
                { uid: currentUser.id || currentUser.uid || "admin", displayName: currentUser.name || currentUser.displayName || "Admin" },
                "APPROVE",
                "TRANSACTION",
                tx.id,
                logMsg
            );

            // 4. Update Account Balance
            const account = accounts.find(a => a.id === tx.accountId);
            if (account) {
                const newBalance = tx.type === "IN"
                    ? account.balance + tx.amount
                    : account.balance - tx.amount;
                await updateAccountBalance(account.id, newBalance);
            }

            // Refresh
            fetchData();
        } catch (error) {
            console.error("Approval failed", error);
            alert(error instanceof Error ? error.message : t("approve_error"));
        }
    };

    const openRejectModal = (tx: Transaction) => {
        setRejectingTx(tx);
        setRejectionReason("");
        setShowRejectModal(true);
    };

    const handleReject = async () => {
        if (!rejectingTx) return;
        if (!currentUser) return alert("Error: User not found");
        if (!rejectionReason.trim()) {
            alert(t("please_enter_reject_reason"));
            return;
        }

        try {
            // 1. Update Status
            await updateTransactionStatus(rejectingTx.id, "REJECTED");

            // 2. Update transaction with rejection info
            const rejecterId = currentUser.uid || currentUser.id;
            await updateTransaction(rejectingTx.id, {
                ...(rejecterId ? { rejectedBy: rejecterId } : {}),
                rejectionReason: rejectionReason.trim(),
            });

            // 3. Log Activity
            const proj = allProjects.find(p => p.id === rejectingTx.projectId);
            const logMsg = `Từ chối: ${rejectingTx.category} - ${rejectingTx.amount.toLocaleString("vi-VN")} ${rejectingTx.currency} | Dự án: ${proj?.name || "N/A"} | Lý do: ${rejectionReason.trim()}`;

            await logActivity(
                { uid: currentUser.id || currentUser.uid || "admin", displayName: currentUser.name || currentUser.displayName || "Admin" },
                "REJECT",
                "TRANSACTION",
                rejectingTx.id,
                logMsg
            );

            setShowRejectModal(false);
            setRejectingTx(null);
            fetchData();
        } catch (error) {
            console.error("Rejection failed", error);
            alert(t("reject_error"));
        }
    };

    const handleApproveBudget = async (request: BudgetRequest) => {
        if (!confirm("Bạn có chắc chắn muốn đồng ý yêu cầu ngân sách này?")) return;

        try {
            await updateBudgetStatus(request.id, "dong_y");

            await logActivity(
                { uid: currentUser?.id || currentUser?.uid || "admin", displayName: currentUser?.name || currentUser?.displayName || "Admin" },
                "APPROVE_BUDGET",
                "BUDGET_REQUEST",
                request.id,
                `Đồng ý duyệt ngân sách: ${formatMoneyVND(request.ngan_sach_xin)} | Dự án: ${request.du_an?.ten_du_an || "N/A"} | Agency: ${request.crm_agencies?.ten_agency || "N/A"}`
            );

            fetchData();
        } catch (error) {
            console.error("Budget approval failed", error);
            alert("Lỗi khi duyệt ngân sách");
        }
    };

    const openBudgetRejectModal = (request: BudgetRequest) => {
        setRejectingBudget(request);
        setBudgetRejectionReason("");
        setShowBudgetRejectModal(true);
    };

    const handleDirectorApproveBudget = async (request: BudgetRequest) => {
        if (!confirm("Xác nhận giám đốc duyệt báo giá này?")) return;
        try {
            const userName = getCurrentUserName();
            await approveBudgetByDirector(request.id, userName);

            await logActivity(
                { uid: currentUser?.id || currentUser?.uid || "admin", displayName: userName },
                "DIRECTOR_APPROVE_BUDGET",
                "BUDGET_REQUEST",
                request.id,
                `Giám đốc duyệt báo giá: ${formatMoneyVND(request.ngan_sach_xin)} | Dự án: ${request.du_an?.ten_du_an || "N/A"}`
            );

            fetchData();
        } catch (error) {
            console.error("Director approval failed", error);
            alert("Lỗi khi giám đốc duyệt");
        }
    };

    const handleAccountantApproveBudget = async (request: BudgetRequest) => {
        if (!confirm("Xác nhận kế toán duyệt báo giá này?")) return;
        try {
            const userName = getCurrentUserName();
            await approveBudgetByAccountant(request.id, userName);

            await logActivity(
                { uid: currentUser?.id || currentUser?.uid || "admin", displayName: userName },
                "ACCOUNTANT_APPROVE_BUDGET",
                "BUDGET_REQUEST",
                request.id,
                `Kế toán duyệt báo giá: ${formatMoneyVND(request.ngan_sach_xin)} | Dự án: ${request.du_an?.ten_du_an || "N/A"}`
            );

            fetchData();
        } catch (error) {
            console.error("Accountant approval failed", error);
            alert("Lỗi khi kế toán duyệt");
        }
    };

    const openDisburseModal = (request: BudgetRequest) => {
        setDisbursingBudget(request);
        setDisburseFiles([]);
        setShowDisburseModal(true);
    };

    const handleDisburseFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        setDisburseFiles(Array.from(e.target.files));
    };

    const handleDisburseBudget = async () => {
        if (!disbursingBudget) return;
        if (disburseFiles.length === 0) {
            alert("Vui lòng tải lên ít nhất 1 ảnh giải ngân");
            return;
        }

        setIsDisbursing(true);
        try {
            const imageUrls = await Promise.all(disburseFiles.map((file) => uploadImage(file)));
            const userName = getCurrentUserName();

            await disburseBudgetRequest(disbursingBudget.id, imageUrls, userName);

            await logActivity(
                { uid: currentUser?.id || currentUser?.uid || "admin", displayName: userName },
                "DISBURSE_BUDGET",
                "BUDGET_REQUEST",
                disbursingBudget.id,
                `Đã giải ngân báo giá: ${formatMoneyVND(disbursingBudget.ngan_sach_xin)} | Dự án: ${disbursingBudget.du_an?.ten_du_an || "N/A"} | Ảnh: ${imageUrls.length}`
            );

            setShowDisburseModal(false);
            setDisbursingBudget(null);
            setDisburseFiles([]);
            fetchData();
        } catch (error) {
            console.error("Disburse failed", error);
            alert("Lỗi khi giải ngân");
        } finally {
            setIsDisbursing(false);
        }
    };

    const handleRejectBudget = async () => {
        if (!rejectingBudget) return;
        if (!budgetRejectionReason.trim()) {
            alert("Vui lòng nhập lý do từ chối");
            return;
        }

        try {
            await updateBudgetStatus(rejectingBudget.id, "tu_choi", budgetRejectionReason.trim());

            await logActivity(
                { uid: currentUser?.id || currentUser?.uid || "admin", displayName: currentUser?.name || currentUser?.displayName || "Admin" },
                "REJECT_BUDGET",
                "BUDGET_REQUEST",
                rejectingBudget.id,
                `Từ chối ngân sách: ${formatMoneyVND(rejectingBudget.ngan_sach_xin)} | Dự án: ${rejectingBudget.du_an?.ten_du_an || "N/A"} | Agency: ${rejectingBudget.crm_agencies?.ten_agency || "N/A"} | Lý do: ${budgetRejectionReason.trim()}`
            );

            setShowBudgetRejectModal(false);
            setRejectingBudget(null);
            fetchData();
        } catch (error) {
            console.error("Budget rejection failed", error);
            alert("Lỗi khi từ chối ngân sách");
        }
    };

    const filteredTxs = getFilteredTransactions();

    if (loading) {
        return <div className="p-8 text-[var(--muted)]">Đang tải...</div>;
    }

    // Kiểm tra quyền
    if (!canApprove) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                <ShieldX size={64} className="text-red-400 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">{t("access_denied")}</h1>
                <p className="text-[var(--muted)] mb-4">{t("approval_permission_required")}</p>
                <button
                    onClick={() => router.push("/finance")}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                >
                    {t("back_to_dashboard")}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">{t("approval_title")}</h1>
                <p className="text-[var(--muted)]">{t("approval_desc")}</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveMainTab("transactions")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeMainTab === "transactions"
                        ? "bg-blue-500/20 text-blue-300"
                        : "text-[var(--muted)] hover:text-white"
                        }`}
                >
                    Duyệt Giao Dịch ({pendingTransactions.length})
                </button>
                <button
                    onClick={() => setActiveMainTab("budgets")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeMainTab === "budgets"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "text-[var(--muted)] hover:text-white"
                        }`}
                >
                    Duyệt Ngân Sách ({budgetRequests.length})
                </button>
            </div>

            {activeMainTab === "transactions" && (
                <>
                    <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setActiveTab("all")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "all"
                        ? "bg-white/10 text-white"
                        : "text-[var(--muted)] hover:text-white"
                        }`}
                >
                    {t("all_transactions")} ({pendingTransactions.length})
                </button>
                <button
                    onClick={() => setActiveTab("high_value")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "high_value"
                        ? "bg-red-500/20 text-red-400"
                        : "text-[var(--muted)] hover:text-white"
                        }`}
                >
                    {t("high_value_tx")} (&gt;5tr / &gt;$100)
                </button>
                <button
                    onClick={() => setActiveTab("processed")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "processed"
                        ? "bg-slate-500/25 text-slate-200"
                        : "text-[var(--muted)] hover:text-white"
                        }`}
                >
                    Đã xử lý ({processedTransactions.length})
                </button>
            </div>

                    {loading ? (
                <div className="text-center py-12 text-[var(--muted)]">{t("loading")}</div>
            ) : filteredTxs.length === 0 ? (
                <div className="glass-card p-12 text-center text-[var(--muted)] rounded-xl">
                    <div className="text-4xl mb-4">{activeTab === "processed" ? "📋" : "✓"}</div>
                    <p>{activeTab === "processed" ? "Chưa có giao dịch đã duyệt / từ chối trong phạm vi quyền (90 ngày gần nhất)." : t("no_pending_tx")}</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredTxs.map(tx => {
                        const isHighValue = (tx.currency === "VND" && tx.amount > 5000000) ||
                            (tx.currency !== "VND" && tx.amount > 100);
                        const isProcessedList = activeTab === "processed";

                        const statusLabel =
                            tx.status === "APPROVED" ? "Đã duyệt" :
                            tx.status === "REJECTED" ? "Từ chối" :
                            tx.status === "PAID" ? "Đã TT" :
                            tx.status === "COMPLETED" ? "Hoàn thành" : tx.status;

                        return (
                            <div
                                key={tx.id}
                                className={`glass-card p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isHighValue && !isProcessedList ? "border-l-4 border-red-500" : ""
                                    }`}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === "IN" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                            }`}>
                                            {tx.type === "IN" ? t("income") : t("expense")}
                                        </span>
                                        {isProcessedList && (
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-300">
                                                {statusLabel}
                                            </span>
                                        )}
                                        {isHighValue && !isProcessedList && (
                                            <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-bold">
                                                ⚠️ {t("high_value_warning")}
                                            </span>
                                        )}
                                        <span className="text-sm text-[var(--muted)]">{new Date(tx.date).toLocaleDateString()}</span>
                                        <span className="text-sm text-[var(--muted)]">Người tạo: {tx.createdBy}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-1">
                                        {tx.amount.toLocaleString("vi-VN")} {tx.currency}
                                    </h3>
                                    <div className="space-y-1">
                                        <p className="text-white font-medium">{tx.category}</p>
                                        <p className="text-[var(--muted)] text-sm">{tx.description}</p>
                                        {tx.beneficiary && (
                                            <p className="text-blue-400 text-xs font-bold uppercase">Thụ hưởng: {tx.beneficiary}</p>
                                        )}
                                        {tx.projectId && (
                                            <p className="text-[var(--muted)] text-[10px]">Dự án: {allProjects.find(p => p.id === tx.projectId)?.name || "N/A"}</p>
                                        )}
                                    </div>

                                    {tx.images && tx.images.length > 0 && (
                                        <div className="mt-2 flex gap-2">
                                            {tx.images.map((img, i) => (
                                                <a
                                                    key={i}
                                                    href={img}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-blue-400 underline hover:text-blue-300"
                                                >
                                                    {t("view_image")} {i + 1}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setViewDetailTx(tx)}
                                        className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 font-medium transition-colors inline-flex items-center gap-2"
                                    >
                                        <Eye size={18} />
                                        Xem
                                    </button>
                                    {!isProcessedList && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => openRejectModal(tx)}
                                                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 font-medium transition-colors"
                                            >
                                                {t("reject")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleApprove(tx)}
                                                className="px-6 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold transition-colors shadow-lg shadow-green-500/20"
                                            >
                                                {t("approve")}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
                </>
            )}

            {activeMainTab === "budgets" && (
                <div className="glass-card rounded-xl overflow-hidden">
                    {budgetRequests.length === 0 ? (
                        <div className="p-10 text-center text-[var(--muted)]">Không có yêu cầu ngân sách chờ duyệt</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-white/5 border-b border-white/10">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-semibold text-white/80">Dự án / Agency</th>
                                        <th className="text-left px-4 py-3 font-semibold text-white/80">Ngân sách xin</th>
                                        <th className="text-left px-4 py-3 font-semibold text-white/80">Giám đốc</th>
                                        <th className="text-left px-4 py-3 font-semibold text-white/80">Kế toán</th>
                                        <th className="text-left px-4 py-3 font-semibold text-white/80">Giải ngân</th>
                                        <th className="text-left px-4 py-3 font-semibold text-white/80">Chứng từ</th>
                                        <th className="text-left px-4 py-3 font-semibold text-white/80">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {budgetRequests.map((request) => (
                                        <tr key={request.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-white">{request.du_an?.ten_du_an || "N/A"}</div>
                                                <div className="text-xs text-[var(--muted)]">{request.crm_agencies?.ten_agency || "N/A"}</div>
                                            </td>
                                            <td className="px-4 py-3 text-blue-300 font-semibold">{formatMoneyVND(request.ngan_sach_xin)}</td>
                                            <td className="px-4 py-3">
                                                {request.giam_doc_da_duyet ? (
                                                    <span className="px-2 py-1 rounded bg-green-500/20 text-green-300 text-xs">Đã duyệt</span>
                                                ) : (
                                                    <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 text-xs">Chờ duyệt</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {request.ke_toan_da_duyet ? (
                                                    <span className="px-2 py-1 rounded bg-green-500/20 text-green-300 text-xs">Đã duyệt</span>
                                                ) : (
                                                    <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 text-xs">Chờ duyệt</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {request.da_giai_ngan ? (
                                                    <div className="space-y-2">
                                                        <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs">Đã giải ngân</span>
                                                        {!!request.anh_giai_ngan_urls?.length && (
                                                            <div className="flex flex-wrap gap-2">
                                                                {request.anh_giai_ngan_urls.map((url, index) => (
                                                                    <a
                                                                        key={`${request.id}-disburse-${index}`}
                                                                        href={url}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="px-2 py-1 rounded bg-white/10 text-blue-300 hover:bg-white/20 text-xs"
                                                                    >
                                                                        Ảnh GN {index + 1}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="px-2 py-1 rounded bg-white/10 text-[var(--muted)] text-xs">Chưa giải ngân</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {request.chung_tu_urls?.length ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {request.chung_tu_urls.map((url, index) => (
                                                            <a
                                                                key={`${request.id}-${index}`}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="px-2 py-1 rounded bg-white/10 text-blue-300 hover:bg-white/20"
                                                            >
                                                                Chứng từ {index + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[var(--muted)]">Không có</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewingBudget(request)}
                                                        className="px-3 py-1.5 rounded bg-white/10 text-white hover:bg-white/15 font-medium inline-flex items-center gap-1.5"
                                                    >
                                                        <Eye size={16} />
                                                        Xem
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openBudgetRejectModal(request)}
                                                        className="px-3 py-1.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 font-medium"
                                                    >
                                                        Từ chối
                                                    </button>
                                                    {!request.giam_doc_da_duyet && canDirectorApproveBudget(request) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDirectorApproveBudget(request)}
                                                            className="px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 font-medium"
                                                        >
                                                            Duyệt Giám đốc
                                                        </button>
                                                    )}
                                                    {!request.ke_toan_da_duyet && canAccountantApproveBudget(request) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAccountantApproveBudget(request)}
                                                            className="px-3 py-1.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 font-medium"
                                                        >
                                                            Duyệt Kế toán
                                                        </button>
                                                    )}
                                                    {request.giam_doc_da_duyet && request.ke_toan_da_duyet && !request.da_giai_ngan && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openDisburseModal(request)}
                                                            className="px-3 py-1.5 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30 font-medium"
                                                        >
                                                            Giải ngân
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Approval History */}
            <div className="glass-card rounded-xl p-6 min-h-[min(70vh,720px)] flex flex-col">
                <div className="mb-4 shrink-0">
                    <h3 className="text-lg font-bold text-white">{t("recent_approval_history")}</h3>
                    <p className="text-sm text-[var(--muted)] mt-1">Tối đa 120 bản ghi gần nhất. Dùng nút Xem để mở chi tiết giao dịch hoặc báo giá.</p>
                </div>
                <div className="flex-1 min-h-[420px] min-w-0">
                    <DataTable
                        data={approvalLogs}
                        colorScheme="blue"
                        emptyMessage={t("no_approval_history")}
                        showIndex={false}
                        itemsPerPage={25}
                        columns={[
                            {
                                key: "timestamp",
                                header: t("time"),
                                render: (log) => (
                                    <span className="text-white/70 whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleString("vi-VN")}
                                    </span>
                                )
                            },
                            {
                                key: "userName",
                                header: t("approver"),
                                render: (log) => <span className="text-white font-medium">{log.userName}</span>
                            },
                            {
                                key: "action",
                                header: t("action"),
                                align: "center",
                                render: (log) => {
                                    const isRejectAction = log.action === "REJECT" || log.action === "REJECT_BUDGET";
                                    const isDisburse = log.action === "DISBURSE_BUDGET";
                                    if (isDisburse) {
                                        return (
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-300">
                                                Giải ngân
                                            </span>
                                        );
                                    }
                                    return (
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${isRejectAction
                                            ? "bg-red-500/20 text-red-400"
                                            : "bg-green-500/20 text-green-400"
                                            }`}>
                                            {isRejectAction ? t("rejected_label") : t("approved")}
                                        </span>
                                    );
                                }
                            },
                            {
                                key: "details",
                                header: t("details"),
                                render: (log) => {
                                    let displayDetails = log.details || "";
                                    if (displayDetails.startsWith('{')) {
                                        try {
                                            const parsed = JSON.parse(displayDetails);
                                            displayDetails = typeof parsed.details === "string" ? parsed.details : displayDetails;
                                        } catch (e) {
                                            console.error("Failed to parse log details", e);
                                        }
                                    }
                                    return (
                                        <div className="max-w-xl">
                                            <div className="text-white/70 whitespace-normal break-words">{displayDetails === "{}" ? "-" : displayDetails}</div>
                                            {log.reason && (
                                                <div className="text-xs text-white/40 mt-1">{t("reason")}: {log.reason}</div>
                                            )}
                                        </div>
                                    );
                                }
                            },
                            {
                                key: "view",
                                header: "Thao tác",
                                align: "right",
                                render: (log) => {
                                    const canTry =
                                        !!log.transactionId?.trim() &&
                                        (LOG_TX_ACTIONS.has(log.action) || LOG_BUDGET_ACTIONS.has(log.action));
                                    return (
                                        <button
                                            type="button"
                                            disabled={!canTry}
                                            onClick={() => void handleViewApprovalLog(log)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${canTry
                                                ? "bg-white/10 text-white hover:bg-white/15"
                                                : "bg-white/5 text-white/30 cursor-not-allowed"
                                                }`}
                                        >
                                            <Eye size={16} />
                                            Xem
                                        </button>
                                    );
                                }
                            }
                        ]}
                    />
                </div>
            </div>

            <TransactionDetailModal
                transaction={viewDetailTx}
                isOpen={!!viewDetailTx}
                onClose={() => setViewDetailTx(null)}
                accountName={viewDetailTx ? txAccountLabel(viewDetailTx) : undefined}
                projectName={viewDetailTx ? txProjectLabel(viewDetailTx) : undefined}
            />

            {viewingBudget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-lg p-6 rounded-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => setViewingBudget(null)}
                            className="absolute top-4 right-4 text-[var(--muted)] hover:text-white text-xl leading-none"
                            aria-label="Đóng"
                        >
                            ✕
                        </button>
                        <h2 className="text-xl font-bold text-white mb-4 pr-8">Chi tiết yêu cầu ngân sách</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                                <span className="text-[var(--muted)]">Dự án</span>
                                <span className="text-white font-medium text-right">{viewingBudget.du_an?.ten_du_an || "—"}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                                <span className="text-[var(--muted)]">Agency</span>
                                <span className="text-white font-medium text-right">{viewingBudget.crm_agencies?.ten_agency || "—"}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                                <span className="text-[var(--muted)]">Ngân sách xin</span>
                                <span className="text-blue-300 font-bold">{formatMoneyVND(viewingBudget.ngan_sach_xin)}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                                <span className="text-[var(--muted)]">Trạng thái</span>
                                <span className="text-white">{viewingBudget.trang_thai}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                                <span className="text-[var(--muted)]">Giám đốc</span>
                                <span className="text-white">{viewingBudget.giam_doc_da_duyet ? `Đã duyệt${viewingBudget.giam_doc_duyet_boi ? ` — ${viewingBudget.giam_doc_duyet_boi}` : ""}` : "Chờ duyệt"}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                                <span className="text-[var(--muted)]">Kế toán</span>
                                <span className="text-white">{viewingBudget.ke_toan_da_duyet ? `Đã duyệt${viewingBudget.ke_toan_duyet_boi ? ` — ${viewingBudget.ke_toan_duyet_boi}` : ""}` : "Chờ duyệt"}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                                <span className="text-[var(--muted)]">Giải ngân</span>
                                <span className="text-white">{viewingBudget.da_giai_ngan ? "Đã giải ngân" : "Chưa"}</span>
                            </div>
                            {viewingBudget.ghi_chu && (
                                <div>
                                    <span className="text-[var(--muted)] block mb-1">Ghi chú</span>
                                    <p className="text-white/90 whitespace-pre-wrap">{viewingBudget.ghi_chu}</p>
                                </div>
                            )}
                            {viewingBudget.ly_do_tu_choi && (
                                <div>
                                    <span className="text-red-400 block mb-1 font-medium">Lý do từ chối</span>
                                    <p className="text-red-200/90 whitespace-pre-wrap">{viewingBudget.ly_do_tu_choi}</p>
                                </div>
                            )}
                            {!!viewingBudget.chung_tu_urls?.length && (
                                <div>
                                    <span className="text-[var(--muted)] block mb-2">Chứng từ</span>
                                    <div className="flex flex-wrap gap-2">
                                        {viewingBudget.chung_tu_urls.map((url, i) => (
                                            <a key={url} href={url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-xs">
                                                Tệp {i + 1}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setViewingBudget(null)}
                            className="mt-6 w-full py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 font-medium"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}

            {/* Rejection Modal */}
            {showRejectModal && rejectingTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                        <button
                            onClick={() => setShowRejectModal(false)}
                            className="absolute top-4 right-4 text-[var(--muted)] hover:text-white"
                        >
                            ✕
                        </button>
                        <h2 className="text-xl font-bold mb-4 text-red-400">{t("reject_tx")}</h2>

                        <div className="mb-4 p-4 bg-white/5 rounded-lg">
                            <p className="text-sm text-[var(--muted)]">{t("transaction")}:</p>
                            <p className="text-lg font-bold text-white">
                                {rejectingTx.amount.toLocaleString("vi-VN")} {rejectingTx.currency}
                            </p>
                            <p className="text-sm text-[var(--muted)]">{rejectingTx.category} • {rejectingTx.createdBy}</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                                {t("reject_reason")} *
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                placeholder={t("enter_reject_reason")}
                                className="glass-input w-full p-3 rounded-lg"
                                rows={3}
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="flex-1 px-4 py-3 rounded-lg bg-white/5 text-[var(--muted)] hover:text-white transition-colors"
                            >
                                {t("cancel")}
                            </button>
                            <button
                                onClick={handleReject}
                                className="flex-1 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-colors"
                            >
                                {t("confirm_reject")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showBudgetRejectModal && rejectingBudget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                        <button
                            onClick={() => setShowBudgetRejectModal(false)}
                            className="absolute top-4 right-4 text-[var(--muted)] hover:text-white"
                        >
                            ✕
                        </button>
                        <h2 className="text-xl font-bold mb-4 text-red-400">Từ chối yêu cầu ngân sách</h2>

                        <div className="mb-4 p-4 bg-white/5 rounded-lg">
                            <p className="text-sm text-[var(--muted)]">Yêu cầu ngân sách:</p>
                            <p className="text-lg font-bold text-white">{formatMoneyVND(rejectingBudget.ngan_sach_xin)}</p>
                            <p className="text-sm text-[var(--muted)]">
                                {rejectingBudget.du_an?.ten_du_an || "N/A"} • {rejectingBudget.crm_agencies?.ten_agency || "N/A"}
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-[var(--muted)] mb-2">Lý do từ chối *</label>
                            <textarea
                                value={budgetRejectionReason}
                                onChange={e => setBudgetRejectionReason(e.target.value)}
                                placeholder="Nhập lý do từ chối"
                                className="glass-input w-full p-3 rounded-lg"
                                rows={3}
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowBudgetRejectModal(false)}
                                className="flex-1 px-4 py-3 rounded-lg bg-white/5 text-[var(--muted)] hover:text-white transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleRejectBudget}
                                className="flex-1 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-colors"
                            >
                                Xác nhận từ chối
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDisburseModal && disbursingBudget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                        <button
                            onClick={() => setShowDisburseModal(false)}
                            className="absolute top-4 right-4 text-[var(--muted)] hover:text-white"
                        >
                            ✕
                        </button>
                        <h2 className="text-xl font-bold mb-4 text-green-400">Giải ngân báo giá</h2>

                        <div className="mb-4 p-4 bg-white/5 rounded-lg">
                            <p className="text-sm text-[var(--muted)]">Khoản giải ngân:</p>
                            <p className="text-lg font-bold text-white">{formatMoneyVND(disbursingBudget.ngan_sach_xin)}</p>
                            <p className="text-sm text-[var(--muted)]">
                                {disbursingBudget.du_an?.ten_du_an || "N/A"} • {disbursingBudget.crm_agencies?.ten_agency || "N/A"}
                            </p>
                        </div>

                        <div className="mb-4 border-2 border-dashed border-white/20 rounded-xl p-4 text-center">
                            <input
                                type="file"
                                multiple
                                onChange={handleDisburseFilesChange}
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                            {disburseFiles.length > 0 && (
                                <div className="mt-2 text-sm text-green-400">Đã chọn {disburseFiles.length} ảnh giải ngân</div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDisburseModal(false)}
                                className="flex-1 px-4 py-3 rounded-lg bg-white/5 text-[var(--muted)] hover:text-white transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleDisburseBudget}
                                disabled={isDisbursing || disburseFiles.length === 0}
                                className="flex-1 px-4 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold transition-colors disabled:opacity-50"
                            >
                                {isDisbursing ? "Đang giải ngân..." : "Xác nhận giải ngân"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

