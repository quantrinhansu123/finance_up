"use client";

import { Transaction } from "@/types/finance";
import { X, User, CheckCircle, Calendar, Wallet, FileText, Image as ImageIcon, Download, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { getUserById } from "@/lib/users";
import { UserProfile } from "@/types/user";
import { useTranslation } from "@/lib/i18n";

export interface ExpenseSettleActions {
    onUploadBills: (files: File[]) => Promise<void>;
    onConfirmPaid: () => Promise<void>;
    uploadBusy: boolean;
    confirmBusy: boolean;
}

interface TransactionDetailModalProps {
    transaction: Transaction | null;
    isOpen: boolean;
    onClose: () => void;
    accountName?: string;
    projectName?: string;
    /** Khi bật: khu vực chỉ tải bill + nút xác nhận đã chi (khoản chi đã duyệt chờ hoàn tất) */
    expenseSettle?: ExpenseSettleActions | null;
}

export default function TransactionDetailModal({
    transaction,
    isOpen,
    onClose,
    accountName,
    projectName,
    expenseSettle,
}: TransactionDetailModalProps) {
    const { t } = useTranslation();
    const [creatorInfo, setCreatorInfo] = useState<UserProfile | null>(null);
    const [approverInfo, setApproverInfo] = useState<UserProfile | null>(null);
    const [confirmerInfo, setConfirmerInfo] = useState<UserProfile | null>(null);
    const [loadingUsers, setLoadingUsers] = useState(false);

    useEffect(() => {
        if (!transaction || !isOpen) return;

        const loadUserInfo = async () => {
            setLoadingUsers(true);
            try {
                setCreatorInfo(null);
                setApproverInfo(null);
                setConfirmerInfo(null);

                const needApproverProfile =
                    !!transaction.approvedBy && !transaction.approverDisplayName?.trim();
                const [creator, approver, confirmer] = await Promise.all([
                    transaction.userId ? getUserById(transaction.userId) : Promise.resolve(null),
                    needApproverProfile ? getUserById(transaction.approvedBy!) : Promise.resolve(null),
                    transaction.confirmedBy ? getUserById(transaction.confirmedBy) : Promise.resolve(null),
                ]);
                setCreatorInfo(creator);
                setApproverInfo(approver);
                setConfirmerInfo(confirmer);
            } catch (error) {
                console.error("Failed to load user info", error);
            } finally {
                setLoadingUsers(false);
            }
        };

        loadUserInfo();
    }, [transaction, isOpen]);

    if (!isOpen || !transaction) return null;

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + " " + currency;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "APPROVED": return "bg-green-500/20 text-green-400 border-green-500/30";
            case "PENDING": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
            case "REJECTED": return "bg-red-500/20 text-red-400 border-red-500/30";
            case "COMPLETED": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
            case "PAID": return "bg-purple-500/20 text-purple-300 border-purple-500/30";
            default: return "bg-white/10 text-[var(--muted)] border-white/10";
        }
    };

    const getStatusLabel = (status: string) => {
        if (transaction.type === "IN") {
            if (status === "REJECTED") return t("rejected");
            return "Đã ghi nhận";
        }
        switch (status) {
            case "APPROVED": return t("approved");
            case "PENDING": return t("pending");
            case "REJECTED": return t("rejected");
            case "COMPLETED": return t("completed");
            case "PAID": return t("paid_status");
            default: return status;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-3xl p-6 rounded-2xl relative max-h-[90vh] overflow-y-auto">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-[var(--muted)] hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${transaction.type === "IN"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                        }`}>
                        <Wallet size={28} />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-white">
                            {t("transaction_detail")}
                        </h2>
                        <p className="text-sm text-[var(--muted)]">
                            {transaction.type === "IN" ? t("income_ticket") : t("expense_ticket")}
                        </p>
                    </div>
                    <div className={`px-4 py-2 rounded-lg border ${getStatusColor(transaction.status)}`}>
                        <span className="text-sm font-medium">{getStatusLabel(transaction.status)}</span>
                    </div>
                </div>

                {/* Amount */}
                <div className={`p-6 rounded-xl mb-6 ${transaction.type === "IN"
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-red-500/10 border border-red-500/20"
                    }`}>
                    <div className="text-sm text-[var(--muted)] mb-1">{t("amount")}</div>
                    <div className={`text-3xl font-bold ${transaction.type === "IN" ? "text-green-400" : "text-red-400"
                        }`}>
                        {transaction.type === "IN" ? "+" : "-"}
                        {formatCurrency(transaction.amount, transaction.currency)}
                    </div>
                </div>

                {/* Transaction Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-1">
                                <Calendar size={14} />
                                {t("date")}
                            </div>
                            <div className="text-white font-medium">
                                {new Date(transaction.date).toLocaleString('vi-VN', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-1">
                                <Wallet size={14} />
                                {t("account")}
                            </div>
                            <div className="text-white font-medium">
                                {accountName || (transaction.accountId ? transaction.accountId : "Chưa chỉ định")}
                            </div>
                        </div>

                        {projectName && (
                            <div>
                                <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-1">
                                    <FileText size={14} />
                                    {t("project")}
                                </div>
                                <div className="text-white font-medium">{projectName}</div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div>
                            <div className="text-sm text-[var(--muted)] mb-1">
                                {transaction.type === "IN" ? t("source") : t("category")}
                            </div>
                            <div className="text-white font-medium">
                                {transaction.source || transaction.category || "-"}
                            </div>
                        </div>

                        {transaction.parentCategory && (
                            <div>
                                <div className="text-sm text-[var(--muted)] mb-1">{t("parent_category")}</div>
                                <div className="text-white font-medium">{transaction.parentCategory}</div>
                            </div>
                        )}

                        {transaction.fundId && (
                            <div>
                                <div className="text-sm text-[var(--muted)] mb-1">{t("funds")}</div>
                                <div className="text-white font-medium">{transaction.fundId}</div>
                            </div>
                        )}

                        {transaction.paymentType && (
                            <div>
                                <div className="text-sm text-[var(--muted)] mb-1">{t("payment_type")}</div>
                                <div className={`text-sm font-bold px-2 py-0.5 rounded inline-block ${transaction.paymentType === "FULL" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                                    {transaction.paymentType === "FULL" ? t("full_payment") : t("partial_payment")}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Description */}
                {transaction.description && (
                    <div className="mb-6">
                        <div className="text-sm text-[var(--muted)] mb-2">{t("description")}</div>
                        <div className="p-4 bg-white/5 rounded-lg text-white">
                            {transaction.description}
                        </div>
                    </div>
                )}

                {(transaction.beneficiary || transaction.platform || transaction.transferContent || transaction.bankInfo) && (
                    <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                        <div className="text-sm font-bold text-blue-300 uppercase tracking-wide mb-2">Thụ hưởng & chuyển khoản</div>
                        {transaction.beneficiary && (
                            <div className="flex justify-between gap-4 text-sm">
                                <span className="text-[var(--muted)]">Đơn vị / Thụ hưởng</span>
                                <span className="text-white font-medium text-right">{transaction.beneficiary}</span>
                            </div>
                        )}
                        {transaction.platform && (
                            <div className="flex justify-between gap-4 text-sm">
                                <span className="text-[var(--muted)]">Nền tảng</span>
                                <span className="text-white text-right">{transaction.platform}</span>
                            </div>
                        )}
                        {transaction.transferContent && (
                            <div className="flex justify-between gap-4 text-sm">
                                <span className="text-[var(--muted)]">Nội dung CK</span>
                                <span className="text-white font-mono text-right break-all">{transaction.transferContent}</span>
                            </div>
                        )}
                        {transaction.bankInfo && (
                            <div className="mt-2 pt-2 border-t border-blue-500/20 space-y-1 text-sm">
                                <div className="flex justify-between gap-4">
                                    <span className="text-[var(--muted)]">Ngân hàng</span>
                                    <span className="text-white text-right">{transaction.bankInfo.bankName}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-[var(--muted)]">Số TK</span>
                                    <span className="text-white font-mono">{transaction.bankInfo.accountNumber}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-[var(--muted)]">Chủ TK</span>
                                    <span className="text-white text-right uppercase">{transaction.bankInfo.accountName}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* User Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Creator */}
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-3">
                            <User size={14} />
                            {t("creator")}
                        </div>
                        {loadingUsers ? (
                            <div className="text-sm text-[var(--muted)]">{t("loading")}</div>
                        ) : creatorInfo ? (
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">
                                    {(creatorInfo.displayName || creatorInfo.email)[0].toUpperCase()}
                                </div>
                                <div>
                                    <div className="text-white font-medium">
                                        {creatorInfo.displayName || creatorInfo.email}
                                    </div>
                                    <div className="text-xs text-[var(--muted)]">
                                        {creatorInfo.email}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-white">
                                {transaction.createdBy || transaction.userId || t("unknown")}
                            </div>
                        )}
                        <div className="text-xs text-[var(--muted)] mt-2">
                            {new Date(transaction.createdAt || transaction.date).toLocaleString('vi-VN')}
                        </div>
                    </div>

                    {/* Đã chi (chi phí): meta jsonb */}
                    {transaction.type === "OUT" && transaction.status === "COMPLETED" && transaction.paidConfirmMeta && (
                        <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                            <div className="flex items-center gap-2 text-sm text-emerald-400 mb-2">
                                <CheckCircle size={14} />
                                Đã chi
                            </div>
                            <div className="text-sm text-white font-medium">{transaction.paidConfirmMeta.byName}</div>
                            <div className="text-xs text-[var(--muted)] mt-2">
                                {new Date(transaction.paidConfirmMeta.at).toLocaleString("vi-VN")}
                            </div>
                        </div>
                    )}

                    {/* Completed (legacy: confirmed_by, khi không có paid_confirm_meta) */}
                    {transaction.status === "COMPLETED" && transaction.confirmedBy && !(transaction.type === "OUT" && transaction.paidConfirmMeta) && (
                        <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                            <div className="flex items-center gap-2 text-sm text-emerald-400 mb-2">
                                <CheckCircle size={14} />
                                {t("completed")}
                            </div>
                            {loadingUsers ? (
                                <div className="text-sm text-[var(--muted)]">{t("loading")}</div>
                            ) : confirmerInfo ? (
                                <div className="text-sm text-white font-medium">
                                    {confirmerInfo.displayName || confirmerInfo.email}
                                </div>
                            ) : (
                                <div className="text-sm text-white/90">{transaction.confirmedBy}</div>
                            )}
                            <div className="text-xs text-[var(--muted)] mt-2">
                                {new Date(transaction.updatedAt || Date.now()).toLocaleString("vi-VN")}
                            </div>
                        </div>
                    )}

                    {(transaction.approverDisplayName || transaction.approvedBy) &&
                        transaction.type !== "IN" &&
                        transaction.status !== "PENDING" &&
                        transaction.status !== "REJECTED" && (
                        <div className="p-4 bg-green-500/5 rounded-xl border border-green-500/20">
                            <div className="flex items-center gap-2 text-sm text-green-400 mb-3">
                                <CheckCircle size={14} />
                                {t("approver")}
                            </div>
                            {transaction.approverDisplayName?.trim() ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-sm font-bold">
                                        {transaction.approverDisplayName.trim()[0].toUpperCase()}
                                    </div>
                                    <div className="text-white font-medium">{transaction.approverDisplayName.trim()}</div>
                                </div>
                            ) : loadingUsers ? (
                                <div className="text-sm text-[var(--muted)]">{t("loading")}</div>
                            ) : approverInfo ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-sm font-bold">
                                        {(approverInfo.displayName || approverInfo.email)[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-white font-medium">
                                            {approverInfo.displayName || approverInfo.email}
                                        </div>
                                        <div className="text-xs text-[var(--muted)]">
                                            {approverInfo.email}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-white">{transaction.approvedBy}</div>
                            )}
                        </div>
                    )}

                </div>

                {/* Images */}
                {transaction.images && transaction.images.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-3">
                            <ImageIcon size={14} />
                            {t("attached_images_count").replace("{count}", transaction.images.length.toString())}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {transaction.images.map((url: string, index: number) => (
                                <a
                                    key={index}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group relative aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all"
                                >
                                    <img
                                        src={url}
                                        alt={`Hình ${index + 1}`}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Download size={24} className="text-white" />
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {expenseSettle && (
                    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-4">
                        <div className="flex items-start gap-2">
                            <CheckCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-100/95 leading-relaxed">{t("expense_settle_locked_hint")}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors">
                                <Upload size={18} className="text-amber-400" />
                                <span className="text-sm font-semibold text-white">{t("attached_images")}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    disabled={expenseSettle.uploadBusy}
                                    onChange={async (e) => {
                                        const files = e.target.files ? Array.from(e.target.files) : [];
                                        e.target.value = "";
                                        if (files.length === 0) return;
                                        await expenseSettle.onUploadBills(files);
                                    }}
                                />
                            </label>
                            {expenseSettle.uploadBusy && (
                                <span className="text-xs text-white/60">{t("processing")}</span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => expenseSettle.onConfirmPaid()}
                            disabled={expenseSettle.confirmBusy || expenseSettle.uploadBusy}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold shadow-lg shadow-amber-900/30 hover:opacity-95 transition-opacity disabled:opacity-40"
                        >
                            {expenseSettle.confirmBusy ? t("processing") : t("confirm_paid_expense")}
                        </button>
                    </div>
                )}

                {/* Close Button */}
                <div className="flex justify-end pt-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        {t("close")}
                    </button>
                </div>
            </div>
        </div>
    );
}
