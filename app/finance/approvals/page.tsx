"use client";

import { useState, useEffect } from "react";
import { getTransactions, updateTransactionStatus, updateAccountBalance, getAccounts } from "@/lib/finance";
import { Transaction, Account } from "@/types/finance";
import { logActivity } from "@/lib/logger";
import { doc, updateDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

type ApprovalTab = "all" | "high_value" | "pending";

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
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<ApprovalTab>("all");
    const [approvalLogs, setApprovalLogs] = useState<ApprovalLog[]>([]);

    // Rejection Modal
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectingTx, setRejectingTx] = useState<Transaction | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    useEffect(() => {
        const u = localStorage.getItem("user");
        if (u) setCurrentUser(JSON.parse(u));

        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [txs, accs] = await Promise.all([getTransactions(), getAccounts()]);
            // Filter only PENDING
            setPendingTransactions(txs.filter(t => t.status === "PENDING"));
            setAccounts(accs);

            // Fetch recent logs (Broad query to avoid Composite Index requirement)
            const logsSnapshot = await getDocs(
                query(
                    collection(db, "finance_logs"),
                    orderBy("timestamp", "desc"),
                    limit(50)
                )
            );

            // Client-side Filter
            const rawLogs = logsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalLog));
            const filteredLogs = rawLogs.filter(l => ["APPROVE", "REJECT"].includes(l.action));

            setApprovalLogs(filteredLogs.slice(0, 10));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredTransactions = () => {
        if (activeTab === "high_value") {
            return pendingTransactions.filter(tx => {
                const isHighVND = tx.currency === "VND" && tx.amount > 5000000;
                const isHighUSD = (tx.currency === "USD" || tx.currency === "KHR") && tx.amount > 100;
                return isHighVND || isHighUSD;
            });
        }
        return pendingTransactions;
    };

    const handleApprove = async (tx: Transaction) => {
        if (!currentUser) return alert("Error: User not found");
        if (!confirm("Xác nhận DUYỆT giao dịch này?")) return;

        try {
            // 1. Update Status
            await updateTransactionStatus(tx.id, "APPROVED");

            // 2. Update transaction with approver info
            const txRef = doc(db, "finance_transactions", tx.id);
            await updateDoc(txRef, {
                approvedBy: currentUser.name || currentUser.displayName || "Admin",
                updatedAt: Date.now()
            });

            // 3. Log Activity
            await logActivity(
                { uid: currentUser.id || currentUser.uid || "admin", displayName: currentUser.name || currentUser.displayName || "Admin" },
                "APPROVE",
                "TRANSACTION",
                tx.id,
                `Đã duyệt giao dịch ${tx.id}: ${tx.amount} ${tx.currency}`
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
            alert("Lỗi khi duyệt giao dịch");
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
            alert("Vui lòng nhập lý do từ chối");
            return;
        }

        try {
            // 1. Update Status
            await updateTransactionStatus(rejectingTx.id, "REJECTED");

            // 2. Update transaction with rejection info
            const txRef = doc(db, "finance_transactions", rejectingTx.id);
            await updateDoc(txRef, {
                rejectedBy: currentUser.name || currentUser.displayName || "Admin",
                rejectionReason: rejectionReason.trim(),
                updatedAt: Date.now()
            });

            // 3. Log Activity
            await logActivity(
                { uid: currentUser.id || currentUser.uid || "admin", displayName: currentUser.name || currentUser.displayName || "Admin" },
                "REJECT",
                "TRANSACTION",
                rejectingTx.id,
                `Từ chối giao dịch ${rejectingTx.id}. Lý do: ${rejectionReason.trim()}`
            );

            setShowRejectModal(false);
            setRejectingTx(null);
            fetchData();
        } catch (error) {
            console.error("Rejection failed", error);
            alert("Lỗi khi từ chối giao dịch");
        }
    };

    const filteredTxs = getFilteredTransactions();

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Phê duyệt</h1>
                <p className="text-[var(--muted)]">Xét duyệt các giao dịch giá trị lớn hoặc đáng ngờ</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab("all")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "all"
                        ? "bg-white/10 text-white"
                        : "text-[var(--muted)] hover:text-white"
                        }`}
                >
                    Tất cả ({pendingTransactions.length})
                </button>
                <button
                    onClick={() => setActiveTab("high_value")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "high_value"
                        ? "bg-red-500/20 text-red-400"
                        : "text-[var(--muted)] hover:text-white"
                        }`}
                >
                    Khoản lớn (&gt;5tr / &gt;$100)
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-[var(--muted)]">Đang tải...</div>
            ) : filteredTxs.length === 0 ? (
                <div className="glass-card p-12 text-center text-[var(--muted)] rounded-xl">
                    <div className="text-4xl mb-4">✓</div>
                    <p>Không có giao dịch chờ duyệt. Bạn đã xử lý xong!</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredTxs.map(tx => {
                        const isHighValue = (tx.currency === "VND" && tx.amount > 5000000) ||
                            ((tx.currency === "USD" || tx.currency === "KHR") && tx.amount > 100);

                        return (
                            <div
                                key={tx.id}
                                className={`glass-card p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isHighValue ? "border-l-4 border-red-500" : ""
                                    }`}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === "IN" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                            }`}>
                                            {tx.type === "IN" ? "THU" : "CHI"}
                                        </span>
                                        {isHighValue && (
                                            <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-bold">
                                                ⚠️ Giá trị lớn
                                            </span>
                                        )}
                                        <span className="text-sm text-[var(--muted)]">{new Date(tx.date).toLocaleDateString()}</span>
                                        <span className="text-sm text-[var(--muted)]">bởi {tx.createdBy}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-1">
                                        {tx.amount.toLocaleString()} {tx.currency}
                                    </h3>
                                    <p className="text-[var(--muted)]">{tx.description || tx.category}</p>

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
                                                    Xem ảnh {i + 1}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => openRejectModal(tx)}
                                        className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 font-medium transition-colors"
                                    >
                                        Từ chối
                                    </button>
                                    <button
                                        onClick={() => handleApprove(tx)}
                                        className="px-6 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold transition-colors shadow-lg shadow-green-500/20"
                                    >
                                        Duyệt
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Approval History */}
            <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                <div className="p-4 border-b border-white/5 bg-[#1a1a1a]">
                    <h3 className="text-lg font-bold">Lịch sử phê duyệt gần đây</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#1a1a1a] text-[var(--muted)] text-xs uppercase font-semibold tracking-wider">
                            <tr>
                                <th className="p-4 border-b border-white/10">Thời gian</th>
                                <th className="p-4 border-b border-white/10">Người duyệt</th>
                                <th className="p-4 border-b border-white/10">Hành động</th>
                                <th className="p-4 border-b border-white/10">Chi tiết</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {approvalLogs.map(log => (
                                <tr key={log.id} className="hover:bg-white/5">
                                    <td className="p-4 text-[var(--muted)]">{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="p-4 text-white">{log.userName}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${log.action === "APPROVE" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                            }`}>
                                            {log.action === "APPROVE" ? "DUYỆT" : "TỪ CHỐI"}
                                        </span>
                                    </td>
                                    <td className="p-4 text-[var(--muted)] max-w-[300px] truncate">{log.details}</td>
                                </tr>
                            ))}
                            {approvalLogs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-[var(--muted)]">
                                        Chưa có lịch sử phê duyệt
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
                        <h2 className="text-xl font-bold mb-4 text-red-400">Từ chối giao dịch</h2>

                        <div className="mb-4 p-4 bg-white/5 rounded-lg">
                            <p className="text-sm text-[var(--muted)]">Giao dịch:</p>
                            <p className="text-lg font-bold text-white">
                                {rejectingTx.amount.toLocaleString()} {rejectingTx.currency}
                            </p>
                            <p className="text-sm text-[var(--muted)]">{rejectingTx.category} • {rejectingTx.createdBy}</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                                Lý do từ chối *
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                placeholder="Nhập lý do từ chối giao dịch này..."
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
                                Hủy
                            </button>
                            <button
                                onClick={handleReject}
                                className="flex-1 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-colors"
                            >
                                Xác nhận từ chối
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
