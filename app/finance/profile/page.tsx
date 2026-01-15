"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { getUserRole } from "@/lib/permissions";
import { Save, Eye, EyeOff, User, Mail, Phone, Briefcase, Shield, Calendar, Key, Edit3, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function ProfilePage() {
    const { t } = useTranslation();
    const router = useRouter();

    const FINANCE_ROLES: Record<string, string> = useMemo(() => ({
        NONE: t("role_none"),
        STAFF: t("role_staff"),
        TREASURER: t("role_treasurer"),
        ACCOUNTANT: t("role_accountant"),
        MANAGER: t("role_manager"),
        ADMIN: t("role_admin"),
    }), [t]);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [editMode, setEditMode] = useState(false);

    const [form, setForm] = useState({
        displayName: "",
        phoneNumber: "",
        password: "",
    });

    useEffect(() => {
        const stored = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (stored) {
            const parsed = JSON.parse(stored);
            setUser(parsed);
            setForm({
                displayName: parsed.displayName || "",
                phoneNumber: parsed.phoneNumber || "",
                password: parsed.password || "",
            });
        } else {
            router.push("/login");
        }
        setLoading(false);
    }, [router]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "users", user.uid || user.id), {
                displayName: form.displayName,
                phoneNumber: form.phoneNumber,
                password: form.password,
                updatedAt: new Date(),
            });

            const updatedUser = { ...user, ...form };
            const storage = localStorage.getItem("user") ? localStorage : sessionStorage;
            storage.setItem("user", JSON.stringify(updatedUser));
            setUser(updatedUser);
            setEditMode(false);
            alert(t("update_success"));
        } catch (error) {
            console.error("Failed to update profile", error);
            alert(t("update_error"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-[var(--muted)]">{t("loading")}</div>;
    if (!user) return null;

    const role = getUserRole(user);
    const position = user.employment?.position || user.position || t("not_updated");

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{t("my_account")}</h1>
                    <p className="text-sm text-[var(--muted)]">{t("manage_personal_info")}</p>
                </div>
                {!editMode && (
                    <button
                        onClick={() => setEditMode(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Edit3 size={16} /> {t("edit_profile")}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Avatar & Quick Info */}
                <div className="lg:col-span-1">
                    <div className="glass-card p-6 rounded-xl border border-white/10 text-center">
                        {/* Avatar */}
                        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-lg">
                            {(form.displayName || user.email || "U").charAt(0).toUpperCase()}
                        </div>

                        <h2 className="mt-4 text-xl font-bold text-white">
                            {form.displayName || t("not_updated")}
                        </h2>
                        <p className="text-sm text-[var(--muted)]">{user.email}</p>

                        {/* Badges */}
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                {FINANCE_ROLES[user.financeRole] || FINANCE_ROLES[role] || t("role_staff")}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                {position}
                            </span>
                        </div>

                        {/* Quick Stats */}
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <p className="text-lg font-bold text-white">{role}</p>
                                    <p className="text-xs text-[var(--muted)]">{t("system_permission")}</p>
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-white">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) : "N/A"}
                                    </p>
                                    <p className="text-xs text-[var(--muted)]">{t("created_date")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column - Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Personal Info Card */}
                    <div className="glass-card p-6 rounded-xl border border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <User size={18} className="text-blue-400" /> {t("personal_info")}
                            </h3>
                            {editMode && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
                                    >
                                        <Save size={14} /> {saving ? t("saving") : t("save")}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditMode(false);
                                            setForm({
                                                displayName: user.displayName || "",
                                                phoneNumber: user.phoneNumber || "",
                                                password: user.password || "",
                                            });
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        <X size={14} /> {t("cancel")}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Display Name */}
                            <div>
                                <label className="flex items-center gap-2 text-sm text-[var(--muted)] mb-2">
                                    <User size={14} /> {t("full_name")}
                                </label>
                                {editMode ? (
                                    <input
                                        type="text"
                                        value={form.displayName}
                                        onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                                        className="glass-input w-full p-3 rounded-lg"
                                        placeholder={t("enter_full_name")}
                                    />
                                ) : (
                                    <p className="text-white p-3 bg-white/5 rounded-lg">{form.displayName || t("not_updated")}</p>
                                )}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="flex items-center gap-2 text-sm text-[var(--muted)] mb-2">
                                    <Mail size={14} /> {t("email")}
                                </label>
                                <p className="text-white p-3 bg-white/5 rounded-lg">{user.email}</p>
                                <p className="text-xs text-[var(--muted)] mt-1">{t("email_read_only")}</p>
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="flex items-center gap-2 text-sm text-[var(--muted)] mb-2">
                                    <Phone size={14} /> {t("phone")}
                                </label>
                                {editMode ? (
                                    <input
                                        type="tel"
                                        value={form.phoneNumber}
                                        onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                                        className="glass-input w-full p-3 rounded-lg"
                                        placeholder="0912345678"
                                    />
                                ) : (
                                    <p className="text-white p-3 bg-white/5 rounded-lg">{form.phoneNumber || t("not_updated")}</p>
                                )}
                            </div>

                            {/* Position */}
                            <div>
                                <label className="flex items-center gap-2 text-sm text-[var(--muted)] mb-2">
                                    <Briefcase size={14} /> {t("position")}
                                </label>
                                <p className="text-white p-3 bg-white/5 rounded-lg">{position}</p>
                                <p className="text-xs text-[var(--muted)] mt-1">{t("contact_admin_change")}</p>
                            </div>
                        </div>
                    </div>

                    {/* Security Card */}
                    <div className="glass-card p-6 rounded-xl border border-white/10">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                            <Shield size={18} className="text-green-400" /> {t("security")}
                        </h3>

                        <div>
                            <label className="flex items-center gap-2 text-sm text-[var(--muted)] mb-2">
                                <Key size={14} /> {t("password")}
                            </label>
                            {editMode ? (
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        className="glass-input w-full p-3 rounded-lg pr-12"
                                        placeholder={t("enter_new_password")}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                                    <p className="text-white font-mono flex-1">
                                        {showPassword ? form.password : "••••••••"}
                                    </p>
                                    <button
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-[var(--muted)] hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Account Info Card */}
                    <div className="glass-card p-6 rounded-xl border border-white/10">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                            <Calendar size={18} className="text-yellow-400" /> {t("account_info")}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 rounded-lg">
                                <p className="text-xs text-[var(--muted)] mb-1">User ID</p>
                                <p className="text-white font-mono text-sm break-all">{user.uid || user.id}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                                <p className="text-xs text-[var(--muted)] mb-1">{t("finance_permission")}</p>
                                <p className="text-white">{FINANCE_ROLES[user.financeRole] || t("no_permission_assigned")}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                                <p className="text-xs text-[var(--muted)] mb-1">{t("account_created_date")}</p>
                                <p className="text-white">
                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString("vi-VN", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric"
                                    }) : "N/A"}
                                </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                                <p className="text-xs text-[var(--muted)] mb-1">{t("system_role_label")}</p>
                                <p className="text-white">{role}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
