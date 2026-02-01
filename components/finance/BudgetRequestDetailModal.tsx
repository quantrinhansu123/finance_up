"use client";

import { Transaction, TransactionStatus, Project } from "@/types/finance";
import { X, CheckCircle, Clock, Upload, ArrowRightCircle, ShieldCheck, Download, ExternalLink, XCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { updateTransactionStatus } from "@/lib/finance";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUserRole, hasProjectPermission } from "@/lib/permissions";
import { uploadImage } from "../../lib/upload";

interface Props {
    transaction: Transaction;
    isOpen?: boolean;
    onClose: () => void;
    onUpdate: () => void;
    currentUser: any;
    allProjects?: Project[]; // NEW: For permission checking
}

export default function BudgetRequestDetailModal({ transaction, onClose, onUpdate, currentUser, allProjects = [] }: Props) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [uploadUrl, setUploadUrl] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [editedAmount, setEditedAmount] = useState(transaction.amount);
    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");

    const role = getUserRole(currentUser);
    const financeRole = currentUser?.financeRole;
    const userId = currentUser?.uid || currentUser?.id;

    // Find project for permission checking
    const project = allProjects.find(p => p.id === transaction.projectId);

    // Accountant: System Admin OR User with ACCOUNTANT finance role OR has pay_transactions permission
    const isAccountant = role === "ADMIN" || financeRole === "ACCOUNTANT" ||
        (project && hasProjectPermission(userId, project, "pay_transactions", currentUser));

    // Director/Approver: System Admin OR has approve_transactions permission in project
    const isDirector = role === "ADMIN" || financeRole === "MANAGER" || financeRole === "ADMIN" ||
        (project && hasProjectPermission(userId, project, "approve_transactions", currentUser));

    const isCreator = currentUser?.uid === transaction.userId || currentUser?.id === transaction.userId;

    const handleApprove = async () => {
        if (!confirm("Bạn có chắc chắn muốn duyệt yêu cầu này?")) return;
        setLoading(true);
        try {
            await updateTransactionStatus(transaction.id, "APPROVED");
            await updateDoc(doc(db, "finance_transactions", transaction.id), {
                amount: Number(editedAmount), // Use the possibly edited amount
                approvedBy: currentUser.displayName || currentUser.email,
                updatedAt: Date.now()
            });
            onUpdate();
        } catch (e) {
            console.error(e);
            alert("Lỗi khi duyệt");
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            alert("Vui lòng nhập lý do từ chối.");
            return;
        }

        setLoading(true);
        try {
            await updateTransactionStatus(transaction.id, "REJECTED");
            await updateDoc(doc(db, "finance_transactions", transaction.id), {
                rejectedBy: currentUser.displayName || currentUser.email,
                rejectionReason: rejectionReason,
                updatedAt: Date.now()
            });
            onUpdate();
            setIsRejecting(false);
        } catch (e) {
            console.error(e);
            alert("Lỗi khi từ chối");
        } finally {
            setLoading(false);
        }
    };

    const [pendingAction, setPendingAction] = useState<"PAY" | "CONFIRM" | null>(null);
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setUploadFiles(Array.from(e.target.files));
        }
    };

    const processAction = async () => {
        if (!pendingAction) return;
        if (uploadFiles.length === 0) {
            alert("Vui lòng tải lên tài liệu chứng minh.");
            return;
        }

        setUploading(true);
        try {
            // Upload all files
            const urls = await Promise.all(uploadFiles.map(file => uploadImage(file)));

            if (pendingAction === "PAY") {
                // Update Balance when marked as PAID
                try {
                    const accRef = doc(db, "finance_accounts", transaction.accountId);
                    const accSnap = await getDoc(accRef);
                    if (accSnap.exists()) {
                        const accData = accSnap.data();
                        const newBalance = (accData.balance || 0) - transaction.amount;
                        await updateDoc(accRef, { balance: newBalance });
                    }
                } catch (balanceError) {
                    console.error("Failed to update balance:", balanceError);
                    // Continue anyway? Or throw? Better throw to avoid inconsistent state
                    throw new Error("Không thể cập nhật số dư tài khoản. Vui lòng thử lại.");
                }

                await updateTransactionStatus(transaction.id, "PAID");
                await updateDoc(doc(db, "finance_transactions", transaction.id), {
                    paidBy: currentUser.displayName || currentUser.email,
                    proofOfPayment: urls,
                    updatedAt: Date.now()
                });
            } else if (pendingAction === "CONFIRM") {
                // Enforce 2 photos for Marketing Budget confirmation
                if (urls.length < 2) {
                    alert("Yêu cầu tối thiểu 2 ảnh bằng chứng để hoàn thành.");
                    setUploading(false);
                    return;
                }

                await updateTransactionStatus(transaction.id, "COMPLETED");
                await updateDoc(doc(db, "finance_transactions", transaction.id), {
                    confirmedBy: currentUser.displayName || currentUser.email,
                    proofOfReceipt: urls,
                    updatedAt: Date.now()
                });
            }

            onUpdate();
            setPendingAction(null);
            setUploadFiles([]);
        } catch (e) {
            console.error(e);
            alert("Lỗi khi xử lý: " + e);
        } finally {
            setUploading(false);
        }
    };

    const getStatusStep = () => {
        // Handle REJECTED status separately
        if (transaction.status === "REJECTED") {
            return (
                <div className="flex items-center justify-center w-full mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <XCircle size={24} className="text-red-400 mr-3" />
                    <div>
                        <div className="text-red-400 font-bold">Yêu cầu đã bị từ chối</div>
                        {transaction.rejectedBy && (
                            <div className="text-sm text-red-300/70">Bởi: {transaction.rejectedBy}</div>
                        )}
                    </div>
                </div>
            );
        }

        const steps = ["PENDING", "APPROVED", "PAID", "COMPLETED"];
        const currentIdx = steps.indexOf(transaction.status);
        return (
            <div className="flex items-center justify-between w-full mb-8 relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-white/10 -z-10 transform -translate-y-1/2"></div>
                {steps.map((s, i) => {
                    const isActive = i <= currentIdx;
                    const isCurrent = s === transaction.status;
                    return (
                        <div key={s} className="flex flex-col items-center bg-[#1e1e2e] px-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isActive ? "bg-blue-500 text-white" : "bg-white/10 text-[var(--muted)]"
                                }`}>
                                {i + 1}
                            </div>
                            <div className={`text-xs mt-1 ${isCurrent ? "text-blue-400 font-bold" : "text-[var(--muted)]"}`}>
                                {s === "PENDING" ? "Tạo YC" :
                                    s === "APPROVED" ? "Đã Duyệt" :
                                        s === "PAID" ? "Đã TT" : "Hoàn Thành"}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-3xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">Chi Tiết Yêu Cầu #{transaction.id.slice(0, 8)}</h2>
                        <span className="text-sm text-[var(--muted)]">{new Date(transaction.date).toLocaleString()}</span>
                    </div>
                    <button onClick={onClose} className="text-white/50 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {getStatusStep()}

                    {/* Main Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10 relative group">
                                <span className="text-sm text-[var(--muted)]">Số tiền yêu cầu</span>
                                {isEditing && transaction.status === "PENDING" && isDirector ? (
                                    <div className="flex items-center gap-2 mt-1">
                                        <input
                                            type="number"
                                            value={editedAmount}
                                            onChange={(e) => setEditedAmount(Number(e.target.value))}
                                            className="glass-input text-2xl font-bold text-blue-400 w-full"
                                            autoFocus
                                        />
                                        <button onClick={() => setIsEditing(false)} className="p-2 bg-green-600 rounded-lg text-white">Save</button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="text-3xl font-bold text-blue-400">
                                            {editedAmount.toLocaleString()} {transaction.currency}
                                        </div>
                                        {transaction.status === "PENDING" && isDirector && (
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors"
                                            >
                                                Điều chỉnh
                                            </button>
                                        )}
                                    </div>
                                )}
                                <div className="text-sm text-white mt-1">{transaction.category}</div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-[var(--muted)] mb-2 uppercase">Thông tin thụ hưởng</h3>
                                <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-[var(--muted)]">Đơn vị:</span>
                                        <span className="font-bold text-white">{transaction.beneficiary || "N/A"}</span>
                                    </div>
                                    {transaction.bankInfo && (
                                        <>
                                            <div className="flex justify-between">
                                                <span className="text-[var(--muted)]">Ngân hàng:</span>
                                                <span className="text-white">{transaction.bankInfo.bankName}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-[var(--muted)]">Số TK:</span>
                                                <span className="font-mono text-white">{transaction.bankInfo.accountNumber}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-[var(--muted)]">Chủ TK:</span>
                                                <span className="text-white uppercase">{transaction.bankInfo.accountName}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-[var(--muted)] mb-2 uppercase">Chi tiết</h3>
                                <div className="space-y-3">
                                    {transaction.status === "REJECTED" && transaction.rejectionReason && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                            <span className="block text-xs text-red-400 font-bold mb-1 uppercase">Lý do từ chối</span>
                                            <div className="text-red-200 text-sm italic">"{transaction.rejectionReason}"</div>
                                            <div className="text-[10px] text-red-400/50 mt-1">Bởi: {transaction.rejectedBy}</div>
                                        </div>
                                    )}
                                    <div>
                                        <span className="block text-xs text-[var(--muted)]">Nội dung chuyển khoản (Memo)</span>
                                        <div className="p-2 bg-white/5 rounded text-white text-sm">{transaction.transferContent || "N/A"}</div>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-[var(--muted)]">Mục đích sử dụng</span>
                                        <div className="p-2 bg-white/5 rounded text-white text-sm min-h-[60px]">
                                            {transaction.description || "N/A"}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Proofs */}
                            <div>
                                <h3 className="text-sm font-bold text-[var(--muted)] mb-2 uppercase">Chứng từ</h3>
                                <div className="space-y-3">
                                    {/* Supporting documents (uploaded when creating request) */}
                                    {transaction.images && transaction.images.length > 0 && (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-sm text-blue-400">
                                                <Upload size={14} />
                                                <span>Chứng từ đề xuất ({transaction.images.length} file):</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {transaction.images.map((url, i) => (
                                                    <a key={i} href={url} target="_blank" className="block w-16 h-16 rounded border border-blue-500/30 overflow-hidden relative hover:border-blue-400 transition-colors">
                                                        <img src={url} className="w-full h-full object-cover" alt={`doc-${i}`} />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Proof of payment (uploaded by accountant) */}
                                    {transaction.proofOfPayment && transaction.proofOfPayment.length > 0 && (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-sm text-purple-400">
                                                <CheckCircle size={14} />
                                                <span>Bill chuyển khoản ({transaction.proofOfPayment.length} ảnh):</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {transaction.proofOfPayment.map((url, i) => (
                                                    <a key={i} href={url} target="_blank" className="block w-16 h-16 rounded border border-purple-500/30 overflow-hidden relative hover:border-purple-400 transition-colors">
                                                        <img src={url} className="w-full h-full object-cover" alt={`bill-${i}`} />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Proof of receipt (uploaded when completing) */}
                                    {transaction.proofOfReceipt && transaction.proofOfReceipt.length > 0 && (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-sm text-green-400">
                                                <CheckCircle size={14} />
                                                <span>Xác nhận hoàn thành ({transaction.proofOfReceipt.length} ảnh):</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {transaction.proofOfReceipt.map((url, i) => (
                                                    <a key={i} href={url} target="_blank" className="block w-16 h-16 rounded border border-green-500/30 overflow-hidden relative hover:border-green-400 transition-colors">
                                                        <img src={url} className="w-full h-full object-cover" alt={`receipt-${i}`} />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* No documents */}
                                    {(!transaction.images || transaction.images.length === 0) &&
                                        !transaction.proofOfPayment &&
                                        !transaction.proofOfReceipt && (
                                            <div className="text-sm text-[var(--muted)] italic">Chưa có chứng từ</div>
                                        )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-[#1e1e2e]">
                    {transaction.status === "PENDING" && isDirector && !pendingAction && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsRejecting(true)}
                                disabled={loading}
                                className="px-6 py-2 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/50 rounded-lg font-bold transition-all"
                            >
                                Từ Chối
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={loading}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2"
                            >
                                <ShieldCheck size={18} /> Duyệt Yêu Cầu
                            </button>
                        </div>
                    )}

                    {transaction.status === "APPROVED" && isAccountant && !pendingAction && (
                        <button
                            onClick={() => setPendingAction("PAY")}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center gap-2"
                        >
                            <Upload size={18} /> Xác Nhận & Up Bill
                        </button>
                    )}

                    {transaction.status === "PAID" && isCreator && !pendingAction && (
                        <button
                            onClick={() => setPendingAction("CONFIRM")}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2"
                        >
                            <CheckCircle size={18} /> Xác Nhận & Hoàn Thành
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        className="px-4 py-2 hover:bg-white/10 text-[var(--muted)] hover:text-white rounded-lg transition-colors"
                    >
                        Đóng
                    </button>
                </div>

                {/* Reject Reason Form Overlay */}
                {isRejecting && (
                    <div className="absolute inset-0 bg-black/90 z-20 flex items-center justify-center p-6">
                        <div className="w-full max-w-md bg-[#1e1e2e] rounded-xl p-6 border border-white/10">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-white">Lý do từ chối</h3>
                                <button onClick={() => setIsRejecting(false)} className="text-white/50 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Nhập lý do từ chối yêu cầu này..."
                                className="glass-input w-full p-3 rounded-lg h-32 mb-4"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsRejecting(false)}
                                    className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={loading || !rejectionReason.trim()}
                                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold disabled:opacity-50"
                                >
                                    {loading ? "Đang xử lý..." : "Xác nhận Từ chối"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Upload Overlay */}
                {pendingAction && (
                    <div className="absolute inset-0 bg-black/90 z-10 flex items-center justify-center p-6">
                        <div className="w-full max-w-md bg-[#1e1e2e] rounded-xl p-6 border border-white/10">
                            <h3 className="text-xl font-bold text-white mb-2">
                                {pendingAction === "PAY" ? "Upload Bill Chuyển Khoản" : "Upload Bằng Chứng Nhận Tiền"}
                            </h3>
                            <p className="text-sm text-[var(--muted)] mb-4">
                                {pendingAction === "PAY"
                                    ? "Vui lòng chụp ảnh màn hình giao dịch chuyển khoản thành công."
                                    : "Vui lòng tải lên 2 ảnh chứng minh (Ví dụ: Số dư tài khoản Ads)."}
                            </p>

                            <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center mb-4">
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileChange}
                                    className="block w-full text-sm text-slate-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-50 file:text-blue-700
                                hover:file:bg-blue-100"
                                />
                                {uploadFiles.length > 0 && (
                                    <div className="mt-2 text-sm text-green-400">Đã chọn {uploadFiles.length} file</div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setPendingAction(null); setUploadFiles([]); }}
                                    className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={processAction}
                                    disabled={uploading || uploadFiles.length === 0}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex justify-center gap-2"
                                >
                                    {uploading ? "Đang upload..." : "Xác nhận & Lưu"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
