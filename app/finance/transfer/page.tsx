"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createTransaction, getAccounts, updateAccountBalance } from "@/lib/finance";
import { Account } from "@/types/finance";
import { getUserRole, Role } from "@/lib/permissions";
import { ArrowRightLeft, ShieldX, Upload, RefreshCw } from "lucide-react";
import CurrencyInput from "@/components/finance/CurrencyInput";
import { uploadImage } from "@/lib/upload";
import { getExchangeRates, convertCurrency } from "@/lib/currency";
import SearchableSelect from "@/components/finance/SearchableSelect";


const CURRENCY_FLAGS: Record<string, string> = { "VND": "🇻🇳", "USD": "🇺🇸", "KHR": "🇰🇭", "TRY": "🇹🇷" };

export default function TransferPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [, setUserRole] = useState<Role>("USER");
    const [canTransfer, setCanTransfer] = useState(false);
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

    // Form
    const [fromAccount, setFromAccount] = useState("");
    const [toAccount, setToAccount] = useState("");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [files, setFiles] = useState<File[]>([]);

    // Exchange rate options
    const [useCustomRate, setUseCustomRate] = useState(false);
    const [customRate, setCustomRate] = useState("");

    const fromAcc = useMemo(() => accounts.find(a => a.id === fromAccount), [accounts, fromAccount]);
    const toAcc = useMemo(() => accounts.find(a => a.id === toAccount), [accounts, toAccount]);
    const isDifferentCurrency = fromAcc && toAcc && fromAcc.currency !== toAcc.currency;

    // API exchange rate (1 fromCurrency = ? toCurrency)
    const apiRate = useMemo(() => {
        if (!fromAcc || !toAcc || fromAcc.currency === toAcc.currency) return 1;
        const fromRate = exchangeRates[fromAcc.currency] || 1;
        const toRate = exchangeRates[toAcc.currency] || 1;
        return toRate / fromRate;
    }, [fromAcc, toAcc, exchangeRates]);

    // Effective rate (custom or API)
    const effectiveRate = useMemo(() => {
        if (!isDifferentCurrency) return 1;
        if (useCustomRate && customRate) return parseFloat(customRate) || apiRate;
        return apiRate;
    }, [isDifferentCurrency, useCustomRate, customRate, apiRate]);

    // Final received amount
    const finalReceivedAmount = useMemo(() => {
        const numAmount = parseFloat(amount) || 0;
        return numAmount * effectiveRate;
    }, [amount, effectiveRate]);

    useEffect(() => {
        const loadData = async () => {
            const u = localStorage.getItem("user") || sessionStorage.getItem("user");
            if (!u) {
                setLoading(false);
                return;
            }

            const parsed = JSON.parse(u);
            setCurrentUser(parsed);
            const role = getUserRole(parsed);
            setUserRole(role);

            // Chỉ ADMIN mới được chuyển tiền
            if (role === "ADMIN") {
                setCanTransfer(true);
                const [accs, rates] = await Promise.all([getAccounts(), getExchangeRates()]);
                setAccounts(accs);
                setExchangeRates(rates);
            } else {
                setCanTransfer(false);
                setAccounts([]);
            }
            setLoading(false);
        };

        loadData();
    }, []);

    // Reset custom rate when switching accounts
    useEffect(() => {
        setCustomRate("");
        setUseCustomRate(false);
    }, [fromAccount, toAccount]);

    // Auto-fill custom rate with API rate when enabling custom mode
    useEffect(() => {
        if (useCustomRate && !customRate && apiRate > 0) {
            setCustomRate(apiRate.toFixed(4));
        }
    }, [useCustomRate, apiRate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const numAmount = parseFloat(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
                alert("Vui lòng nhập số tiền hợp lệ");
                setSubmitting(false);
                return;
            }

            if (fromAccount === toAccount) {
                alert("Tài khoản nguồn và đích phải khác nhau");
                setSubmitting(false);
                return;
            }

            if (!fromAcc || !toAcc) {
                alert("Tài khoản không tồn tại");
                setSubmitting(false);
                return;
            }

            if (fromAcc.balance < numAmount) {
                alert("Số dư tài khoản nguồn không đủ");
                setSubmitting(false);
                return;
            }

            // Execute Transfer
            const timestamp = Date.now();
            const dateStr = new Date().toISOString();
            const transferRef = `TRF-${timestamp.toString().slice(-6)}`;

            // Upload images (max 2)
            const imageUrls: string[] = [];
            if (files.length > 0) {
                for (const file of files.slice(0, 2)) {
                    const url = await uploadImage(file);
                    imageUrls.push(url);
                }
            }

            // Determine received amount
            const receivedAmount = isDifferentCurrency ? finalReceivedAmount : numAmount;
            const rateInfo = isDifferentCurrency
                ? ` | Tỷ giá: 1 ${fromAcc.currency} = ${effectiveRate.toFixed(4)} ${toAcc.currency}`
                : "";

            // 1. OUT Transaction (From Source)
            await createTransaction({
                type: "OUT",
                amount: numAmount,
                currency: fromAcc.currency,
                category: "Chuyển tiền nội bộ",
                accountId: fromAcc.id,
                description: `Chuyển đến ${toAcc.name}: ${description}${rateInfo} (Ref: ${transferRef})`,
                date: dateStr,
                status: "APPROVED",
                createdBy: currentUser?.name || "System",
                userId: currentUser?.id || "system",
                images: imageUrls,
                createdAt: timestamp,
                updatedAt: timestamp,
            });

            // 2. IN Transaction (To Destination)
            await createTransaction({
                type: "IN",
                amount: receivedAmount,
                currency: toAcc.currency,
                category: "Nhận tiền nội bộ",
                source: "Chuyển khoản nội bộ",
                accountId: toAcc.id,
                description: `Nhận từ ${fromAcc.name}: ${description}${rateInfo} (Ref: ${transferRef})`,
                date: dateStr,
                status: "APPROVED",
                createdBy: currentUser?.name || "System",
                userId: currentUser?.id || "system",
                images: imageUrls,
                createdAt: timestamp,
                updatedAt: timestamp,
            });

            // 3. Update Balances
            await updateAccountBalance(fromAcc.id, fromAcc.balance - numAmount);
            await updateAccountBalance(toAcc.id, toAcc.balance + receivedAmount);

            alert("Chuyển tiền thành công!");

            // Reset
            setAmount("");
            setDescription("");
            setFromAccount("");
            setToAccount("");
            setFiles([]);
            setUseCustomRate(false);
            setCustomRate("");

            // Refresh accounts
            const updatedAccs = await getAccounts();
            setAccounts(updatedAccs);

        } catch (error) {
            console.error("Transfer failed", error);
            alert("Lỗi khi chuyển tiền");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-[var(--muted)]">Loading...</div>;

    if (!canTransfer) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                <ShieldX size={64} className="text-red-400 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">Chỉ dành cho Quản trị viên</h1>
                <p className="text-[var(--muted)] mb-4">Chức năng chuyển tiền nội bộ chỉ dành cho quản trị viên hệ thống.</p>
                <button onClick={() => router.push("/finance")} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">
                    Quay về Dashboard
                </button>
            </div>
        );
    }

    if (accounts.length < 2) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                <ArrowRightLeft size={64} className="text-yellow-400 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">Không đủ tài khoản</h1>
                <p className="text-[var(--muted)] mb-4">Cần ít nhất 2 tài khoản để thực hiện chuyển tiền nội bộ.</p>
                <button onClick={() => router.push("/finance")} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">
                    Quay về Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Chuyển Tiền Nội Bộ</h1>
                <p className="text-[var(--muted)]">Chuyển quỹ giữa các tài khoản công ty (hỗ trợ đa tiền tệ)</p>
            </div>

            <div className="glass-card p-8 rounded-2xl max-w-2xl mx-auto border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <ArrowRightLeft size={100} />
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Source */}
                        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                            <label className="block text-sm font-bold text-red-400 mb-2">Tài khoản Nguồn (Gửi)</label>
                            <SearchableSelect
                                options={accounts.map(a => ({
                                    id: a.id,
                                    label: a.name,
                                    subLabel: `${a.balance.toLocaleString()} ${a.currency}`,
                                    icon: CURRENCY_FLAGS[a.currency]
                                }))}
                                value={fromAccount}
                                onChange={val => { setFromAccount(val); setToAccount(""); }}
                                placeholder="Chọn tài khoản nguồn"
                                searchPlaceholder="Tìm theo tên hoặc số dư..."
                                required
                            />
                        </div>

                        {/* Destination */}
                        <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                            <label className="block text-sm font-bold text-green-400 mb-2">Tài khoản Đích (Nhận)</label>
                            <SearchableSelect
                                options={accounts
                                    .filter(a => a.id !== fromAccount)
                                    .map(a => ({
                                        id: a.id,
                                        label: a.name,
                                        subLabel: `${a.balance.toLocaleString()} ${a.currency}`,
                                        icon: CURRENCY_FLAGS[a.currency]
                                    }))}
                                value={toAccount}
                                onChange={setToAccount}
                                placeholder="Chọn tài khoản đích"
                                searchPlaceholder="Tìm theo tên hoặc số dư..."
                                disabled={!fromAccount}
                                required
                            />
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                            Số tiền chuyển {fromAcc && `(${fromAcc.currency})`}
                        </label>
                        <CurrencyInput value={amount} onChange={setAmount} currency={fromAcc?.currency} required />
                        {fromAcc && parseFloat(amount) > 0 && (
                            <p className="text-xs text-[var(--muted)] mt-1">
                                Số dư sau chuyển: <span className={fromAcc.balance - parseFloat(amount) >= 0 ? "text-green-400" : "text-red-400"}>
                                    {(fromAcc.balance - parseFloat(amount)).toLocaleString()} {fromAcc.currency}
                                </span>
                            </p>
                        )}
                    </div>

                    {/* Exchange Rate Section - Only show when different currencies */}
                    {isDifferentCurrency && (
                        <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <RefreshCw size={16} className="text-yellow-400" />
                                    <span className="text-sm font-bold text-yellow-400">Quy đổi tiền tệ</span>
                                </div>
                                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                                    {fromAcc?.currency} → {toAcc?.currency}
                                </span>
                            </div>

                            {/* API Rate Info */}
                            <div className="p-3 bg-black/20 rounded-lg">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-[var(--muted)]">Tỷ giá API:</span>
                                    <span className="text-white font-mono">
                                        1 {fromAcc?.currency} = {apiRate.toFixed(4)} {toAcc?.currency}
                                    </span>
                                </div>
                            </div>

                            {/* Custom Rate Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={useCustomRate}
                                    onChange={e => setUseCustomRate(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm text-white">Tự nhập tỷ giá</span>
                            </label>

                            {/* Custom Rate Input */}
                            {useCustomRate && (
                                <div>
                                    <label className="block text-xs text-[var(--muted)] mb-1">
                                        Tỷ giá (1 {fromAcc?.currency} = ? {toAcc?.currency})
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={customRate}
                                        onChange={e => setCustomRate(e.target.value)}
                                        className="glass-input w-full p-3 rounded-xl font-mono"
                                        placeholder={apiRate.toFixed(4)}
                                    />
                                </div>
                            )}

                            {/* Final Summary */}
                            {parseFloat(amount) > 0 && (
                                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                                    <div className="flex justify-between items-center text-sm mb-1">
                                        <span className="text-[var(--muted)]">Tỷ giá áp dụng:</span>
                                        <span className="text-white font-mono">
                                            1 {fromAcc?.currency} = {effectiveRate.toFixed(4)} {toAcc?.currency}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-green-400">Số tiền sẽ nhận:</span>
                                        <span className="text-lg font-bold text-green-400">
                                            {CURRENCY_FLAGS[toAcc?.currency || "USD"]} {finalReceivedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {toAcc?.currency}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Ghi chú</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="glass-input w-full p-3 rounded-xl"
                            rows={2}
                            placeholder="Lý do chuyển tiền..."
                        ></textarea>
                    </div>

                    {/* Upload Images */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Chứng từ đính kèm (tối đa 2 ảnh)</label>
                        <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-white/20 transition-colors">
                            <Upload size={20} className="text-white/40" />
                            <span className="text-sm text-white/40">
                                {files.length > 0 ? `${files.length} file đã chọn` : "Chọn ảnh chứng từ"}
                            </span>
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 2))}
                                className="hidden"
                            />
                        </label>
                        {files.length > 0 && (
                            <div className="flex gap-2 mt-2">
                                {files.map((file, idx) => (
                                    <div key={idx} className="relative">
                                        <img
                                            src={URL.createObjectURL(file)}
                                            alt={`Preview ${idx + 1}`}
                                            className="w-16 h-16 object-cover rounded-lg border border-white/10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || (fromAcc && parseFloat(amount) > fromAcc.balance)}
                        className="glass-button w-full py-4 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white border-none text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? "Đang xử lý..." : (
                            <>
                                <ArrowRightLeft size={20} />
                                Xác nhận Chuyển tiền
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
