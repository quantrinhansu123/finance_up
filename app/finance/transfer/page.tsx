"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createTransaction, getAccounts, updateAccountBalance, getProjects } from "@/lib/finance";
import { Account } from "@/types/finance";
import { getUserRole, Role, hasProjectPermission } from "@/lib/permissions";
import { ArrowRightLeft, ShieldX } from "lucide-react";
import CurrencyInput from "@/components/finance/CurrencyInput";

export default function TransferPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [, setUserRole] = useState<Role>("USER");
    const [canTransfer, setCanTransfer] = useState(false);

    // Form
    const [fromAccount, setFromAccount] = useState("");
    const [toAccount, setToAccount] = useState("");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");

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

            const userId = parsed.uid || parsed.id;

            // Chỉ ADMIN mới được chuyển tiền
            if (role === "ADMIN") {
                setCanTransfer(true);
                const accs = await getAccounts();
                setAccounts(accs);
                setLoading(false);
                return;
            } else {
                // USER không được chuyển tiền
                setCanTransfer(false);
                setAccounts([]);
                setLoading(false);
                return;
            }
        };

        loadData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const numAmount = parseFloat(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
                alert("Vui lòng nhập số tiền hợp lệ");
                return;
            }

            if (fromAccount === toAccount) {
                alert("Tài khoản nguồn và đích phải khác nhau");
                return;
            }

            const fromAcc = accounts.find(a => a.id === fromAccount);
            const toAcc = accounts.find(a => a.id === toAccount);

            if (!fromAcc || !toAcc) {
                alert("Tài khoản không tồn tại");
                return;
            }

            if (fromAcc.currency !== toAcc.currency) {
                alert(`Chưa hỗ trợ chuyển tiền khác loại tiền tệ (${fromAcc.currency} -> ${toAcc.currency})`);
                return;
            }

            if (fromAcc.balance < numAmount) {
                alert("Số dư tài khoản nguồn không đủ");
                return;
            }

            // Execute Transfer
            const timestamp = Date.now();
            const dateStr = new Date().toISOString();
            const transferRef = `TRF-${timestamp.toString().slice(-6)}`;

            // 1. OUT Transaction (From Source)
            await createTransaction({
                type: "OUT",
                amount: numAmount,
                currency: fromAcc.currency,
                category: "Chuyển tiền nội bộ",
                accountId: fromAcc.id,
                description: `Chuyển tiền đến ${toAcc.name}: ${description} (Ref: ${transferRef})`,
                date: dateStr,
                status: "APPROVED",
                createdBy: currentUser?.name || "System",
                userId: currentUser?.id || "system",
                createdAt: timestamp,
                updatedAt: timestamp,
            });

            // 2. IN Transaction (To Destination)
            await createTransaction({
                type: "IN",
                amount: numAmount,
                currency: toAcc.currency,
                category: "Nhận tiền nội bộ",
                source: "Chuyển khoản nội bộ",
                accountId: toAcc.id,
                description: `Nhận tiền từ ${fromAcc.name}: ${description} (Ref: ${transferRef})`,
                date: dateStr,
                status: "APPROVED",
                createdBy: currentUser?.name || "System",
                userId: currentUser?.id || "system",
                createdAt: timestamp,
                updatedAt: timestamp,
            });

            // 3. Update Balances
            await updateAccountBalance(fromAcc.id, fromAcc.balance - numAmount);
            await updateAccountBalance(toAcc.id, toAcc.balance + numAmount);

            alert("Chuyển tiền thành công!");

            // Reset
            setAmount("");
            setDescription("");
            setFromAccount("");
            setToAccount("");

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

    // Check permission
    if (!canTransfer) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                <ShieldX size={64} className="text-red-400 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">Chỉ dành cho Quản trị viên</h1>
                <p className="text-[var(--muted)] mb-4">Chức năng chuyển tiền nội bộ chỉ dành cho quản trị viên hệ thống.</p>
                <button
                    onClick={() => router.push("/finance")}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                >
                    Quay về Dashboard
                </button>
            </div>
        );
    }

    // Không có tài khoản nào
    if (accounts.length < 2) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                <ArrowRightLeft size={64} className="text-yellow-400 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">Không đủ tài khoản</h1>
                <p className="text-[var(--muted)] mb-4">Cần ít nhất 2 tài khoản để thực hiện chuyển tiền nội bộ.</p>
                <button
                    onClick={() => router.push("/finance")}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                >
                    Quay về Dashboard
                </button>
            </div>
        );
    }

    const sourceCurrency = accounts.find(a => a.id === fromAccount)?.currency;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Chuyển Tiền Nội Bộ</h1>
                <p className="text-[var(--muted)]">Chuyển quỹ giữa các tài khoản công ty</p>
            </div>

            <div className="glass-card p-8 rounded-2xl max-w-2xl mx-auto border border-white/10 relative overflow-hidden">
                {/* Decor */}
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <ArrowRightLeft size={100} />
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Source */}
                        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                            <label className="block text-sm font-bold text-red-400 mb-2">Tài khoản Nguồn (Gửi)</label>
                            <select
                                value={fromAccount}
                                onChange={e => setFromAccount(e.target.value)}
                                className="glass-input w-full p-2 rounded-lg"
                                required
                            >
                                <option value="">Chọn tài khoản</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.name} - {a.balance.toLocaleString()} {a.currency}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Destination */}
                        <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                            <label className="block text-sm font-bold text-green-400 mb-2">Tài khoản Đích (Nhận)</label>
                            <select
                                value={toAccount}
                                onChange={e => setToAccount(e.target.value)}
                                className="glass-input w-full p-2 rounded-lg"
                                required
                            >
                                <option value="">Chọn tài khoản</option>
                                {accounts
                                    .filter(a => a.id !== fromAccount)
                                    .filter(a => !sourceCurrency || a.currency === sourceCurrency) // Filter strictly by currency
                                    .map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.name} - {a.balance.toLocaleString()} {a.currency}
                                        </option>
                                    ))}
                            </select>
                            {fromAccount && (
                                <p className="text-xs text-[var(--muted)] mt-2">
                                    * Chỉ hiển thị tài khoản cùng loại tiền tệ ({sourceCurrency})
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Số tiền chuyển</label>
                        <CurrencyInput
                            value={amount}
                            onChange={setAmount}
                            currency={sourceCurrency}
                            required
                        />
                    </div>

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

                    <button
                        type="submit"
                        disabled={submitting}
                        className="glass-button w-full py-4 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white border-none text-lg flex items-center justify-center gap-2"
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
