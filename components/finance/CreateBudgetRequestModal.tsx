"use client";

import { useState, useEffect } from "react";
import { X, Save, AlertCircle, Upload, ImageIcon, Trash2 } from "lucide-react";
import { getAccounts, getProjects, createTransaction } from "@/lib/finance";
import { Account, Project, Currency, TransactionType, BankInfo, TransactionStatus } from "@/types/finance";
import { getAccessibleProjects } from "@/lib/permissions";
import { uploadImage } from "../../lib/upload";


interface Props {
    onClose: () => void;
    onSuccess: () => void;
    username: string;
    userId: string;
    currentUser: any;
}

const BENEFICIARIES = [
    {
        id: "zeno",
        name: "ZENO AGENCY (Tiktok Ads)",
        bankInfo: {
            bankName: "Techcombank",
            accountNumber: "19036578901234", // Placeholder
            accountName: "CONG TY TNHH ZENO MEDIA", // Placeholder
            branch: "Hanoi"
        }
    },
    {
        id: "ecome",
        name: "ECOME AGENCY (Google Ads)",
        bankInfo: {
            bankName: "Vietcombank",
            accountNumber: "0011004567890", // Placeholder
            accountName: "CONG TY CP ECOME", // Placeholder
            branch: "HCM"
        }
    },
    {
        id: "facebook",
        name: "FACEBOOK ADS (Direct)",
        bankInfo: {
            bankName: "VISA/MASTER",
            accountNumber: "**** **** **** 1234",
            accountName: "FACEBOOK IRELAND LTD",
            branch: "International"
        }
    },
    {
        id: "other",
        name: "Khác / Other",
        bankInfo: {
            bankName: "",
            accountNumber: "",
            accountName: "",
            branch: ""
        }
    }
];


const FULL_CATEGORIES = [
    {
        group: "MARKETING",
        items: [
            "Nạp quỹ ADS ZENO AGENCY",
            "Nạp quỹ ADS ECOME AGENCY",
            "Chi phí Media",
            "Thưởng Marketing",
            "Lương cơ bản Marketing",
            "Thưởng %KPI Marketing"
        ]
    },
    {
        group: "VĂN PHÒNG",
        items: [
            "Tiền điện",
            "Wifi",
            "Phí vệ sinh",
            "Văn phòng phẩm",
            "Văn phòng Việt Nam",
            "Văn phòng Campuchia"
        ]
    },
    {
        group: "CHI PHÍ VẬN CHUYỂN",
        items: [
            "Cước chuyển VET",
            "Cước chuyển JNT",
            "Ship nội thành",
            "Cước chuyển SEA",
            "Cước chuyển ROAD"
        ]
    },
    {
        group: "SALE",
        items: [
            "Lương cơ bản Sale",
            "Thưởng Hotbonus",
            "Thưởng %KPI Sale"
        ]
    },
    {
        group: "THUẾ",
        items: [
            "Dịch vụ kế toán thuế",
            "Tư vấn thuế (Long Heng)",
            "Đóng thuế Tháng/Năm"
        ]
    }
];

const CATEGORIES = FULL_CATEGORIES.flatMap(c => c.items);


