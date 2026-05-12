"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Save, Upload, ImageIcon, Trash2 } from "lucide-react";
import {
    createTransaction,
    getBeneficiaries,
    BUDGET_REQUEST_CATEGORY,
    BUDGET_REQUEST_CATEGORY_SEPARATOR,
} from "@/lib/finance";
import { getMasterCategories, getMasterSubCategories } from "@/lib/master-categories";
import { Currency, TransactionType, BankInfo, TransactionStatus, Beneficiary, MasterCategory, MasterSubCategory } from "@/types/finance";
import BudgetRequestCategoryPicker from "./BudgetRequestCategoryPicker";
import { uploadImage } from "../../lib/upload";
import CurrencyInput from "./CurrencyInput";


interface Props {
    onClose: () => void;
    onSuccess: () => void;
    username: string;
    userId: string;
}


export default function CreateBudgetRequestModal({ onClose, onSuccess, username, userId }: Props) {
    const [loading, setLoading] = useState(false);
    const [allBeneficiaries, setAllBeneficiaries] = useState<Beneficiary[]>([]);
    const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState("");
    const [selectedPlatform, setSelectedPlatform] = useState("");

    const [beneficiary, setBeneficiary] = useState("");
    const [amount, setAmount] = useState<number>(0);
    const [currency, setCurrency] = useState<Currency>("VND");
    const [description, setDescription] = useState("");
    const [transferContent, setTransferContent] = useState("");
    const [bankInfo, setBankInfo] = useState<BankInfo>({
        bankName: "",
        accountNumber: "",
        accountName: "",
        branch: ""
    });

    const [uploadingDocs, setUploadingDocs] = useState(false);
    const [docFiles, setDocFiles] = useState<File[]>([]);

    const [masterCategories, setMasterCategories] = useState<MasterCategory[]>([]);
    const [globalSubCategories, setGlobalSubCategories] = useState<MasterSubCategory[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<string[]>([BUDGET_REQUEST_CATEGORY]);

    useEffect(() => {
        const loadData = async () => {
            const [beneficiaries, cats, subs] = await Promise.all([
                getBeneficiaries(),
                getMasterCategories(),
                getMasterSubCategories(),
            ]);
            setAllBeneficiaries(beneficiaries);
            setMasterCategories(cats.filter((c) => c.isActive && c.type === "EXPENSE"));
            setGlobalSubCategories(subs.filter((c) => c.isActive));
        };
        void loadData();
    }, []);

    const expenseCategorySuggestions = useMemo(() => {
        const names = new Set<string>();
        names.add(BUDGET_REQUEST_CATEGORY);
        const expenseMasterIds = new Set(masterCategories.map((m) => m.id));
        for (const s of globalSubCategories) {
            if (expenseMasterIds.has(s.parentCategoryId)) names.add(s.name);
        }
        return Array.from(names);
    }, [masterCategories, globalSubCategories]);

    useEffect(() => {
        const selected = allBeneficiaries.find(b => b.id === selectedBeneficiaryId);
        if (selected) {
            setBeneficiary(selected.name);
            if (selected.platforms.length === 1) {
                setSelectedPlatform(selected.platforms[0]);
            } else {
                setSelectedPlatform("");
            }
            if (selected.bankAccounts.length > 0) {
                setBankInfo(selected.bankAccounts[0]);
            }
        }
    }, [selectedBeneficiaryId, allBeneficiaries]);

    const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setDocFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeDocFile = (index: number) => {
        setDocFiles(prev => prev.filter((_, i) => i !== index));
    };

    const uploadSupportingDocs = async (): Promise<string[]> => {
        if (docFiles.length === 0) return [];
        setUploadingDocs(true);
        try {
            const urls = await Promise.all(docFiles.map(file => uploadImage(file)));
            return urls;
        } finally {
            setUploadingDocs(false);
        }
    };

    const handleSubmit = async () => {
        if (!amount || !beneficiary) {
            alert("Vui lòng điền đầy đủ thông tin bắt buộc!");
            return;
        }
        if (expenseCategories.length === 0) {
            alert("Vui lòng chọn ít nhất một hạng mục chi phí.");
            return;
        }

        setLoading(true);
        try {
            const uploadedDocs = await uploadSupportingDocs();

            const uid = userId || "";
            const creatorLabel = (username && username.trim()) || uid || "—";
            const newTx = {
                date: new Date().toISOString(),
                amount: Number(amount),
                currency,
                type: "OUT" as TransactionType,
                category: expenseCategories.map((c) => c.trim()).filter(Boolean).join(BUDGET_REQUEST_CATEGORY_SEPARATOR),
                description: description,
                transferContent: transferContent,
                status: "PENDING" as TransactionStatus,
                createdBy: creatorLabel,
                userId: uid || creatorLabel,
                beneficiary,
                platform: selectedPlatform,
                bankInfo,
                images: uploadedDocs,
                isBudgetRequest: true,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            await createTransaction(newTx);
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Có lỗi xảy ra khi tạo yêu cầu.");
        } finally {
            setLoading(false);

        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-2xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-white">Tạo Yêu Cầu Xin Ngân Sách</h2>
                    <button onClick={onClose} className="text-white/50 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                            <label className="block text-[10px] uppercase font-bold text-white/40 tracking-wider mb-2">
                                Hạng mục chi phí *
                            </label>
                            <BudgetRequestCategoryPicker
                                value={expenseCategories}
                                onChange={setExpenseCategories}
                                suggestions={expenseCategorySuggestions}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-[var(--muted)] mb-1">Đơn vị thụ hưởng *</label>
                            <select
                                value={selectedBeneficiaryId}
                                onChange={(e) => setSelectedBeneficiaryId(e.target.value)}
                                className="glass-input w-full p-3 rounded-xl font-bold text-blue-300"
                            >
                                <option value="">-- Chọn Công Ty / Agency --</option>
                                {allBeneficiaries.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                                <option value="manual">-- Khác (Nhập thủ công) --</option>
                            </select>
                        </div>

                        {selectedBeneficiaryId === "manual" && (
                            <div>
                                <label className="block text-sm text-[var(--muted)] mb-1">Tên đơn vị khác *</label>
                                <input
                                    type="text"
                                    value={beneficiary}
                                    onChange={(e) => setBeneficiary(e.target.value)}
                                    placeholder="Nhập tên đơn vị..."
                                    className="glass-input w-full p-3 rounded-xl font-bold text-white"
                                />
                            </div>
                        )}

                        {selectedBeneficiaryId && selectedBeneficiaryId !== "manual" && (
                            <>
                                <div>
                                    <label className="block text-sm text-[var(--muted)] mb-1">Nền tảng / Platform *</label>
                                    <select
                                        value={selectedPlatform}
                                        onChange={(e) => setSelectedPlatform(e.target.value)}
                                        className="glass-input w-full p-3 rounded-xl font-bold text-green-400"
                                    >
                                        <option value="">-- Chọn nền tảng --</option>
                                        {allBeneficiaries.find(b => b.id === selectedBeneficiaryId)?.platforms.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm text-[var(--muted)] mb-1">Tài khoản ngân hàng thụ hưởng *</label>
                                    <select
                                        onChange={(e) => {
                                            const idx = parseInt(e.target.value);
                                            const accs = allBeneficiaries.find(b => b.id === selectedBeneficiaryId)?.bankAccounts;
                                            if (accs && accs[idx]) setBankInfo(accs[idx]);
                                        }}
                                        className="glass-input w-full p-3 rounded-xl font-mono text-sm text-white"
                                    >
                                        {allBeneficiaries.find(b => b.id === selectedBeneficiaryId)?.bankAccounts.map((acc, idx) => (
                                            <option key={idx} value={idx}>
                                                {acc.bankName} - {acc.accountNumber} ({acc.accountName})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="bg-white/5 p-4 rounded-lg space-y-2">
                        <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] font-bold">Thông tin chuyển khoản</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-[var(--muted)]">Ngân hàng</label>
                                <input
                                    value={bankInfo.bankName}
                                    onChange={(e) => setBankInfo({ ...bankInfo, bankName: e.target.value })}
                                    placeholder="Tên ngân hàng"
                                    className="glass-input w-full p-2 rounded text-sm"
                                    readOnly={!!selectedBeneficiaryId && selectedBeneficiaryId !== "manual"}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[var(--muted)]">Số tài khoản</label>
                                <input
                                    value={bankInfo.accountNumber}
                                    onChange={(e) => setBankInfo({ ...bankInfo, accountNumber: e.target.value })}
                                    placeholder="STK"
                                    className="glass-input w-full p-2 rounded text-sm font-mono"
                                    readOnly={!!selectedBeneficiaryId && selectedBeneficiaryId !== "manual"}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs text-[var(--muted)]">Chủ tài khoản</label>
                                <input
                                    value={bankInfo.accountName}
                                    onChange={(e) => setBankInfo({ ...bankInfo, accountName: e.target.value })}
                                    placeholder="Tên chủ tài khoản"
                                    className="glass-input w-full p-2 rounded text-sm uppercase"
                                    readOnly={!!selectedBeneficiaryId && selectedBeneficiaryId !== "manual"}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-[var(--muted)] mb-1">Số tiền đề xuất *</label>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="col-span-3">
                                        <CurrencyInput
                                            value={amount}
                                            onChange={(val) => setAmount(Number(val))}
                                            currency={currency}
                                            className="text-xl font-bold"
                                            placeholder="0"
                                        />
                                    </div>
                                    <select
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value as Currency)}
                                        className="glass-input p-2 rounded-xl text-center font-bold text-blue-400"
                                    >
                                        <option value="VND">VND</option>
                                        <option value="USD">USD</option>
                                        <option value="KHR">KHR</option>
                                        <option value="THB">THB</option>
                                        <option value="TRY">TRY</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-[var(--muted)] mb-1">Nội dung chuyển khoản (Memo)</label>
                        <input
                            value={transferContent}
                            onChange={(e) => setTransferContent(e.target.value)}
                            placeholder="Ví dụ: Thanh toan HD QC Thang 2..."
                            className="glass-input w-full p-2 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-[var(--muted)] mb-1">Mục đích sử dụng (Chi tiết)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Mô tả chi tiết mục đích sử dụng ngân sách này..."
                            className="glass-input w-full p-2 rounded-lg h-24"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-[var(--muted)] mb-1">
                            Chứng từ đề xuất (Báo giá, Hợp đồng, Hóa đơn...)
                        </label>
                        <div className="border-2 border-dashed border-white/20 rounded-xl p-4 text-center">
                            <input
                                type="file"
                                multiple
                                accept="image/*,.pdf"
                                onChange={handleDocFileChange}
                                className="hidden"
                                id="doc-upload"
                            />
                            <label
                                htmlFor="doc-upload"
                                className="cursor-pointer flex flex-col items-center gap-2 text-[var(--muted)] hover:text-white transition-colors"
                            >
                                <Upload size={24} />
                                <span className="text-sm">Click để chọn file hoặc kéo thả vào đây</span>
                                <span className="text-xs text-white/30">Hỗ trợ: JPG, PNG, PDF</span>
                            </label>
                        </div>

                        {docFiles.length > 0 && (
                            <div className="mt-3 space-y-2">
                                <div className="text-xs text-[var(--muted)]">Đã chọn {docFiles.length} file:</div>
                                <div className="flex flex-wrap gap-2">
                                    {docFiles.map((file, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                                            <ImageIcon size={14} className="text-blue-400" />
                                            <span className="text-sm text-white truncate max-w-[150px]">{file.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeDocFile(i)}
                                                className="text-red-400 hover:text-red-300"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-white/10 flex justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 rounded-lg hover:bg-white/5 text-[var(--muted)] hover:text-white transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || uploadingDocs}
                        className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors flex items-center gap-2"
                    >
                        {loading || uploadingDocs ? (
                            uploadingDocs ? "Đang upload..." : "Đang xử lý..."
                        ) : (
                            <>
                                <Save size={18} />
                                Gửi Yêu Cầu
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
