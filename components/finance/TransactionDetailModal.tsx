"use client";

import { Transaction } from "@/types/finance";
import { X, User, CheckCircle, Calendar, Wallet, FileText, Image as ImageIcon, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { getUserById } from "@/lib/users";
import { UserProfile } from "@/types/user";
import { useTranslation } from "@/lib/i18n";

interface TransactionDetailModalProps {
    transaction: Transaction | null;
    isOpen: boolean;
    onClose: () => void;
    accountName?: string;
    projectName?: string;
}

export default function TransactionDetailModal({
    transaction,
    isOpen,
    onClose,
    accountName,
    projectName
}: TransactionDetailModalProps) {
    const { t, language } = useTranslation();
    const [creatorInfo, setCreatorInfo] = useState<UserProfile | null>(null);
    const [approverInfo, setApproverInfo] = useState<UserProfile | null>(null);
    const [loadingUsers, setLoadingUsers] = useState(false);

    useEffect(() => {
        if (!transaction || !isOpen) return;

        const loadUserInfo = async () => {
            setLoadingUsers(true);
            try {
                // Load creator info
                if (transaction.userId) {
                    const creator = await getUserById(transaction.userId);
                    setCreatorInfo(creator);
                }

                // Load approver info
                if (transaction.approvedBy) {
                    const approver = await getUserById(transaction.approvedBy);
                    setApproverInfo(approver);
                }
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
        if (currency === "VND") {
            return new Intl.NumberFormat('vi-VN').format(amount) + " VND";
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "APPROVED": return "bg-green-500/20 text-green-400 border-green-500/30";
            case "PENDING": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
            case "REJECTED": return "bg-red-500/20 text-red-400 border-red-500/30";
            default: return "bg-white/10 text-[var(--muted)] border-white/10";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "APPROVED": return t("approved");
            case "PENDING": return t("pending");
            case "REJECTED": return t("rejected");
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
                                {accountName || transaction.accountId}
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

                    {/* Approver */}
                    {transaction.status === "APPROVED" && transaction.approvedBy && (
                        <div className="p-4 bg-green-500/5 rounded-xl border border-green-500/20">
                            <div className="flex items-center gap-2 text-sm text-green-400 mb-3">
                                <CheckCircle size={14} />
                                {t("approver")}
                            </div>
                            {loadingUsers ? (
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