export default function CreateBudgetRequestModal({ onClose, onSuccess, username, userId, currentUser }: Props) {
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    // Form State
    const [projectId, setProjectId] = useState("");
    const [accountId, setAccountId] = useState("");
    const [beneficiary, setBeneficiary] = useState("");
    const [amount, setAmount] = useState<number>(0);
    const [currency, setCurrency] = useState<Currency>("VND");
    const [category, setCategory] = useState("Nạp quỹ ADS ZENO AGENCY");
    const [description, setDescription] = useState(""); // Purpose
    const [transferContent, setTransferContent] = useState(""); // Content
    const [bankInfo, setBankInfo] = useState<BankInfo>({
        bankName: "",
        accountNumber: "",
        accountName: "",
        branch: ""
    });

    // NEW: Supporting documents upload
    const [uploadingDocs, setUploadingDocs] = useState(false);
    const [docFiles, setDocFiles] = useState<File[]>([]);

    useEffect(() => {
        const loadData = async () => {
            const [accs, projs] = await Promise.all([getAccounts(), getProjects()]);
            setAccounts(accs);
            // Filter projects based on permissions
            const accessibleProjects = getAccessibleProjects(currentUser, projs);
            setProjects(accessibleProjects);

            // Default selection logic if needed
            if (accessibleProjects.length > 0) setProjectId(accessibleProjects[0].id);
        };
        loadData();
    }, [currentUser]);

    // Handle Beneficiary Change
    useEffect(() => {
        const selected = BENEFICIARIES.find(b => b.name === beneficiary);
        if (selected && selected.id !== 'other') {
            setBankInfo(selected.bankInfo);
            // Auto-update category if matches
            if (selected.id === "zeno") setCategory("Nạp quỹ ADS ZENO AGENCY");
            if (selected.id === "ecome") setCategory("Nạp quỹ ADS ECOME AGENCY");
        } else if (beneficiary === "") {
            setBankInfo({ bankName: "", accountNumber: "", accountName: "", branch: "" });
        }
    }, [beneficiary]);

    // Derived State
    const filteredAccounts = accounts.filter(a => a.projectId === projectId);
    const selectedAccount = accounts.find(a => a.id === accountId);

    // Auto-set currency when account changes
    useEffect(() => {
        if (selectedAccount) {
            setCurrency(selectedAccount.currency);
        }
    }, [selectedAccount]);

    // Filter categories based on account restrictions
    const getFilteredCategories = () => {
        if (!selectedAccount?.allowedCategories || selectedAccount.allowedCategories.length === 0) {
            return FULL_CATEGORIES;
        }


        // Filter groups/items logic
        return FULL_CATEGORIES.map(group => ({
            ...group,
            items: group.items.filter(item => selectedAccount.allowedCategories!.includes(item))
        })).filter(group => group.items.length > 0);
    };

    const displayCategories = getFilteredCategories();

    // Handle file selection for supporting docs
    const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setDocFiles(prev => [...prev, ...newFiles]);
        }
    };

    // Remove selected file
    const removeDocFile = (index: number) => {
        setDocFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Upload supporting docs
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
        if (!amount || !accountId || !category || !beneficiary) {
            alert("Vui lòng điền đầy đủ thông tin bắt buộc!");
            return;
        }

        setLoading(true);
        try {
            // Upload supporting documents first
            const uploadedDocs = await uploadSupportingDocs();

            const newTx = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                amount: Number(amount),
                currency,
                type: "OUT" as TransactionType,
                category,
                description: description,
                transferContent: transferContent,
                accountId,
                projectId: projectId || undefined,
                status: "PENDING" as TransactionStatus,
                createdBy: username,
                userId,
                beneficiary,
                bankInfo,
                images: uploadedDocs, // Supporting documents
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
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Tạo Yêu Cầu Xin Ngân Sách</h2>
                    <button onClick={onClose} className="text-white/50 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                    {/* Project & Account */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-[var(--muted)] mb-1">Dự án</label>
                            <select
                                value={projectId}
                                onChange={(e) => {
                                    setProjectId(e.target.value);
                                    setAccountId(""); // Reset account when project changes
                                }}
                                className="glass-input w-full p-2 rounded-lg"
                            >
                                <option value="">-- Chọn Dự Án --</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--muted)] mb-1">Nguồn tiền (Tài khoản)</label>
                            <select
                                value={accountId}
                                onChange={(e) => setAccountId(e.target.value)}
                                className="glass-input w-full p-2 rounded-lg"
                                disabled={!projectId}
                            >
                                <option value="">-- Chọn Tài Khoản --</option>
                                {filteredAccounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Beneficiary */}
                    <div>
                        <label className="block text-sm text-[var(--muted)] mb-1">Đơn vị thụ hưởng (Agency) *</label>
                        <select
                            value={beneficiary}
                            onChange={(e) => setBeneficiary(e.target.value)}
                            className="glass-input w-full p-2 rounded-lg font-bold text-blue-300"
                        >
                            <option value="">-- Chọn Đơn Vị --</option>
                            {BENEFICIARIES.map(b => (
                                <option key={b.id} value={b.name}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Bank Info (Auto-filled) */}
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
                                    readOnly={beneficiary !== "Khác / Other" && beneficiary !== ""}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[var(--muted)]">Số tài khoản</label>
                                <input
                                    value={bankInfo.accountNumber}
                                    onChange={(e) => setBankInfo({ ...bankInfo, accountNumber: e.target.value })}
                                    placeholder="STK"
                                    className="glass-input w-full p-2 rounded text-sm font-mono"
                                    readOnly={beneficiary !== "Khác / Other" && beneficiary !== ""}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs text-[var(--muted)]">Chủ tài khoản</label>
                                <input
                                    value={bankInfo.accountName}
                                    onChange={(e) => setBankInfo({ ...bankInfo, accountName: e.target.value })}
                                    placeholder="Tên chủ tài khoản"
                                    className="glass-input w-full p-2 rounded text-sm uppercase"
                                    readOnly={beneficiary !== "Khác / Other" && beneficiary !== ""}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Amount & Category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-[var(--muted)] mb-1">Số tiền đề xuất *</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    className="glass-input flex-1 p-2 rounded-lg text-lg font-bold"
                                    placeholder="0"
                                />
                                <div className="glass-input min-w-[80px] p-2 rounded-lg flex items-center justify-center bg-white/5 text-[var(--muted)]">
                                    {currency}
                                </div>
                            </div>
                            <div className="text-xs text-[var(--muted)] mt-1 italic">
                                * Loại tiền theo tài khoản nguồn
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--muted)] mb-1">Hạng mục *</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="glass-input w-full p-2 rounded-lg"
                            >
                                {displayCategories.map(group => (
                                    <optgroup key={group.group} label={group.group}>
                                        {group.items.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </optgroup>
                                ))}
                                <option value="Khác">Khác</option>
                            </select>
                        </div>
                    </div>

                    {/* Content */}
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

                    {/* NEW: Supporting Documents Upload */}
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

                        {/* Preview selected files */}
                        {docFiles.length > 0 && (
                            <div className="mt-3 space-y-2">
                                <div className="text-xs text-[var(--muted)]">Đã chọn {docFiles.length} file:</div>
                                <div className="flex flex-wrap gap-2">
                                    {docFiles.map((file, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                                            <ImageIcon size={14} className="text-blue-400" />
                                            <span className="text-sm text-white truncate max-w-[150px]">{file.name}</span>
                                            <button
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

                <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-lg hover:bg-white/5 text-[var(--muted)] hover:text-white transition-colors"
                    >
                        Hủy
                    </button>
                    <button
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
